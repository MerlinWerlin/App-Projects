#!/bin/sh
# Glaze trial kit for macOS/Linux: same steps as START_TRIAL.cmd. See docs/TRIAL.md.
# Install and version-fix output is also written to trial-log.txt next to this file.
cd "$(dirname "$0")" || exit 1
LOG=trial-log.txt
echo "Glaze trial $(date)" > "$LOG"
[ -f KIT_VERSION.txt ] && { cat KIT_VERSION.txt | tee -a "$LOG"; echo "Check the commit above matches the Trial kit line on the Glaze Build page."; }
command -v node >/dev/null 2>&1 || { echo "Install Node.js LTS from https://nodejs.org then run this again." | tee -a "$LOG"; exit 1; }
[ -f package.json ] || { echo "This build has no app code yet."; exit 1; }
echo "node $(node -v)" >> "$LOG"
logged() { echo "--- $*" >> "$LOG"; { "$@" 2>&1; echo "exit $?" > .trial-status; } | tee -a "$LOG"; return "$(cut -d' ' -f2 .trial-status)"; }
logged npm install || { echo "Install failed: paste trial-log.txt into a Glaze Build page comment."; exit 1; }
logged npx expo install expo@latest
logged npx expo install expo-blur expo-linear-gradient
logged npx expo install --fix
rm -f .trial-status
echo "--- expo start --go --tunnel (output shown in the terminal only)" >> "$LOG"
npx expo start --go --tunnel
