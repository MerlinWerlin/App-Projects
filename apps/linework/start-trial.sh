#!/bin/sh
# Linework trial kit for macOS/Linux: same steps as START_TRIAL.cmd. See docs/TRIAL.md.
# Install output is also saved to trial-log.txt next to this script.
cd "$(dirname "$0")" || exit 1
LOG="$(pwd)/trial-log.txt"
echo "Linework trial log, $(date)" > "$LOG"
command -v node >/dev/null 2>&1 || { echo "Install Node.js LTS from https://nodejs.org then run this again." | tee -a "$LOG"; exit 1; }
echo "node $(node -v)" >> "$LOG"
[ -f package.json ] || { echo "This build has no app code yet."; exit 1; }

# logged CMD...: show output, append it to trial-log.txt, keep the exit code.
logged() {
  printf '\n> %s\n' "$*" >> "$LOG"
  { "$@" 2>&1; echo $? > .trial-status; } | tee -a "$LOG"
  s=$(cat .trial-status); rm -f .trial-status
  return "$s"
}

fail() { echo "Something went wrong. Paste trial-log.txt into a comment on the Linework Build page."; exit 1; }

logged npm install || fail
logged npx expo install expo@latest || echo "Expo update failed - continuing with the current version. See trial-log.txt."
logged npx expo install expo-blur expo-linear-gradient || echo "Blur module install failed - the app falls back to solid bars. See trial-log.txt."
logged npx expo install --fix
echo "Checking the app code for errors (a quick check; the app still starts if it finds some)..."
logged npx tsc --noEmit || echo "The code check found errors. Please paste trial-log.txt into a comment on the Linework Build page, then carry on testing."
echo "If anything is red, paste trial-log.txt and these messages into a comment on the Linework Build page."
printf '\n> npx expo start --go --tunnel (interactive; output stays in the terminal)\n' >> "$LOG"
npx expo start --go --tunnel
