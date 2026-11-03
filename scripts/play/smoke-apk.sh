#!/usr/bin/env bash
# CI-only Android install/launch evidence. No store or production credentials.
set -euo pipefail
# setup-android selects current command-line tools; do not shadow them with a runner's older 'latest' directory.
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export ANDROID_USER_HOME="$RUNNER_TEMP/play-android-user"
export ANDROID_EMULATOR_HOME="$ANDROID_USER_HOME"
export ANDROID_AVD_HOME="$RUNNER_TEMP/play-avd"
mkdir -p "$ANDROID_USER_HOME" "$ANDROID_AVD_HOME"
apk=$(realpath "$1")
output=$(realpath "$2")
package=$(python -c 'import json,sys; print(json.load(open(sys.argv[1]))["android"]["package"])' "$output/config.json")
[[ "$package" == *.playtest ]]
sdkmanager 'system-images;android-35;google_apis;x86_64' > "$output/emulator-setup.txt" 2>&1
echo no | avdmanager create avd --name play-smoke --path "$ANDROID_AVD_HOME/play-smoke.avd" --package 'system-images;android-35;google_apis;x86_64' --force >> "$output/emulator-setup.txt" 2>&1
python - <<'PY'
from pathlib import Path
import os
p=Path(os.environ['ANDROID_AVD_HOME'])/'play-smoke.avd/config.ini'
values={}
for line in p.read_text().splitlines():
    if '=' in line:
        k,v=line.split('=',1);values[k]=v
values.update({'hw.audioInput':'yes','hw.audioOutput':'yes','hw.lcd.width':'1080','hw.lcd.height':'1920','hw.lcd.density':'420'})
p.write_text(''.join(k+'='+v+'\n' for k,v in values.items()))
PY
"$ANDROID_HOME/emulator/emulator" -list-avds | tee "$output/avds.txt" | grep -qx play-smoke
sudo chmod 666 /dev/kvm
if [[ "${APP:-}" == backspin ]]; then
  pulseaudio --start --exit-idle-time=-1
  pactl load-module module-null-sink sink_name=backspin_input > "$output/audio-input-module.txt"
  pactl load-module module-null-sink sink_name=backspin_output > "$output/audio-output-module.txt"
  pactl set-default-source backspin_input.monitor
  export PULSE_SOURCE=backspin_input.monitor PULSE_SINK=backspin_output QEMU_AUDIO_DRV=pa
  # QEMU's bundled PulseAudio client must use the explicit private Unix socket.
  export PULSE_SERVER="unix:$(pactl info | sed -n 's/^Server String: //p')"
  export QEMU_PA_SERVER="$PULSE_SERVER" QEMU_PA_SOURCE="$PULSE_SOURCE" QEMU_PA_SINK="$PULSE_SINK"
  ffmpeg -hide_banner -loglevel error -re -f lavfi -i 'sine=frequency=440:sample_rate=44100' -f s16le -ac 1 -ar 44100 - | pacat --playback --device=backspin_input --raw --format=s16le --rate=44100 --channels=1 &
  pactl info > "$output/host-audio.txt"
  python - "$output" <<'PY'
import subprocess,struct,math,json,sys
from pathlib import Path
p=subprocess.Popen(['parec','--device=backspin_input.monitor','--raw','--format=s16le','--rate=44100','--channels=1'],stdout=subprocess.PIPE)
try:
    data,_=p.communicate(timeout=2)
except subprocess.TimeoutExpired:
    p.kill();data,_=p.communicate()
values=struct.unpack('<'+'h'*(len(data)//2),data[:len(data)//2*2])
rms=math.sqrt(sum(v*v for v in values)/len(values)) if values else 0
Path(sys.argv[1],'host-microphone-probe.json').write_text(json.dumps({'samples':len(values),'rms_pcm16':rms,'source':'synthetic tone monitor'},indent=2))
assert rms>100, 'Synthetic host microphone is silent before emulator startup'
PY
fi
"$ANDROID_HOME/emulator/emulator" -avd play-smoke -no-window -allow-host-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -memory 3072 > "$output/emulator.txt" 2>&1 &
trap 'adb emu kill || true' EXIT
timeout 180 adb wait-for-device
for i in $(seq 1 90); do
  if [[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]; then break; fi
  sleep 2
done
[[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]
if [[ "${APP:-}" == backspin ]]; then
  adb emu avd hostmicon | tee "$output/emulator-microphone.txt"
  grep -q OK "$output/emulator-microphone.txt"
  if grep -q 'Could not init.*audio driver' "$output/emulator.txt"; then
    pactl list short sources > "$output/host-sources.txt"
    pactl list short source-outputs > "$output/host-source-outputs.txt"
    echo 'Emulator audio backend failed; refusing to label silent audio as app behavior.' >&2
    exit 1
  fi
fi
adb shell input keyevent 82
adb install "$apk" | tee "$output/install.txt"
adb logcat -c
adb shell am start -W -n "$package/.MainActivity" | tee "$output/launch.txt"
sleep 20
# Preserve crash evidence even when the process already exited.
adb logcat -d > "$output/logcat.txt"
adb exec-out screencap -p > "$output/launch.png"
adb shell pidof "$package" > "$output/process.txt"
# Some apps keep animating, so UIAutomator cannot reach idle. A screenshot and
# live process still establish launch; XML is supplementary except in Rowlight's functional test.
adb shell uiautomator dump /sdcard/window.xml > "$output/ui-dump.txt" 2>&1 || true
adb pull /sdcard/window.xml "$output/window.xml" >> "$output/ui-dump.txt" 2>&1 || true
if grep -E 'FATAL EXCEPTION|Fatal signal|ReactNativeJS:.*(Error:|Exception)' "$output/logcat.txt"; then
  exit 1
fi
grep -q 'Status: ok' "$output/launch.txt"
if [[ "${APP:-}" == crochet ]]; then
  python scripts/play/rowlight-smoke.py "$output"
fi
if [[ "${APP:-}" == linework ]]; then
  python scripts/play/linework-smoke.py "$output"
fi
printf 'Installed and alive 20 seconds after launch on API 35 x86_64. Feature/device QA still required.\n' > "$output/smoke-result.txt"
if [[ "${APP:-}" == backspin ]]; then
  python scripts/play/backspin-smoke.py "$output"
  (cd apps/backspin/android && ./gradlew :backspin-pcm:connectedDebugAndroidTest --no-daemon --max-workers=2 -PreactNativeArchitectures=x86_64 -Dorg.gradle.jvmargs=-Xmx3g) 2>&1 | tee "$output/pcm-instrumentation.txt"
fi
