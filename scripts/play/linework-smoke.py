"""Exercise the installed Linework test APK on a disposable emulator.

No store purchases or production credentials. Deep links test actual native
screens; they do not establish photo-picker, physical-camera or billing QA.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

output = Path(sys.argv[1])
package = sys.argv[2] if len(sys.argv) > 2 else 'com.jared797.linework.playtest'
scheme = sys.argv[3] if len(sys.argv) > 3 else 'linework-play-test'
assert (package, scheme) in [('com.jared797.linework.playtest', 'linework-play-test'),
                            ('com.jared797.linework', 'linework')]
checks = []


def adb(*args):
    started = time.monotonic()
    record = {'at_utc': datetime.now(timezone.utc).isoformat(), 'args': args}
    try:
        result = subprocess.run(['adb', *args], capture_output=True, timeout=35)
        record.update(returncode=result.returncode, stderr=result.stderr.decode(errors='replace')[-4000:])
        result.check_returncode()
        return result.stdout
    except subprocess.TimeoutExpired:
        record['timeout_seconds'] = 35
        raise
    finally:
        record['elapsed_seconds'] = round(time.monotonic() - started, 3)
        with (output / 'adb-commands.jsonl').open('a') as journal:
            journal.write(json.dumps(record) + '\n')


def snapshot(name='linework-current'):
    adb('shell', 'uiautomator', 'dump', '/sdcard/linework.xml')
    xml = adb('shell', 'cat', '/sdcard/linework.xml')
    (output / (name + '.xml')).write_bytes(xml)
    return ET.fromstring(xml)


def find(pattern, tap=False, attempts=8, scroll=False, direction='down'):
    for _ in range(attempts):
        tree = snapshot()
        for node in tree.iter('node'):
            label = node.get('content-desc') or node.get('text') or ''
            bounds = [int(n) for n in re.findall(r'\d+', node.get('bounds', ''))]
            if re.search(pattern, label) and len(bounds) == 4:
                x1, y1, x2, y2 = bounds
                if x2 <= x1 or y2 <= y1:
                    continue
                if tap:
                    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                    time.sleep(0.8)
                return label
        if scroll:
            size = re.search(r'(\d+)x(\d+)', adb('shell', 'wm', 'size').decode())
            w, h = map(int, size.groups())
            start, end = (h//3, h*4//5) if direction == 'up' else (h*4//5, h//3)
            adb('shell', 'input', 'swipe', str(w//2), str(start), str(w//2), str(end), '350')
        time.sleep(0.7)
    raise AssertionError('Missing UI: ' + pattern)


def capture(name):
    snapshot(name)
    (output / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p'))


def route(path):
    adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
        '-d', scheme + '://' + path, package)
    time.sleep(1)


try:
    find(r'^Skip the setup guide$', tap=True)
    find(r'^Trace a photo$')
    capture('linework-home')
    checks.append('onboarding dismissed; real home renders')

    route('trace?template=cat-sitting')
    find(r'^Camera needed to trace$')
    find(r'^Allow camera$', tap=True)
    find(r"^(Don't allow|Don’t allow|Deny)$", tap=True)
    find(r'^Use Lightbox instead$', tap=True)
    find(r'^Sitting cat template on lightbox$')
    capture('linework-lightbox-template')
    checks.append('camera denied through Android prompt; Lightbox fallback displays template')

    find(r'^Lock image in place$', tap=True)
    find(r'^Unlock image$')
    capture('linework-lightbox-locked')
    checks.append('Lightbox lock changes to unlock state')
    find(r'^Unlock image$', tap=True)
    find(r'^Lock image in place$')
    find(r'^Reset image size and position$', tap=True)
    find(r'^Exit lightbox$', tap=True)
    checks.append('Lightbox unlock, reset and exit remain accessible')

    adb('shell', 'am', 'force-stop', package)
    adb('shell', 'am', 'start', '-W', '-n', package + '/.MainActivity')
    find(r'^Trace a photo$')
    labels = [n.get('content-desc') or n.get('text') for n in snapshot().iter('node')]
    assert 'Skip the setup guide' not in labels
    capture('linework-restarted')
    checks.append('onboarding dismissal survives process restart')

    route('lightbox')
    find(r'^No image to show$')
    find(r'^Go back$', tap=True)
    checks.append('empty Lightbox gives a recoverable no-image state')
    route('plus')
    find(r'^Start free trial$', tap=True, scroll=True)
    find(r'^Free trial: 14 days left$', scroll=True, direction='up')
    capture('linework-android-trial')
    checks.append('Android local trial starts without Apple product; exact 14-day status visible; no purchase performed')
    adb('shell', 'am', 'force-stop', package)
    adb('shell', 'am', 'start', '-W', '-n', package + '/.MainActivity')
    # am start -W waits for the Activity, not the JS router's initial Home
    # render. Sending the deep link earlier can be replaced by that startup.
    find(r'^Trace a photo$')
    route('plus')
    find(r'^Free trial: 14 days left$', scroll=True, direction='up')
    capture('linework-android-trial-restarted')
    checks.append('Android local trial retains 14-day status after process restart')
    result = 'PASS'
except Exception as error:
    result = 'FAIL'
    try:
        capture('linework-failure')
    except Exception:
        pass
    raise
finally:
    (output / 'linework-functional.json').write_text(json.dumps({
        'status': result,
        'package': package,
        'checks': checks,
        'scope': 'API35 emulator, test APK; physical camera, photo import, timelapse, billing and 16KB runtime remain unverified',
    }, indent=2) + '\n')
