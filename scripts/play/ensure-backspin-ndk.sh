#!/usr/bin/env bash
# Fail before emulator QA if the pinned native toolchain cannot be installed.
set -euo pipefail
version=27.1.12297006
ndk="$ANDROID_HOME/ndk/$version"
mkdir -p apk-output
ready() {
  [[ -f "$ndk/source.properties" && -x "$ndk/toolchains/llvm/prebuilt/linux-x86_64/bin/clang" ]] &&
    grep -Eq "^Pkg.Revision[[:space:]]*=[[:space:]]*$version$" "$ndk/source.properties"
}
for attempt in 1 2; do
  if ready; then
    cp "$ndk/source.properties" apk-output/ndk-source-properties.txt
    "$ndk/toolchains/llvm/prebuilt/linux-x86_64/bin/clang" --version > apk-output/ndk-clang-version.txt
    exit 0
  fi
  # Preserve each failed download/install log. SDK Manager verifies its package.
  sdkmanager --install "ndk;$version" > "apk-output/ndk-install-$attempt.txt" 2>&1 || true
done
if ready; then
  cp "$ndk/source.properties" apk-output/ndk-source-properties.txt
  "$ndk/toolchains/llvm/prebuilt/linux-x86_64/bin/clang" --version > apk-output/ndk-clang-version.txt
else
  echo 'Pinned Android NDK is unavailable after two attempts; no emulator/app result is inferred.' >&2
  exit 1
fi
