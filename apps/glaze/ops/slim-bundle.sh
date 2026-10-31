#!/bin/sh
# T195 (owner-1101 item 11): repo-space plan, step 2 ("the swap"). See docs/REPO_SPACE.md.
#
# Builds a SLIM repo bundle: one new root commit whose tree is exactly HEAD's tree, so the next
# run restores the same files with ~half the bytes (the full history stays in the archive file
# history/repo-full-<date>.bundle.b64.txt on the build page, published BEFORE any swap).
#
# Run it ONLY after the overseer has said go (oversight directive) and auto-ship can re-pin
# App-Projects apps/glaze/SHIP_BASE.txt to the new root hash printed below, because every commit
# hash changes. Without that, auto-ship cannot find its SHIP_BASE commit.
#
# Usage: sh ops/slim-bundle.sh <archive file name>   (writes /home/claude/slim.bundle and
#        /home/claude/repo.bundle.b64.txt; prints the old tip, the new root and the size)
set -e
cd "$(dirname "$0")/.." || exit 1
ARCHIVE="${1:?archive file name, e.g. history/repo-full-2026-11-01.bundle.b64.txt}"
OLD=$(git rev-parse HEAD)
NEW=$(git commit-tree "HEAD^{tree}" -m "Glaze repo snapshot of $OLD (full history before this point: $ARCHIVE on the build page)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>")
git branch -f slim-main "$NEW"
# Name the branch main inside the bundle (the run prompt restores with git checkout main).
rm -rf /home/claude/slim-repo && git init -q /home/claude/slim-repo
git -C /home/claude/slim-repo fetch -q "$(pwd)" slim-main:main
git branch -D -q slim-main
git -C /home/claude/slim-repo bundle create /home/claude/slim.bundle main >/dev/null 2>&1
rm -rf /home/claude/slim-repo
base64 -w0 /home/claude/slim.bundle > /home/claude/repo.bundle.b64.txt
# Check: the slim bundle restores to the identical tree.
rm -rf /home/claude/slim-check
git clone -q -b main /home/claude/slim.bundle /home/claude/slim-check
[ "$(git -C /home/claude/slim-check rev-parse 'HEAD^{tree}')" = "$(git rev-parse 'HEAD^{tree}')" ] || { echo "TREE MISMATCH: do not publish"; exit 1; }
rm -rf /home/claude/slim-check
echo "old tip:  $OLD"
echo "new root: $NEW   (SHIP_BASE must be re-pinned to this; its tree equals the old tip's)"
echo "base64 bytes: $(wc -c < /home/claude/repo.bundle.b64.txt)"
