# Pack hosting: GitHub Release assets (T169)

Glaze's downloadable theme packs are hosted as **release assets on the public repo `MerlinWerlin/App-Projects`** (Jared's instruction, 30 Oct 2026). This replaces the Cloudflare R2 plan (`docs/R2_SETUP.md` is kept as reference only). Nothing here needs an account, a card or a secret: the workflow uses the built-in `GITHUB_TOKEN`.

| | Release tag | Base URL the app uses (`src/config/packs.ts`) |
|---|---|---|
| Production | `glaze-packs-v1` | `https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1` |
| Staging | `glaze-packs-staging` (pre-release) | `https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-staging` |

The app picks staging only when the build has Expo extra `packEnv: "staging"`; otherwise production.

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
- **GitHub limits:** 1000 assets per release and 2 GB per file. A pack is about 8 files, so ~87 themes come to ~700 assets. Old pack versions stay on the release (phones mid-download keep working). When `release_assets.mjs` warns past 800, delete the stale assets it lists in `dist/release/plan.json` (`stale`), or move to a new tag (`glaze-packs-v2`) and update `PACK_RELEASE_TAGS`.
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
   Inputs: `target` (`staging` | `production`), `only` (comma-separated pack ids, empty means all), `dry_run` (build and plan, no release changes).
3. **What it does:** it runs the pack script tests and builds the packs (`build_packs.mjs --plus-file scripts/packs/tiers.json`). It reads the release's current assets, flattens the build (`release_assets.mjs --existing`), and creates the release if it is missing (`--latest=false`; staging is a pre-release). Then it uploads in three batches: pack files, then manifests, then `catalog.json` last with `--clobber`. Files already on the release are skipped. Finally it downloads every uploaded asset from its public URL and compares SHA-256.
4. **After a real run:** download the `pack-versions-<target>` artifact and commit its `versions.json` to `apps/glaze/scripts/packs/versions.json`, so the next build keeps the same pack versions.

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
TAG=glaze-packs-staging            # or glaze-packs-v1
R=MerlinWerlin/App-Projects
node --test "scripts/packs/*.test.mjs"
node scripts/packs/build_packs.mjs --plus-file scripts/packs/tiers.json
gh release view "$TAG" -R "$R" --json assets > /tmp/existing.json || echo '{"assets":[]}' > /tmp/existing.json
node scripts/packs/release_assets.mjs --dir dist/packs --out dist/release --existing /tmp/existing.json
gh release view "$TAG" -R "$R" >/dev/null 2>&1 || \
  gh release create "$TAG" -R "$R" --title "Glaze theme packs ($TAG)" --notes "Theme art packs for the Glaze app." --latest=false
cd dist/release/assets
for list in upload-1-files.txt upload-2-manifests.txt upload-3-catalog.txt; do
  [ -s "../$list" ] && xargs -a "../$list" -d '\n' -n 50 gh release upload "$TAG" -R "$R" --clobber
done
cd ../../..
curl -fsSL "https://github.com/$R/releases/download/$TAG/catalog.json" | sha256sum   # equals catalog.json's sha256 in dist/release/plan.json
git add scripts/packs/versions.json && git commit -m "Glaze packs: versions after publishing $TAG"
```

Add `--prerelease` to `gh release create` for the staging tag. Never upload `catalog.json` before the files it lists.

## Not used any more
- `scripts/packs/publish_r2.mjs` and `scripts/packs/sigv4.mjs` (S3/R2 uploader) stay in the repo, tested, in case the packs ever move to a bucket. A bucket would be a `folder` host, so only the base URL changes.
- `docs/R2_SETUP.md`: reference only. Jared has nothing to do there.
