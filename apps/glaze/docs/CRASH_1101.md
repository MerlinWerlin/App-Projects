# Crash: TestFlight 1.0.1 (17), wallpaper from a saved theme (T228)

**Report (iPhone, iOS 27.0.1):** "When applying the wallpaper from a saved theme in glaze, it crashed the app."

**Crash log:** `EXC_CRASH SIGABRT` on the main thread. A JS exception was thrown inside a Reanimated UI-thread worklet that a gesture drives:
`HermesRuntimeImpl::throwPendingError <- worklets::WorkletRuntime::runSync <- reanimated::UIEventHandler::process <- ReanimatedModuleProxy::handleEvent <- REANodesManager dispatchEvent <- RNGestureHandlerManager sendEventForReanimated`.
On iOS, an uncaught throw on the UI runtime aborts the whole app.

## Where

Only one gesture in the app runs on the UI thread through Reanimated: the Pan and Pinch pair in `src/ui/PhotoCropEditor.tsx`. It is the photo crop in the wallpaper maker (`app/wallpaper.tsx`, photo mode), which opens straight into the saved photo when you apply a saved theme's wallpaper. Every other gesture uses `.runOnJS(true)` (`ShowcaseGrid`, `app/live/[id].tsx`), and scroll events reach Reanimated through a different path.

## Most likely cause (fixed)

The UI-thread maths was imported from another module, `src/core/photoCrop.ts`, as `'worklet'` functions. Those functions:

- read module-level constants (`MIN_ZOOM`, `MAX_ZOOM`, `ZOOM_STRETCH`, `CROP_RUBBER`), and
- used default parameters (`rubberInto(..., coefficient = CROP_RUBBER)` and `cropInBounds(..., eps = 0.01)`).

`rubberInto` runs on every pan update when Reduce Motion is off. The default parameter's closure capture (`CROP_RUBBER`) and the module constants all depend on how the worklets Babel plugin serialises closures. The owner's build compiles with newer Reanimated and worklets pins than the repo's lockfile. If any of those identifiers is not captured there, the UI runtime throws `ReferenceError: Property 'CROP_RUBBER' doesn't exist`. That throw happens on the first drag, which matches the log.

We cannot reproduce this on a device here (the registry is offline), so this is the most likely cause, not a confirmed one.

**Fix:** the photoCrop worklets now have no default parameters and read no module constants. The limits are written as literals (1, 5, 0.5, 0.55), and a test asserts they equal the exported constants. Each worklet calls only worklets declared above it in the same module. `cropBounds` now always returns finite values with min <= max.

## Second suspect (fixed)

The `withDecay` momentum after a fling was built from `clamp: [b.minX, b.maxX]` and the gesture's velocity, with no validity check. A NaN anywhere in that path skipped the `< MIN_TRAVEL` guard (`NaN < 0.5` is false) and reached `withDecay`. NaN can come from a velocity or translation, or from a degenerate size. A saved theme is the usual case for zoomed, off-centre transforms, so it is also the case that most often takes the momentum path. Momentum now runs only when both clamp ends are finite, `hi - lo >= 0.5` and the velocity is finite. Otherwise the crop eases to the settled position. Event values (`translation*`, `velocity*`, `focal*`, `scale`) are checked with `Number.isFinite` before use.

Saved backgrounds were checked too. `sanitizeBackground` and `usesPhoto` already require `imageW` and `imageH` to be finite and >= 1, so a saved theme cannot hand the editor a size of 0 or NaN through `loadBackground`.

## Defensive (cannot crash any more)

- **Every UI-thread callback catches its own errors.** This covers every gesture callback in `PhotoCropEditor` and the `useAnimatedScrollHandler` and `useAnimatedReaction` bodies in `LargeTitleHeader` and `app/(tabs)/themes.tsx`. On an error, the crop hard-settles: it cancels its animations, resets the touch count, jumps to the clamped view (or the default view if that is not finite), re-enables the parent scroll and commits. It reports through `runOnJS` to a JS `console.warn`, and never rethrows. The completion callback of the settle animations is guarded the same way.
- **The static preview.** `PhotoCropEditor` mounts the live editor and its `GestureDetector` only when the photo size, the frame size and the cover size are all positive finite numbers. Otherwise it renders a static preview with no gestures, while the zoom and reset buttons and Save keep working.
- **`useAnimatedStyle` for the photo** falls back to an identity transform if any value is not finite.

## Guard

`src/core/workletGuard.test.ts` scans `src/` and `app/`, and it fails against the pre-fix code.

- Every Gesture chain without `.runOnJS(true)`, and every `useAnimatedScrollHandler`, `useAnimatedReaction` or `useAnimatedGestureHandler` callback, must be an inline arrow whose body is exactly `try { ... } catch { ... }`, and the catch must not throw.
- Calls inside those callbacks, and inside the file's own `'worklet'` functions, may only go to:
  - local worklets,
  - worklets exported by the allow-listed module `src/core/photoCrop.ts`,
  - Reanimated primitives (`withTiming`, `withDecay`, `withSpring`, `cancelAnimation`, `interpolate`, `runOnJS`, `scheduleOnRN`),
  - `Math.*`, `Number.*` and `String`.

  Anything else must go through `runOnJS(fn)(...)`.
- The allow-listed module's worklets may have no default parameters and may read no module constants or non-worklet helpers. They may only call worklets declared above them.
