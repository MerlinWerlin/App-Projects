# M06 — 2D frame animation revision, 4 November 2026

Jared rejected M05's visual movement: the wake-up looked unlike a cat and the repetitive snack gesture read badly. He authorised a fresh approach and suggested blending 2D frames. The default route now opens a 2D character study. The rejected 3D code, original GLB/Blender assets and recordings remain intact at `/rig-reference` and in the M05 folders; their passing technical checks never established acceptable movement quality. The planner remains at `/planner-reference`.

## Current approach

An original fluffy ginger-and-cream professional kitty rests two forepaws on a desk. The lower45percent of the sprite, including clothing and paws, always comes from one drawing. Only the upper55percent changes. Six512px keyframes were generated in one3×2sheet; five are used: open eyes, half blink, closed eyes, a small ear change and a sideways glance. The sixth head-tilt drawing is retained as source but excluded from playback because its silhouette ghosted during a dissolve. Proper drawn in-betweens are required before adding that movement.

Two short arrivals alternate on a fresh JS session: a seated doze becomes attentive, or a cat watching the room looks back. Both settle into the same open-eyed drawing. Tapping triggers a slow-blink greeting. Idle holds the pose for long intervals with occasional blink/ear changes. Menus can interrupt; short blends start from the current facial mix. Foreground returns resume, backgrounding pauses, and reduced motion displays a static face. There is no full-body rotation, waving arm, snack prop, walking or deforming torso in this version.

Facial blends are short weighted dissolves, not optical-flow interpolation or newly drawn in-between frames. Larger pose changes would need additional artwork. Listening currently holds the attentive open face. Local device speech is a voice preview; the mouth stays closed, there is no lip sync, and the microphone stays off.

## Art and implementation

All artwork was generated with the built-in image-generation tool. [The exact three prompts](character-direction/2d-generation-prompts.md) and references are recorded. Both master-sheet outputs and the original room artwork live in `assets/companion/`. The first sheet's pale semi-transparent background failed compositing review; a background-extraction edit corrected the alpha. An alpha-channel preview and the real dark-room render were checked. Generated drawings are not assumed pixel-identical: the player deliberately uses one constant lower-body crop.

`scripts/prepare-frames.ts` uses FFmpeg for exact cell crops and the runtime room JPEG. `scripts/verify-frames.ts` checks all ten image hashes, six512×512 RGBA crops and manifest structure. It does not establish anatomy or perceived motion quality. The runtime image assets total about2.45MB before platform packaging; sources are retained separately and referenced only where needed.

`src/companion/timeline.ts` is the shared pure facial director. Native `FrameStage.tsx` uses preloaded React Native images; web `FrameStage.web.tsx` draws the same layers/timeline to a2D canvas. Neither active renderer uses the earlier3D rig or GL context. The old dependencies remain because the historical rig route is preserved. All six facial images preload before the clock starts. The session chooser has its own AsyncStorage key, separate from tasks and the previous3D selector. No external assistant service or network integration was added.

Reproduce/check from the app folder:

```sh
node scripts/prepare-frames.ts
npm test
npm run typecheck
npx expo export --platform ios --platform web
```

FFmpeg is needed to regenerate crops and review movies; ordinary tests only read the committed artwork. A preflight caught React Native Web's lack of the native `Image.resolveAssetSource` static helper; the web loader now reads Expo's exported asset URI directly. A visual pass also removed the ghosting head tilt. These were corrected before closeout.

## Verification and review

47 tests pass locally:26 planner checks,13 retained historical rig checks, and8 new checks for2D entrance selection, common ready state, stable normalized facial mixes, interruptions, pause/resume, reduced motion and alpha compositing. App/script TypeScript passes. Current local iOS/web exports pass. CI source identity and receipts are recorded in `ops/status.json` and `ops/RUNLOG.md`; compilation and technical checks do not substitute for art review or real-device playback.

The real app was reviewed at390×844 in the in-app browser at `http://127.0.0.1:8102/`. The host initially requested reduced motion, which correctly skipped the entrance. The review recorder explicitly enables full motion. It records the actual canvas with no audio stream; the raw WebM retains the device-pixel-resolution recording, while the MP4 review copy is390×844 at30fps using held frames where necessary. This is an actual renderer capture, not a generated video. The screenshot includes the surrounding app controls. Earlier recorder iterations are preserved beside the final review.

The recording measurements compare changing eye pixels with the lower-body region in a lossy video; they are diagnostic values, not an artistic approval or an exact pixel-lock certificate. The source renderer's lower-body image remains fixed. See `docs/frame-animation-proof/` for the playable clip, source recording, screenshots and sampled frames.

## Remaining limits

This is a restrained facial animation prototype. It does not yet provide full2D locomotion, curled sleep, eating, expressive speaking or a broad set of opening activities. Those need authored sequential drawings with consistent anatomy and in-between poses. Physical iPhone playback, memory, frame pacing and lifecycle testing remain unverified. Final character-art and animation approval remain with Jared; no TestFlight upload or store submission is claimed.
