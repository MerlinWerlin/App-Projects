"""Compare genuine synthetic-test AAC and decoded WAV files independently of app DSP."""
import array
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys
from backspin_test_scope import assert_backspin_test_package


def statistics(values, rate=44100):
    size = max(1, rate // 50)
    windows = [math.sqrt(sum(x*x for x in values[i:i+size]) / len(values[i:i+size]))
               for i in range(0, len(values), size)]
    threshold = max(.006, max(windows, default=0) * .08)
    active = [i for i, x in enumerate(windows) if x >= threshold]
    return dict(samples=len(values), duration_seconds=len(values)/rate,
                peak=max((abs(x) for x in values), default=0),
                rms=math.sqrt(sum(x*x for x in values)/len(values)) if values else 0,
                active_windows=len(active), total_windows=len(windows),
                active_span_seconds=(active[-1]-active[0]+1)*size/rate if active else 0)


if sys.argv[1:] == ['--self-test']:
    a = statistics([.2*math.sin(2*math.pi*440*i/44100) for i in range(44100)])
    assert abs(a['rms']-.2/math.sqrt(2)) < .00001 and a['active_span_seconds'] >= .99
    b = statistics([0.0]*44100)
    assert b['rms'] == 0 and b['active_windows'] == 0
    print('Independent waveform metrics: known tone and silence PASS')
    raise SystemExit(0)

out = Path(sys.argv[1])
package = json.loads((out/'config.json').read_text())['android']['package']
assert_backspin_test_package(package, device=True)
target = out/'microphone-diagnostics'
target.mkdir()
result = dict(scope='Fresh emulator; synthetic test recordings only', files=[])
try:
    root = subprocess.run(['adb','root'], capture_output=True, text=True, timeout=30)
    result['adbd_root_response'] = root.stdout.strip()
    subprocess.run(['adb','wait-for-device'], check=True, timeout=30)
    remote_root = '/data/user/0/'+package+'/cache'
    paths = subprocess.check_output(['adb','shell','find',remote_root,'-type','f'], timeout=30).decode().splitlines()
    for remote in paths:
        remote = remote.strip()
        if not remote.startswith(remote_root+'/') or not re.search(r'\.(m4a|wav|aac)$', remote):
            continue
        length = int(subprocess.check_output(['adb','shell','stat','-c','%s',remote],timeout=20))
        if length > 20*1024*1024:
            continue
        local = target/('%02d'%len(result['files'])+Path(remote).suffix)
        subprocess.run(['adb','pull',remote,str(local)], check=True, capture_output=True, timeout=30)
        info = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries',
                         'format=duration:stream=codec_name,sample_rate,channels,bit_rate','-of','json',str(local)]))
        raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(local),'-ac','1','-ar','44100','-f','f32le','-'],timeout=30)
        pcm = array.array('f'); pcm.frombytes(raw)
        assert sys.byteorder == 'little'
        result['files'].append(dict(file=local.name, app_cache_path=remote,
                                    sha256=hashlib.sha256(local.read_bytes()).hexdigest(),
                                    bytes=local.stat().st_size, metadata=info, independent_pcm=statistics(pcm)))
    result['status'] = 'CAPTURED' if result['files'] else 'NO_AUDIO_FILES'
except Exception as e:
    result['status'] = 'DIAGNOSTIC_ERROR'
    result['error'] = str(e)
(target/'recording-analysis.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
