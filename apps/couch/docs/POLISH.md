# Premium polish (polish-1013)

Owner request 13 Oct 2026, confirmed by the owner ("go polish") in the build session. Imported once as backlog tasks
tagged `polish-1013` (T37–T42) that outrank everything except trial blockers and open owner-comment tasks. Later runs
continue the rest. Brief as received:

> PREMIUM POLISH (owner request 13 Oct 2026, one-time import; skip the import if ops/backlog.json already has tasks tagged "polish-1013"): the owner wants the app to feel premium before his final test tonight. Add backlog tasks tagged "polish-1013" that outrank everything except trial blockers and open owner-comment tasks, and do as many as fit this run. Later runs continue the rest. Also copy this whole brief into docs/POLISH.md so later runs see it.

## Shared rules (all tasks)

1. `src/theme/motion.ts`: durations fast 120 / base 200 / slow 320 ms, one spring preset (damping ~18, stiffness ~220), ease-out curve. Every animation reads it. Respect Reduce Motion (reanimated useReducedMotion / AccessibilityInfo): swap movement for a short fade or nothing.
2. Navigation: smooth screen changes. Stack pushes use the native slide; sheets/modals spring up with a dimmed backdrop; tab switches cross-fade (navigator's own animation option if supported, else a 150 ms FadeIn on screen content). No navigation animation longer than ~350 ms; never block input.
3. A shared PressableScale component for all buttons/cards: scale 0.97 on press with the spring, light haptic (expo-haptics) on primary actions, selection haptic on toggles/sliders, success haptic on completions; a Haptics on/off setting.
4. Lists: staggered FadeInDown on first mount only (30 ms stagger, max 8 items), LinearTransition on add/remove/reorder.
5. Loading over ~300 ms shows a shimmer skeleton in the final layout instead of a spinner. Toasts spring in/out with a haptic.
6. Tabular figures for numbers, consistent elevation tokens, expo-blur glass only where contrast stays WCAG AA in light and dark, splash fades into the first screen after fonts load, designed empty states.
7. Guardrails: Expo Go-compatible libraries only (reanimated, gesture-handler, expo-haptics, expo-blur, expo-linear-gradient, react-native-svg); no new native modules; animate transform/opacity on the UI thread (60 fps); idle animations cheap and paused when the screen is unfocused or the app is backgrounded; no core-logic changes; tests and typecheck green. Record in RUNLOG/DECISIONS, say "premium polish" in the finish message, never claim real-device testing.

## Couch-specific (owner asked for this one by name)

- **P1 "Cinema glow" behind the remote:** the remote screen sits on a near-black backdrop with soft bias lighting behind the controls, like LED strips behind a TV. Build it from 2–3 large react-native-svg RadialGradients (blurred-looking, low saturation) behind the button area, slowly breathing (opacity ~0.55↔0.8, 6–8 s cycle) and drifting a few px; each key press sends a brief brighter pulse (~150 ms) from the pressed key's direction; power-on gives one slow warm swell. Glow setting in Settings: Warm amber (default) / Cool blue / Violet / Match TV (per saved TV colour) / Off. Reduce Motion = static glow, no breathing. Optional tasteful extra: a row of tiny dim "theatre marquee" dots along the top edge that ripple once when the TV connects. Keep it classy, not neon; buttons must keep AA contrast over the glow.
- **P2 Controls:** d-pad press = inner ring highlight + scale + haptic (heavier impact for Power); hold-to-repeat on volume/channel with a soft haptic tick per step and a floating volume HUD that springs in and fades; touchpad shows a fading light trail under the finger; voice button shows a breathing mic ring while listening.
- **P3 Connection:** status pill animates searching (shimmer) → connected (dot pops green once + success haptic) → reconnecting (amber pulse); TV switcher cards press-scale and the active TV name cross-fades in the header.
- **P4 Sheets (number pad, source picker, keyboard):** spring up with dim backdrop, keys press-scale with haptic.
- **P5 Apps tab:** icon tiles stagger in, press-scale; house-style fallback tiles get a subtle gradient sheen.

## How the build applies it (run 8 decisions, see ops/DECISIONS.md)

- Motion uses React Native's built-in `Animated` API with `useNativeDriver: true` (transform/opacity on the UI thread) and `LayoutAnimation` for list add/remove, instead of adding reanimated. Reason: reanimated 4 needs react-native-worklets plus a babel plugin, and the cloud cannot install or bundle-check new packages (npm registry unreachable), so a misconfiguration would break the owner's first Expo Go start. Built-in Animated gives the same UI-thread transform/opacity animation with no new dependency. Reduce Motion comes from `AccessibilityInfo`.
- The one new dependency is `react-native-svg` (ships in Expo Go) for the cinema glow's radial gradients; `npx expo install --fix` in START_TRIAL corrects its pin.
- Not used: expo-blur (no surface needs glass where AA contrast is guaranteed in both themes), expo-linear-gradient (the sheen uses react-native-svg gradients).
- Tasks: T37 foundation (motion tokens, reduce-motion hook, haptics kinds, PressableScale, FadeIn stagger, Skeleton shimmer, fx bus, elevation + tabular tokens, navigation animations, splash fade), T38 P1 cinema glow + Glow setting, T39 P2 controls, T40 P3 connection + toasts, T41 P4 sheets, T42 P5 apps tab + empty states.

## Remote themes (owner-1017, T56/T57)

- Tokens: `src/theme/remoteThemes.ts` (10 themes). Remote code reads them with `useRemoteTheme()` (`src/theme/useRemoteTheme.ts`), never `useTheme()`; `tests/remote-themes.test.ts` scans every file under `src/ui/remote`, the remote tab, the keyboard sheet, VolumeHud and StatusPill.
- Gating: only `src/plus/themes.tsx` (`PlusThemeProvider`, mounted in `app/_layout.tsx` inside `PrefsProvider`) reads the entitlement; it fills `RemoteThemeAccessContext` (`src/theme/RemoteThemeContext.ts`) with `{ plus, trying, tryTheme }`. "Try it" is session-only; buying Plus while trying keeps the tried theme. Without Plus a chosen Plus theme shows Midnight (never locked).
- Pref: `remoteTheme` (default `midnight`) in `src/core/prefs.ts`. The Glow setting gained `theme` (new default): the theme's own glow colour, none for themes without one. Explicit colours / Match TV / Off behave as before.
- Stage: `remoteStage(theme, glow)` in `src/ui/fx/glow.ts` picks the stage colour and the ink for text on it; AA is proven per theme and per glow colour in `glow.test.ts`.
- Press feel: `src/ui/remote/press.ts` maps the theme's press style to the key scale (`PRESS_SCALE`) and haptic weight (soft = selection tick, firm = light, click = medium; OK one step heavier; Power stays heavy).
- Texture: `src/ui/remote/RemoteTexture.tsx` + pure `textureArt.ts` (gradients, brushed stripes, sine woodgrain, neon edge light, drifting aurora). Aurora animates opacity/translate only, paused when idle/blurred, still under Reduce Motion. Peak alpha is capped so body text keeps AA (`tests/remote-themes.test.ts`).
- Sheets: `Sheet` takes an optional `palette`; Numpad, Source and Keyboard sheets pass the remote theme.
- D-pad geometry is untouched: every size comes from `dpadGeometry()`; the Themes screen's mini preview uses it too.

