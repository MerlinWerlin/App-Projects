"""Read the real simulator app's recovery marker; never create or alter app state."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

assert os.environ.get('GITHUB_ACTIONS') == 'true'
device, report_path = sys.argv[1:3]
expected_key = sys.argv[3] if len(sys.argv) > 3 else 'glaze.widgetArt.recovered106.v1'
deadline = time.monotonic() + 120
while time.monotonic() < deadline:
    result = subprocess.run(
        ['xcrun', 'simctl', 'get_app_container', device, 'com.jared797.glaze', 'data'],
        capture_output=True, text=True, check=True,
    )
    manifest = Path(result.stdout.strip()) / 'Library/Application Support/com.jared797.glaze/RCTAsyncLocalStorage_V1/manifest.json'
    try:
        values = json.loads(manifest.read_text())
        if values.get(expected_key) == 'complete':
            report = Path(report_path)
            report.parent.mkdir(parents=True, exist_ok=True)
            report.write_text(json.dumps({
                'recoveryCompleteObserved': True, 'appDataModifiedByHarness': False,
                'key': expected_key,
            }, indent=2))
            print('GLAZE_ALREADY_RECOVERED_INSTALLATION_OBSERVED')
            sys.exit(0)
    except (OSError, ValueError):
        pass
    time.sleep(1)
raise SystemExit('The installed predecessor did not finish its real one-time art recovery')
