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
if [[ "$package" != *.playtest ]]; then
  # Only the explicit Linework production-bundle job may test a store identity
  # on this disposable emulator. Never accept arbitrary production packages.
  [[ "${APP:-}" == linework && "${LINEWORK_PRODUCTION_QA:-}" == 1 && "$package" == com.jared797.linework ]]
  python -c 'import json,sys; c=json.load(open(sys.argv[1])); assert c["extra"]["playVariant"]=="production" and c["updates"]["enabled"] is False' "$output/config.json"
fi
system_image='system-images;android-35;google_apis;x86_64'
expected_pages=4096
guest_memory=2048
if [[ "${APP:-}" == linework ]]; then
  # Use current target-API images for qualification. The retained API35
  # images showed transport/system-server failures unrelated to app asserts.
  system_image='system-images;android-36;google_apis;x86_64'
  guest_memory=4096
  case "${LINEWORK_PAGE_SIZE:-4k}" in
    4k) ;;
    16k) system_image='system-images;android-36;google_apis_ps16k;x86_64'; expected_pages=16384; guest_memory=4096 ;;
    *) exit 2 ;;
  esac
fi
printf '%s\n' "$system_image" > "$output/system-image.txt"
sdkmanager "$system_image" > "$output/emulator-setup.txt" 2>&1
echo no | avdmanager create avd --name play-smoke --path "$ANDROID_AVD_HOME/play-smoke.avd" --package "$system_image" --force >> "$output/emulator-setup.txt" 2>&1
"$ANDROID_HOME/emulator/emulator" -list-avds | tee "$output/avds.txt" | grep -qx play-smoke
sudo chmod 666 /dev/kvm
gpu_args=(-gpu swiftshader_indirect)
if [[ "${APP:-}" == linework ]]; then
  # Current emulator guidance deprecates *_indirect. Keep this change scoped
  # to Linework until its evidence is reviewed; do not restart a failed guest.
  gpu_args=(-gpu swiftshader -feature -Vulkan -cores 2 -no-metrics)
fi
"$ANDROID_HOME/emulator/emulator" -avd play-smoke -no-window -no-audio -no-boot-anim -no-snapshot "${gpu_args[@]}" -memory "$guest_memory" > "$output/emulator.txt" 2>&1 &
emulator_pid=$!
diagnostics() {
  result=$?
  trap - EXIT
  if [[ "${APP:-}" == linework ]]; then
    # Keep native camera/media diagnostics from the complete functional run,
    # including app restarts; the earlier launch-only log cannot cover them.
    timeout 15 adb logcat -d > "$output/runtime-logcat.txt" 2> "$output/runtime-logcat-stderr.txt" || true
    {
      date -u --iso-8601=seconds
      printf 'script_exit=%s emulator_pid=%s\n' "$result" "$emulator_pid"
      ps -p "$emulator_pid" -o pid,ppid,stat,etime,rss,args || true
      timeout 10 adb devices -l || true
      timeout 10 adb get-state || true
      timeout 10 adb shell cat /proc/meminfo > "$output/guest-meminfo.txt" 2>&1 || true
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
if [[ "${APP:-}" == linework ]]; then
  adb shell getprop ro.build.version.sdk | tr -d '\r' > "$output/emulator-api-level.txt"
  adb shell getconf PAGE_SIZE | tr -d '\r' > "$output/emulator-page-size.txt"
  [[ "$(cat "$output/emulator-page-size.txt")" == "$expected_pages" ]]
fi
adb shell input keyevent 82
adb install "$apk" | tee "$output/install.txt"
adb logcat -c
adb shell am start -W -n "$package/.MainActivity" | tee "$output/launch.txt"
if [[ "${APP:-}" == linework ]]; then
  adb shell pidof "$package" | tr -d '\r' > "$output/launch-process.txt"
  [[ "$(cat "$output/launch-process.txt")" =~ ^[0-9]+$ ]]
fi
sleep 20
# Preserve crash evidence even when the process already exited.
adb logcat -d > "$output/logcat.txt" 2> "$output/logcat-stderr.txt"
adb exec-out screencap -p > "$output/launch.png"
adb shell pidof "$package" | tr -d '\r' > "$output/process.txt"
# Some apps keep animating, so UIAutomator cannot reach idle. A screenshot and
# live process still establish launch; XML is supplementary except in Rowlight's functional test.
adb shell uiautomator dump /sdcard/window.xml > "$output/ui-dump.txt" 2>&1 || true
adb pull /sdcard/window.xml "$output/window.xml" >> "$output/ui-dump.txt" 2>&1 || true
crash_log="$output/logcat.txt"
if [[ "${APP:-}" == linework ]]; then
  [[ "$(cat "$output/launch-process.txt")" == "$(cat "$output/process.txt")" ]]
  awk -v pid="$(cat "$output/process.txt")" '$3 == pid' "$output/logcat.txt" > "$output/app-logcat.txt"
  [[ -s "$output/app-logcat.txt" ]]
  crash_log="$output/app-logcat.txt"
fi
if grep -E 'FATAL EXCEPTION|Fatal signal|ReactNativeJS:.*(Error:|Exception)' "$crash_log"; then
  exit 1
fi
grep -q 'Status: ok' "$output/launch.txt"
if [[ "${APP:-}" == crochet ]]; then
  python scripts/play/rowlight-smoke.py "$output"
fi
if [[ "${APP:-}" == linework ]]; then
  python -m pip install 'uiautomator2==3.4.2' > "$output/ui-driver-install.txt" 2>&1
  scheme=$(python -c 'import json,sys; print(json.load(open(sys.argv[1]))["scheme"])' "$output/config.json")
  python scripts/play/linework-smoke.py "$output" "$package" "$scheme"
fi
printf 'Installed and alive 20 seconds after launch on %s. Completed feature checks are recorded separately; physical-device QA still required.\n' "$system_image" > "$output/smoke-result.txt"
if [[ "${APP:-}" == backspin ]]; then
  (cd apps/backspin/android && ./gradlew :backspin-pcm:connectedDebugAndroidTest --no-daemon --max-workers=2 -PreactNativeArchitectures=x86_64 -Dorg.gradle.jvmargs=-Xmx3g) 2>&1 | tee "$output/pcm-instrumentation.txt"
fi
