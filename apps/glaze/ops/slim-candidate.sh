#!/bin/sh
# D223-1 / T195: build the SLIM CANDIDATE bundle without touching the live repo.bundle.b64.txt.
#
# Root commit = the tree of the commit App-Projects apps/glaze/SHIP_BASE.txt pins today (so the
# re-pinned SHIP_BASE ships an identical tree), then every later first-parent commit on main is
# replayed on top with its own tree, message and author (merges become plain commits whose tree
# is the merge result). Writes:
#   /home/claude/repo-slim-candidate.bundle.b64.txt   (publish as history/repo-slim-candidate.bundle.b64.txt)
#   /home/claude/REPO_MAP.json                        (publish as docs/REPO_MAP.json; old id -> new id)
# Usage: sh ops/slim-candidate.sh <SHIP_BASE commit id>
set -e
cd "$(dirname "$0")/.." || exit 1
BASE=$(git rev-parse "${1:?SHIP_BASE commit id}^{commit}")
TIP=$(git rev-parse main)
git merge-base --is-ancestor "$BASE" "$TIP" || { echo "SHIP_BASE is not an ancestor of main"; exit 1; }
MAP=/home/claude/REPO_MAP.tsv
: > "$MAP"
# Fixed identity + dates so the candidate ids are the SAME on every rebuild (the re-pin must match).
export GIT_COMMITTER_NAME="Glaze build" GIT_COMMITTER_EMAIL="build@glaze.local"
NEW=$(GIT_AUTHOR_NAME="Glaze build" GIT_AUTHOR_EMAIL="build@glaze.local" GIT_AUTHOR_DATE="$(git log -1 --format=%cI "$BASE")" GIT_COMMITTER_DATE="$(git log -1 --format=%cI "$BASE")" git commit-tree "$BASE^{tree}" -m "Glaze repo snapshot of $BASE (SHIP_BASE at slim-down; full history before this point: history/repo-full-2026-11-01.bundle.b64.txt on the build page)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>")
printf '%s\t%s\n' "$BASE" "$NEW" >> "$MAP"
for C in $(git rev-list --reverse --first-parent "$BASE..$TIP"); do
  MSG=$(git log -1 --format=%B "$C")
  NEW=$(GIT_AUTHOR_NAME="$(git log -1 --format=%an "$C")" GIT_AUTHOR_EMAIL="$(git log -1 --format=%ae "$C")" \
        GIT_AUTHOR_DATE="$(git log -1 --format=%aI "$C")" GIT_COMMITTER_DATE="$(git log -1 --format=%cI "$C")" \
        git commit-tree "$C^{tree}" -p "$NEW" -m "$MSG")
  printf '%s\t%s\n' "$C" "$NEW" >> "$MAP"
  # side-branch commits brought in by a merge map to the replayed merge
  if [ "$(git rev-list --parents -n1 "$C" | wc -w)" -gt 2 ]; then
    for S in $(git rev-list "$C^1..$C^2"); do printf '%s\t%s\n' "$S" "$NEW" >> "$MAP"; done
  fi
done
git branch -f slim-candidate "$NEW"
rm -rf /home/claude/slim-repo && git init -q /home/claude/slim-repo
git -C /home/claude/slim-repo fetch -q "$(pwd)" slim-candidate:main
git branch -D -q slim-candidate
git -C /home/claude/slim-repo bundle create /home/claude/slim-candidate.bundle main >/dev/null 2>&1
rm -rf /home/claude/slim-repo
base64 -w0 /home/claude/slim-candidate.bundle > /home/claude/repo-slim-candidate.bundle.b64.txt
# Checks: tip tree equals main's tree; root tree equals SHIP_BASE's tree.
rm -rf /home/claude/slim-check
git clone -q -b main /home/claude/slim-candidate.bundle /home/claude/slim-check
[ "$(git -C /home/claude/slim-check rev-parse 'HEAD^{tree}')" = "$(git rev-parse "$TIP^{tree}")" ] || { echo "TIP TREE MISMATCH: do not publish"; exit 1; }
ROOT=$(git -C /home/claude/slim-check rev-list --max-parents=0 HEAD)
[ "$(git -C /home/claude/slim-check rev-parse "$ROOT^{tree}")" = "$(git rev-parse "$BASE^{tree}")" ] || { echo "ROOT TREE MISMATCH: do not publish"; exit 1; }
rm -rf /home/claude/slim-check
python3 - "$MAP" "$BASE" "$TIP" "$NEW" <<'EOF'
import json, sys
m, base, tip, new = sys.argv[1:]
pairs = dict(l.rstrip('\n').split('\t') for l in open(m) if l.strip())
json.dump({"note": "D223-1 slim candidate: old commit id -> new id. Re-pin App-Projects apps/glaze/SHIP_BASE.txt to map[old SHIP_BASE].",
           "ship_base_old": base, "ship_base_new": pairs[base], "tip_old": tip, "tip_new": new,
           "map": pairs}, open('/home/claude/REPO_MAP.json', 'w'), indent=1)
EOF
echo "ship_base: $BASE -> $(sed -n 1p "$MAP" | cut -f2)"
echo "tip:       $TIP -> $NEW"
echo "base64 bytes: $(wc -c < /home/claude/repo-slim-candidate.bundle.b64.txt)"
