"""Exercise the installed Android app. Synthetic host microphone; no fake app unlocks."""
import json
from pathlib import Path
import subprocess
import sys
import time
import traceback
import uiautomator2 as u2
from backspin_test_scope import assert_backspin_test_package

out = Path(sys.argv[1]); out.mkdir(exist_ok=True)
package = json.loads((out / 'config.json').read_text())['android']['package']
assert_backspin_test_package(package, device=True)
d = u2.connect()
d.jsonrpc.setConfigurator({'waitForIdleTimeout': 0, 'waitForSelectorTimeout': 0})
d.implicitly_wait(15)
steps = []

def check_system_dialog():
    # Emulator launcher startup can ANR while the game itself remains responsive.
    # Dismiss only this named system component; never suppress a Backspin ANR.
    if d(text="Pixel Launcher isn't responding").exists:
        capture('emulator-launcher-anr')
        d(text='Close app').click()
        steps.append('Dismissed emulator Pixel Launcher ANR; evidence retained')
        time.sleep(.5)

def capture(name):
    # API36 can close UIAutomator's screenshot RPC connection. ADB captures the
    # actual display independently, without changing the app or its input state.
    shot = subprocess.run(['adb', 'exec-out', 'screencap', '-p'], check=True,
                          capture_output=True, timeout=20).stdout
    assert shot.startswith(b'\x89PNG\r\n\x1a\n'), 'Device screenshot is not a PNG'
    (out / (name + '.png')).write_bytes(shot)
    try:
        (out / (name + '.xml')).write_text(d.dump_hierarchy(), encoding='utf-8')
    except Exception:
        # XML is supplementary; functional state checks remain mandatory.
        (out / (name + '-xml-error.txt')).write_text(traceback.format_exc())

def find(label):
    for _ in range(7):
        check_system_dialog()
        for selector in [d(description=label), d(text=label)]:
            if selector.exists:
                return selector
        d.swipe_ext('up', scale=0.45)
        time.sleep(.3)
    capture('missing-control')
    raise AssertionError('Missing visible control: ' + label)

def click(label):
    find(label).click()
    steps.append(label)
    time.sleep(.6)

def wait(label, timeout=30):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        check_system_dialog()
        if d(description=label).exists or d(text=label).exists:
            return
        time.sleep(.3)
    capture('missing-state')
    raise AssertionError('Missing state: ' + label)

def record():
    button = find('Hold to record')
    # Hold through actual preparation, then record three seconds of sound.
    # A fixed press duration incorrectly counts cold emulator setup as recording.
    b = button.info['bounds']
    x, y = (b['left'] + b['right']) // 2, (b['top'] + b['bottom']) // 2
    began = time.monotonic()
    d.touch.down(x, y)
    try:
        until = began + 30
        while not (d(descriptionMatches='Recording.*').exists or d(textMatches='Recording.*').exists):
            assert time.monotonic() < until, 'Recorder never entered its recording state'
            time.sleep(.2)
        steps.append('Recorder prepared after %.2fs' % (time.monotonic() - began))
        time.sleep(3)
        capture('recording-%d' % len(steps))
    finally:
        d.touch.up(x, y)
    time.sleep(2)

try:
    d.app_start(package, stop=True)
    wait('Next')
    capture('01-onboarding')
    click('Next'); click('Next'); click("Let's play")
    wait('Allow microphone')
    capture('02-microphone-explanation')
    click('Allow microphone')
    # Android system dialog, not an app permission bypass.
    allow = d(resourceIdMatches='.*:id/permission_allow_foreground_only_button')
    assert allow.exists(timeout=30), 'Android microphone permission dialog did not appear'
    capture('02-android-microphone-permission')
    allow.click()
    wait('Quick play')
    capture('03-home')
    click('Quick play')
    wait('Hold to record')
    capture('04-record-original')
    record()
    wait('Now copy it')
    capture('05-reversed-playback')
    click('Play')
    time.sleep(4)
    click('Now copy it')
    wait('Hold to record')
    record()
    wait('Closeness')
    capture('06-score')
    click('Save take')
    find('✓ Saved to Takes')
    capture('07-saved')
    click('Share clip')
    time.sleep(2)
    capture('08-share-sheet')
    current = d.app_current()
    assert current['package'] == 'com.android.intentresolver' or 'ChooserActivity' in str(current.get('activity')), current
    d.press('back')
    d.app_stop(package)
    d.app_start(package)
    wait('Quick play')
    assert d(description='9 free goes left').exists or d(textContains='9 free goes left').exists, 'Completed round did not persist exactly one consumed free go'
    capture('09-restarted-home-counter')
    click('Takes')
    wait('Saved takes')
    assert not d(text='No takes yet').exists, 'Saved take was lost on process restart'
    capture('09-persisted-takes')
    result = dict(status='PASS', package=package, steps=steps,
                  audio='Synthetic speech routed through host microphone into real Android recording',
                  checked=['onboarding', 'microphone permission', 'record original', 'AAC to PCM',
                           'reverse playback', 'record copy', 'score', 'save', 'share sheet',
                           'free-go consumption', 'process-restart persistence'],
                  device_page_size=int((out / 'device-page-size.txt').read_text()),
                  device_api_level=int((out / 'device-api-level.txt').read_text()),
                  device_memory_kib=int((out / 'device-memory.txt').read_text().split()[1]),
                  not_checked=['human voice quality', 'physical phone routes and interruptions',
                               'Play Billing transaction and restore'])
    (out / 'backspin-gameplay.json').write_text(json.dumps(result, indent=2))
except Exception:
    (out / 'backspin-gameplay-failure.txt').write_text(traceback.format_exc())
    try:
        capture('failure')
    except Exception:
        (out / 'failure-capture-error.txt').write_text(traceback.format_exc())
    raise
