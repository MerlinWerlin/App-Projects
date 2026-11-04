"""Attribute runtime failures to Cue; preserve unrelated emulator failures."""
import json
import hashlib
from pathlib import Path
import re
import sys

PACKAGE = 'com.jared797.cue.playtest'


def inspect(log, final_pids):
    assert final_pids and all(str(pid).isdigit() for pid in final_pids), 'Missing live Cue PID'
    pids = {str(pid) for pid in final_pids}
    package = re.escape(PACKAGE)
    pids.update(re.findall(r'Start proc (\d+):' + package + r'(?=[:/])', log))
    pids.update(re.findall(r'Process: ' + package + r'(?:\:[^,]+)?, PID: (\d+)', log))
    failures, external = [], []
    for line in log.splitlines():
        header = re.match(r'^\d\d-\d\d\s+\S+\s+(\d+)\s+\d+\s+[VDIWEF]\s+\S+\s*:\s*(.*)', line)
        fatal = bool(re.search(r'FATAL EXCEPTION|Fatal signal|ReactNativeJS.*(?:Error:|Exception)', line))
        explicit = bool(re.search(r'ANR in ' + package + r'(?=[:\s,]|$)|>>> ' + package + r'(?=[:\s])', line))
        if explicit or (fatal and header and header[1] in pids):
            failures.append(line)
        elif fatal:
            external.append(line)
    return {'cuePids': sorted(pids, key=int), 'cueFailures': failures,
            'externalFatalEvents': external, 'scope': 'Cue process runtime health; not overall emulator health'}


if __name__ == '__main__':
    output = Path(sys.argv[1])
    log = (output / 'logcat.txt').read_bytes()
    result = inspect(log.decode(errors='replace'),
                     (output / 'app-final-pids.txt').read_text().split())
    result['logcatSha256'] = hashlib.sha256(log).hexdigest()
    (output / 'runtime-health.json').write_text(json.dumps(result, indent=2) + '\n')
    assert not result['cueFailures'], '\n'.join(result['cueFailures'])
    print(f"Cue runtime check passed for {len(result['cuePids'])} PIDs; "
          f"{len(result['externalFatalEvents'])} unrelated events retained")
