# Pack hosting: GitHub Release assets (T169)

Glaze's downloadable theme packs are hosted as **release assets on the public repo `MerlinWerlin/App-Projects`** (Jared's instruction, 30 Oct 2026). This replaces the Cloudflare R2 plan (`docs/R2_SETUP.md` is kept as reference only). Nothing here needs an account, a card or a secret: the workflow uses the built-in `GITHUB_TOKEN`.

| | Release tag | Base URL the app uses (`src/config/packs.ts`) |
|---|---|---|
| Production (1.0.2+) | `glaze-packs-v5` | `https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v5` |
| Legacy (1.0.1 and earlier) | `glaze-packs-v1` | `https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1` |
| Staging | `glaze-packs-staging` (pre-release) | `https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-staging` |

The 1.0.2 catalogue lives on v5. Design-hold immutable packs on v11/v12/v13 preserve141themes while removing103 small automatic clock overlays and withholding315 repeated component editions;2dedicated art clocks and other original choices remain. Source branches `codex/glaze-packs-v11-20261104` through v13 contain exact assets and upload plans. Historical versioned files remain intact. The rebuild-template commands below describe the legacy v1 publisher: do not use that catalogue default for1.0.2 or replace older clients' catalogue. Current locks/digests are in `versions.json`, `releases.json` and `testflight-1.0.2.json`.

The app picks staging only when the build has Expo extra `packEnv: "staging"`; otherwise production.

The eight illustrated clock pilot packs on `glaze-packs-v14` add a single `clock-face.<sha8>.png` asset with the existing `widget-art` role. The asset stays outside the pack's decorative widget choices. Restore the published PNG as `clock-face.png` in that theme's source folder before rebuilding it. The version lock records the face digest and the builder catches a missing source so a rebuild keeps the illustrated clock.

## Flat asset names

Release assets have no folders, so each file of the pack layout (`src/core/packCatalog.ts`) is uploaded under a flat name: every `/` becomes `__`.

| Built file (`dist/packs/`) | Release asset name |
|---|---|
| `catalog.json` | `catalog.json` |
| `art/deep-sea/v1/manifest.json` | `art__deep-sea__v1__manifest.json` |
| `art/deep-sea/v1/wallpaper-2796.1a2b3c4d.webp` | `art__deep-sea__v1__wallpaper-2796.1a2b3c4d.webp` |

- The app builds URLs with `packObjectUrl` in `src/core/packHost.ts`. The host kind comes from the base URL: a `/<owner>/<repo>/releases/download/<tag>` base is flat, and any other HTTPS base (bucket, CDN, custom domain) uses normal folders. Moving host later only means changing `PACK_BASE_URLS`.
- `scripts/packs/release_assets.mjs` uses the same function to write the flat files, and refuses any name GitHub would rewrite. GitHub keeps only letters, digits, `.`, `-` and `_` (pack ids are lower-case slugs and file names are `[a-z0-9._-]`).
- Integrity does not depend on the host. Every file is checked against the SHA-256 in its manifest, and a corrupt file is fetched once more and then refused.
- **Before the first publish the release doesn't exist**, so `catalog.json` returns 404. The app treats that exactly like being offline: it shows the cached catalogue or none, shows no error, and never crashes (tested in `src/core/remoteArtDownload.test.ts`). The 3 bundled themes still work.
- **GitHub limits:** 1000 assets per release and 2 GB per file. A pack is about 8 files, so ~87 themes come to ~700 assets. Old pack versions stay on the release (phones mid-download keep working). When `release_assets.mjs` warns past 800, delete the stale assets it lists in `plan.json` (`stale`), or put new packs on the next tag: see [More than one release](#more-than-one-release-glaze-packs-v2). `PACK_RELEASE_TAGS` does not change (catalog.json stays on `glaze-packs-v1`).
- **No Cache-Control control.** GitHub serves release assets with its own headers. Hashed file names and versioned manifests never change, and the app re-reads `catalog.json` at most every 6 h (or on pull to refresh), so this is fine.
- **Privacy.** Downloads come from github.com / objects.githubusercontent.com, which see the phone's IP address like any website. Glaze sends no personal data, so "Data Not Collected" still holds.

## Publish with the workflow (auto-ship, or a Claude chat with repo access)

1. **Place the workflow once.** In `MerlinWerlin/App-Projects`, copy `apps/glaze/scripts/packs/publish-packs.yml` to `.github/workflows/glaze-publish-packs.yml` and commit it to the default branch. It is manual-dispatch only and needs no secrets. It declares `permissions: contents: write` for the built-in token. If the repo's Settings › Actions › General › Workflow permissions is "Read repository contents", the job-level `permissions` block still grants write for this workflow, unless an organisation policy forbids it.
2. **Dispatch it.** Use **Actions › Publish Glaze theme packs › Run workflow**, or the CLI:
   ```sh
   gh workflow run glaze-publish-packs.yml -R MerlinWerlin/App-Projects -f target=staging -f dry_run=true
   gh workflow run glaze-publish-packs.yml -R MerlinWerlin/App-Projects -f target=staging
   gh workflow run glaze-publish-packs.yml -R MerlinWerlin/App-Projects -f target=production
   gh run watch -R MerlinWerlin/App-Projects "$(gh run list -R MerlinWerlin/App-Projects -w glaze-publish-packs.yml -L 1 --json databaseId -q '.[0].databaseId')"
   ```
   Inputs: `target` (`staging` | `production`), `only` (comma-separated pack ids, empty means all), `release` (the tag for packs never published before, default `glaze-packs-v1`; T274), `dry_run` (build and plan, no release changes).
3. **What it does:** it runs the pack script tests and builds the packs (`build_packs.mjs --plus-file scripts/packs/tiers.json`). It reads the current assets of every release the catalogue uses, flattens the build into one upload set per tag (`release_assets.mjs --existing-dir`; staging: `--single`), and creates any release that is missing (`--latest=false`; staging is a pre-release). Then, tag by tag with `glaze-packs-v1` last, it uploads in three batches: pack files, then manifests, then (v1 only) `catalog.json` last with `--clobber`. Files already on the release are skipped. Finally it downloads every uploaded asset from its public URL and compares SHA-256.
4. **After a real run:** download the `pack-versions-<target>` artifact and commit its `versions.json` and `releases.json` to `apps/glaze/scripts/packs/`, so the next build keeps the same pack versions and releases.

## Verify a URL

```sh
curl -fsSL https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1/catalog.json | head -c 300
# A pack file, by its flat name (from catalog.json: "thumb": "art/<id>/v<n>/<file>" -> art__<id>__v<n>__<file>)
curl -fsSIL https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1/art__deep-sea__v1__manifest.json | grep -i -E '^HTTP|content-length'
gh release view glaze-packs-v1 -R MerlinWerlin/App-Projects --json assets -q '.assets | length'
```
`-L` matters: GitHub answers with a 302 to `objects.githubusercontent.com`. The app's `fetch` follows it, including `Range` requests for resumed downloads.

## Manual `gh` sequence (no workflow)

From `apps/glaze` in a checkout of App-Projects, with `gh` logged in as someone who can write to the repo:

```sh
TAG=glaze-packs-staging            # staging: ONE release holds every pack (production: next section)
R=MerlinWerlin/App-Projects
node --test "scripts/packs/*.test.mjs"
node scripts/packs/build_packs.mjs --plus-file scripts/packs/tiers.json
gh release view "$TAG" -R "$R" --json assets > /tmp/existing.json || echo '{"assets":[]}' > /tmp/existing.json
node scripts/packs/release_assets.mjs --single --dir dist/packs --out dist/release --existing /tmp/existing.json
gh release view "$TAG" -R "$R" >/dev/null 2>&1 || \
  gh release create "$TAG" -R "$R" --title "Glaze theme packs ($TAG)" --notes "Theme art packs for the Glaze app." --latest=false --prerelease
cd dist/release/assets
for list in upload-1-files.txt upload-2-manifests.txt upload-3-catalog.txt; do
  [ -s "../$list" ] && xargs -a "../$list" -d '\n' -n 50 gh release upload "$TAG" -R "$R" --clobber
done
cd ../../..
curl -fsSL "https://github.com/$R/releases/download/$TAG/catalog.json" | sha256sum   # equals catalog.json's sha256 in dist/release/plan.json
git add scripts/packs/versions.json scripts/packs/releases.json && git commit -m "Glaze packs: versions after publishing $TAG"
```

Never upload `catalog.json` before the files it lists. Production (`glaze-packs-v1` plus any `glaze-packs-v2+`) uses the per-tag sequence in the next section.

## More than one release (glaze-packs-v2+)

T274. GitHub allows **1000 assets per release**; `glaze-packs-v1` holds ~925, so new packs go to `glaze-packs-v2` (then `-v3`, ...) on the **same repo**.

**Contract.** A `catalog.json` pack entry may carry `"release": "glaze-packs-v2"`. `catalog.json` itself is always on `glaze-packs-v1`. Missing `release` = `glaze-packs-v1`, exactly as before.
- The app (`src/core/packCatalog.ts` `parseCatalog`) keeps `release` only if it matches `^glaze-packs-v\d+$`. Any other value is dropped and the pack still lists (fetched from v1).
- Every pack file URL (catalogue thumb, manifest, every asset, downloads and updates) is built from `packReleaseBase(base, release)` (`src/core/packHost.ts`):
  - **Production** (a GitHub `releases/download/glaze-packs-v<n>` base): only the tag segment is swapped. Owner and repo always come from the configured base, so a catalogue cannot point a pack at another repo.
  - **Staging** (`glaze-packs-staging`): `release` is ignored. The staging release is one self-contained test release holding every pack (publish it with `release_assets.mjs --single`).
  - **Folder hosts** (R2/CDN, the local test fixture server): `release` is ignored, because one tree serves every pack.
  - The catalogue cache stamp is unchanged (catalog.json never moves). Thumbnail image caches key on the URL, so they follow the tag.
- **Older app builds.** Their `parseCatalog` copies named fields only, so the unknown `release` field is ignored: the catalogue still parses and v2 packs still list (`src/core/packReleaseT274.test.ts` runs a frozen copy of the old parser). But an old build fetches a v2 pack's thumb and manifest from `glaze-packs-v1`, gets 404, and shows a missing thumbnail (blurred ThumbHash placeholder) and the normal "couldn't download" error. Nothing crashes and no bad file is kept. Only builds from before T274 are affected.

**Which pack is on which release.** `scripts/packs/releases.json` (committed, next to `versions.json`) maps pack id -> tag:
- A pack listed there keeps its tag on every build.
- A pack missing from it is `glaze-packs-v1` if `versions.json` already knows it (it was published before T274). Otherwise it is a new pack and gets `--release` (default `glaze-packs-v1`).
- `build_packs.mjs` writes the map back and puts `release` in a catalogue entry only when it is not v1.
- To move a pack, edit its tag in `releases.json` and rebuild it (`--only <id>`). Its files are then uploaded to the new tag, and the old copies on v1 show up as `stale` in v1's `plan.json` (delete them once the new catalogue is live).

**Build and plan (offline apart from `gh release view`)**, from `apps/glaze`:
```sh
R=MerlinWerlin/App-Projects
node --test "scripts/packs/*.test.mjs"
node scripts/packs/build_packs.mjs --plus-file scripts/packs/tiers.json --release glaze-packs-v2   # new packs -> v2; existing keep theirs
node -e 'const c=require("./dist/packs/catalog.json");const t=new Set(["glaze-packs-v1"]);for(const p of c.packs) if(p.release) t.add(p.release);console.log([...t].join("\n"))' > /tmp/tags.txt
mkdir -p /tmp/existing
while read -r tag; do
  gh release view "$tag" -R "$R" --json assets > "/tmp/existing/$tag.json" 2>/dev/null || echo '{"assets":[]}' > "/tmp/existing/$tag.json"
done < /tmp/tags.txt
node scripts/packs/release_assets.mjs --dir dist/packs --out dist/release --existing-dir /tmp/existing
cat dist/release/tags.txt      # e.g. glaze-packs-v2, then glaze-packs-v1 (always last)
```
This writes, for each tag, `dist/release/<tag>/assets/`, `plan.json` (with `tag`), `upload-order.txt` and `upload-{1-files,2-manifests,3-catalog}.txt`. `catalog.json` is only in `glaze-packs-v1/`. A warning is printed for each tag past 800 assets, and a tag past 1000 is refused.

**Publish with the workflow:**
```sh
gh workflow run glaze-publish-packs.yml -R MerlinWerlin/App-Projects -f target=production -f release=glaze-packs-v2 -f dry_run=true
gh workflow run glaze-publish-packs.yml -R MerlinWerlin/App-Projects -f target=production -f release=glaze-packs-v2
```
It creates any missing tag (`--latest=false`). It uploads every other tag first, then `glaze-packs-v1` last with `catalog.json` as the very last asset. Then it checks every SHA-256 at its public URL. It uses the built-in `GITHUB_TOKEN` only. Commit the artifact's `versions.json` and `releases.json` afterwards.

**Publish by hand with `gh`**, after the build and plan above:
```sh
while read -r tag; do
  gh release view "$tag" -R "$R" >/dev/null 2>&1 || \
    gh release create "$tag" -R "$R" --title "Glaze theme packs ($tag)" --notes "Theme art packs for the Glaze app." --latest=false
  ( cd "dist/release/$tag/assets"
    for list in upload-1-files.txt upload-2-manifests.txt upload-3-catalog.txt; do
      [ -s "../$list" ] && xargs -a "../$list" -d '\n' -n 50 gh release upload "$tag" -R "$R" --clobber
    done )
done < dist/release/tags.txt
curl -fsSIL "https://github.com/$R/releases/download/glaze-packs-v2/$(head -1 dist/release/glaze-packs-v2/upload-2-manifests.txt)" | grep -i '^HTTP'
git add scripts/packs/versions.json scripts/packs/releases.json && git commit -m "Glaze packs: versions + releases after publishing"
```

Other modes: `release_assets.mjs --tag <tag>` writes the old single-folder layout (`<out>/assets`) for one tag's packs only, and `--single` writes it for every pack (staging). The widget-alpha workflow (`ops/github/glaze-widget-alpha-publish.yml`), `rebuild_widget_alpha.mjs` and `blend-audit.py` also follow each pack's `release`.

## Clock editions (owner-1102a)

`build_packs.mjs` (T275) picks up Codex's per-theme widget exports from a `widgets/` folder inside each theme folder, next to the usual pack files:

| File in `<theme>/widgets/` | Written by | Becomes |
|---|---|---|
| `themed-clock-20261102.json` + its source PNG | `scripts/prepare-themed-clocks.mjs` | the **first** option, `themed-live-clock` (live clock drawn over the original art, `liveFrame.clockStyle` / `ink` kept) |
| `widget-options.json` (themes 101-146) | the theme exports | one option per entry; kind names `digitalClock`, `analogClock` / `analog clock` / `analog-clock`, `dateCalendar`, `focusTimer`, `countdown`, `battery` are written as Glaze's kinds (`clock` + clockStyle, `date`, `focus`, …), so older app builds parse them too |
| `runtime-options-20261101.json` + `runtime-<kind>-face-20261101.png` | `scripts/export-reviewed-themes.mjs` | live clean faces (`numberFree` + `liveFrame`); the plain clock face is labelled "Plain clock (fallback)" |

- The theme's v1 hero art (`hero-small/medium/large`) is appended, so nothing it offered before disappears. A pack with any of these files becomes a **v2 manifest** (`widget-art` assets, max long edge 1024, WebP with sharp or Pillow).
- Folders may be named `<id>` or Codex's `NNN-<id>`: the leading three digits are dropped to get the pack id (`--only` takes either).
- The themed clock's `option.image` is an absolute path on the PC that wrote it. The build tries that path, then `<--themes>/<source>`, then the theme folder (by file name). A missing image, or one whose `sourceSha256` / `sha256` no longer matches, skips that edition with a `warning:` line. An unknown kind fails that pack (exit code 1); the app itself never crashes on one (it drops the option).
- A theme without these files builds byte-identical output to before (`scripts/packs/clock_editions.test.mjs`).
- **Review folders build directly (T275b).** A folder with no `wallpaper.png` but with `wallpapers/wallpaper.png` (Codex's review layout) is read the way `scripts/prepare-reviewed-packs.mjs` reads it:
  - **Wallpaper:** `wallpapers/wallpaper.png`, cover-cropped to the three device classes.
  - **Palette:** `palette.json` if the folder has one; otherwise the theme's `background` / `foreground` in `<reviews root>/release-simulation/catalogue.json` (bg/tile = background, glyph/accent/text = foreground).
  - **Meta:** `meta.json` if present; otherwise generated from `source-and-prompts.json`. The name comes from `set` (or the folder name), credits from `source.photographer` / `page`, licence `openai-output-owned`, tags `review-candidate`, `addedAt` 2026-11-01.
  - **Widget options:** hero files are optional. The options are the editions above, then every other `widgets/*.png` as `art`. Images are deduplicated by SHA-256, ids follow the `short()` rule, and a catalogue `originalFile` → `file` override is applied.
  - **Skipped files:** `runtime-*-face-*` and `native-clock-background-*` files are not repeated as art.
  - **Failures:** a review folder needs at least one option. A folder with no palette (or a palette below the contrast rules) is `FAILED`.
  - **Normal folders:** `release-simulation/` is skipped, and normal-layout folders are unchanged.
- The originals, the review folders and `docs/themed-clock-fixtures/` stay outside the app bundle: only the built packs are uploaded, and the app downloads them.
- Live clock frames need a build with the native art-clock support (App-Projects PR #190). Older builds show these options with the default live badge.

Build from Jared's review folder, then publish with the manual sequence above (staging first):

```sh
node --test "scripts/packs/*.test.mjs"
node scripts/packs/build_packs.mjs --themes <glaze-theme-reviews> --out dist/packs --plus-file scripts/packs/tiers.json
# check the log: every theme OK (FAILED = exit 1), "warning:" lines name skipped editions
TAG=glaze-packs-staging R=MerlinWerlin/App-Projects
gh release view "$TAG" -R "$R" --json assets > /tmp/existing.json || echo '{"assets":[]}' > /tmp/existing.json
node scripts/packs/release_assets.mjs --dir dist/packs --out dist/release --existing /tmp/existing.json
# then the gh release create / upload batches / curl check from "Manual gh sequence", and commit versions.json
```

To use the workflow instead, the theme folders (with `widgets/`) must be committed under `apps/glaze/themes/` first, because the workflow builds from the repo's `themes/`.

## Not used any more
- `scripts/packs/publish_r2.mjs` and `scripts/packs/sigv4.mjs` (S3/R2 uploader) stay in the repo, tested, in case the packs ever move to a bucket. A bucket would be a `folder` host, so only the base URL changes.
- `docs/R2_SETUP.md`: reference only. Jared has nothing to do there.

## 4 Nov 2026 TestFlight design gate

Technical compilation and automated checks passed, but103/105 automatically generated themed clocks use small values above reused decorative artwork. The315 added date/focus/battery editions repeat that composition. They do not meet the intended dedicated functional widget design and must not be described as complete. The v11/v12/v13 design-hold packs restore original metadata/choices and omit those automatic variants; all141 themes keep their palettes, prices and credits. Existing placed widgets may retain their earlier artwork; check, reselect and re-save as needed. Native habits, photo albums and the general widget runtime are available for testing in 1.0.2 (27); dedicated themed layouts still require redesign, per-theme visual qualification and iPhone QA. Prototype flat icons remain excluded. Evidence: `ops/TESTFLIGHT_DELIVERY_20261104.json`.

The canonical GitHub catalogue URL can retain an old redirect after replacement. TestFlight 1.0.2 (27) uses `catalogRequestUrl` to give each actual catalogue fetch a fresh URL, while retaining conditional ETag checks, the six-hour/offline policy, and unchanged immutable asset URLs. Publication readback uses that same production helper. A successful upload alone does not establish that an older client's cached redirect has refreshed.

Final Apple observation on 4 Nov 2026 at08:18:03UTC:1.0.2(27) is VALID / IN_BETA_TESTING in the existing internal group. This is native-runtime delivery with a themed-design hold, not completion of the full themed widget suite.
