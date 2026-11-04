# M05 animation build — 4 November 2026

Jared asked to start building the kitty animations. Codex built the first executable motion pass in the existing Meow Manager app and kept the earlier planner at `/planner-reference`. The default route now opens the original 3D character scene. This is a motion/timing prototype; the accepted furry concept remains the art target. Physical iPhone performance, final body-joint skinning and production character art remain unverified.

## Delivered motion

| Clip | Duration | Acting |
|---|---:|---|
| Nap_to_ready | 7.2 s | Sleep, ear reaction, open eyes, uncurl/rise, stretch, straighten up, ready. |
| Chips_to_ready | 6.6 s | Nibble, notice the user, stop, put the snack away, brush/tidy, ready. |
| Idle | 4.6 s asset | Breathing, blink, small head/tail motion. |
| Greeting | 1.8 s | Raised forepaw, wrist wave, return to idle. |
| Listening | 3 s asset | Lean, head tilt, ear/brow reaction; microphone stays off in this review build. |
| Speaking | 3 s asset | Mouth, head and forepaw gestures. App demo follows the local speech utterance lifecycle. |

`src/character/motion.ts` is the pure authored director. Interruptions blend from the current pose, both openings finish at the same ready pose, backgrounding pauses the director and reduced motion skips the long entrance. `entrance.ts` stores a two-scene shuffle bag under a separate key; a new JS session selects once and quick foreground returns resume. A failed chooser save does not touch task storage.

`rig.ts` constructs an original articulated procedural mesh rig: exactly two forepaw and two hind-paw joints, a continuous skinned tail with eleven bones, separate eyes/brows/jaw, clothing and snack props. This is the first rig for refining acting; the stylised model is visibly simpler than the generated concept. No external model, image-to-3D service or video-generation service was used.

`StageView.tsx` uses Expo GL for iOS; `StageView.web.tsx` is the review renderer. Both use the same Three.js scene, rig and director. Native resizing, background pause, cleanup and reduced-motion paths are implemented. Mobile bundle export is compilation evidence, not real-device rendering evidence.

## Editable assets

`assets/character/mochi-motion-proof.glb` contains all six clips at 30 sampled frames per second. `mochi-motion-proof.blend` is a compressed editable Blender 4.4.3 import with inspection lights/camera. The GLB is about 1.48 MB; it is an editable handoff, while the app currently constructs the same rig directly.

```sh
npm run character:export
node scripts/verify-character.ts
"C:/Program Files/Blender Foundation/Blender 4.4/blender.exe" --background --python scripts/blender-motion-proof.py
```

The manifest hashes the motion, rig and exporter sources. The independent verifier reloads the GLB through GLTFLoader, checks six clip names/four paws/a skinned tail and samples 126 exported frames for finite transforms. Blender import separately confirmed six actions, six NLA track families and four paws. Reports are saved beside the asset. The first limb-count test incorrectly counted meshes called `paw_fur`; the corrected check counts the four actual paw-joint names. A first script typecheck lacked Node types; asset scripts now have a separate checked TypeScript configuration.

## Runtime review evidence

The real local app ran at `http://127.0.0.1:8102/` in the in-app browser. The viewport was set to 390 × 844 for phone framing. Browser observations during review were around 30–32 fps, roughly 209k rendered triangles and 132–143 draw calls; these are machine-specific observations, not iPhone benchmarks. The host's reduced-motion setting initially skipped the entrances as intended; recording explicitly enabled the full motion in the review controls.

The app's review-only canvas recorder captured the wake-up and chips sequences without a microphone/audio stream. Unmodified WebM files remain under `docs/animation-proof/raw`; H.264 MP4 review copies and frame sheets are next to them. Initial contact sheets revealed nap edge clipping, so the nap starts farther back and the camera stays fixed through menu interruptions. Final recordings are identified separately from the initial ones. The recording button briefly timed out in browser automation while the eight-second recording continued normally; the finished download was retrieved through the visible save link.

Local checks: 39 Node tests, app/script TypeScript, SDK dependency check and Expo doctor21/21 passed. iOS and web exports passed. CI and final source identity are recorded in `ops/status.json` and `ops/RUNLOG.md`. Runtime tests cover actual motion logic; no tests were added merely for the documentation or art records.

## Remaining proof

The main remaining work is artistic refinement toward the accepted professional kitty, better curled-body/shoulder deformation and physical iPhone GL/performance/thermal testing. Speech is a local demonstration with mouth acting; phoneme-level lip sync and real microphone recognition are not implemented. The full assistant/tool integrations remain separate. No TestFlight upload, store submission or final animation-quality approval is claimed.

References used for the renderer/asset path: [Expo GL for SDK57](https://docs.expo.dev/versions/v57.0.0/sdk/gl-view/), [Three.js animation system](https://threejs.org/manual/en/animation-system.html), [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html). Existing App Factory repository and release workflows are retained.
