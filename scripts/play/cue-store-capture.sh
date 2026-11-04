#!/usr/bin/env bash
set -euo pipefail
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_OPTS="${MAESTRO_OPTS:-} -Xms128m -Xmx768m"
output="$(realpath cue-android-output)"
mkdir -p "$output/captures"
trap 'adb logcat -d -v threadtime > "$output/logcat.txt"; adb exec-out screencap -p > "$output/final.png"' EXIT
[[ "$(adb shell getconf PAGE_SIZE | tr -d '\r')" == '4096' ]]
adb install "$output/cue-play-test.apk" > "$output/install.txt"
adb logcat -c
MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 maestro test --test-output-dir "$output/captures" --debug-output "$output/captures" scripts/play/cue-store-flow.yaml
adb shell wm size > "$output/screenshot-size.txt"
printf 'Captured actual Android UI from source-bound APK. Listing capture only; functional validation is recorded separately.\n' > "$output/store-capture-result.txt"
