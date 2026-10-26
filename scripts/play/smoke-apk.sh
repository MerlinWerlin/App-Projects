#!/usr/bin/env bash
# CI-only Android install/launch evidence. No store or production credentials.
set -euo pipefail
apk=$(realpath "$1")
output=$(realpath "$2")
package=$(python -c 'import json,sys; print(json.load(open(sys.argv[1]))["android"]["package"])' "$output/config.json")
[[ "$package" == *.playtest ]]
sdkmanager 'system-images;android-35;google_apis;x86_64' > "$output/emulator-setup.txt" 2>&1
echo no | avdmanager create avd --name play-smoke --package 'system-images;android-35;google_apis;x86_64' --force >> "$output/emulator-setup.txt" 2>&1
sudo chmod 666 /dev/kvm
"$ANDROID_HOME/emulator/emulator" -avd play-smoke -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -memory 2048 > "$output/emulator.txt" 2>&1 &
trap 'adb emu kill || true' EXIT
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
adb shell pidof "$package" > "$output/process.txt"
adb logcat -d > "$output/logcat.txt"
adb exec-out screencap -p > "$output/launch.png"
adb shell uiautomator dump /sdcard/window.xml
adb pull /sdcard/window.xml "$output/window.xml"
if grep -E 'FATAL EXCEPTION|Fatal signal|ReactNativeJS:.*(Error:|Exception)' "$output/logcat.txt"; then
  exit 1
fi
grep -q 'Status: ok' "$output/launch.txt"
printf 'Installed and alive 20 seconds after launch on API 35 x86_64. Feature/device QA still required.\n' > "$output/smoke-result.txt"
