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
"$ANDROID_HOME/emulator/emulator" -list-avds | tee "$output/avds.txt" | grep -qx play-smoke
sudo chmod 666 /dev/kvm
gpu_args=(-gpu swiftshader_indirect)
if [[ "${APP:-}" == linework ]]; then
  # Current emulator guidance deprecates *_indirect. Keep this change scoped
  # to Linework until its evidence is reviewed; do not restart a failed guest.
  gpu_args=(-gpu swiftshader -feature -Vulkan -cores 2 -no-metrics)
fi
"$ANDROID_HOME/emulator/emulator" -avd play-smoke -no-window -no-audio -no-boot-anim -no-snapshot "${gpu_args[@]}" -memory 2048 > "$output/emulator.txt" 2>&1 &
emulator_pid=$!
diagnostics() {
  result=$?
  trap - EXIT
  if [[ "${APP:-}" == linework ]]; then
    {
      date -u --iso-8601=seconds
      printf 'script_exit=%s emulator_pid=%s\n' "$result" "$emulator_pid"
      ps -p "$emulator_pid" -o pid,ppid,stat,etime,rss,args || true
      timeout 10 adb devices -l || true
      timeout 10 adb get-state || true
      free -m
      df -h "$RUNNER_TEMP"
      dmesg -T 2>&1 | tail -60 || true
    } > "$output/emulator-health.txt" 2>&1
  fi
  timeout 10 adb emu kill || true
  exit "$result"
}
trap diagnostics EXIT
timeout 180 adb wait-for-device
for i in $(seq 1 90); do
  if [[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]; then break; fi
  sleep 2
done
[[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]
adb shell input keyevent 82
adb install "$apk" | tee "$output/install.txt"
adb logcat -c
adb shell am start -W -n "$package/.MainActivity" | tee "$output/launch.txt"
sleep 20
# Preserve crash evidence even when the process already exited.
adb logcat -d > "$output/logcat.txt" 2> "$output/logcat-stderr.txt"
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
  (cd apps/backspin/android && ./gradlew :backspin-pcm:connectedDebugAndroidTest --no-daemon --max-workers=2 -PreactNativeArchitectures=x86_64 -Dorg.gradle.jvmargs=-Xmx3g) 2>&1 | tee "$output/pcm-instrumentation.txt"
fi
