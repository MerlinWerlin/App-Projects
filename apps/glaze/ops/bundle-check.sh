#!/bin/sh
# D215-1 (oversight v215): repack, bundle, report base64 size, and guard big images.
# Usage: sh ops/bundle-check.sh <base-commit>   (base = commit of the last published bundle)
# Writes /home/claude/out.bundle and /home/claude/repo.bundle.b64.txt.
# Never rewrites history: repack keeps every commit hash (SHIP_BASE safe).
set -e
BASE="$1"
LIMIT=15600000   # bytes of base64; above this no new/changed PNG/JPG over 100 KB
CAP=16000000
git repack -a -d -f --window=250 --depth=250 -q
git bundle create /home/claude/out.bundle --all 2>/dev/null
base64 -w0 /home/claude/out.bundle > /home/claude/repo.bundle.b64.txt
SIZE=$(wc -c < /home/claude/repo.bundle.b64.txt)
echo "bundle base64 bytes: $SIZE (guard $LIMIT, cap $CAP)"
BIG=""
if [ -n "$BASE" ]; then
  for f in $(git diff --name-only --diff-filter=AM "$BASE" HEAD | grep -iE '\.(png|jpe?g)$' || true); do
    n=$(git cat-file -s "HEAD:$f")
    if [ "$n" -gt 102400 ]; then BIG="$BIG $f($n)"; fi
  done
fi
if [ -n "$BIG" ]; then echo "new/changed images over 100 KB since $BASE:$BIG"; fi
if [ "$SIZE" -gt "$CAP" ]; then echo "FAIL: over the 16 MB artifact cap"; exit 2; fi
if [ "$SIZE" -gt "$LIMIT" ] && [ -n "$BIG" ]; then echo "FAIL: over 15.6 MB with big images; compress or drop them"; exit 3; fi
echo "ok"
