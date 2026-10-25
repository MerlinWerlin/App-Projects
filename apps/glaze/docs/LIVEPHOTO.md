# Live Photo export (T11)

**Status: code-complete, not yet tested on a device.** Written without Xcode; spots we could not check are marked `// VERIFY` in `modules/glaze-livephoto/ios/GlazeLivePhotoModule.swift`.

"Save as Live Photo" in the Live editor turns a loop into a Live Photo in the user's library. T127 (24 Oct): the Now Playing mode was taken out of the UI. The editor's primary button is "Save as Live Photo", and `src/ui/LivePhotoGuide.tsx` shows three illustrated steps for trying it as a wallpaper: Photos > Share > Use as Wallpaper > Live Photo on. Apple's facts and sources are in docs/OWNER_1024E.md (part C).

## Decision 25 Oct 2026 (T147, owner feedback fb-1025 C)

**Owner test (TestFlight build):** saving works, but using the saved Live Photo as the Lock Screen wallpaper did **not** move (he answered No).

**Evidence:**
- Apple DTS engineer on the developer forums, <https://developer.apple.com/forums/thread/798044>: Live Photos created by apps (not captured by the Camera) have "undocumented requirements" to be usable as Live Wallpapers; DTS recommends against reverse-engineering them and suggested a Feedback Assistant request for a public API.
- Other reports, e.g. <https://developer.apple.com/forums/thread/768984>: "Motion not available" for app-made Live Photos as wallpapers since iOS 16/17.
- Our module already does the standard pairing (MakerApple key 17, QuickTime content identifier, still-image-time track, one `PHAssetCreationRequest` with `.photo` + `.pairedVideo`), so this is not a missing step we know how to fix.

**Decision (owner direction 24 Oct: "good enough to ship"; themes, icons, widgets and wallpaper packs are the pitch):** keep the Live Photo maker. It saves a real Live Photo that plays in Photos when you touch and hold it. The app no longer promises it moves as an iPhone Lock Screen wallpaper. The copy (catalogue `liveUi.*`, `live.tab.subtitle`, the Live tips) says, in all 11 languages: it saves a Live Photo to Photos that moves when you press it; you can try it as a wallpaper (Photos > Share > Use as Wallpaper), but iPhone often shows Live Photos made by apps as a still or says "Motion not available"; that is an Apple limit, not your phone; for a wallpaper that always works, pick a still one in Wallpapers. Android keeps its real looping live wallpaper. Guarded by `src/core/fb1025Live.test.ts`. Not tested on a device after the copy change. What would reopen it: `docs/future/live-wallpaper/README.md`, "Live Photo as wallpaper (25 Oct 2026)".

## Wallpaper recipe (run 120)

**Status: written, not verified on a device.** T153 (owner brief 25 Oct 21:29: "the Live Photo wallpaper must work"). After the owner's test (saved fine, did not move as the Lock Screen wallpaper), we looked for what other developers found makes app-made Live Photos accepted by iOS 17+ "Use as Wallpaper". Apple documents none of it (DTS: "undocumented requirements", <https://developer.apple.com/forums/thread/798044>), so every row below is community reverse-engineering. No code was copied; only the reported facts.

Sources:
- **[LP]** LivePaper (MIT, Mac app, "turn any video into a moving iPhone lock-screen wallpaper"), README <https://github.com/Yuyang16Z/LivePaper> and byte-level notes <https://github.com/Yuyang16Z/LivePaper/blob/main/docs/FINDINGS.md>. Pass/fail tests on a device, one change at a time. Strongest source.
- **[OWE]** open-wallpaper-engine-mac PR #288 "Exported Live Photos move on the Lock Screen" (13 Oct 2026), <https://github.com/deepratna-awale/open-wallpaper-engine-mac/pull/288>. Description read; the metadata Swift files could not be fetched (robots), so only the description's claims are used.
- **[MR]** MacRumors thread "iOS 17 - Live Photos 'Motion Not Available' (Lock Screen)", <https://forums.macrumors.com/threads/ios-17-live-photos-motion-not-available-lock-screen.2403161/page-3> (user reports; area7: "1 video of 1 second, 60 fps, 1080x1920, hevc compressed"; Bostonbanana: image from 0.5 s).
- Also read: <https://developer.apple.com/forums/thread/768984> (no fix, "Motion not available" since iOS 16), <https://www.videotoliveios.com/post/tips-on-creating-live-wallpaper-for-ios-17> (claims a 3 s minimum, contradicted by [LP] and [OWE]), Apple <https://support.apple.com/120734> (iOS 17+, "plays whenever you wake up your device", play button on).

| # | Requirement | What Glaze now does | Source | Confidence |
|---|---|---|---|---|
| 1 | Video long side ≤ 1920 px (1080 x 1920 passed; 1440x2560 and 2304x4096 failed) | Always **1080 x 1920** portrait; the user's crop is aspect-filled to 9:16 around its centre (`fillCrop`, `LIVE_PHOTO_WALLPAPER_SIZE`) | [LP] tests, [OWE], [MR] | High |
| 2 | **HEVC** paired video ("H.264 always failed") | HEVC Main (`kVTProfileLevel_HEVC_Main_AutoLevel`), no frame reordering, a key frame every second, ~5 Mbit/s. We used H.264 before: likely a cause of the owner's failure | [LP] tests, [OWE], [MR] | High |
| 3 | Frame rate | **30 fps** (camera Live Photos are ~24-30; [LP] says fps isn't checked and 60 fps conversions play choppy) | [OWE], [LP] | Medium (60 fps from [MR] not needed) |
| 4 | Duration | **1 to 3 s** (`LIVE_PHOTO_MIN_MS` 1000, `LIVE_PHOTO_MAX_MS` 3000). [LP]: 3, 4, 5 s passed, 6 s failed | [OWE], [LP] | High |
| 5 | Key photo is a frame of the video, not at 0 s | Middle frame, never before **0.5 s**, snapped to a frame boundary; the still is grabbed from the same composition at that time | [LP] tests, [OWE], [MR] | High |
| 6 | HEIC still | **HEIC** with MakerApple key 17; JPEG only if the device can't encode HEIC | [LP], [OWE] | Medium (both working exporters use HEIC; not tested as the deciding factor) |
| 7 | `com.apple.quicktime.still-image-time` value **-1** (int8 0xFF), was 0 | -1 in the wallpaper recipe | [LP] bytes, [OWE] | High |
| 8 | still-image-time sample in the **600** timescale (other timescales lost the empty edit and moved the sample to 0 s) | `mediaTimeScale = 600` on the metadata and video inputs; the group starts at the still time in 600 | [LP], [OWE] | Medium (`// VERIFY` that the writer honours it) |
| 9 | `com.apple.quicktime.live-photo-still-image-transform` = identity 3x3 Float64, in the same sample as still-image-time | Written (`kCMMetadataBaseDataType_AffineTransformF64`, `NSValue(cgAffineTransform: .identity)`) | [LP] bytes, [OWE] | Medium (`// VERIFY` data type) |
| 10 | Metadata track references the video track (`cdsc`) | `addTrackAssociation(... .metadataReferent)` | [OWE] | Medium |
| 11 | Per-frame timed metadata `mdta/com.apple.quicktime.live-photo-info` (144-byte samples) carrying the **iPhone camera's own values** | **Not done.** [LP] found zeroed or made-up payloads fail (V3, V5) and only real camera values pass; we have no such record and the exact fields iOS reads are unknown. This is the most likely reason it may still not move | [LP] tests, [OWE] | High that it matters; no safe way to fake it |
| 12 | Movie-level `com.apple.quicktime.live-photo.vitality-score` (1.0) / `vitality-scoring-version` | **Not added.** [LP]: camera files carry it but it is not required, and 1.0 changed nothing. No source found for the scoring-version value | [LP] | Medium |

Unchanged pairing: MakerApple 17 = content identifier, top-level `com.apple.quicktime.content.identifier`, still-image-time track, one `PHAssetCreationRequest` with `.photo` + `.pairedVideo`.

**Fallbacks:** if the wallpaper recipe fails to write (e.g. a VERIFY spot is wrong), the module retries without the still-image-transform item, then with the T127 recipe (H.264, JPEG, value 0, device-independent 1080 x 1920). Save as Live Photo keeps working either way; each failure is logged (`GlazeLivePhoto: recipe … failed`).

**Copy:** unchanged. Because row 11 is missing, Glaze cannot honestly say it now builds "the wallpaper format iPhone expects". The guide keeps saying it saves a Live Photo that moves when you press it, you can try it as a wallpaper, and iPhone often keeps app-made Live Photos still ("Motion not available"). Apple's article says a working Live Photo wallpaper plays when you wake the iPhone; it never loops. If the owner's next test moves, the copy can change to "moves when you wake your iPhone" (all 11 languages, `fb1025Live.test.ts`).

**Next step if it still says Motion not available:** the owner records one Live Photo with the iPhone Camera and sends the original file (AirDrop → Mac keeps the .MOV); we extract its `live-photo-info` setup and sample (row 11) and test writing it per frame. Guards: `src/core/t153LiveWallpaper.test.ts`.

## Pieces

| File | Role |
|---|---|
| `src/core/livephoto.ts` (+ test) | Pure TS: builds and validates the JSON payload (clip ≤ 3 s, still in the middle, size from `exportSettings`). |
| `src/native/livephoto.ts` | Adapter: `isAvailable()` → `{available, reason: 'expo-go' \| 'android' \| 'not-built' \| null}`, `save(project, device)` → `'saved' \| 'denied' \| 'unavailable' \| 'unsupported' \| 'failed'`. Never throws. |
| `src/ui/LivePhotoSheet.tsx` | `SaveAsLivePhotoButton` + result sheet (moves in Photos, how to try it as a wallpaper and why it may stay still, permission denied, needs the full build). |
| `modules/glaze-livephoto/` | Local Expo module `GlazeLivePhoto` (Swift, iOS 15.1+). `AsyncFunction("save")(json) -> "saved" \| "denied"`, rejects on failure. Autolinked from `modules/`. |
| `native-plugins/livephoto.json` | `NSPhotoLibraryAddUsageDescription`, merged only when `GLAZE_NATIVE=1`. |

App code reaches the module only through `src/native/livephoto.ts` (`requireOptionalNativeModule('GlazeLivePhoto')`), so Expo Go and Android get "unavailable" and the sheet explains that it needs the full build.

## Approach

A Live Photo is two files Photos pairs by a shared **content identifier** (a UUID):

1. **Permission:** `PHPhotoLibrary.requestAuthorization(for: .addOnly)`; anything other than authorized/limited returns `"denied"`.
2. **Composition:** `AVMutableComposition` with the trimmed source range, `scaleTimeRange` for speed, and an `AVMutableVideoComposition` that applies the track's `preferredTransform`, the crop and a scale to the output size (render size 1080 × 1920, 30 fps; T153).
3. **Still:** `AVAssetImageGenerator` (zero tolerance, same video composition) grabs the frame at the middle of the clip (never before 0.5 s, on a frame boundary).
4. **HEIC (JPEG fallback):** `CGImageDestination` writes the still with the MakerApple content identifier.
5. **MOV:** `AVAssetReader` (video composition output, BGRA) → `AVAssetWriter` (`.mov`, HEVC; H.264 only in the T127 fallback), with top-level content identifier metadata and a timed metadata track written through `AVAssetWriterInputMetadataAdaptor`.
6. **Save:** `PHPhotoLibrary.shared().performChanges` with `PHAssetCreationRequest.forAsset()`, `addResource(with: .photo, …)` + `addResource(with: .pairedVideo, …)` (files moved into Photos; temp files cleaned up either way).

## Metadata keys used

| Where | Key | Value |
|---|---|---|
| HEIC (JPEG fallback) | `kCGImagePropertyMakerAppleDictionary` → key `"17"` | content identifier (UUID string) |
| MOV, top-level (`mdta` key space) | `com.apple.quicktime.content.identifier` | same UUID (UTF-8) |
| MOV, timed metadata track | `com.apple.quicktime.still-image-time` (identifier `mdta/com.apple.quicktime.still-image-time`, data type `com.apple.metadata.datatype.int8`) | int8 `-1` (T153 wallpaper recipe; `0` in the T127 fallback), at the still time in the 600 timescale, one frame long |
| MOV, same timed metadata sample | `com.apple.quicktime.live-photo-still-image-transform` (data type affine-transform-F64) | identity 3x3 (T153) |

## Limits

- **Length:** at most **3 s** of output, taken from the **start** of the loop's trim range (source window = 3 s × speed). The still frame is at the middle of that clip.
- **Size:** always 1080 × 1920 (T153; long side over 1920 px fails as a wallpaper). The user's crop is aspect-filled to 9:16 around its centre.
- **Shortest:** 1 s of output (T153).
- **Video only:** GIF loops are refused (`unsupported`; AVFoundation can't read GIF as video). Clips under 1 s are refused.
- **Sources:** `file://` URIs (what expo-image-picker gives). `ph://` URIs are not supported.
- No audio track. Crop falls back to a centred fill if the decoded orientation disagrees with the size the picker reported.

## Test on a development build

1. `GLAZE_NATIVE=1 npx expo prebuild --platform ios --clean` (the PC check: config + autolinking; needs no Xcode), then `eas build --profile development` and install.
2. Live tab → open a video loop → **Save as Live Photo**. Allow "Add Photos Only".
3. Photos: the newest item shows the LIVE badge; touch and hold to play ~3 s; the key photo is the middle frame.
4. Photos → the item → Share → Use as Wallpaper → Live Photo button on if offered → Add, then lock and wake the iPhone. T153: this is the test that matters. Note whether the Live Photo button is offered, whether it says "Motion not available", and whether it moves on wake, with the iOS version. Also note which recipe ran (Console: `GlazeLivePhoto: recipe … failed` lines mean a fallback). If it stays still, see "Next step" in "Wallpaper recipe (run 120)".
5. Edge cases: deny permission (sheet offers Open Settings), a GIF loop (explains), speed 0.5× and 1.5×, a heavily zoomed crop, a landscape source.
6. If Photos saves it as a still only, the pairing failed: check the three metadata keys above (e.g. `exiftool -MakerNotes:all` on the JPEG, `exiftool -QuickTime:all` on the MOV) and the `// VERIFY` spots.
