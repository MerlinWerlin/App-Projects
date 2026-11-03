"""Stream synthetic speech into the SDK emulator's authenticated virtual microphone.

Uses the installed Google emulator_controller.proto, not an app recording override.
Never print or persist the emulator's authentication token.
"""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import struct
import sys
import time
import wave

p = argparse.ArgumentParser()
p.add_argument('--wave', required=True, type=Path)
p.add_argument('--output', required=True, type=Path)
p.add_argument('--modules', required=True)
a = p.parse_args()
sys.path.insert(0, a.modules)
import grpc
import emulator_controller_pb2 as control
import emulator_controller_pb2_grpc as service

bases = {Path('/tmp/android-' + getpass.getuser()), Path('/run/user/' + str(os.getuid()))}
if os.environ.get('XDG_RUNTIME_DIR'):
    bases.add(Path(os.environ['XDG_RUNTIME_DIR']))
if os.environ.get('ANDROID_EMULATOR_HOME'):
    bases.add(Path(os.environ['ANDROID_EMULATOR_HOME']))
discovery = None
for base in bases:
    for directory in [base / 'avd/running', base / 'running']:
        for f in directory.glob('pid*.ini'):
            values = dict(line.split('=', 1) for line in f.read_text().splitlines() if '=' in line)
            values = {k.strip(): v.strip() for k, v in values.items()}
            if values.get('port.serial') == '5554' and values.get('grpc.port') == '8554' and values.get('grpc.token'):
                discovery = values
                break
assert discovery, 'No token-protected local emulator discovery file; refusing unauthenticated fallback'

with wave.open(str(a.wave), 'rb') as w:
    assert w.getnchannels() == 1 and w.getsampwidth() == 2 and w.getframerate() == 44100
    pcm = w.readframes(w.getnframes())
samples = struct.unpack('<' + 'h' * (len(pcm) // 2), pcm)
rms = (sum(v * v for v in samples) / len(samples)) ** .5
assert rms > 100, 'Synthetic speech fixture is silent'
fmt = control.AudioFormat(samplingRate=44100, channels=control.AudioFormat.Mono,
                          format=control.AudioFormat.AUD_FMT_S16,
                          mode=control.AudioFormat.MODE_UNSPECIFIED)
state = dict(status='STARTING', source='SDK gRPC injectAudio into Android virtual microphone',
             authenticated=True, loopback_only=True, fixture_sha256=hashlib.sha256(pcm).hexdigest(),
             fixture_rms_pcm16=rms, packets=0)

def save():
    temp = a.output.with_suffix('.tmp')
    temp.write_text(json.dumps(state, indent=2))
    temp.replace(a.output)

def packets():
    # The SDK's blocking delivery mode provides backpressure when the guest is
    # not reading. No real-time queue overwrites or host capture clock are used.
    offset = 0
    while True:
        chunk = pcm[offset:offset + 1764]
        offset = (offset + len(chunk)) % len(pcm)
        state['packets'] += 1
        yield control.AudioPacket(format=fmt, timestamp=time.time_ns() // 1000, audio=chunk)

channel = grpc.insecure_channel('127.0.0.1:8554')  # Local transport; bearer authentication remains mandatory.
grpc.channel_ready_future(channel).result(timeout=20)
stub = service.EmulatorControllerStub(channel)
call = stub.injectAudio.future(packets(), metadata=(('authorization', 'Bearer ' + discovery['grpc.token']),), timeout=900)
state['status'] = 'STREAMING_REQUEST_ACTIVE'
save()
print('Authenticated SDK virtual-microphone stream started; synthetic mono PCM16/44100Hz', flush=True)
while not call.done():
    time.sleep(1)
    save()
state['status'] = 'RPC_ENDED'
state['rpc_code'] = call.code().name
save()
raise SystemExit(0 if call.code() == grpc.StatusCode.OK else 1)
