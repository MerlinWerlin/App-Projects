# Theme packs (T46, owner request 16 Oct 2026, R6)

Free themes stay bundled. Glaze Plus themes can ship as **downloadable theme packs**: a small manifest plus compressed artwork, fetched when needed, cached on the phone, removable from Settings › Storage with a size readout, and downloadable again. Glaze Plus is a one-time unlock; there is no subscription.

**The app makes no network call until the owner sets `PACK_BASE_URL`** in `src/config/packs.ts`. It is an empty string today, so packs are switched off and Settings › Storage says "Theme packs arrive with the store release". No hosting is configured anywhere in the repo.

## Files

| File | What it does |
|---|---|
| `src/core/themePack.ts` | Pack format types, `parsePackManifest`, art asset encode/decode, `planDownload` (resume), `verifyAsset`, cache index (`cacheIndexAdd/Remove`, `totalCacheBytes`), `formatBytes(n, locale)`, `buildPack` |
| `src/core/bytes.ts` | Pure-TS SHA-256, UTF-8 and base64 (same code in Node and Hermes) |
| `src/core/inflate.ts` | Pure-TS gunzip/inflate (React Native has no zlib) |
| `src/core/packDownloader.ts` | Download orchestration over an injected `Transport` |
| `src/config/packs.ts` | `PACK_BASE_URL` (empty = disabled) and the disabled message |
| `src/native/packs.ts` | Phone `Transport` over expo-file-system (via `src/native/fs.ts`), the cache index file and a small store |
| `src/plus/usePackAccess.ts` | The Plus gate: `usePackAccess(theme)` and `usePackStorage()` |
| `src/ui/PackStorageSection.tsx` | Settings › Storage |
| `src/core/themesNew.ts` | The 12 new themes (4 free bundled, 8 Plus in `pack-aurora-2026`) |
| `ops/build-pack.ts` | Builds a pack folder from themes |
| `src/core/__fixtures__/packs/pack-aurora-2026/` | The built fixture pack the tests serve locally |
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
4. Upload the `dist/packs/<pack id>/` folder as-is to the host so that `<PACK_BASE_URL>/<pack id>/manifest.json` resolves. Serve it over HTTPS with `Accept-Ranges: bytes`. Most static hosts do this.
5. Set `PACK_BASE_URL` in `src/config/packs.ts` and ship the change (an OTA update is enough, since it's JS only).
6. To update a pack, rebuild and re-upload. Changed files get new hashes, so phones re-fetch only what changed the next time they download it.

## Owner decision needed: hosting

Packs are static files, so any free static host works. The limits below are **as published at the time of writing; check them before choosing**:

| Option | Free limits (as published at the time of writing, check before choosing) | Notes |
|---|---|---|
| GitHub Releases | 2 GB per file; bandwidth not metered, but no SLA | Upload the pack folder's files as release assets. Release URLs redirect, and Range support depends on the CDN behind the redirect. Good for a start. |
| GitHub Pages | 1 GB site; ~100 GB/month soft bandwidth limit | Plain static folder; HTTPS by default. Simplest fit for the `<base>/<pack id>/…` layout. |
| Cloudflare R2 (free tier) | 10 GB storage; egress is free | Needs a Cloudflare account with a card on file. Public bucket or custom domain. |
| Cloudflare Pages | 25 MB per file; 20,000 files per site | Static folder deploys; generous bandwidth. Each pack file is far under 25 MB. |
| Firebase Hosting (Spark plan) | 10 GB storage; 360 MB/day transfer | The daily transfer cap could be hit quickly once many people download. |
| Netlify (free) | 100 GB/month bandwidth | Static folder deploys. |

Recommendation for launch: **GitHub Pages** or **Cloudflare Pages**. Both are free, need no card and serve HTTPS static files with Range support. Move to R2 if packs grow large. Whichever host is chosen, the only code change is `PACK_BASE_URL`.

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
