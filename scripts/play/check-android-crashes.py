"""Scope Android crash evidence to the tested app; retain the complete log separately."""
import json
from pathlib import Path
import re
import sys


def app_crashes(log, package, pids):
    lines = log.splitlines()
    found = []
    for i, line in enumerate(lines):
        if not re.search(r'FATAL EXCEPTION|Fatal signal|ReactNativeJS:.*(?:Error:|Exception)', line):
            continue
        fields = line.split()
        own_pid = len(fields) > 2 and fields[2] in pids
        context = '\n'.join(lines[i:i + 8])
        own_process = re.search(r'Process: ' + re.escape(package) + r'(?:[:,\s]|$)', context)
        if own_pid or own_process:
            found.append(line)
    return found


if __name__ == '__main__':
    if sys.argv[1:] == ['--self-test']:
        other = '11-03 20:15:42.795 3484 4098 E AndroidRuntime: FATAL EXCEPTION: Blocking Thread\n11-03 20:15:42.795 3484 4098 E AndroidRuntime: Process: com.google.android.googlequicksearchbox:search, PID: 3484'
        assert not app_crashes(other, 'com.jared797.backspin.playtest', {'4518'})
        assert app_crashes(other.replace('com.google.android.googlequicksearchbox:search', 'com.jared797.backspin.playtest'), 'com.jared797.backspin.playtest', {'4518'})
        assert app_crashes('11-03 20:15:42.795 4518 4560 F libc: Fatal signal 11', 'com.jared797.backspin.playtest', {'4518'})
        print('Crash scope: unrelated process excluded; app Java/native crashes detected')
    else:
        log, package, pidfile, output = sys.argv[1:]
        crashes = app_crashes(Path(log).read_text(), package, set(Path(pidfile).read_text().split()))
        Path(output).write_text(json.dumps({'package': package, 'app_crashes': crashes, 'scope': 'Captured launch log and live app process'}, indent=2))
        if crashes:
            raise SystemExit('Tested app crash detected: ' + '\n'.join(crashes))
