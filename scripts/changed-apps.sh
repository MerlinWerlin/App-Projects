#!/usr/bin/env bash
# Prints a JSON array of app folders whose RELEASE.json changed in the last commit (the merged pull request).
set -euo pipefail
base="${1:-HEAD~1}"
apps=$(git diff --name-only "$base" HEAD | grep -E '^apps/[^/]+/RELEASE\.json$' | cut -d/ -f2 | sort -u || true)
if [ -z "$apps" ]; then echo '[]'; exit 0; fi
printf '%s\n' $apps | jq -R . | jq -s -c .
