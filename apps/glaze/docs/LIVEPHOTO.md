# Live Photo export (T11)

**Status: code-complete, not yet tested on a device.** Written without Xcode; spots we could not check are marked `// VERIFY` in `modules/glaze-livephoto/ios/GlazeLivePhotoModule.swift`.

"Save as Live Photo" in the Live editor turns a loop into a Live Photo in the user's library. It works on every supported iOS version, so it is the stopgap before iOS 26 (Live Lock Screen) and an alternative after it.

## Pieces

| File | Role |
|---|---|
| `src/core/livephoto.ts` (+ test) | Pure TS: builds and validates the JSON payload (clip ≤ 3 s, still in the middle, size from `exportSettings`). |
| `src/native/livephoto.ts` | Adapter: `isAvailable()` → `{available, reason: 'expo-go' \| 'android' \| 'not-built' \| null}`, `save(project, device)` → `'saved' \| 'denied' \| 'unavailable' \| 'unsupported' \| 'failed'`. Never throws. |
| `src/ui/LivePhotoSheet.tsx` | `SaveAsLivePhotoButton` + result sheet (how to set it, permission denied, needs the full build). |
| `modules/glaze-livephoto/` | Local Expo module `GlazeLivePhoto` (Swift, iOS 15.1+). `AsyncFunction("save")(json) -> "saved" \| "denied"`, rejects on failure. Autolinked from `modules/`. |
| `native-plugins/livephoto.json` | `NSPhotoLibraryAddUsageDescription`, merged only when `GLAZE_NATIVE=1`. |

App code reaches the module only through `src/native/livephoto.ts` (`requireOptionalNativeModule('GlazeLivePhoto')`), so Expo Go and Android get "unavailable" and the sheet explains that it needs the full build.

## Approach

A Live Photo is two files Photos pairs by a shared **content identifier** (a UUID):

1. **Permission:** `PHPhotoLibrary.requestAuthorization(for: .addOnly)`; anything other than authorized/limited returns `"denied"`.
2. **Composition:** `AVMutableComposition` with the trimmed source range, `scaleTimeRange` for speed, and an `AVMutableVideoComposition` that applies the track's `preferredTransform`, the crop and a scale to the output size (render size = payload width × height, 30 fps).
3. **Still:** `AVAssetImageGenerator` (zero tolerance, same video composition) grabs the frame at the middle of the clip.
4. **JPEG:** `CGImageDestination` writes the still with the MakerApple content identifier.
5. **MOV:** `AVAssetReader` (video composition output, BGRA) → `AVAssetWriter` (`.mov`, H.264, payload bitrate), with top-level content identifier metadata and a timed metadata track written through `AVAssetWriterInputMetadataAdaptor`.
6. **Save:** `PHPhotoLibrary.shared().performChanges` with `PHAssetCreationRequest.forAsset()`, `addResource(with: .photo, …)` + `addResource(with: .pairedVideo, …)` (files moved into Photos; temp files cleaned up either way).

## Metadata keys used

| Where | Key | Value |
|---|---|---|
| JPEG | `kCGImagePropertyMakerAppleDictionary` → key `"17"` | content identifier (UUID string) |
| MOV, top-level (`mdta` key space) | `com.apple.quicktime.content.identifier` | same UUID (UTF-8) |
| MOV, timed metadata track | `com.apple.quicktime.still-image-time` (identifier `mdta/com.apple.quicktime.still-image-time`, data type `com.apple.metadata.datatype.int8`) | int8 `0xFF` (-1), at the still time, one frame long |

## Limits

- **Length:** at most **3 s** of output, taken from the **start** of the loop's trim range (source window = 3 s × speed). The still frame is at the middle of that clip.
- **Size:** device resolution from `exportSettings(device, {codec: 'h264'})`, rounded down to even numbers (encoders need even sizes; e.g. 1179 → 1178 px).
- **Video only:** GIF loops are refused (`unsupported`; AVFoundation can't read GIF as video). Clips under 0.5 s are refused.
- **Sources:** `file://` URIs (what expo-image-picker gives). `ph://` URIs are not supported.
- No audio track. Crop falls back to a centred fill if the decoded orientation disagrees with the size the picker reported.

## Test on a development build

1. `GLAZE_NATIVE=1 npx expo prebuild --platform ios --clean` (the PC check: config + autolinking; needs no Xcode), then `eas build --profile development` and install.
2. Live tab → open a video loop → **Save as Live Photo**. Allow "Add Photos Only".
3. Photos: the newest item shows the LIVE badge; touch and hold to play ~3 s; the key photo is the middle frame.
4. Settings > Wallpaper > Add New Wallpaper > Photos → pick it → tap the Live Photo button → Add. Lock and wake: it should play briefly.
5. Edge cases: deny permission (sheet offers Open Settings), a GIF loop (explains), speed 0.5× and 1.5×, a heavily zoomed crop, a landscape source.
6. If Photos saves it as a still only, the pairing failed: check the three metadata keys above (e.g. `exiftool -MakerNotes:all` on the JPEG, `exiftool -QuickTime:all` on the MOV) and the `// VERIFY` spots.
