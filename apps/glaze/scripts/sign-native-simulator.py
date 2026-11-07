"""CI-only simulator signing with Glaze's existing Expo-held Apple certificate.

Read-only credential query; creates no Apple/Expo records and uploads nothing. Secrets stay
in an ephemeral keychain outside artifact paths. Simulator entitlement metadata is aligned
with the real team, without modifying any renderer or other compiled source.
"""
import base64
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shlex
import struct
import subprocess
import sys
import urllib.request

assert os.environ.get('GITHUB_ACTIONS') == 'true'
root = Path(os.environ['RUNNER_TEMP']).resolve() / 'glaze-simulator-signing'
state_path = root / 'private-state.json'

def run(args, private=False):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        if not private:
            print(result.stderr.decode(errors='replace')[-1800:])
        raise RuntimeError('Simulator signing command failed: ' + Path(args[0]).name)
    return result.stdout, result.stderr

def setup():
    root.mkdir(mode=0o700)
    config = json.loads((Path(__file__).resolve().parents[1] / 'app.json').read_text())['expo']
    full_name = '@' + config['owner'] + '/' + config['slug']
    query = '''query($name: String!) { app { byFullName(fullName: $name) {
      iosAppCredentials { appleTeam { appleTeamIdentifier }
        iosAppBuildCredentialsList { iosDistributionType distributionCertificate {
          certificateP12 certificatePassword validityNotAfter
        } } }
    } } }'''
    request = urllib.request.Request('https://api.expo.dev/graphql',
        data=json.dumps({'query': query, 'variables': {'name': full_name}}).encode(),
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + os.environ['EXPO_TOKEN']})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = json.load(response)
    if data.get('errors'):
        raise RuntimeError('Read-only Expo simulator-signing credential query failed')
    selected = None
    for credential in data['data']['app']['byFullName']['iosAppCredentials']:
        for build in credential['iosAppBuildCredentialsList']:
            cert = build.get('distributionCertificate')
            if build['iosDistributionType'] == 'APP_STORE' and cert and cert.get('certificateP12'):
                expiry = datetime.fromisoformat(cert['validityNotAfter'].replace('Z', '+00:00'))
                if expiry > datetime.now(timezone.utc):
                    selected = (credential['appleTeam']['appleTeamIdentifier'], cert)
                    break
    if not selected:
        raise RuntimeError('No existing valid Glaze signing certificate is available')
    team, cert = selected
    assert re.fullmatch('[A-Z0-9]{10}', team) and team != 'GLAZETEST0'
    p12 = root / 'certificate.p12'
    p12.write_bytes(base64.b64decode(cert['certificateP12'])); p12.chmod(0o600)
    password = cert['certificatePassword'] or ''
    keychain_password = secrets.token_urlsafe(32)
    keychain = root / 'simulator.keychain-db'
    prior = shlex.split(run(['security', 'list-keychains', '-d', 'user'])[0].decode())
    # Store cleanup information before commands that might fail; no secret file is an artifact.
    state = {'team': team, 'keychain': str(keychain), 'password': keychain_password, 'prior': prior}
    state_path.write_text(json.dumps(state)); state_path.chmod(0o600)
    run(['security', 'create-keychain', '-p', keychain_password, str(keychain)], private=True)
    run(['security', 'set-keychain-settings', '-lut', '21600', str(keychain)], private=True)
    run(['security', 'unlock-keychain', '-p', keychain_password, str(keychain)], private=True)
    run(['security', 'import', str(p12), '-k', str(keychain), '-P', password,
        '-T', '/usr/bin/codesign', '-T', '/usr/bin/security'], private=True)
    run(['security', 'set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:',
        '-s', '-k', keychain_password, str(keychain)], private=True)
    run(['security', 'list-keychains', '-d', 'user', '-s', str(keychain), *prior], private=True)
    identities = run(['security', 'find-identity', '-v', '-p', 'codesigning', str(keychain)])[0].decode()
    identity = re.search(r'\b([A-F0-9]{40})\b', identities)
    if not identity:
        raise RuntimeError('Existing certificate did not import as a valid code-signing identity')
    state['identity'] = identity.group(1)
    state_path.write_text(json.dumps(state)); state_path.chmod(0o600)
    p12.unlink()
    print('GLAZE_EXISTING_APPLE_IDENTITY_READY_FOR_SIMULATOR')

def align_embedded_entitlements(executable, team):
    data = bytearray(executable.read_bytes())
    magic = bytes(data[:4])
    if magic == b'\xca\xfe\xba\xbe':
        count = struct.unpack_from('>I', data, 4)[0]
        offsets = [struct.unpack_from('>IIIII', data, 8 + i * 20)[2] for i in range(count)]
    elif magic == b'\xcf\xfa\xed\xfe':
        offsets = [0]
    else:
        raise RuntimeError('Unexpected simulator Mach-O format')
    sections = []
    for offset in offsets:
        assert bytes(data[offset:offset + 4]) == b'\xcf\xfa\xed\xfe'
        commands = struct.unpack_from('<I', data, offset + 16)[0]
        cursor = offset + 32
        for _ in range(commands):
            command, length = struct.unpack_from('<II', data, cursor)
            if command == 0x19:  # LC_SEGMENT_64
                count = struct.unpack_from('<I', data, cursor + 64)[0]
                for index in range(count):
                    section = cursor + 72 + index * 80
                    name = bytes(data[section:section + 16]).split(b'\0')[0]
                    if name not in [b'__entitlements', b'__ents_der']:
                        continue
                    size = struct.unpack_from('<Q', data, section + 40)[0]
                    start = offset + struct.unpack_from('<I', data, section + 48)[0]
                    old = bytes(data[start:start + size])
                    changed = old.replace(b'GLAZETEST0', team.encode())
                    assert len(changed) == len(old)
                    data[start:start + size] = changed
                    sections.append({'name': name.decode(), 'replacements': old.count(b'GLAZETEST0')})
            cursor += length
    assert sections and all(section['replacements'] >= 2 for section in sections)
    executable.write_bytes(data)
    return sections

def sign(app, report):
    app = app.resolve()
    assert app.is_relative_to(Path(os.environ['RUNNER_TEMP']).resolve()) and app.suffix == '.app'
    state = json.loads(state_path.read_text())
    team = state['team']
    # Seal frameworks before their containing app. The original simulator resources stay intact.
    for item in sorted((app / 'Frameworks').glob('*')):
        run(['codesign', '--force', '--sign', state['identity'], '--keychain', state['keychain'], str(item)])
    rows = []
    for bundle in [app / 'PlugIns/GlazeWidgets.appex', app]:
        info = plistlib.loads((bundle / 'Info.plist').read_bytes())
        identifier = info['CFBundleIdentifier']
        assert identifier in ['com.jared797.glaze', 'com.jared797.glaze.widget']
        sections = align_embedded_entitlements(bundle / info['CFBundleExecutable'], team)
        entitlements = {'application-identifier': team + '.' + identifier,
            'com.apple.developer.team-identifier': team,
            'com.apple.security.application-groups': ['group.com.jared797.glaze'], 'get-task-allow': True}
        path = root / (identifier + '.plist')
        path.write_bytes(plistlib.dumps(entitlements))
        run(['codesign', '--force', '--sign', state['identity'], '--keychain', state['keychain'],
            '--entitlements', str(path), '--generate-entitlement-der', str(bundle)])
        _, description = run(['codesign', '-dvv', str(bundle)])
        assert ('TeamIdentifier=' + team) in description.decode()
        signed, _ = run(['codesign', '--display', '--entitlements', ':-', str(bundle)])
        parsed = plistlib.loads(signed)
        assert parsed['com.apple.developer.team-identifier'] == team
        assert parsed['com.apple.security.application-groups'] == ['group.com.jared797.glaze']
        rows.append({'bundleId': identifier, 'team': team, 'version': info['CFBundleShortVersionString'],
            'build': info['CFBundleVersion'], 'embeddedSimulatorEntitlementSections': sections,
            'realAppleSignature': True, 'groupEntitlementVerified': True})
    run(['codesign', '--verify', '--deep', '--strict', str(app)])
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({'simulatorOnly': True, 'createdCertificate': False,
        'uploadedToApple': False, 'bundles': rows}, indent=2))
    print('GLAZE_SIMULATOR_REAL_TEAM_SIGNATURE_VERIFIED', rows[0]['version'], rows[0]['build'])

def cleanup():
    if state_path.exists():
        state = json.loads(state_path.read_text())
        run(['security', 'list-keychains', '-d', 'user', '-s', *state['prior']], private=True)
        subprocess.run(['security', 'delete-keychain', state['keychain']], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if root.exists():
        for path in root.iterdir():
            if path.is_file():
                path.unlink()
        root.rmdir()
    print('GLAZE_SIMULATOR_SIGNING_KEYCHAIN_REMOVED')

command = sys.argv[1]
if command == 'setup':
    setup()
elif command == 'sign':
    sign(Path(sys.argv[2]), Path(sys.argv[3]))
elif command == 'cleanup':
    cleanup()
else:
    raise SystemExit('Expected setup, sign or cleanup')
