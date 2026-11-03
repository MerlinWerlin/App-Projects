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
[[ "$package" == *.playtest || ( "$package" == com.jared797.backspin && "${CI:-}" == 1 && "${BACKSPIN_PRODUCTION_REPLAY:-}" == 1 ) ]]
microphone_source="${BACKSPIN_MICROPHONE_SOURCE:-host-speech}"
case "$microphone_source" in host-speech) ;; hal-tone) [[ "${CI:-}" == 1 && "${APP:-}" == backspin ]];; *) exit 2;; esac
echo "$microphone_source" > "$output/microphone-source.txt"
case "${ANDROID_API_LEVEL:-35}" in 35|36) ;; *) exit 2;; esac
case "${ANDROID_PAGE_SIZE:-4096}" in
  4096) image="system-images;android-${ANDROID_API_LEVEL:-35};google_apis;x86_64";;
  16384) image="system-images;android-${ANDROID_API_LEVEL:-35};google_apis_ps16k;x86_64";;
  *) echo 'Unsupported page size' >&2; exit 2;;
esac
sdkmanager "$image" > "$output/emulator-setup.txt" 2>&1
echo no | avdmanager create avd --name play-smoke --path "$ANDROID_AVD_HOME/play-smoke.avd" --package "$image" --force >> "$output/emulator-setup.txt" 2>&1
python - <<'PY'
from pathlib import Path
import os
p=Path(os.environ['ANDROID_AVD_HOME'])/'play-smoke.avd/config.ini'
values={}
for line in p.read_text().splitlines():
    if '=' in line:
        k,v=line.split('=',1);values[k]=v
profile=os.environ.get('ANDROID_EMULATOR_PROFILE','standard')
assert profile in ('standard','low-load')
width,height,density=('540','960','210') if profile=='low-load' else ('1080','1920','420')
values.update({'hw.audioInput':'yes','hw.audioOutput':'yes','hw.lcd.width':width,'hw.lcd.height':height,'hw.lcd.density':density})
p.write_text(''.join(k+'='+v+'\n' for k,v in values.items()))
PY
"$ANDROID_HOME/emulator/emulator" -list-avds | tee "$output/avds.txt" | grep -qx play-smoke
sudo chmod 666 /dev/kvm
if [[ "${APP:-}" == backspin && "$microphone_source" == host-speech ]]; then
  pulseaudio --start --exit-idle-time=-1
  pactl load-module module-null-sink sink_name=backspin_input > "$output/audio-input-module.txt"
  pactl load-module module-null-sink sink_name=backspin_output > "$output/audio-output-module.txt"
  pactl set-default-source backspin_input.monitor
  export PULSE_SOURCE=backspin_input.monitor PULSE_SINK=backspin_output QEMU_AUDIO_DRV=pa
  # QEMU's bundled PulseAudio client must use the explicit private Unix socket.
  export PULSE_SERVER="unix:$(pactl info | sed -n 's/^Server String: //p')"
  export QEMU_PA_SERVER="$PULSE_SERVER" QEMU_PA_SOURCE="$PULSE_SOURCE" QEMU_PA_SINK="$PULSE_SINK"
  # Speech varies in time and frequency; a constant sine can be removed by
  # Android microphone noise suppression after its initial transient.
  espeak-ng -s 155 -w "$RUNNER_TEMP/backspin-speech.wav" 'A penguin waddles, plip plop. Say the sound, reverse the voice. Backspin recording test.'
  ffmpeg -nostdin -hide_banner -loglevel error -re -stream_loop -1 -i "$RUNNER_TEMP/backspin-speech.wav" -f s16le -ac 1 -ar 44100 - 2>"$output/tone-generator.txt" | pacat --playback --device=backspin_input --raw --latency-msec=20 --format=s16le --rate=44100 --channels=1 2>"$output/tone-playback.txt" &
  pactl info > "$output/host-audio.txt"
  python - "$output" <<'PY'
import subprocess,struct,math,json,sys
from pathlib import Path
p=subprocess.Popen(['parec','--device=backspin_input.monitor','--raw','--latency-msec=20','--format=s16le','--rate=44100','--channels=1'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
    data,error=p.communicate(timeout=5)
except subprocess.TimeoutExpired:
    p.kill();data,error=p.communicate()
Path(sys.argv[1],'host-probe-stderr.txt').write_bytes(error)
values=struct.unpack('<'+'h'*(len(data)//2),data[:len(data)//2*2])
rms=math.sqrt(sum(v*v for v in values)/len(values)) if values else 0
Path(sys.argv[1],'host-microphone-probe.json').write_text(json.dumps({'samples':len(values),'rms_pcm16':rms,'source':'synthetic tone monitor'},indent=2))
assert rms>100, 'Synthetic host microphone is silent before emulator startup'
PY
fi
# Use the GUI-enabled binary under a private virtual display. The SDK's
if [[ "$microphone_source" == hal-tone ]]; then
  # Keep a working host output sink for reverse playback. Input comes explicitly
  # from the emulator HAL fixture, not a claimed physical/host microphone.
  pulseaudio --start --exit-idle-time=-1
  pactl load-module module-null-sink sink_name=backspin_output > "$output/audio-output-module.txt"
  export PULSE_SINK=backspin_output QEMU_AUDIO_DRV=pa
  export PULSE_SERVER="unix:$(pactl info | sed -n 's/^Server String: //p')"
  export QEMU_PA_SERVER="$PULSE_SERVER" QEMU_PA_SINK="$PULSE_SINK"
fi
# Use the GUI-enabled binary under a private virtual display. The SDK's
# headless binary can provide stub PulseAudio calls despite a working host source.
memory=3072
if [[ "${ANDROID_PAGE_SIZE:-4096}" == 16384 ]]; then memory=6144; fi
free -m > "$output/host-memory.txt"
extra_emulator_args=()
if [[ "$microphone_source" == hal-tone ]]; then
  # Official Ranchu HAL test input; app code/guards and permissions are unchanged.
  # https://android.googlesource.com/device/generic/goldfish/+/refs/heads/android14-dev/audio/device_port_source.cpp
  # -prop accepts only qemu.*. The launcher appends -qemu/-append to its
  # existing kernel arguments; verify the resulting Android boot property below.
  extra_emulator_args=(-qemu -append androidboot.audio.tinyalsa.simulate_input=1)
fi
xvfb-run -a -s '-screen 0 1080x1920x24' "$ANDROID_HOME/emulator/emulator" -avd play-smoke -allow-host-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -memory "$memory" "${extra_emulator_args[@]}" > "$output/emulator.txt" 2>&1 &
trap 'adb emu kill || true' EXIT
timeout 180 adb wait-for-device
for i in $(seq 1 90); do
  if [[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]; then break; fi
  sleep 2
done
[[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]
if [[ "${BACKSPIN_PRODUCTION_REPLAY:-}" == 1 ]]; then
  python scripts/play/backspin_test_scope.py "$package"
fi
adb shell getconf PAGE_SIZE | tr -d '\r' > "$output/device-page-size.txt"
[[ "$(cat "$output/device-page-size.txt")" == "${ANDROID_PAGE_SIZE:-4096}" ]]
adb shell getprop ro.build.version.sdk | tr -d '\r' > "$output/device-api-level.txt"
[[ "$(cat "$output/device-api-level.txt")" == "${ANDROID_API_LEVEL:-35}" ]]
adb shell grep MemTotal /proc/meminfo | tr -d '\r' > "$output/device-memory.txt"
adb shell wm size > "$output/device-display.txt"
adb shell wm density >> "$output/device-display.txt"
if [[ "${ANDROID_PAGE_SIZE:-4096}" == 16384 ]]; then
  [[ "$(awk '{print $2}' "$output/device-memory.txt")" -ge 4194304 ]]
fi
if [[ "$microphone_source" == hal-tone ]]; then
  # Some images protect /proc/cmdline from shell. Its diagnostic is optional;
  # the actual boot property and measured 300Hz recording remain mandatory.
  adb shell cat /proc/cmdline > "$output/hal-tone-kernel-cmdline.txt" 2>&1 || true
  adb shell getprop ro.boot.audio.tinyalsa.simulate_input | tr -d '\r' > "$output/hal-tone-property.txt"
  [[ "$(cat "$output/hal-tone-property.txt")" == 1 ]]
fi
if [[ "${APP:-}" == backspin && "$microphone_source" == host-speech ]]; then
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
# Let first-boot Google services settle before adding the app and UI test server.
sleep 20
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
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
python scripts/play/check-android-crashes.py --self-test
python scripts/play/check-android-crashes.py "$output/logcat.txt" "$package" "$output/process.txt" "$output/launch-crash-check.json"
grep -q 'Status: ok' "$output/launch.txt"
if [[ "${APP:-}" == crochet ]]; then
  python scripts/play/rowlight-smoke.py "$output"
fi
if [[ "${APP:-}" == linework ]]; then
  python scripts/play/linework-smoke.py "$output"
fi
printf 'Installed and alive 20 seconds after launch on API %s x86_64. Feature/device QA recorded separately.\n' "$(cat "$output/device-api-level.txt")" > "$output/smoke-result.txt"
if [[ "${APP:-}" == backspin ]]; then
  # Capture the complete gameplay log even if a later assertion fails.
  gameplay_status=0
  python scripts/play/backspin-smoke.py "$output" || gameplay_status=$?
  adb logcat -d > "$output/gameplay-logcat.txt"
  if [[ "$microphone_source" == host-speech ]]; then
    pactl list source-outputs > "$output/gameplay-audio-clients.txt"
  fi
  adb shell dumpsys media.audio_flinger > "$output/gameplay-audio-flinger.txt"
  adb shell dumpsys media.audio_policy > "$output/gameplay-audio-policy.txt"
  python scripts/play/inspect-backspin-recordings.py --self-test
  python scripts/play/inspect-backspin-recordings.py "$output"
  microphone_status=0
  python scripts/play/qualify-backspin-microphone.py --self-test
  python scripts/play/qualify-backspin-microphone.py "$output" || microphone_status=$?
  # Decoder instrumentation is independent evidence, not a substitute gameplay pass.
  if [[ "${BACKSPIN_PRODUCTION_REPLAY:-}" == 1 ]]; then
    echo 'Not rerun in production bundle replay; full native recording/conversion is exercised above. Separate decoder instrumentation evidence is retained in the source build.' > "$output/pcm-instrumentation.txt"
  else
    (cd apps/backspin/android && ./gradlew :backspin-pcm:connectedDebugAndroidTest --no-daemon --max-workers=2 -PreactNativeArchitectures=x86_64 -Dorg.gradle.jvmargs=-Xmx3g) 2>&1 | tee "$output/pcm-instrumentation.txt"
  fi
  [[ "$gameplay_status" == 0 ]]
  [[ "$microphone_status" == 0 ]]
fi
