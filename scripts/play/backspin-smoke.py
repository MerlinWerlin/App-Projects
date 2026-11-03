"""Exercise the installed Android app. Synthetic host microphone; no fake app unlocks."""
import json
from pathlib import Path
import subprocess
import sys
import time
import traceback
import uiautomator2 as u2

out = Path(sys.argv[1]); out.mkdir(exist_ok=True)
package = json.loads((out / 'config.json').read_text())['android']['package']
assert package == 'com.jared797.backspin.playtest'
d = u2.connect()
d.jsonrpc.setConfigurator({'waitForIdleTimeout': 0, 'waitForSelectorTimeout': 0})
d.implicitly_wait(15)
steps = []

def capture(name):
    d.screenshot(str(out / (name + '.png')))
    (out / (name + '.xml')).write_text(d.dump_hierarchy(), encoding='utf-8')

def find(label):
    for _ in range(7):
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
        if d(description=label).exists or d(text=label).exists:
            return
        time.sleep(.3)
    capture('missing-state')
    raise AssertionError('Missing state: ' + label)

def record():
    button = find('Hold to record')
    # Real press-in/out invokes the shipping recorder, AAC decoder and DSP.
    button.long_click(duration=3)
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
    for rid in ['com.android.permissioncontroller:id/permission_allow_foreground_only_button',
                'com.android.permissioncontroller:id/permission_allow_one_time_button']:
        if d(resourceId=rid).exists(timeout=3):
            d(resourceId=rid).click()
            break
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
    wait('✓ Saved to Takes')
    capture('07-saved')
    click('Share clip')
    time.sleep(2)
    capture('08-share-sheet')
    current = d.app_current()
    assert current['package'] != package, current
    d.press('back')
    d.app_stop(package)
    d.app_start(package)
    wait('Quick play')
    assert not d(text='10 free goes left').exists, 'Completed round did not consume a free go'
    click('Takes')
    wait('Saved takes')
    assert not d(text='No takes yet').exists, 'Saved take was lost on process restart'
    capture('09-persisted-takes')
    result = dict(status='PASS', package=package, steps=steps,
                  audio='Synthetic tone routed through host microphone into real Android recording',
                  checked=['onboarding', 'microphone permission', 'record original', 'AAC to PCM',
                           'reverse playback', 'record copy', 'score', 'save', 'share sheet',
                           'free-go consumption', 'process-restart persistence'],
                  not_checked=['human voice quality', 'physical phone routes and interruptions',
                               'Play Billing transaction and restore', '16 KB runtime'])
    (out / 'backspin-gameplay.json').write_text(json.dumps(result, indent=2))
except Exception:
    capture('failure')
    (out / 'backspin-gameplay-failure.txt').write_text(traceback.format_exc())
    raise
