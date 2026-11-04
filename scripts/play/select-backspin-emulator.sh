#!/usr/bin/env bash
# Ephemeral CI host only. Keep the current SDK default and offer one pinned control.
set -euo pipefail
mkdir -p apk-output
case "${EMULATOR_VERSION:-sdk-current}" in
  sdk-current) ;;
  36.6.11)
    # Official archive and SHA256, checked 4 Nov 2026:
    # https://developer.android.com/studio/emulator_archive
    zip="$RUNNER_TEMP/emulator-linux_x64-15507667.zip"
    curl --fail --location --retry 2 --output "$zip" https://redirector.gvt1.com/edgedl/android/repository/emulator-linux_x64-15507667.zip
    printf '%s  %s\n' 1eade4cf2df6ea8eeead4902c635897ba12aaa32aac4389eaae0fdb498a5b830 "$zip" | sha256sum --check
    # Follow Google's manual-install instructions; retain the original SDK tool.
    test ! -e "$ANDROID_HOME/emulator_original"
    mv "$ANDROID_HOME/emulator" "$ANDROID_HOME/emulator_original"
    unzip -q "$zip" -d "$ANDROID_HOME"
    cp "$ANDROID_HOME/emulator_original/package.xml" "$ANDROID_HOME/emulator/package.xml"
    python - <<'PY'
import os
from pathlib import Path
import xml.etree.ElementTree as ET
p=Path(os.environ['ANDROID_HOME'])/'emulator/package.xml'
tree=ET.parse(p)
revisions=[e for e in tree.iter() if e.tag.split('}')[-1]=='revision']
assert len(revisions)==1
for name,value in [('major','36'),('minor','6'),('micro','11')]:
    field=next(e for e in revisions[0] if e.tag.split('}')[-1]==name)
    field.text=value
tree.write(p,encoding='utf-8',xml_declaration=True)
PY
    ;;
  *) echo 'Unsupported emulator version' >&2; exit 2 ;;
esac
"$ANDROID_HOME/emulator/emulator" -version > apk-output/host-emulator-version.txt 2>&1
if [[ "${EMULATOR_VERSION:-sdk-current}" == 36.6.11 ]]; then
  grep -q '36.6.11' apk-output/host-emulator-version.txt
fi
cat apk-output/host-emulator-version.txt
