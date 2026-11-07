"""Give archived simulator apps the increasing build identities used by TestFlight.

The reusable simulator artifacts otherwise all have build 1. Only Info.plist build numbers
change; app/extension executable hashes must remain identical. No app data is touched.
"""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import sys

assert os.environ.get('GITHUB_ACTIONS') == 'true'
app = Path(sys.argv[1]).resolve()
assert app.is_relative_to(Path(os.environ['RUNNER_TEMP']).resolve())
report = Path(sys.argv[2])
builds = {'1.0.4': '33', '1.0.6': '37', '1.0.12': '49', '1.0.13': '51'}
rows = []
for bundle in [app, app / 'PlugIns/GlazeWidgets.appex']:
    path = bundle / 'Info.plist'
    info = plistlib.loads(path.read_bytes())
    version = info['CFBundleShortVersionString']
    build = builds[version]
    executable = bundle / info['CFBundleExecutable']
    before = hashlib.sha256(executable.read_bytes()).hexdigest()
    old_build = info['CFBundleVersion']
    info['CFBundleVersion'] = build
    path.write_bytes(plistlib.dumps(info, fmt=plistlib.FMT_BINARY))
    after = hashlib.sha256(executable.read_bytes()).hexdigest()
    assert before == after
    rows.append({'bundleId': info['CFBundleIdentifier'], 'version': version,
        'archiveBuild': old_build, 'installBuild': build, 'executableSHA256': after,
        'executableUnchanged': True})
assert rows[0]['version'] == rows[1]['version'] and rows[0]['installBuild'] == rows[1]['installBuild']
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps({'simulatorMetadataOnly': True, 'appDataChanged': False,
    'candidateBuild51IsStagedUntilSignedRelease': rows[0]['version'] == '1.0.13', 'bundles': rows}, indent=2))
print('GLAZE_SIMULATOR_RELEASE_IDENTITY', rows[0]['version'], rows[0]['installBuild'])
