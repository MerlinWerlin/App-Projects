# Theme packs (T46, owner request 16 Oct 2026, R6)

Free themes stay bundled. Glaze Plus themes can ship as **downloadable theme packs**: a small manifest plus compressed artwork, fetched when needed, cached on the phone, removable from Settings › Storage with a size readout, and downloadable again. Glaze Plus is a one-time unlock; there is no subscription.

**Hosting: GitHub Release assets on `MerlinWerlin/App-Projects`** (T169, owner instruction 30 Oct 2026; how to publish: `docs/PACK_HOSTING.md`). `PACK_BASE_URLS` in `src/config/packs.ts` points production at the `glaze-packs-v1` release and staging at `glaze-packs-staging`. Until the release exists, `catalog.json` returns 404, which the app handles exactly like being offline: no remote themes, no error, no crash. An empty base URL still switches packs off completely (no request at all; Settings › Storage says "Theme packs arrive with the store release").

## Files

| File | What it does |
|---|---|
| `src/core/themePack.ts` | Pack format types, `parsePackManifest`, art asset encode/decode, `planDownload` (resume), `verifyAsset`, cache index (`cacheIndexAdd/Remove`, `totalCacheBytes`), `formatBytes(n, locale)`, `buildPack` |
| `src/core/bytes.ts` | Pure-TS SHA-256, UTF-8 and base64 (same code in Node and Hermes) |
| `src/core/inflate.ts` | Pure-TS gunzip/inflate (React Native has no zlib) |
| `src/core/packDownloader.ts` | Download orchestration over an injected `Transport` |
| `src/config/packs.ts` | `PACK_BASE_URLS` staging/production (GitHub release bases; empty = disabled) and the disabled message |
| `src/core/packHost.ts` | Host kinds (`folder` / `github-release`) and `packObjectUrl`, which turns a relative pack path into the URL (flat `__` names on a release) |
| `src/native/packs.ts` | Phone `Transport` over expo-file-system (via `src/native/fs.ts`), the cache index file and a small store |
| `src/plus/usePackAccess.ts` | The Plus gate: `usePackAccess(theme)` and `usePackStorage()` |
| `src/ui/PackStorageSection.tsx` | Settings › Storage |
| `src/core/themesNew.ts` | The 12 new themes (4 free bundled, 8 Plus in `pack-aurora-2026`) |
| `ops/build-pack.ts` | Builds a pack folder from themes |
| `src/core/__fixtures__/packs/pack-aurora-2026/` | The built fixture pack the tests serve locally |
| `src/core/widgetOptions.ts` | T187: pack v2 widget options (`parseWidgetOptions`, `validateWidgetOptions`), the v1 → options adapter (`widgetOptionsFromV1`), fit-not-crop geometry (`placeArt`) and the Widgets tab menu model (`widgetOptionSections`, `selectedOption`, `liveStudioHref`) |
| `src/core/themesStoryPlay.ts` | T104: 13 original game, movie-night and storybook themes (6 free bundled, 7 Plus in `pack-storyplay-2026`); fixture in `src/core/__fixtures__/packs/pack-storyplay-2026/` |

## Format (version 1)

A pack is a folder named after its id, served at `<PACK_BASE_URL>/<pack id>/`:

```
manifest.json              the manifest (below)
art/<theme id>.json.gz     gzip'd art asset: { format: 'glaze-art', version: 1, themeId, art: ThemeArt, motifs: { <motif id>: MotifLayer[] } }
thumbs/<theme id>.png      optional preview thumbnail
```

```jsonc
{
  "format": "glaze-pack",
  "version": 1,
  "id": "pack-aurora-2026",
  "name": "Aurora",
  "plus": true,
  "minAppVersion": "0.1.0",
  "themes": [ /* Theme JSON minus art: iconStyle/wallpaper without .art, plus "artAsset" and optional "thumbAsset" paths */ ],
  "assets": [ { "path": "art/starry-gaze.json.gz", "bytes": 570, "sha256": "<64 hex>" } ],
  "totalBytes": 11234
}
```

- The manifest holds what the gallery needs to list a theme (name, palette, icon and wallpaper parameters, categories, tags). The artwork and thumbnails, which make up most of a pack, are in `assets`. Each art asset also carries the vector layers of every motif it uses (0–100 box), so a later pack can bring motifs the app doesn't have yet. Drawing pack-only motifs needs a small renderer hook; today every pack motif is also in `src/core/artwork.ts`.
- `parsePackManifest` rejects: an unknown `format`, any `version` other than the number 1, bad or path-like ids, `plus` not true, a bad `minAppVersion`, asset paths that are absolute, contain `..`, `.`, empty segments, backslashes, drive letters or URLs, the reserved `manifest.json`, duplicate asset paths, duplicate theme ids, sizes that aren't positive integers, hashes that aren't 64 lower-case hex, `totalBytes` that doesn't equal the sum of the asset sizes, packs over 50 MB, themes with inline art, unknown categories, or an `artAsset`/`thumbAsset` not listed in `assets`.
- Integrity: every asset is checked for its exact size and SHA-256 after download, and art is checked again each time it is read from the phone. A tampered file hides only that theme.

## Downloader

`downloadPack({ baseUrl, packId, transport, appVersion, onProgress, retries = 1 })`:

1. Empty base URL → rejects with `disabled` **before any request**. Anything other than `https://` (or `http://127.0.0.1` / `localhost` for tests) → `bad-url`.
2. Fetches and validates `manifest.json` (≤ 1 MB). Wrong pack id → `manifest`; app too old → `app-version`.
3. Deletes any stored manifest (the pack no longer counts as downloaded), takes stock of local files and calls `planDownload`: complete and verified files are kept, partial files resume with `Range: bytes=<size>-`, oversized or wrong-hash files are deleted and fetched again.
4. Streams each asset with `writeAppend`. If the connection drops, the partial file stays and the next call resumes it. If the server ignores Range (200 instead of 206), the file is restarted.
5. Verifies each asset. A failed check deletes the file and retries once from zero; a second failure rejects with `integrity`.
6. Writes `manifest.json` last. A pack is downloaded only when its manifest is on disk.

`Transport` is `{ fetchRange(url, start) → { offset, chunks }, writeAppend, readFile, remove }`. The tests (`src/core/packDownloader.test.ts`) run a `node:http` server on `127.0.0.1` port 0 that serves the fixture with Range support, drops connections part-way, corrupts bytes and ignores Range on request. On the phone (`src/native/packs.ts`), `fetch` with a Range header returns the whole body as one chunk (React Native fetch doesn't stream), so resuming works per file across a pack. Files go in `documentDirectory/packs/<id>/` and the cache index in `documentDirectory/packs/index.json`.

## Cache and Settings › Storage

The cache index lists `{ id, name, version, bytes, themeIds, downloadedAt }` per pack. Settings › Storage lists the downloaded packs with their size (`formatBytes`, decimal units like iOS, localised through `Intl`), a **Remove** button (always allowed, since it frees space), **Re-download** (needs Plus, deletes and fetches a fresh copy) and the total.

## Plus gate

Only `src/plus/` reads the entitlement (`src/core/guard.test.ts` enforces it). `usePackAccess(theme)` returns:

| state | meaning | UI |
|---|---|---|
| `free` | not Plus content | normal |
| `locked` | Plus content, no Glaze Plus | show the existing `PlusLockSheet` |
| `ready` | Plus owned and the theme is bundled or its pack is downloaded | normal |
| `disabled` | Plus owned, packs not hosted yet | normal (the pack themes' data is still bundled, see below) |
| `not-downloaded` / `downloading` / `error` | Plus owned, pack hosted, not on the phone | offer Download with progress, or show the error |

`download()` returns `'locked'` without making any request if the person doesn't have Plus.

**Today's trade-off:** the 8 Aurora themes are also in the app bundle (`NEW_PLUS_THEMES`), so the gallery, Plus lock and theme detail work as they did before while hosting is undecided. Their artwork is built from the shared motif library, so bundling them costs a few kB of JS. Once hosting is live, future packs can be download-only: list them from the manifest and build themes with `packThemesOnDevice(id)` / `themesFromPack`.

Not wired yet: a Download button on the theme detail screen (`app/theme/[id].tsx`, which belongs to another task). It only needs `usePackAccess(theme)`.

## How to build and publish a pack

1. Add the themes (`plus: true`, `packId: '<pack id>'`, `categories`, `tags`, `addedAt`) in `src/core/`, like `NEW_PLUS_THEMES` in `src/core/themesNew.ts`.
2. Build: `node ops/build-pack.ts --out dist/packs` (with no `--out` it rewrites the test fixture). Pass `--min-app 1.2.0` if the pack needs a newer app. The script prints the pack size.
3. Run `npm test`. The fixture test fails if the fixture is stale.
4. Upload the `dist/packs/<pack id>/` folder's files to the host so that `packFileUrl(PACK_BASE_URL, '<pack id>', 'manifest.json')` resolves. On a folder host that is `<base>/<pack id>/manifest.json`. On the GitHub release (today's host) every `/` becomes `__`, giving `<base>/<pack id>__manifest.json` (see `docs/PACK_HOSTING.md`). Serve over HTTPS with `Accept-Ranges: bytes`.
5. `PACK_BASE_URLS` in `src/config/packs.ts` already points at the release; a host change is a JS-only change (an OTA update is enough).
6. To update a pack, rebuild and re-upload. Changed files get new hashes, so phones re-fetch only what changed the next time they download it.

## Hosting options (decided: GitHub Releases, T169)

Packs are static files, so any free static host works. The limits below are **as published at the time of writing; check them before choosing**:

| Option | Free limits (as published at the time of writing, check before choosing) | Notes |
|---|---|---|
| GitHub Releases | 2 GB per file; bandwidth not metered, but no SLA | Upload the pack folder's files as release assets. Release URLs redirect, and Range support depends on the CDN behind the redirect. Good for a start. |
| GitHub Pages | 1 GB site; ~100 GB/month soft bandwidth limit | Plain static folder; HTTPS by default. Simplest fit for the `<base>/<pack id>/…` layout. |
| Cloudflare R2 (free tier) | 10 GB storage; egress is free | Needs a Cloudflare account with a card on file. Public bucket or custom domain. |
| Cloudflare Pages | 25 MB per file; 20,000 files per site | Static folder deploys; generous bandwidth. Each pack file is far under 25 MB. |
| Firebase Hosting (Spark plan) | 10 GB storage; 360 MB/day transfer | The daily transfer cap could be hit quickly once many people download. |
| Netlify (free) | 100 GB/month bandwidth | Static folder deploys. |

Decision (30 Oct 2026, Jared): **GitHub Release assets** on the public repo `MerlinWerlin/App-Projects`, tag `glaze-packs-v1` (staging `glaze-packs-staging`). It needs no account, card or secret, and the workflow uses the built-in `GITHUB_TOKEN`. The release redirect to `objects.githubusercontent.com` serves Range requests, and if one ever didn't, the downloader starts the file again from byte 0. A first Cloudflare R2 plan (`docs/R2_SETUP.md`) is kept as reference only. Changing host later only changes `PACK_BASE_URLS`.

## The 12 new themes (all original art)

Free, bundled: Still Water (minimal, nature, pastel), Sakura Sprint (anime-style speed lines and petals), Little Ghosts (Halloween, cute), Night Drive (neon, retro).
Plus, pack `pack-aurora-2026` "Aurora": Starry Gaze (anime-style sparkly eyes), Moonlit Bats (Halloween), Lantern Hollow (Halloween), Gilded Noir (luxury), Aurora Veil (nature, neon), Pocket Arcade (retro, neon), Macaron Box (cute, pastel, luxury), First Frost (winter, tagged `christmas`).

Seasonal collection: Little Ghosts, Moonlit Bats and Lantern Hollow are tagged `halloween` (`src/core/seasons.ts` matches collection ids against tags). The new motifs in `src/core/artwork.ts` (speed lines, starry eye, little ghost, bat, cut gem, lightning bolt, snowflake) are Glaze's own vector paths. Anime-style means the visual language only: never characters, franchises or brands.

## Story & Play (T104, owner feedback 22 Oct, G5 b–d)

13 original themes dated 2026-10-22, built exactly like Aurora (`node ops/build-pack.ts` now writes both packs). Free, bundled (no Plus badge): Pixel Party (pixel arcade), Little Acre (cosy farm), Midnight Munchers (cute monsters, tagged `halloween`), Cape & Bolt (superhero style with our own winged emblem), Storybook Castle, Woodland Friends. Plus, pack `pack-storyplay-2026` "Story & Play": Neon Circuit (cyber neon), Questing Crest (fantasy quest), Chequered Dash (racing), Deep Orbit (sci-fi), After Rain (noir), Tiara & Gown (princess style), Ember Hatchling (little dragon). Search tags `games`, `movie night`, `storybook` / `kids` find each group. All 25 new motifs in `src/core/artwork.ts` are Glaze's own shapes; no third-party characters, franchises, films, games, studios or teams (`src/core/themesStoryPlay.test.ts` checks the names, tags and source).

## Space (Webb) photo pack (T103, owner feedback 22 Oct 2026, G5a)

A **free** collection of eight themes whose wallpaper is a real James Webb Space Telescope image from an official ESA/Webb release. Icons, widgets and the fallback wallpaper art are Glaze's own (deep navy and violet glass icons, gold/amber glows, generic stars and sparkles); only the wallpaper photo is Webb's.

### Network: a deliberate, user-initiated exception (this free pack only)

Glaze otherwise makes no network calls. The Space photos are the one exception, and only on these terms:

- **Nothing is bundled.** The manifest (names, palettes, credits, URLs) ships in the app; the photos do not. No Webb image file is in the repo.
- **Only on a tap.** A photo is fetched only when the person taps **Download photo** on that theme (`downloadPhotoTheme`, called only from `PhotoCredit`'s button / `usePhotoTheme().download`). Opening the gallery or the theme makes no request.
- **One request, to the official host.** A single plain GET to the `imageUrl` in the manifest, which must be `https://` on an allowlisted official host. No other request, no extra headers, no analytics, no tracking, no account. The server sees an ordinary image download.
- **Only free photo packs.** `downloadPhoto` refuses (`disabled`, no request) unless `allowNetwork` is true and the pack id is in `FREE_PHOTO_PACK_IDS` (`space-webb`). Art packs keep their own gate (`PACK_BASE_URL`, empty today).
- **Verified, cached, removable.** The download is capped at 8 MB (`MAX_PHOTO_BYTES`), must have an image Content-Type (`image/jpeg` or `image/png`) and JPEG/PNG magic bytes (and match a pinned SHA-256 if the manifest gives one); anything else is deleted. It is stored in `documentDirectory/packs/space-webb/photos/<theme id>.jpg` with a small meta file written last, and **Remove photo** deletes it. Works in Expo Go (expo-file-system via `src/native/fs.ts`, global `fetch`).
- **Failures leave nothing (T108, oversight D104-2).** The body is written to `<theme id>.part`, read back and verified on disk (size cap, Content-Type, magic bytes, SHA-256 when pinned), then moved to its real name (`PhotoTransport.move`, `fs.moveAsync` on the phone); the meta file goes through `<theme id>.json.part` and is moved last. On any failure (offline, HTTP error or proxy refusal, wrong type, too big, hash mismatch, cancelled, a failed write or move) every file of that theme is deleted, so no half-written file remains and the photo does not count as downloaded. The error is a `PhotoError` (still a `PackError`) with a friendly `failure` (`offline`, `blocked`, `bad-file`, `storage`, `cancelled`, `other`); `photoDownloadView` turns it into the offline / error panel with **Try again** in the theme detail. Tests: `src/core/photoPack.test.ts` (mocked fetch failure, dropped connection, mid-write failure, failed move) and `src/core/spaceCredit.test.ts` (the credit stays wherever a Space photo is shown or saved).

### Files

| File | What it does |
|---|---|
| `src/core/photoPack.ts` | Photo-pack format (`glaze-photo-pack` v1, `kind: 'photo'`, `plus: false`), `parsePhotoPackManifest`, `parseAnyPackManifest` (art packs still go through the unchanged v1 `parsePackManifest`), host allowlists, licences, `downloadPhoto`, `readPhotoMeta`, `removePhoto`, `photoDownloadView` (T108), `wallpaperSourceFor` and `downloadedPhotoRows` (T105) |
| `src/ui/PackStorageSection.tsx` | Settings › Storage: theme packs, then the downloaded Space photos (size, credit, Remove) |
| `src/core/spacePack.ts` | The Space manifest (`SPACE_PACK_MANIFEST`) and `SPACE_THEMES` |
| `packs/space-webb/manifest.json` | The same manifest as JSON, written by `node ops/build-photo-pack.ts` (a test fails when stale) |
| `src/native/photoPacks.ts` | Phone transport (reuses the pack `Transport` file ops; fetch also reports Content-Type and throws `HttpStatusError`; `move` for the temp file) and a small store (status, progress, uri, failure, bytes) |
| `src/ui/usePhotoTheme.ts` | `photoThemeOf(theme)`, `isPhotoThemeId(id)`, `usePhotoTheme(theme)` → `{ photo, status, progress, uri, error, failure, bytes, view, download, remove }` |
| `src/ui/PhotoCredit.tsx` | Credit line (exactly as published), title, links to the release page and the licence, and `PhotoDownloadControl` (Download / progress / offline or error + Try again / Remove) |

### Validation (`parsePhotoPackManifest`)

Rejects: unknown format or version, `kind` other than `photo`, `plus` other than `false`, themes with another `packId`, bad palettes / icon style / wallpaper / widget / art, and for every `photo`: a page or image URL that is not `https://`, has user info, a port, a query or fragment, or a host outside the allowlist (pages: `esawebb.org`; images: `cdn.esawebb.org`), an image URL that is not `.jpg`/`.jpeg`/`.png`, a blank or missing credit, an unknown licence (only `CC-BY-4.0` today) or a licence link that is not the canonical one, a bad `checkedAt`, an `approxBytes` over the cap, or a malformed `sha256`. NASA (`science.nasa.gov`, `www.nasa.gov`) and STScI (`webbtelescope.org`, `stsci-opo.org`) hosts are **not** on the allowlist: add them only after checking their release pages and terms the same way.

### Licence

ESA/Webb images are released under **Creative Commons Attribution 4.0 International** (https://creativecommons.org/licenses/by/4.0/), per https://esawebb.org/copyright/ (checked 2026-10-22). Its conditions, which the app follows:

- Each image's own credit line must be shown clearly, **unaltered**, and not hidden or separated from the image. `PhotoCredit` shows it verbatim on the theme detail; never translate or shorten a credit.
- Changes beyond resizing or cropping must be noted after the credit. Glaze only crops/scales to the screen.
- No use of the ESA/Webb **logos** (the permission does not cover them). The release pages show logos only in the site header, not as part of the images; confirm by eye that no file carries a logo or watermark (see "Verify before release"), and never add one.
- No implied endorsement by ESA/Webb of Glaze. Don't use "official", "ESA" or "NASA" in marketing for the pack beyond the credit.
- None of the chosen images shows an identifiable person (the copyright page flags privacy for those).

The credits read "NASA, ESA, CSA, STScI…" because Webb is a NASA/ESA/CSA mission; the files and terms used here are the ESA/Webb releases at esawebb.org.

### Images (all checked 2026-10-22)

| Theme | Title (as on the release page) | Release id | Page URL | Image URL | Exact credit | Licence | Checked |
|---|---|---|---|---|---|---|---|
| Pillars of Creation (`space-pillars`) | Webb Takes a Stunning, Star-Filled Portrait of the Pillars of Creation (Full View) | weic2216b | https://esawebb.org/images/weic2216b/ | https://cdn.esawebb.org/archives/images/publicationjpg/weic2216b.jpg (4.2 MB) | NASA, ESA, CSA, STScI; J. DePasquale, A. Koekemoer, A. Pagan (STScI). | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) ([terms](https://esawebb.org/copyright/)) | 2026-10-22 |
| Cosmic Cliffs (`space-cosmic-cliffs`) | NIRCam Image of the "Cosmic Cliffs" in Carina | weic2205a | https://esawebb.org/images/weic2205a/ | https://cdn.esawebb.org/archives/images/publicationjpg/weic2205a.jpg (2.3 MB) | NASA, ESA, CSA, and STScI | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2026-10-22 |
| Tarantula Nebula (`space-tarantula`) | Tarantula Nebula (NIRCam Image) | weic2212a | https://esawebb.org/images/weic2212a/ | https://cdn.esawebb.org/archives/images/publicationjpg/weic2212a.jpg (2.7 MB) | NASA, ESA, CSA, and STScI | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2026-10-22 |
| Cassiopeia A (`space-cas-a`) | Cas A (NIRCam image) | weic2330a | https://esawebb.org/images/weic2330a/ | https://cdn.esawebb.org/archives/images/publicationjpg/weic2330a.jpg (3.4 MB) | NASA, ESA, CSA, STScI, D. Milisavljevic (Purdue University), T. Temim (Princeton University), I. De Looze (University of Gent) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2026-10-22 |
| Infrared Remnant (`space-cas-a-infrared`) | Cassiopeia A (MIRI Image) | weic2311a | https://esawebb.org/images/weic2311a/ | https://cdn.esawebb.org/archives/images/publicationjpg/weic2311a.jpg (2.2 MB) | NASA, ESA, CSA, D. Milisavljevic (Purdue University), T. Temim (Princeton University), I. De Looze (UGent), J. DePasquale (STScI) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2026-10-22 |
| Rho Ophiuchi (`space-rho-ophiuchi`) | Rho Ophiuchi cloud complex | weic2316a | https://esawebb.org/images/weic2316a/ | https://cdn.esawebb.org/archives/images/publicationjpg/weic2316a.jpg (2.0 MB) | NASA, ESA, CSA, STScI, K. Pontoppidan (STScI), A. Pagan (STScI) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2026-10-22 |
| Cartwheel Galaxy (`space-cartwheel`) | Cartwheel Galaxy (NIRCam and MIRI Composite Image) | weic2211a | https://esawebb.org/images/weic2211a/ | https://cdn.esawebb.org/archives/images/publicationjpg/weic2211a.jpg (4.0 MB) | NASA, ESA, CSA, STScI | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2026-10-22 |
| Ghostly Pillars (`space-pillars-infrared`) | Pillars of Creation (MIRI Image) | weic2218a | https://esawebb.org/images/weic2218a/ | https://cdn.esawebb.org/archives/images/large/weic2218a.jpg (586 kB; the release has no separate publication JPEG) | NASA, ESA, CSA, STScI, J. DePasquale (STScI), A. Pagan (STScI) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2026-10-22 |

How these were checked: each release page was read on 2026-10-22 for its title, credit line, download links and sizes; the licence terms from https://esawebb.org/copyright/. The pages state no image-specific restrictions. Considered and left out: the cropped Pillars (weic2216a, 1200 px square, too small for a phone), Southern Ring side-by-side (weic2207a, two panels, crops badly in portrait), Chameleon I (weic2303a, very dark and wide), and every TIFF and the 17–30 MB "Large JPEG" originals (too big to download on a phone).

**Verify before release:** the pages were read through a web reader, but direct requests to esawebb.org from this build environment were refused by its network proxy, so the image files themselves were not downloaded: their `image/jpeg` Content-Type, exact byte sizes, absence of logos/watermarks and a pinned SHA-256 per file are not yet confirmed. On a phone or PC: download each URL once, check it opens, looks right and is under 5 MB, then optionally add its `sha256` to `src/core/spacePack.ts` and rerun `node ops/build-photo-pack.ts`. Re-read each credit on its release page against the table above. The step-by-step list is under "On the iPhone" below.

### Wiring (theme detail and gallery)

- Gallery: list `SPACE_THEMES` (from `src/core/spacePack.ts` or `src/ui/usePhotoTheme.ts`) with the free themes, e.g. as a "Space" collection. They are `plus: false` and need no Plus gate. Before download they draw their generated deep-space wallpaper like any other theme.
- Theme detail: `const photo = usePhotoTheme(theme)`. If `photo.photo` is non-null, render `<PhotoCredit theme={theme} />` under the preview (it carries Download / Remove), and when `photo.uri` is set use it as the wallpaper image (`<Image source={{ uri: photo.uri }} resizeMode="cover" />`) behind the icons. Keep the credit visible wherever the photo is shown full-size (`<PhotoCredit theme={theme} showActions={false} />`).
- Apply › Wallpaper (T105): `wallpaperSourceFor` decides what **Save wallpaper to Photos** saves. The person's own photo still wins; otherwise a Space theme with its photo on the phone saves the downloaded Webb photo, cropped (cover) to the screen size through the same off-screen photo saver as an own photo (no overlay, no text burned in). The step shows the exact credit line under the text, and the saved confirmation repeats it (`ui.photoCredit.savedCredit`). If the photo is not downloaded yet, the step offers the download first (`PhotoDownloadControl`, with the T108 offline / error state and Try again); the drawn space wallpaper can still be saved instead.
- Settings › Storage (T105): a **Space photos** group under the theme packs lists each downloaded photo (`useDownloadedPhotos` → `downloadedPhotoRows`) with its size, its exact credit and **Remove**, plus the total. It only reads the meta files on the phone; it never downloads. Removing a photo sends its theme back to the drawn wallpaper; the person can download it again from the theme.

### On the iPhone (owner check, T105; can't be done from the cloud build)

The cloud build can't reach esawebb.org, so the files themselves have never been opened. The `sha256` pins in `src/core/spacePack.ts` are deliberately absent until this is done. On the iPhone (Safari is fine), for each of the 8 image URLs in the table above:

- [ ] `weic2216b.jpg` (Pillars of Creation) opens as a picture
- [ ] `weic2205a.jpg` (Cosmic Cliffs) opens as a picture
- [ ] `weic2212a.jpg` (Tarantula Nebula) opens as a picture
- [ ] `weic2330a.jpg` (Cassiopeia A) opens as a picture
- [ ] `weic2311a.jpg` (Infrared Remnant) opens as a picture
- [ ] `weic2316a.jpg` (Rho Ophiuchi) opens as a picture
- [ ] `weic2211a.jpg` (Cartwheel Galaxy) opens as a picture
- [ ] `weic2218a.jpg` (Ghostly Pillars, `/archives/images/large/`) opens as a picture

For each one also check:

1. **It opens** straight away (no login page, no "access denied", no redirect to an HTML page).
2. **It is `image/jpeg`**: Safari shows just the image; long-press › Save to Photos works, and Photos shows it as a JPEG (swipe up / ⓘ). In Glaze: Space theme › **Download photo** succeeds and the preview shows the photo (a wrong content type shows "Download didn't finish" instead).
3. **No logo or watermark** anywhere in the picture, including the corners (zoom in).
4. Size roughly as listed (under 5 MB), and the credit in the theme detail matches its release page.

Then, from a PC that can reach the files, add each file's `sha256` to `src/core/spacePack.ts`, rerun `node ops/build-photo-pack.ts`, and close T105. Any URL that fails: tell the build (that theme gets a different release or is dropped).

## Art packs (themes-1024)

T130 + T132, owner brief "themes-1024": themes as creative as a hand-made Home Screen (a starry-night wallpaper, white line glyphs on dark rounded tiles, large widgets whose planets float in the sky because their background is the wallpaper itself). Theme art can be made anywhere (AI image tools, a drawing app, code) and arrives as **folders**. **The format below is the contract**: a folder that passes the validator becomes a free theme in the app with no code changes.

### Format: `themes/<id>/`

| File | Rule |
|---|---|
| `wallpaper.png` | **Exactly 1290 x 2796** px (iPhone 15 Pro Max class screen). 8-bit, not interlaced, opaque (an alpha channel is a warning). |
| `widget-small.png` | Transparent hero art for the small widget. Reference **510 x 510** px. |
| `widget-medium.png` | Transparent hero art for the medium widget. Reference **1092 x 510** px. |
| `widget-large.png` | Transparent hero art for the large widget. Reference **1092 x 1146** px. |
| `palette.json` | `{ "bg", "tile", "glyph", "accent", "text" }`, each `#RRGGBB`. |
| `meta.json` | `{ "name", "mood", "tags": [], "credits", "licence", "generator", "prompt" }`, optional `"addedAt": "YYYY-MM-DD"`. |

- `<id>` is the folder name and the theme id: lower case `a-z`, `0-9` and single hyphens, 3–40 characters, not the id of a built-in theme.
- **Hero sizes** are 3x the point sizes of the iPhone 15 Pro Max widgets (small 170 x 170 pt, medium 364 x 170 pt, large 364 x 382 pt). Any other size is accepted when it has the same aspect ratio (±1 %) and is at least half the reference size (e.g. 255 x 255 for small); art over twice the reference size gets a warning.
- **Hero art is the subject only** (a moon, a planet, a jellyfish) on a **transparent** background: PNG colour type 4 or 6, or a palette/colour-key PNG with a `tRNS` chunk, **and** at least 1 % of its pixels actually transparent (alpha ≤ 8). The seamless widget draws it over the matching crop of the wallpaper, so it floats in the scene.
- `palette.json`: `tile` is the icon background (a solid squircle), `glyph` the icon line colour, `bg` the theme background, `text` text on `bg`, `accent` highlights and widget accents. Icons are **never** per-app images: they stay the icon studio's vector glyphs drawn in `glyph` on `tile`. No brand logos, ever.
- `meta.json`: `name` (≤ 40 characters), `mood` (one line, ≤ 120, shown as the tagline), lower-case `tags` (a tag that is a category id such as `dark`, `nature`, `pastel` also files the theme there), `credits`, `licence`, `generator` (`procedural`, `openai-image`, `photo`, `hand-drawn`; others are a warning) and `prompt` (the AI prompt, `""` for non-AI art).

### Validator rules (`src/core/artPack.ts` `validateArtPack(id, files)` → `{ ok, errors, warnings, pack }`)

Pure TypeScript (no React Native), Node-tested in `src/core/artPack.test.ts`. It reads the PNG chunks itself (`IHDR` size, bit depth, colour type, interlace; `PLTE`, `tRNS`), inflates `IDAT` with the repo's `src/core/inflate.ts` and unfilters every scanline to count transparent pixels. Errors:

- a missing file; a bad pack id; a file that isn't a PNG, is truncated or corrupt;
- 16-bit or other non-8-bit PNGs, and interlaced PNGs ("save as 8-bit", "save without interlacing");
- a wallpaper that isn't exactly 1290 x 2796; hero art with the wrong aspect or under half size; hero art with no alpha or no transparent pixels;
- palette colours that aren't `#RRGGBB`; **glyph on tile** or **text on bg** contrast under **4.5:1** (WCAG AA, `src/core/colour.ts` `contrastRatio`);
- missing `name`, `mood`, `tags`, `credits`, `licence`, `generator` or `prompt`; upper-case tags; a bad `addedAt`;
- a `licence` outside the allowlist: `original`, `CC0-1.0`, `public-domain`, `CC-BY-4.0`, `openai-output-owned`;
- **credits**: required (the attribution line) for `CC-BY-4.0`; and whenever NASA, ESA, JPL, Webb/JWST or Hubble is mentioned anywhere (name, mood, tags, credits, prompt) the credits must name the agency (NASA, ESA, JPL, CSA or STScI);
- a brand, franchise or competitor name anywhere in the meta (`ART_BANNED_NAMES`);
- files over the hard limits (wallpaper 8 MB, hero 3 MB).

Warnings (the pack still imports): extra files (ignored, never copied), unknown palette/meta keys, an unknown generator, AI art without its prompt, `openai-output-owned` on non-AI art, a low accent/bg contrast, a wallpaper with alpha, hero art over twice its reference size, and files over the **bundle budget: wallpaper ≤ 450 KB, each hero ≤ 150 KB** (the app bundle has a size cap; quantise to 256 colours, e.g. `pngquant 256`, before importing).

### Import

```
node scripts/import-theme-packs.mjs <folder-of-packs> [--dry-run] [--replace]
node scripts/import-theme-packs.mjs --regenerate
```

Each sub-folder of `<folder-of-packs>` is one pack. The script validates every pack, prints a report (`OK` / `FAILED` with each error and warning), copies the valid ones into `themes/<id>/` (only the six format files), refuses an id that already exists in `themes/` unless `--replace`, and refuses the id of a built-in theme. It then regenerates, from everything in `themes/`:

- `src/ui/artPackAssets.ts`: a static `require()` map of every `themes/<id>/*.png` (Metro needs literal paths);
- `src/core/artPackLibrary.ts`: palette, meta, pixel sizes and byte sizes per pack (data only, no image bytes).

`--dry-run` validates and reports without writing anything; `--regenerate` only rebuilds the two generated files. Exit code 1 when any pack failed. Node 22.18+ runs the TypeScript core directly. `src/core/artPack.test.ts` fails when the generated files are out of step with `themes/` (fix: `--regenerate`), and checks that every shipped pack validates with no errors or warnings and that all packs together stay under 1.8 MB.

### In the app

- `src/core/artPack.ts` `artPackTheme(pack)` maps a pack to a normal `Theme`: palette (`tile` → `surface` and the solid icon background, `glyph` → glyph colour, `text` → `ink`), vector-glyph icon style (feather set, squircle, no stickers or textures), widget style from the palette (glass on dark tiles), categories from the tags (and `dark` for a dark `bg`), a drawn gradient `wallpaper` from `bg`/`accent` for places that can't show an image, and `artPack: { id, wallpaperImage: true, heroes, credits, licence, generator }`.
- `src/core/artPackThemes.ts`: `ART_PACK_THEMES`, `artPackThemeById`, `artPackOf`. `getAnyTheme` resolves them (detail, studio, apply) and they carry the "Free" pill.
- Gallery: an **Art** section above Space on the Themes tab (`themes.art.*`). `ThemeCard` and the theme detail preview draw the wallpaper image (`src/ui/ThemeWallpaper.tsx`; React Native `Image` with a `require()`'d PNG, so it works in Expo Go).
- Theme detail: the credit card (`src/ui/ArtPackCredit.tsx`: the credit exactly as in `meta.json`, how it was made, the licence). Apply › Wallpaper › **Save to Photos** saves the pack's PNG cropped to the phone's screen through the same off-screen photo saver as a downloaded Space photo; the person's own photo still wins.
- `src/ui/artPackSources.ts`: `artPackWallpaper(id)`, `artPackWallpaperUri(id)` and **`artPackHero(id, 'small' | 'medium' | 'large')`**, the hero image source for the seamless widget component (null when the theme isn't an art pack).

### Starter packs (T132)

Three original packs drawn in code by `scripts/brand/make-starter-packs.py` (Python 3, Pillow, numpy, scipy; fixed seeds, no network, no photos): gradients, value noise, analytic spheres and discs, quantised to 256-colour palette PNGs (heroes keep their alpha through `tRNS`).

| Pack | Wallpaper | Hero art (large / medium / small) |
|---|---|---|
| `starry-night` | deep blue-black night sky, a dense star field with a faint milky band, dark hills | full moon with craters and maria / ringed gas giant / blood moon |
| `sunset-dunes` | violet-to-gold dusk sky, wispy lit clouds, four layers of dunes | setting sun with drifting wisps / lit cumulus bank / crescent moon with the evening star |
| `deep-sea` | sunbeams fading from teal to deep navy, marine snow, bubbles, kelp | glowing jellyfish / two jellyfish / bubble cluster |

All three: `licence: "original"`, `generator: "procedural"`, `credits: "Glaze (original procedural art)"`, ~1.2 MB together. To rebuild them:

```
python3 scripts/brand/make-starter-packs.py /tmp/starter-packs
node scripts/import-theme-packs.mjs /tmp/starter-packs --replace
```

## Remote art packs

T159 (owner-1030 A2-A3), T169. Theme folders (`themes/<id>/`, the art-pack format above) become downloadable packs hosted as GitHub Release assets (`docs/PACK_HOSTING.md`; first planned on Cloudflare R2). The contract is `src/core/packCatalog.ts` (`parseCatalog`, `parseRemoteArtManifest`); the builder checks its own output with both.

**Layout** (logical paths; `dist/packs/` is gitignored). On the GitHub release each path is one flat asset with `/` replaced by `__` (`art__<id>__v<n>__<file>`; `scripts/packs/release_assets.mjs` writes them to `dist/release/assets/`):

```
catalog.json                                          every pack: id, name, packVersion, plus, bytes, manifest, thumb, thumbhash, palette, tags, mood, addedAt
art/<id>/v<packVersion>/manifest.json                 assets with role, size, bytes, sha256, mime; written LAST in the folder
art/<id>/v<packVersion>/wallpaper-2796.<sha8>.webp    1290x2796   (also -2556: 1179x2556, -1334: 750x1334, centre-cropped)
art/<id>/v<packVersion>/widget-small|medium|large.<sha8>.webp   hero art with alpha, source size capped at the reference size
art/<id>/v<packVersion>/thumb.<sha8>.webp             240x520 gallery thumbnail
```

**Commands** (Node 22, no dependencies):

```
npm run packs:build   -- [--themes themes] [--out dist/packs] [--only id,id] [--plus id,id | --plus-file scripts/packs/tiers.json] [--encoder auto|sharp|pillow|png] [--min-app 1.0.0]
node scripts/packs/release_assets.mjs [--dir dist/packs] [--out dist/release] [--existing assets.json]   # flat release assets (T169)
npm run packs:publish -- [--dir dist/packs] [--dry-run]                                                # R2/S3 uploader, reference only
node --test "scripts/packs/*.test.mjs"
```

- **Images**: `sharp` if installed (WebP q82, effort 4), else `python3` + Pillow (WebP q82, method 4), else a warning and the original PNGs (one wallpaper class) plus a PNG thumb. ThumbHash of the wallpaper is computed in JS (`scripts/packs/thumbhash.mjs`, MIT, see LICENSES.md).
- **Plus**: ids listed in `scripts/packs/tiers.json` (`{ "plus": [...] }`) or `--plus` are marked `plus: true`; everything else is free.
- **Versions**: `scripts/packs/versions.json` keeps `{ id: { packVersion, contentHash } }`; `contentHash` is the sha256 of the manifest without `packVersion` (so every file hash, palette, meta, plus flag and minAppVersion). Same hash keeps the version, any change gives `v+1` in a new folder. Commit `versions.json` after publishing. Old versions stay on the host (phones mid-download keep working); dist only holds the current one. `--only` rebuilds some packs and keeps the rest of the existing `catalog.json`.
- **Publish (GitHub release, current)**: the workflow or the manual `gh` sequence in `docs/PACK_HOSTING.md`. Uploads go in three batches (pack files, manifests, `catalog.json` last). Files already on the release are skipped, and a versioned manifest already there with a different size stops the run. Every uploaded asset is downloaded again from its public URL and its SHA-256 compared. GitHub allows 1000 assets per release (the script refuses more and warns past 800).
- **Publish (R2/S3, reference only)**: env `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (or `.env` in the app folder, gitignored). S3 API at `https://<account>.r2.cloudflarestorage.com`, region `auto`, path-style, SigV4 signed in `scripts/packs/sigv4.mjs` (tested against AWS's published vectors). Upload order: pack files, then manifests, then `catalog.json` last. Objects whose HEAD shows the same size, MD5 ETag and Cache-Control are skipped; a versioned manifest already on R2 with different bytes stops the run (bump the version instead of overwriting). Every object is HEAD-verified afterwards (size, content type). `--dry-run` needs no env and makes no network calls. Secrets are never printed.
- **Cache headers** (R2/S3 uploader only; GitHub sets its own and the hashed names make that safe): everything under `art/` is `public, max-age=31536000, immutable` (file names carry the hash, manifests live in versioned folders); `catalog.json` is `public, max-age=300`. Content-Type from the extension (`image/webp`, `image/png`, `application/json`).
- **CI**: `scripts/packs/publish-packs.yml` is a manual-dispatch GitHub Actions workflow (written, not run) that builds the packs and creates/updates the release with `gh` and the built-in `GITHUB_TOKEN`. It needs no secrets. It goes to `.github/workflows/glaze-publish-packs.yml` in App-Projects (`docs/PACK_HOSTING.md`).

## Updating downloaded packs (T222, owner-1101e)

A phone that downloaded a pack keeps that version until the catalogue lists a newer `packVersion`. Then it updates by itself:

- **Recorded version.** The cache index entry (`documentDirectory/packs/index.json`) stores `packVersion` for each downloaded remote art pack. An entry written before T222 has none: it is back-filled from the stored manifest's `packVersion`, else counts as 1 (`downloadedPackVersion`).
- **Decision** (`src/core/packUpdates.ts`, tested in `packUpdates.test.ts`): `packUpdateState(catalogVersion, downloadedVersion)` → `not-downloaded` / `up-to-date` / `needs-update` (only when the catalogue is strictly newer; a rolled-back catalogue never downgrades). `packUpdatePlan` lists the outdated packs in catalogue order, skipping busy packs and packs inside a failure backoff (15 min, doubling, capped at 6 h; a new target version retries at once).
- **Background run** (`runPackUpdates` in `src/native/packs.ts`): after every catalogue load (app open, Themes tab, coming back to the foreground), one pack at a time. Wi-Fi or cellular alike. Only the existing pack host is contacted.
- **Atomic swap** (`downloadRemoteArtPack` in `src/core/packDownloader.ts`): an update downloads into `packs/.staging/<id>/` (files the old version shares by name and hash are copied locally instead of downloaded; a marker file names the version being staged, so a later attempt resumes it and a staged copy of another version is discarded). When every file is verified and the staged manifest is written, `packs/<id>/` moves to `packs/.previous/<id>/`, the staged folder moves to `packs/<id>/`, and the previous copy is deleted. A failure or cancel at any point leaves the old version in `packs/<id>/`, working. A swap the app was killed in the middle of is undone on the next read (`recoverRemoteArtSwap`). Remove deletes the staging and previous folders too.
- **Refresh.** The new manifest replaces the cached one in the store, so the theme page, the widget art list (now the v2 pieces), hero files, wallpaper URI and credits re-derive from it (`useRemoteArtTheme` memoises on the manifest object). Widget art and wallpapers already applied are copies in the widget App Group / Photos, so the swap never breaks them.
- **Theme page.** While an update is pending, running or failed, a small card ("Update available", `src/ui/PackUpdateNote.tsx`, strings `theme.update.*`) shows under the header with **Update now** / **Try again** (ignores the backoff; a Plus pack needs Glaze Plus as for its download, `src/plus/usePackUpdate.ts`).

## Remote art pack v2: widget options (T187, owner-1101 #5)

v2 lets a theme ship **any number of widget art pieces** (the 29 Oct "extra" ones included) and says, per piece, what it is and which widget sizes it suits. The Widgets tab and the theme page's Widgets screen show every option of the picked theme for the chosen size, grouped by kind in one shelf order (T201, `widgetShelf`: practical kinds — habits, countdown, calendar, date, clock, battery, photo, quote — then `art`, then the standard widgets in the theme's palette), and art is always **fitted, never cropped**. Parser and v1 adapter: `src/core/widgetOptions.ts` (`parseWidgetOptions`, `validateWidgetOptions`, `widgetOptionsFromV1`, `placeArt`), wired into `parseRemoteArtManifest` (`src/core/packCatalog.ts`); tests `src/core/widgetOptions.test.ts`.

**What changes from v1** (everything else in the manifest is exactly as in v1: same `catalog.json`, same folder layout, same file naming `<name>.<sha8>.webp`, same hashing, sizes and `totalBytes` rules):

1. `"version": 2`.
2. A new asset role **`widget-art`** (v2 only; a v1 manifest with it is rejected). The v1 roles `widget-small` / `widget-medium` / `widget-large` are still allowed but no longer needed.
3. A required top-level **`widgets`** list: one entry per option.

### `widgets[]` entry

| Field | Type | Required | Rule |
|---|---|---|---|
| `id` | string | yes | Unique in the pack. Lower case `a-z`, `0-9` and hyphens, 1-40 characters, no leading/trailing hyphen (e.g. `paper-boat`). |
| `kind` | string | yes | One of `art`, `clock`, `date`, `calendar`, `countdown`, `habits`, `battery`, `photo`, `quote`. `art` is a picture. The others are pictures meant for that kind of widget: `clock`, `date` / `calendar`, `countdown`, `photo` and `habits` also offer **Make it live** (Widget Studio's live clock, month calendar, countdown, photo album or water tracker in the theme). `battery` and `quote` show as pictures today. |
| `image` | string | yes | The `path` of an entry in `assets` with role `widget-art` (or a v1 `widget-small/medium/large` role). Not the wallpaper or thumb. |
| `sizes` | string[] | yes | Non-empty, no repeats, each of `small`, `medium`, `large`, `lock`. The sizes this piece is suggested for, best first. Since T201 the app offers every piece in every Home Screen size (fitted); the suggested sizes come first in that size's menu. (`lock` is accepted and stored; the Lock tab doesn't show art yet, since iOS draws Lock Screen widgets in one colour.) |
| `fit` | string | no (default `fit`) | `fit`: the whole art, centred, inset 6 % of the widget's short side. `fill`: edge to edge, **only** when the art's aspect is within 2 % of the widget's; otherwise the app fits it anyway. Nothing is ever cropped. |
| `background` | string | no (default `theme`) | What fills the widget around fitted art: `theme` (the palette `bg` colour), `blur` (a blurred copy of the same art, best for opaque square art in wide/large widgets), `wallpaper` (the matching crop of the theme wallpaper: the seamless look, for art with a transparent background). |
| `label` | string | no | Name in the menu, 1-40 characters after trimming (e.g. `"Paper boat"`). Without it the app shows "Art n", n being the piece's place in the list (the same in every size; T209). English only today. |
| `numberFree` | boolean | no (default `false`) | T206: `true` says the picture has **no value painted in** (no date, time, count, level or clock hands). Only then is a `clock`, `date`, `calendar`, `countdown`, `habits` or `battery` piece shown as a practical piece (its kind's section, "Live" badge, **Make it live**). Without it such a piece is shown with the art (its numbers would never change), and the theme page offers the live widget as a separate one ("Live widget instead") with a note that the picture's numbers don't change. Today the widget never draws live values over the art, so number-free art still shows as a picture; the flag is for pack v3 art (T205). |

Unknown extra fields are ignored. At most **32** options per pack (more are ignored).

**Validation.** A manifest with `"version": 2` and no `widgets` array is rejected. Inside the list the app is lenient: a bad entry (bad id, duplicate id, unknown kind or size, image not in `assets` or with the wrong role, bad fit / background / label) is dropped and the others still show; if none is valid the app falls back to the v1 roles. A pack builder should be strict: `validateWidgetOptions(widgets, assets)` returns one line per problem and must return `[]` before publishing.

### Image guidance

| Art shape | Pixel size | Use for |
|---|---|---|
| Square | **1024 x 1024** (minimum 510 x 510) | `small`, and `medium` / `large` fitted on `blur` or `theme` |
| Wide (2.14 : 1) | **1092 x 510** | `medium` with `fit: "fill"` |
| Tall-square (0.95 : 1) | **1092 x 1146** | `large` with `fit: "fill"` |

- WebP (preferred, quality ~82) or PNG, 8-bit sRGB, `mime` `image/webp` / `image/png`. Keep each file **≤ 250 KB** (most square pieces are 20-150 KB); the whole pack stays under 20 MB (`REMOTE_ART_MAX_BYTES`).
- Long edge **≤ 1200 px**: the widget image is capped at 1200 px, so more is only bytes.
- Keep the subject inside the middle ~88 % (the 6 % inset) and away from the corners (widgets have ~22 pt rounded corners).
- Transparent art: use `background: "wallpaper"` (it floats on the wallpaper like v1 hero art). Opaque art: `theme` or `blur`.
- Don't pre-crop square art to wide or tall shapes: list the square file with `sizes: ["small", "medium", "large"]` and the app fits it (this is the Cloud Atelier paper-boat fix).

### Example v2 manifest (`art/cloud-atelier/v2/manifest.json`)

```json
{
  "format": "glaze-remote-art-pack",
  "version": 2,
  "id": "cloud-atelier",
  "packVersion": 2,
  "name": "Cloud Atelier",
  "plus": false,
  "minAppVersion": "1.0.0",
  "palette": { "bg": "#DCE6F2", "tile": "#F7F9FC", "glyph": "#2B3A55", "accent": "#7FA4D6", "text": "#1E2A40" },
  "meta": { "name": "Cloud Atelier", "mood": "…", "tags": ["clouds", "pastel"], "credits": "…", "licence": "openai-output-owned", "generator": "openai-image", "prompt": "…", "addedAt": "2026-10-31" },
  "thumbhash": "xvcFCwB3gCh3bYG5loBmCWg=",
  "assets": [
    { "path": "wallpaper-2796.d5e95932.webp", "role": "wallpaper", "width": 1290, "height": 2796, "bytes": 150412, "sha256": "<64 hex>", "mime": "image/webp" },
    { "path": "wallpaper-2556.919f7026.webp", "role": "wallpaper", "width": 1179, "height": 2556, "bytes": 134170, "sha256": "<64 hex>", "mime": "image/webp" },
    { "path": "wallpaper-1334.7ddccc93.webp", "role": "wallpaper", "width": 750, "height": 1334, "bytes": 64112, "sha256": "<64 hex>", "mime": "image/webp" },
    { "path": "thumb.e5731259.webp", "role": "thumb", "width": 240, "height": 520, "bytes": 10260, "sha256": "<64 hex>", "mime": "image/webp" },
    { "path": "widget-paper-boat.0a0b0c0d.webp", "role": "widget-art", "width": 1024, "height": 1024, "bytes": 61234, "sha256": "<64 hex>", "mime": "image/webp" },
    { "path": "widget-hot-air-balloon.1a1b1c1d.webp", "role": "widget-art", "width": 1024, "height": 1024, "bytes": 58410, "sha256": "<64 hex>", "mime": "image/webp" },
    { "path": "widget-cloud-banner.2a2b2c2d.webp", "role": "widget-art", "width": 1092, "height": 510, "bytes": 72002, "sha256": "<64 hex>", "mime": "image/webp" },
    { "path": "widget-cloud-clock.3a3b3c3d.webp", "role": "widget-art", "width": 1024, "height": 1024, "bytes": 40118, "sha256": "<64 hex>", "mime": "image/webp" },
    { "path": "widget-rain-habits.4a4b4c4d.webp", "role": "widget-art", "width": 1024, "height": 1024, "bytes": 39876, "sha256": "<64 hex>", "mime": "image/webp" }
  ],
  "widgets": [
    { "id": "paper-boat", "kind": "art", "image": "widget-paper-boat.0a0b0c0d.webp", "sizes": ["small", "medium", "large"], "fit": "fit", "background": "blur", "label": "Paper boat" },
    { "id": "hot-air-balloon", "kind": "art", "image": "widget-hot-air-balloon.1a1b1c1d.webp", "sizes": ["small", "large"], "background": "theme", "label": "Balloon" },
    { "id": "cloud-banner", "kind": "art", "image": "widget-cloud-banner.2a2b2c2d.webp", "sizes": ["medium"], "fit": "fill", "background": "theme" },
    { "id": "cloud-clock", "kind": "clock", "image": "widget-cloud-clock.3a3b3c3d.webp", "sizes": ["small", "large"], "background": "blur", "label": "Cloud clock" },
    { "id": "rain-habits", "kind": "habits", "image": "widget-rain-habits.4a4b4c4d.webp", "sizes": ["small", "medium"], "background": "theme", "label": "Rain tracker" }
  ],
  "totalBytes": 630594
}
```

(`<64 hex>` and the sizes are placeholders: write the real SHA-256 and byte counts; `totalBytes` must equal the sum of `bytes`.) The `catalog.json` entry for the pack is unchanged except `packVersion` / `manifest` / `thumb` pointing at the new version folder.

### v1 compatibility

- **v1 packs keep working unchanged.** `widgetOptionsFromV1` turns each `widget-small` / `widget-medium` / `widget-large` asset into an `art` option (`background: "wallpaper"`, `fit: "fit"`), offered in **every** Home Screen size with its own size listed first, so the square small art also appears whole in medium and large.
- A v2 pack doesn't need the v1 widget roles: the theme page's Seamless card uses the first option for each size when there is no `widget-<size>` file (`remoteArtFiles`).
- Apps from before T187 reject `"version": 2` manifests (the download shows the calm "try again" line). Publish v2 packs only once the T187 update is on the phones (it is JavaScript, so it arrives as an over-the-air update). `scripts/packs/build_packs.mjs` in this repo still writes v1 from `themes/<id>/` folders.

### On the phone

- **Widgets tab** (`src/ui/ThemeWidgetArt.tsx`, `src/ui/WidgetArtMenu.tsx`): under the size tabs, "Widget art" lists every option of the picked theme for that size as large rounded previews (two columns for Small, one for Medium / Large), under a header per kind, with a tint ring and check badge on the chosen one. Previews draw the art inside the `placeArt` rectangle with `contentFit="contain"`; only the background (blurred art or wallpaper) is cover-scaled. A remote theme that isn't downloaded yet shows one line pointing to its page. Bundled art packs (Deep Sea, Starry Night, Sunset Dunes) list their three hero pieces the same way.
- **Use on my widget** writes the chosen piece to the Glaze **Seamless** widget (`seamless-<size>.png`): `background: "wallpaper"` through `widgets.setSeamless` (wallpaper crop under the default spot + art fitted); `theme` / `blur` through the new `widgets.setWidgetArt` (native: colour fill, CIGaussianBlur aspect-fill copy for `blur`, then the art fitted with the 6 % inset). A native build from before T187 has no `setWidgetArt`, so the app uses the seamless path instead. Expo Go: "Needs the Glaze TestFlight app".
- **Native widget** (`targets/widget/SeamlessWidget.swift`): the image is drawn `.scaledToFit()` over a blurred `.scaledToFill()` copy on the theme background, so a phone whose widget shape differs a little never cuts the art. This and `setWidgetArt` need a **new native build**.

## App side (remote catalogue)

T160 (owner-1030 A). How the app uses the pack layout in `src/core/packCatalog.ts`:

- **Base URL.** `src/config/packs.ts` has `PACK_BASE_URLS = { staging, production }`: the GitHub release download bases for `glaze-packs-staging` and `glaze-packs-v1` (T169). Expo extra `packEnv: "staging"` picks staging; anything else is production. Every URL goes through `packObjectUrl` (`src/core/packHost.ts`), which uses flat `__` names on a release and folders on any other host. A 404 (release not created yet) or any other fetch failure is handled like offline. An empty URL means no catalogue, no remote themes and **no request at all** (tests assert it).
- **Catalogue.** `src/native/packs.ts` keeps `catalog.json` in `documentDirectory/packs/catalog.json` with the time it was fetched. On the Themes tab the cached copy is listed at once and re-fetched at most every 6 h (`refreshRemoteCatalog()` forces it, for pull to refresh). Offline, an HTTP error or a bad file keeps the last good catalogue (`src/core/remoteCatalog.ts` `decideCatalog`, never throws).
- **Gallery.** Each catalogue pack becomes an art-pack theme (`remoteArtTheme`: palette → icon style, drawn fallback wallpaper, categories from tags) with a `remoteArt` ref (pack version, Plus flag, size, thumbnail URL, ThumbHash). They join the art section after the bundled art packs; a bundled theme with the same id wins. Cards show the thumbnail with expo-image (`cachePolicy="memory-disk"`, ThumbHash placeholder; `src/ui/RemoteArtImage.tsx`).
- **Download.** The theme detail's pack card offers Download for every remote pack. Free packs need no Plus; Plus packs show the Plus sheet (`src/plus/usePackAccess.ts`, the only place that reads the entitlement). `downloadRemoteArtPack` (`src/core/packDownloader.ts`) fetches `art/<id>/v<n>/manifest.json`, then only the files this phone needs (`assetsForDevice`, by screen long edge in px) with the same Range resume, size + SHA-256 checks and one retry as theme packs, and writes the manifest (cut down to those files) last into `documentDirectory/packs/<id>/`. A different version on the phone is removed first. It appears in Settings › Storage like any pack (remove / re-download).
- **After download.** The files are verified again on first read; the detail previews and saves the local wallpaper (`file://`), and the credit comes from the downloaded `meta`. A damaged file drops the pack from the index so Download shows again. The Seamless widget card stays for bundled art packs only for now.
