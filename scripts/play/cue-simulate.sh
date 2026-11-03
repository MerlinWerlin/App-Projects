#!/usr/bin/env bash
set -euo pipefail
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_OPTS="${MAESTRO_OPTS:-} -Xms128m -Xmx768m"
output="$(realpath cue-android-output)"
mkdir -p "$output/captures"
capture_diagnostics() {
  adb devices -l > "$output/adb-devices-final.txt" 2>&1 || true
  adb logcat -d > "$output/logcat.txt" 2>&1 || true
  adb exec-out screencap -p > "$output/final.png" 2>/dev/null || true
  free -m > "$output/host-memory.txt" || true
  ps -eo pid,ppid,rss,args --sort=-rss | head -n 20 > "$output/host-processes.txt" || true
  sudo dmesg -T | tail -n 160 > "$output/host-kernel.txt" || true
}
trap capture_diagnostics EXIT
maestro --version > "$output/maestro-version.txt"
adb version > "$output/adb-version.txt"
actual="$(adb shell getconf PAGE_SIZE | tr -d '\r')"
printf '%s\n' "$actual" > "$output/page-size.txt"
[[ "$actual" == "$EXPECTED_PAGE_SIZE" ]]
adb install "$output/cue-play-test.apk" | tee "$output/install.txt"
adb logcat -c
MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 \
  maestro test --test-output-dir "$output/captures" --debug-output "$output/captures" scripts/play/cue-release-flow.yaml
printf 'Process restart verified by stopApp then persistence subflow launchApp; see Maestro commands.json.\n' > "$output/restart.txt"
for attempt in $(seq 1 10); do
  adb shell content query --uri content://media/external/video/media --projection duration:width:height > "$output/saved-video.txt"
  if python scripts/play/verify_cue_video.py "$output/saved-video.txt"; then break; fi
  sleep 1
done
python scripts/play/verify_cue_video.py "$output/saved-video.txt"
adb logcat -d > "$output/logcat.txt"
if grep -E 'FATAL EXCEPTION|Fatal signal|ReactNativeJS:.*(Error:|Exception)' "$output/logcat.txt"; then exit 1; fi
printf 'Library/edit/prompter/script persistence, Android trial persistence, permission-denial recovery and synthetic-camera video save passed on API35, page size %s. No Play purchase, physical microphone or production signing claim.\n' "$actual" > "$output/result.txt"
