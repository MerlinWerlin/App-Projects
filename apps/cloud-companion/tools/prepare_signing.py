"""Use existing repository signing credentials; never print or publish them."""
import importlib.util
import json
import os
from pathlib import Path

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
