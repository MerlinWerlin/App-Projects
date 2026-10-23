# Performance + accessibility pass (T15)

Numbers below come from Node (`src/core/perf.test.ts`, run by `npm test`) on the cloud build box. Nothing here was measured on an iPhone; on-device checks are listed at the end for the PC/device verification run.

## Profile size and build time (60 icons)

`perf.test.ts` builds a bulk-install profile for 60 icons whose PNG payloads are random base64 of realistic 180×180 PNG sizes (seeded, so runs are comparable). Cap per profile: `DEFAULT_MAX_PROFILE_BYTES` = 2.5 MiB.

| Case | PNG size each | Raw PNG total | Profile output | Files | `buildProfiles` median (5 runs) |
|---|---|---|---|---|---|
| Typical | 12–25 KB | 1.08 MB | 1,605 KB | 1 | 13–17 ms |
| Small | 12 KB | 0.70 MB | 1,062 KB | 1 | 6–12 ms |
| Large | 25 KB | 1.46 MB | 2,163 KB | 1 | 11–18 ms |
| Photo-heavy | 40 KB | 2.34 MB | 2,518 KB + 916 KB | 2 | 17 ms |

- Base64 plus 68-column indented line wrapping and the per-icon plist dict make the profile about 1.45× the raw PNG bytes.
- A typical 60-icon set fits in **one** profile. Only sets with many photo icons (about 40 KB each) split, here into 2.
- `estimateSize` lands within 5% of the real output, so the splitter's grouping is reliable.
- Building takes well under 1 s (about 10–20 ms in Node). On a phone's JS engine it should still be a small fraction of the render time.

## Icon generation (batch capture)

`OffscreenIconRenderer` (src/render/OffscreenRenderer.tsx), reviewed for 60 icons:

- **One icon mounted at a time.** The renderer holds a single `job`. Each icon is mounted, captured and then replaced by the next, so view memory stays flat no matter how many icons there are. Calls to `renderAll` are queued and never interleaved.
- **Waits only where they're needed.** Each icon waits 2 animation frames. The extra 150 ms settle (plus 1 frame) runs only when `overrideImage` is set (a user photo, which loads asynchronously). Glyph and gradient icons skip it.
- **Progress.** `onProgress(done, total, appId)` fires once per captured icon, and the install screen's progress bar shows "Drawing icons n of 60".
- **Cancel (new).** `renderAll` takes an optional 4th argument, `cancel?: { cancelled: boolean }`. The flag is checked before each icon and once more at the end. When it is set, `renderAll` rejects with `RenderCancelledError`, which you can test with `isRenderCancelled(e)`. The 3-argument form still works exactly as before, so existing callers are unaffected (for example `pinAllWithFeedback`).
- `app/install.tsx` now shows a **Cancel** button while icons are drawing, both for the bulk profile and for Save to Photos. A cancel goes back to idle without showing an error. Leaving the screen sets the token, so a batch stops before the next icon instead of going on with an unmounted renderer.
- Estimated time per icon is about 2 frames, plus view-shot capture, plus mount. At 60 Hz that is roughly 60–80 ms, so a 60-glyph set should take about 4–5 s, and each photo icon adds about 170 ms. **These are estimates and need confirming on a device.**
- Memory for the results is 60 base64 strings, about 1.5 MB in total at 180 px. The 360 px Photos path uses about 4× that, which is still small.

## Large videos

- `src/store/loops.ts` copies a picked video with `FileSystem.copyAsync`, file to file. No code path reads video bytes into JS (no base64 or string reads of video). The editor and the Live tab give `expo-video` a file URI.
- `VideoMedia` in `app/live/[id].tsx` creates exactly **one** player with `useVideoPlayer(uri, …)`. That hook creates the player once per source and releases it on unmount. Re-renders (trim, speed, crop) only change properties on the existing player, so no extra player is created per render.
- **New inline warning** in the editor when the video is over 500 MB or longer than 10 minutes, phrased "Previews may be slow… trimming it to a short clip in Photos first works best". The size comes from `FileSystem.getInfoAsync` (metadata only). Helpers: `sourceFileBytes`, `largeSourceIssue` (returns `'big' | 'long' | 'bigAndLong'`; the editor shows `live.editor.largeSource.*` in the app language), `LARGE_VIDEO_BYTES` and `LONG_VIDEO_MS` in `src/store/loops.ts`.

## Reduced motion

- New `useReduceMotion()` hook (`src/ui/useReduceMotion.ts`). It uses the Glaze setting (on/off) when one is chosen and otherwise the system Reduce Motion preference, using the same rule as Toast (`shouldReduceMotion`). It updates live when either one changes.
- `Sheet` (every bottom sheet, built on RN `Modal`) uses `animationType="fade"` instead of `"slide"` when motion is reduced.
- Toast already handled reduced motion. The progress bar is not animated (its width is set directly), and no other `Animated`, Reanimated or `LayoutAnimation` use was found in the screens this pass covered.

## Dynamic Type

- Small containers that hold text now grow with it instead of clipping: the step-number badges in `LivePhotoSheet`, `LiveUnavailableSheet` and `StepCard` use `minWidth`/`minHeight`.
- The trim labels row in the Live editor wraps at large sizes.
- Buttons and the name field already use `minHeight: touch`.
- `maxFontSizeMultiplier={1.6}` is set **only** on the tiny labels inside `HomeMock` (the icon labels and the 9:41 status bar). These are drawn to scale inside a fixed phone frame. `IconTile` takes a new optional `maxFontSizeMultiplier` prop, which has no cap by default.

## VoiceOver

- Icon tiles now get grouped, descriptive labels from `iconAccessibilityLabel()` (`src/render/a11y.ts`), using the app name, shape and fill. Examples: "Spotify icon, squircle, purple to pink gradient", "Mail icon, circle, white", "Notes icon, blob, photo". Colour names are coarse and speakable (red/orange/yellow/green/teal/blue/purple/pink/grey/black/white, plus a light or dark prefix). Since T48 every word comes from the `iconsUi.a11y` catalogue, so the label follows the app language.
- The Icon Studio "my apps" chips read "Edit Music icon, squircle, purple gradient".
- `ProgressBar` already used `accessibilityRole="progressbar"` with `accessibilityValue {min: 0, max: 100, now}`. This pass confirmed it with no change.
- The Live editor's large-video warning is announced as an alert.

## Still to check on a device (not done here)

- Time for a 60-icon render at 180 and 360 px, and peak memory during the batch (Xcode Instruments, Allocations).
- Sheets with Reduce Motion on, and Dynamic Type at AX5 on Install, Icons and the Live editor.
- A 1 GB / 15-minute video in the editor: the warning shows and there is no JS heap spike.
