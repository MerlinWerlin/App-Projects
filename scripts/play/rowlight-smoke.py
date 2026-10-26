"""Exercise real APK UI and persistence on a disposable emulator using accessibility labels."""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

output = Path(sys.argv[1])
package = 'com.jared797.rowlight.playtest'

def adb(*args):
    return subprocess.check_output(['adb', *args], timeout=25)

def snapshot(name='rowlight-current.xml'):
    adb('shell', 'uiautomator', 'dump', '/sdcard/rowlight.xml')
    xml = adb('shell', 'cat', '/sdcard/rowlight.xml')
    (output / name).write_bytes(xml)
    return ET.fromstring(xml)

def find(pattern, tap=False):
    for attempt in range(8):
        tree = snapshot()
        for node in tree.iter('node'):
            label = node.get('content-desc') or node.get('text') or ''
            if not re.search(pattern, label):
                continue
            bounds = [int(v) for v in re.findall(r'\d+', node.get('bounds', ''))]
            if len(bounds) != 4 or bounds[2] <= bounds[0] or bounds[3] <= bounds[1]:
                continue
            if tap:
                adb('shell', 'input', 'tap', str((bounds[0] + bounds[2]) // 2), str((bounds[1] + bounds[3]) // 2))
                time.sleep(1)
            return label
        time.sleep(1)
    raise AssertionError(f'UI did not show {pattern}; see rowlight-current.xml')

find(r'^Try a sample amigurumi$', tap=True)
for value in range(1, 4):
    find(rf'^Add one\. Row {value}$', tap=True)
find(r'^Row: 3$')
snapshot('rowlight-before-restart.xml')
time.sleep(2)  # allow the app's persistence queue to settle before killing its process
adb('shell', 'am', 'force-stop', package)
adb('shell', 'am', 'start', '-W', '-n', package + '/.MainActivity')
find(r'^Little Sprout, Row 3,', tap=True)
find(r'^Row: 3$')
snapshot('rowlight-after-restart.xml')
(output / 'rowlight-counter.png').write_bytes(adb('exec-out', 'screencap', '-p'))
(output / 'rowlight-functional.json').write_text(json.dumps({
    'package': package,
    'sampleProjectCreated': True,
    'counterIncrements': 3,
    'counterAfterProcessRestart': 3,
    'scope': 'API 35 emulator; photo/PDF import, billing, TalkBack and real-device testing remain separate',
}, indent=2) + '\n')
print('Rowlight sample project and row count survive process termination and relaunch.')
