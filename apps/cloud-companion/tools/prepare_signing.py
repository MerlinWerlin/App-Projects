"""Use existing repository signing credentials; never print or publish them."""
import importlib.util
import json
import os
import base64
import plistlib
import secrets
import subprocess
import requests
import yaml
from pathlib import Path

def main():
    repo = Path(__file__).resolve().parents[3]
    spec = importlib.util.spec_from_file_location('factory_asc', repo / 'scripts/asc/asc.py')
    asc = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(asc)
    try:
        apps = asc.get('/v1/apps', **{'filter[bundleId]': 'com.jared797.cloudcompanion', 'limit': 5})['data']
    except RuntimeError as error:
        if '401' not in str(error): raise
        asc.KEY_KIND = 'individual'
        apps = asc.get('/v1/apps', **{'filter[bundleId]': 'com.jared797.cloudcompanion', 'limit': 5})['data']

    key = Path(os.environ['RUNNER_TEMP']) / f'AuthKey_{asc.KID()}.p8'
    key.write_text(asc.key_pem()); key.chmod(0o600)
    team = os.environ.get('APPLE_TEAM_ID', '').strip()
    if not team: raise RuntimeError('Existing APPLE_TEAM_ID repository secret is unavailable')
    with open(os.environ['GITHUB_ENV'], 'a') as env:
        env.write(f'CLOUD_KEY_PATH={key}\nCLOUD_KEY_ID={asc.KID()}\nCLOUD_ISSUER_ID={asc.ISS()}\nCLOUD_TEAM_ID={team}\n')
    Path('output').mkdir(exist_ok=True)
    Path('output/signing-preflight.json').write_text(json.dumps({
        'existing_api_key_authenticated': True, 'app_record_exists': bool(apps),
        'asc_app_id': apps[0]['id'] if apps else None,
        'new_keys_created': False, 'certificate_revocation_requested': False}, indent=2)+'\n')
    print('Existing App Store Connect key authenticated; credentials prepared privately on the runner.')
    print('App Store Connect app record: ' + ('present' if apps else 'not present; distribution may require creating it'))

    # Reuse the same existing distribution certificate as the factory's Expo builds.
    # Field names match Expo's own AppleDistributionCertificate GraphQL fragment.
    query = '''query($n: String!) { app { byFullName(fullName: $n) { iosAppCredentials {
     appleTeam { appleTeamIdentifier }
     iosAppBuildCredentialsList { iosDistributionType distributionCertificate {
    certificateP12 certificatePassword serialNumber appleTeam { appleTeamIdentifier } } } } } } }'''
    response = requests.post('https://api.expo.dev/graphql', headers={'Authorization':'Bearer '+os.environ['EXPO_TOKEN']},
                             json={'query':query,'variables':{'n':'@jared797/backspin'}}, timeout=45)
    response.raise_for_status()
    payload = response.json()
    if payload.get('errors'): raise RuntimeError('Expo could not supply the existing distribution signing material')
    reference = None
    reference_app = payload.get('data', {}).get('app', {}).get('byFullName')
    if not reference_app: raise RuntimeError('The existing reference Expo app could not be read')
    for credentials in reference_app['iosAppCredentials']:
        for build in credentials['iosAppBuildCredentialsList']:
            cert = build.get('distributionCertificate')
            if build['iosDistributionType'] == 'APP_STORE' and cert and cert.get('certificateP12'):
                reference = (credentials, cert); break
        if reference: break
    if not reference: raise RuntimeError('The reference app has no reusable App Store certificate')
    credentials, certificate = reference
    reference_team = credentials.get('appleTeam') or certificate.get('appleTeam')
    if reference_team:
        assert reference_team['appleTeamIdentifier'] == team, 'Existing distribution certificate belongs to another team'
    directory = Path(os.environ['RUNNER_TEMP']) / 'cloud-private-signing'
    directory.mkdir(mode=0o700, exist_ok=True)
    p12 = directory/'distribution.p12'; p12.write_bytes(base64.b64decode(certificate['certificateP12'])); p12.chmod(0o600)
    password = secrets.token_hex(24)
    keychain = directory/'cloud.keychain-db'
    def security(*arguments):
        result = subprocess.run(['security',*map(str,arguments)], capture_output=True)
        if result.returncode: raise RuntimeError('Private runner keychain setup failed; no signing material was printed')
        return result.stdout
    security('create-keychain','-p',password,keychain)
    security('set-keychain-settings','-lut','21600',keychain)
    security('unlock-keychain','-p',password,keychain)
    security('import',p12,'-k',keychain,'-P',certificate['certificatePassword'],'-T','/usr/bin/codesign','-T','/usr/bin/security')
    security('set-key-partition-list','-S','apple-tool:,apple:,codesign:','-s','-k',password,keychain)
    security('list-keychains','-d','user','-s',keychain,Path.home()/'Library/Keychains/login.keychain-db')
    certificates = asc.get('/v1/certificates',limit=200)['data']
    matching = [c for c in certificates if c['attributes'].get('serialNumber','').upper() == certificate['serialNumber'].upper()]
    if len(matching)!=1: raise RuntimeError('Existing Expo certificate did not match exactly one Apple certificate')
    project = yaml.safe_load(Path('project.yml').read_text())
    profiles = {}
    receipts = []
    for target, bid in [('CloudCompanion','com.jared797.cloudcompanion'),('CloudCompanionWidget','com.jared797.cloudcompanion.widget')]:
        ids = asc.get('/v1/bundleIds',**{'filter[identifier]':bid,'limit':5})['data']
        ids = [x for x in ids if x['attributes']['identifier']==bid]
        if len(ids)!=1: raise RuntimeError('Expected the app identifier registered by the first Xcode provisioning attempt')
        name = target+' App Store CI '+str(os.environ['CLOUD_BUILD_NUMBER'])
        existing = asc.get('/v1/profiles',**{'filter[name]':name,'limit':10})['data']
        existing = [p for p in existing if p['attributes']['profileState']=='ACTIVE']
        profile = existing[0] if existing else asc.call('POST','/v1/profiles',{'data':{'type':'profiles',
          'attributes':{'name':name,'profileType':'IOS_APP_STORE'},'relationships':{
            'bundleId':{'data':{'type':'bundleIds','id':ids[0]['id']}},
            'certificates':{'data':[{'type':'certificates','id':matching[0]['id']}]}}}})['data']
        attrs = profile['attributes']
        provision = directory/(target+'.mobileprovision'); provision.write_bytes(base64.b64decode(attrs['profileContent']))
        decoded = plistlib.loads(security('cms','-D','-i',provision))
        entitlements = decoded['Entitlements']
        assert entitlements.get('com.apple.developer.weatherkit') is True, 'WeatherKit is absent from the generated profile'
        assert 'group.com.jared797.cloudcompanion' in entitlements.get('com.apple.security.application-groups',[]), 'Shared App Group is absent from the generated profile'
        profile_dir = Path.home()/'Library/MobileDevice/Provisioning Profiles'; profile_dir.mkdir(parents=True,exist_ok=True)
        (profile_dir/(attrs['uuid']+'.mobileprovision')).write_bytes(provision.read_bytes())
        settings = project['targets'][target]['settings']['base']
        settings.update({'CODE_SIGN_STYLE':'Manual','DEVELOPMENT_TEAM':team,'CODE_SIGN_IDENTITY':'Apple Distribution',
                         'PROVISIONING_PROFILE_SPECIFIER':name})
        profiles[bid] = name
        receipts.append({'target':target,'weatherkit':True,'app_group':True,'profile_type':'IOS_APP_STORE','certificate_reused':True})
    Path('project-signing.yml').write_text(yaml.safe_dump(project,sort_keys=False))
    (directory/'profiles.json').write_text(json.dumps(profiles))
    with open(os.environ['GITHUB_ENV'],'a') as env: env.write(f'CLOUD_PROFILES_PATH={directory / "profiles.json"}\n')
    Path('output/profile-capabilities.json').write_text(json.dumps(receipts,indent=2)+'\n')
    print('App Store profiles verified for both targets; WeatherKit and the shared App Group are present.')


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        detail = str(error)[:700]
        for name in ["ASC_KEY_ID", "ASC_ISSUER_ID", "APPLE_TEAM_ID", "EXPO_TOKEN"]:
            value = os.environ.get(name)
            if value: detail = detail.replace(value, "[redacted]")
        Path("output").mkdir(exist_ok=True)
        Path("output/signing-error.json").write_text(json.dumps({"type":type(error).__name__,"detail":detail},indent=2)+"\n")
        raise SystemExit("Signing preparation stopped; sanitized detail is in signing-error.json")
