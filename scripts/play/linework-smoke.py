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
hierarchy_device = None


def adb(*args):
    started = time.monotonic()
    record = {'at_utc': datetime.now(timezone.utc).isoformat(), 'args': args}
    try:
        result = subprocess.run(['adb', *args], capture_output=True, timeout=35)
        record.update(returncode=result.returncode, stderr=result.stderr.decode(errors='replace')[-4000:])
        if 'uiautomator' in args:
            record['dump_response'] = result.stdout.decode(errors='replace')[-2000:]
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
    if hierarchy_device is not None:
        started = time.monotonic()
        xml = hierarchy_device.dump_hierarchy().encode('utf-8')
        tree = ET.fromstring(xml)
        assert len(list(tree.iter('node'))) > 0, 'Empty continuous-screen hierarchy'
        (output / (name + '.xml')).write_bytes(xml)
        with (output / 'ui-hierarchies.jsonl').open('a') as journal:
            journal.write(json.dumps({'at_utc': datetime.now(timezone.utc).isoformat(),
                                     'name': name, 'elapsed_seconds': round(time.monotonic()-started, 3),
                                     'nodes': len(list(tree.iter('node')))}) + '\n')
        return tree
    # Never accept a previous screen when an animated screen cannot reach idle.
    adb('shell', 'rm', '-f', '/sdcard/linework.xml')
    response = adb('shell', 'uiautomator', 'dump', '/sdcard/linework.xml')
    assert b'dumped to' in response, 'Fresh UI hierarchy unavailable: ' + response.decode(errors='replace')
    xml = adb('shell', 'cat', '/sdcard/linework.xml')
    (output / (name + '.xml')).write_bytes(xml)
    return ET.fromstring(xml)


def find(pattern, tap=False, attempts=8, scroll=False, direction='down', camera=False):
    for _ in range(attempts):
        if camera:
            # Trace deliberately hides controls after three idle seconds.
            # UIAutomator's idle wait can consume that window, so behave like
            # a user: wake the controls before observing and before tapping.
            adb('shell', 'input', 'tap', '160', '250')
        tree = snapshot()
        for node in tree.iter('node'):
            label = node.get('content-desc') or node.get('text') or ''
            bounds = [int(n) for n in re.findall(r'\d+', node.get('bounds', ''))]
            if re.search(pattern, label) and len(bounds) == 4:
                x1, y1, x2, y2 = bounds
                if x2 <= x1 or y2 <= y1:
                    continue
                if tap:
                    if node.get('enabled') == 'false':
                        continue
                    if camera:
                        adb('shell', 'input', 'tap', '160', '250')
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
    (output / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p'))
    snapshot(name)


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

    # Real native CameraView -> MediaStore path on a disposable virtual camera.
    # Grant only CAMERA; modern photo/audio/video reads stay ungranted.
    import uiautomator2 as u2
    hierarchy_device = u2.connect()
    hierarchy_device.jsonrpc.setConfigurator({'waitForIdleTimeout': 0, 'waitForSelectorTimeout': 0})
    hierarchy_device.settings['max_depth'] = 100
    adb('shell', 'pm', 'grant', package, 'android.permission.CAMERA')
    adb('shell', 'am', 'force-stop', package)
    adb('shell', 'am', 'start', '-W', '-n', package + '/.MainActivity')
    find(r'^Trace a photo$')
    before = adb('shell', 'content', 'query', '--uri', 'content://media/external/video/media',
                 '--projection', '_id:_display_name:_size:duration:mime_type').decode(errors='replace')
    (output / 'video-store-before.txt').write_text(before)
    route('trace?template=cat-sitting')
    adb('shell', 'input', 'tap', '160', '250')  # wake focus-mode controls
    find(r'^Record timelapse$', tap=True, camera=True)
    capture('linework-native-record-requested')
    initial = ET.fromstring((output / 'linework-native-record-requested.xml').read_bytes())
    labels = [n.get('text') or n.get('content-desc') or '' for n in initial.iter('node')]
    if 'The camera is still starting. Try again in a moment.' in labels:
        checks.append('observed explicit camera-starting guard; one bounded warm-up retry')
        time.sleep(3)
        find(r'^Record timelapse$', tap=True, camera=True)
        capture('linework-native-record-requested-retry')
    find(r'^Stop recording$', camera=True)
    # The Stop button exists while the video session is being armed. Count
    # clip time only after the app reports it has reached native recording.
    find(r'^Recording\. Only the camera view is saved, not the overlay\.$', attempts=12, camera=True)
    time.sleep(4)
    adb('shell', 'input', 'tap', '160', '250')
    find(r'^Stop recording$', tap=True, camera=True)
    find(r'^Timelapse ready$', attempts=12)
    capture('linework-native-video-ready')
    find(r'^Save to Photos$', tap=True)
    find(r'^Saved to Photos$', attempts=12)
    capture('linework-native-video-saved')
    after = adb('shell', 'content', 'query', '--uri', 'content://media/external/video/media',
                '--projection', '_id:_display_name:_size:duration:mime_type').decode(errors='replace')
    (output / 'video-store-after.txt').write_text(after)
    before_ids = set(re.findall(r'\b_id=(\d+)', before))
    rows = [dict(re.findall(r'(\w+)=([^,\n]+)', line)) for line in after.splitlines() if '_size=' in line]
    new_videos = [row for row in rows if row['_id'] not in before_ids
                  and int(row['_size']) > 1024 and row.get('mime_type', '').startswith('video/')]
    assert len(new_videos) == 1, 'Expected one new nonempty MediaStore video'
    checks.append('virtual-camera clip records/stops and saves a new nonempty native MediaStore video with CAMERA-only grant')
    ready = ET.parse(output / 'linework-native-video-ready.xml')
    lengths = [re.fullmatch(r'Length (\d+) s', n.get('text', '')) for n in ready.iter('node')]
    displayed_seconds = int(next(m.group(1) for m in lengths if m))
    native_seconds = int(new_videos[0]['duration']) / 1000
    duration_check = {'displayedSeconds': displayed_seconds, 'nativeSeconds': native_seconds,
                      'toleranceSeconds': 2, 'mediaId': new_videos[0]['_id']}
    (output / 'video-duration-verification.json').write_text(json.dumps(duration_check, indent=2) + '\n')
    assert native_seconds > 0 and abs(displayed_seconds-native_seconds) <= 2, duration_check
    checks.append('displayed clip length excludes camera preparation and agrees with native video duration within two seconds')

    # Seed one owned image into the disposable guest, then use the actual
    # system picker and the app's native import/outline path. No app data is
    # injected and no broad photo permission is granted.
    find(r'^Done$', tap=True)
    adb('shell', 'am', 'force-stop', package)
    adb('shell', 'am', 'start', '-W', '-n', package + '/.MainActivity')
    find(r'^Trace a photo$')
    seed = Path('apps/linework/assets/icon.png').resolve()
    adb('shell', 'mkdir', '-p', '/sdcard/Pictures')
    adb('push', str(seed), '/sdcard/Pictures/Linework-QA.png')
    adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE',
        '-d', 'file:///sdcard/Pictures/Linework-QA.png')
    for _ in range(12):
        gallery = adb('shell', 'content', 'query', '--uri', 'content://media/external/images/media',
                      '--projection', '_id:_display_name').decode(errors='replace')
        if 'Linework-QA.png' in gallery:
            break
        time.sleep(0.5)
    (output / 'photo-store-seed.txt').write_text(gallery)
    assert gallery.count('Row:') == 1 and 'Linework-QA.png' in gallery, 'Picker fixture must be the only gallery image'
    find(r'^Trace a photo$', tap=True)
    capture('linework-system-photo-picker')
    selected = False
    for _ in range(12):
        tree = snapshot()
        for n in tree.iter('node'):
            owner = n.get('package', '')
            label = n.get('content-desc') or n.get('text') or ''
            thumbnail = n.get('resource-id', '').endswith('/icon_thumbnail') or re.match(r'^Photo taken on ', label)
            bounds = [int(x) for x in re.findall(r'\d+', n.get('bounds', ''))]
            if ('providers.media' in owner or 'photopicker' in owner) and thumbnail and len(bounds) == 4:
                x1, y1, x2, y2 = bounds
                if x2-x1 > 32 and y2-y1 > 32:
                    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                    selected = True
                    break
        if selected:
            break
        time.sleep(0.7)
    assert selected, 'Seed image not selectable in the actual system photo picker'
    find(r'^Image preview$', attempts=16)
    capture('linework-imported-photo')
    find(r'^Outline$', tap=True, scroll=True)
    find(r'^Outline preview$', attempts=20)
    capture('linework-imported-outline')
    find(r'^Start tracing$', tap=True, attempts=20, scroll=True)
    find(r'^Image to trace$', attempts=16, camera=True)
    capture('linework-imported-outline-trace')
    checks.append('owned PNG selected through Android system picker, imported, converted to an outline and opened in camera tracing without broad photo permission')
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
        'scope': 'Disposable emulator; actual image/page size recorded separately. Virtual camera, native video save, duration and system-picker import of the owned PNG tested when completed; physical camera, personal photos and real Play Billing remain unverified.',
    }, indent=2) + '\n')
