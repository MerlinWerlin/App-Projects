"""Read-only production iOS delivery probe; validates the served manifest and bundle hash.

Usage: python scripts/verify-update.py [expected-update-group]
Protocol: https://docs.expo.dev/technical-specs/expo-updates-1/
This proves server delivery eligibility, not uptake on a physical phone.
"""
import base64
import email.parser
import email.policy
import hashlib
import json
import sys
import urllib.request

PROJECT = '2f10e62c-2086-4e7d-9437-649fc240e82d'
headers = {
    'expo-protocol-version': '1', 'expo-platform': 'ios',
    'expo-runtime-version': '0.1.0', 'expo-channel-name': 'production',
    'accept': 'application/expo+json, application/json, multipart/mixed',
    'User-Agent': 'Hollowhue-release-verification/1.0',
}
with urllib.request.urlopen(urllib.request.Request(f'https://u.expo.dev/{PROJECT}', headers=headers), timeout=45) as response:
    raw, content_type = response.read(), response.headers['Content-Type']
extensions = {}
if content_type.startswith('multipart/'):
    message = email.parser.BytesParser(policy=email.policy.default).parsebytes(
        f'Content-Type: {content_type}\r\n\r\n'.encode() + raw)
    manifests = [json.loads(p.get_payload(decode=True)) for p in message.iter_parts()
                 if p.get_param('name', header='Content-Disposition') == 'manifest']
    if len(manifests) != 1:
        raise SystemExit('Expected one production manifest; got a directive or an empty response')
    manifest = manifests[0]
    for part in message.iter_parts():
        if part.get_param('name', header='Content-Disposition') == 'extensions':
            extensions = json.loads(part.get_payload(decode=True))
else:
    manifest = json.loads(raw)
assert manifest['runtimeVersion'] == '0.1.0', 'Incompatible runtime'
assert manifest['extra']['eas']['projectId'] == PROJECT, 'Wrong Expo project'
group = manifest['metadata']['updateGroup']
assert manifest['metadata']['branchName'] == 'production', 'Wrong branch'
if len(sys.argv) > 1:
    assert group == sys.argv[1], f'Expected group {sys.argv[1]}, got {group}'
asset = manifest['launchAsset']
assert asset['url'].startswith('https://'), 'Bundle must use HTTPS'
# EAS supplies short-lived per-asset request headers in the protocol extensions.
# Keep them in memory only; never include authorization values in receipts or logs.
asset_headers = {**extensions.get('assetRequestHeaders', {}).get(asset['key'], {}), 'User-Agent': headers['User-Agent']}
with urllib.request.urlopen(urllib.request.Request(asset['url'], headers=asset_headers), timeout=60) as response:
    bundle = response.read()
actual = base64.urlsafe_b64encode(hashlib.sha256(bundle).digest()).decode().rstrip('=')
assert actual == asset['hash'], 'Downloaded bundle hash differs from manifest'
print(json.dumps({'project': PROJECT, 'platform': 'ios', 'runtime': '0.1.0',
                  'channel': 'production', 'group': group, 'update': manifest['id'],
                  'createdAt': manifest['createdAt'], 'bundleBytes': len(bundle),
                  'bundleSha256': hashlib.sha256(bundle).hexdigest(),
                  'bundleHashMatches': True, 'phoneUptakeVerified': False}, indent=2))
