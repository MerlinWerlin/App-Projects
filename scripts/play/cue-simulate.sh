#!/usr/bin/env bash
set -euo pipefail
output="$(realpath cue-android-output)"
actual="$(adb shell getconf PAGE_SIZE | tr -d '\r')"
printf '%s\n' "$actual" > "$output/page-size.txt"
[[ "$actual" == "$EXPECTED_PAGE_SIZE" ]]
adb install "$output/cue-play-test.apk" | tee "$output/install.txt"
adb logcat -c
mkdir -p "$output/captures"
trap 'adb logcat -d > "$output/logcat.txt"; adb exec-out screencap -p > "$output/final.png"' EXIT
MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 \
  maestro test --test-output-dir "$output/captures" --debug-output "$output/captures" scripts/play/cue-android-flow.yaml
adb shell am force-stop com.jared797.cue.playtest
adb shell am start -W -n com.jared797.cue.playtest/.MainActivity > "$output/restart.txt"
MAESTRO_CLI_NO_ANALYTICS=1 maestro test --test-output-dir "$output/captures" --debug-output "$output/captures" scripts/play/cue-persistence-flow.yaml
adb logcat -d > "$output/logcat.txt"
if grep -E 'FATAL EXCEPTION|Fatal signal|ReactNativeJS:.*(Error:|Exception)' "$output/logcat.txt"; then exit 1; fi
printf 'Library/edit/prompter and process-restart persistence passed on API35, page size %s. No Play purchase, physical microphone or production signing claim.\n' "$actual" > "$output/result.txt"
