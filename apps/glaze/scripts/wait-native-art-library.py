"""Observe the original app's art commit in an isolated simulator without writing its data."""
import json
import os
from pathlib import Path
import plistlib
import sys
import time

assert os.environ.get('GITHUB_ACTIONS') == 'true'
device = sys.argv[1]
base = Path.home() / 'Library/Developer/CoreSimulator/Devices' / device / 'data/Containers/Shared/AppGroup'
expected = {f't-alpine-starlight-{art}-{size}' for art in [
    'copper-eclipse', 'jupiter-polar', 'saturn-rings', 'silver-moon', 'spiral-galaxy'
] for size in ['small', 'medium', 'large']}
deadline = time.monotonic() + 100
while time.monotonic() < deadline:
    for directory in base.glob('*'):
        try:
            metadata = plistlib.loads((directory / '.com.apple.mobile_container_manager.metadata.plist').read_bytes())
            if metadata.get('MCMMetadataIdentifier') != 'group.com.jared797.glaze':
                continue
            art = directory / 'widget-art'
            index = json.loads((art / 'index.json').read_text())
            actual = {p['id'] for p in index.get('pieces', []) if (art / (p['id'] + '.jpg')).is_file()}
            if index.get('currentThemeId') == 'alpine-starlight' and expected <= actual:
                print('GLAZE_ALPINE_NATIVE_COMMIT_OBSERVED', len(actual))
                sys.exit(0)
        except (OSError, ValueError, KeyError, plistlib.InvalidFileException):
            pass
    time.sleep(1)
raise SystemExit('The production app did not commit all 15 original Alpine art variants')
