# Repo space (T150 / T195, owner-1101 item 11)

The build page stores the whole Glaze git repo as one base64 file (`repo.bundle.b64.txt`). The
artifact limit is 16 MB per file. On 1 Nov 2026 it was 15.58 MB.

## What takes the space (measured run 205)

| Part | Size |
|---|---|
| Current files (HEAD tree, raw) | 10.5 MB: TypeScript 5.3 MB, PNG 3.4 MB, Markdown 0.7 MB, Swift/JSON/SVG 0.6 MB |
| Bundle of the current files only (one snapshot commit) | 5.9 MB raw = **7.9 MB base64** |
| Bundle with full history (today) | 11.4 MB raw = **15.6 MB base64** |

So about half is history: old versions of store shots, icons and art.

## Why moving the art out alone does not help

Deleting or moving a file in a new commit leaves every old version in the history, and the
bundle carries the history. Moving binary art to GitHub release assets (as with the theme packs)
only shrinks the bundle after a history cut. Until then it would make the bundle slightly
bigger. Also, most of the PNGs are bundled theme art the app shows offline, so moving them would
change the app. For these reasons, art stays where it is.

## The plan (never lose work)

1. **Archive (done, run 205).** The complete history bundle is published on the build page as
   `history/repo-full-2026-11-01.bundle.b64.txt` (tip `0ab5643` plus the run 205 records). It
   stays there. Restore any old commit with
   `base64 -d repo-full-2026-11-01.bundle.b64.txt > full.bundle && git clone full.bundle`.
2. **Swap (waits on the overseer).** `sh ops/slim-bundle.sh history/repo-full-2026-11-01.bundle.b64.txt`
   writes a slim `repo.bundle.b64.txt`. It has one new root commit whose tree is byte-for-byte the
   current tip's tree, and the script checks this. Dry run in run 205: **7.90 MB base64**, which
   leaves 8 MB of room, or hundreds of runs at the current rate.
   Every commit hash changes in the swap. Auto-ship diffs from App-Projects
   `apps/glaze/SHIP_BASE.txt` (today our hash `f658d83`), so the overseer must re-pin SHIP_BASE to
   the new root in the same step. The new root's tree equals the archived tip's tree, so the first
   ship after the swap is an empty diff. Overseer directive D215-1 ("do not squash or rewrite
   history") also has to be lifted for this. The build run therefore does the swap only when an
   oversight directive says go.
3. **After the swap:** keep new large art out of git where possible (generate store shots at
   render time; host big new art as release assets like the theme packs, `docs/PACK_HOSTING.md`).
   `ops/bundle-check.sh` keeps guarding new images over 100 KB.

## Until then

Each run adds about 16-30 KB. The base64 is 15.6 MB after run 205, so the 16 MB cap is about
15-20 runs away. The build run keeps runs small and adds no new images over 100 KB.

## Slim candidate (D223-1, run 206)

`sh ops/slim-candidate.sh <SHIP_BASE id>` builds the candidate without touching the live bundle:
root commit = tree of the commit App-Projects `apps/glaze/SHIP_BASE.txt` pins, then every later
first-parent commit replayed with its own tree. Dates and identity are fixed, so the same input
gives the same ids every run. Published on the build page as
`history/repo-slim-candidate.bundle.b64.txt` with `docs/REPO_MAP.json` (old id -> new id;
`ship_base_new` is the id to re-pin). Run 206: SHIP_BASE `f658d83` -> new root `301a9f0`.
The swap to `repo.bundle.b64.txt` happens in the first build run that sees SHIP_BASE name a new
id from the map. If auto-ship advances SHIP_BASE before the re-pin, the next rebuild uses that
commit as root and publishes a new map.
