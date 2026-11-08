# Design v2: an iOS-native look for Couch (market-1018 M3)

Owner brief: docs/OWNER_1018.md, M3. Market input: docs/MARKET.md, "UI patterns worth adopting".
T67 wrote this spec and built the shared primitives. T68 migrates the screens one at a time, keeping
tests green.

The goal is that Couch looks like it belongs on iOS, following Apple's Human Interface Guidelines:
- large titles that collapse on scroll
- inset-grouped lists
- continuous-corner cards and capsule buttons
- layered soft shadows
- translucent materials
- system font weights
- springy presses with haptics

What does not change:
- The remote keeps its identity and its themes (owner-1017 section F).
- Every TV control stays free.
- The look is our own. We adopt the platform's patterns, never another app's art, wording or overall look.

## Where things live

| What | File |
|---|---|
| Tokens: palette, type, radii, spacing, shadows, materials, press | `src/theme/design.ts` (pure TS, tested in `design.test.ts`) |
| Large-title collapse maths | `src/ui/v2/headerCollapse.ts` (pure, tested) |
| Pill colours per variant | `src/ui/v2/pillColors.ts` (pure, tested) |
| Primitives | `src/ui/v2/` — `LargeTitleHeader`, `InsetGroupedList` + `Row`, `Card`, `PillButton`, `BlurMaterial` |
| Palette context | `src/ui/v2/useDesign.tsx` — `useDesign()`, `DesignProvider`, `RemoteDesignProvider` |
| Optional blur | `src/ui/v2/blurRegistry.ts` (see Materials) |
| Rule guard | `src/ui/v2/v2-guard.test.ts` |

v1 tokens (`src/theme/tokens.ts`) stay until T68 has moved every screen.

### Dependency decision

`expo-blur` and `expo-linear-gradient` are in package.json since run 42 (oversight D72-1; both ship
in Expo Go and START_TRIAL/VERIFY run `npx expo install expo-blur expo-linear-gradient` for the
SDK-correct pins). `react-native-reanimated` and `react-native-gesture-handler` are **not** in
package.json, and the cloud cannot install packages. The run-8 decision in docs/POLISH.md applies, so
v2 uses only built-in tools:
- **Animation:** React Native's `Animated` with `useNativeDriver: true`, including a native-driver
  `Animated.event` scroll handler, so the collapse runs on the UI thread with no JS round trip.
- **Blur:** a runtime registry instead of a static import. Until expo-blur is registered, every
  material draws its solid fallback, which already meets AA.

## Palette

The colours are semantic roles (`DesignPalette`), not raw values. Light uses the iOS grouped greys.
Dark uses true black with raised `#1C1C1E` cells. Couch's blue is the tint.

| Role | Light | Dark | Used for |
|---|---|---|---|
| background | `#F2F2F7` | `#000000` | Screen behind grouped lists |
| surface | `#FFFFFF` | `#1C1C1E` | Rows, groups, solid material |
| surfacePressed | `#E5E5EA` | `#2C2C2E` | Row highlight while pressed |
| card / cardEdge | `#FFFFFF` / none | `#1C1C1E` / `#2C2C2E` hairline | Cards. Dark cards separate by an edge, not a shadow |
| label | `#111418` | `#F5F5F7` | Primary text |
| secondaryLabel | `#5C5F66` | `#AEAEB2` | Subtitles, values, section headers |
| tertiaryLabel | `#8A8A8F` | `#7C7C80` | Chevrons and glyphs only (non-text, 3:1) |
| separator | `#C6C6C8` | `#38383A` | Hairlines |
| fill | `#E9E9EE` | `#2C2C2E` | Switch off track, tinted destructive pill |
| tint / tintInk | `#2F5BD3` / `#FFFFFF` | `#86A6FF` / `#0B1020` | Filled pill, switch on, selection |
| tintedFill / tintedLabel | `#E3EAFB` / `#2448B0` | `#1E2A47` / `#A9C0FF` | Tinted pill |
| tintLabel | `#2F5BD3` | `#86A6FF` | Plain pill, links, row "detail" |
| destructive | `#B83434` | `#FF7A72` | Delete / forget |
| success / warning | `#2C7A54` / `#8A5E10` | `#6CC796` / `#E5B35A` | Status |

**Contrast is proven, not eyeballed.** `designPairs()` lists every text/background pair the
primitives draw. `design.test.ts` checks each pair:
- 4.5:1 for text
- 3:1 for non-text (chevrons, switch track, status dot)

It runs for light, dark **and all ten remote themes**. The pill labels are checked for every variant
and tone too.

### Remote themes still apply

`remoteDesignPalette(theme)` derives the same roles from a `RemoteTheme` (`src/theme/remoteThemes.ts`):

| v2 role | Remote theme colour |
|---|---|
| surface | body |
| fill | key |
| label | ink |
| secondaryLabel | muted |
| tint | accent |
| tintInk | accentInk |
| tintedFill | accentSoft |
| destructive | power |
| success | ok |
| warning | warn |

Rules for the mapping:
- **Fallback to ink:** a role whose natural colour is not AA on that theme falls back to the theme's
  ink (`pickReadable`). Examples are accent text on Candy's body and Retro's dark stage.
- **Materials and shadows** follow the body's lightness, not the status-bar scheme. Retro Wood has a
  dark status bar over a cream body.
- **How to apply it:** the remote tab, and every sheet opened from it, wrap their content in
  `<RemoteDesignProvider theme={useRemoteTheme()}>`.
- **Everything else is untouched:** the remote keys, d-pad, glow and textures keep reading
  `useRemoteTheme()` directly. The d-pad geometry and NeverMirror stay as they are.

## Type

Text sizes and weights:
- **UI text uses the system font** (SF Pro on iOS, Roboto on Android): leave `fontFamily` unset and
  set `fontWeight`.
- **Large titles and titles keep Couch's display font** (Sora Bold), so the brand stays recognisable.
- **Numbers that change in place** keep JetBrains Mono with tabular figures.
- **Other scripts:** `src/ui/Text` still swaps brand fonts for the system font in CJK, Devanagari
  and Arabic, with taller lines.

| Role | Size / line | Weight | Family | Dynamic Type cap |
|---|---|---|---|---|
| largeTitle | 34 / 41 | 700 | display | 2.0x (wraps) |
| title1 | 28 / 34 | 700 | display | 2.0x |
| title2 | 22 / 28 | 700 | display | – |
| title3 | 20 / 25 | 600 | system | – |
| headline | 17 / 22 | 600 | system | – |
| body | 17 / 22 | 400 | system | – |
| callout | 16 / 21 | 400 | system | – |
| subheadline | 15 / 20 | 400 | system | – |
| footnote | 13 / 18 | 400 | system | – |
| caption1 / caption2 | 12 / 16, 11 / 13 | 400 | system | – |
| navTitle | 17 / 22 | 600 | system | 1.4x (fixed bar) |
| button | 17 / 22 | 600 | system | – |
| numeric | 17 / 22 | 400 | mono, tabular | – |

`textStyle(role)` returns the style object.

**Dynamic Type rule: text wraps and never truncates.**
- No primitive sets `numberOfLines`.
- At accessibility sizes (font scale 1.6 or more, about iOS AX1), a row's value or detail moves under
  its title (`accessoryPlacement`).
- The navigation bar grows when its title wraps.
- Caps exist only where a fixed container would clip, and never below 1.3x.

## Shape and spacing

- **Radii:** xs 6, sm 10, md 14, group 16, card 22, sheet 28, pill 999.
  - Every rounded surface also gets `continuous` (`borderCurve: 'continuous'`), which gives Apple's
    squircle corners on iOS. Android ignores it, harmlessly.
- **Spacing:** a 4-pt grid (2, 4, 8, 12, 16, 20, 24, 32).
- **Lists:**
  - inset 16
  - row padding 16 / 11
  - row min height **48** (the app's touch target; HIG asks for 44)
  - icon tile 30 + 12 gap
  - 28 between groups
- **Separators** start under the text, not under the icon: `separatorInset(hasIcon)`.

## Elevation (layered shadows)

Each level is two layers: a tight contact shadow plus a soft ambient shadow. They are drawn with
React Native's `boxShadow` (0.76+, new architecture, iOS and Android). `legacyShadow()` gives a
single-layer fallback.

| Level | Layers (y / blur / opacity) | Use |
|---|---|---|
| low | 1/2/.06 + 4/12/.06 | Cards at rest |
| mid | 2/4/.06 + 8/24/.10 | Floating pills, raised cards |
| high | 4/8/.08 + 16/40/.16 | Sheets, HUD, toasts |

In dark mode the opacity is ×2.5 and cards also get a hairline `cardEdge`. Dark surfaces separate by
lightness, as on iOS.

## Materials (translucent blur)

| Material | Blur intensity | Tint overlay alpha | Carries |
|---|---|---|---|
| thin | 40 | 0.66 | Primary labels only |
| regular | 60 | 0.78 | Primary labels only |
| thick | 80 | 0.90 | Primary + secondary text |
| chrome | 70 | 0.90 | Navigation bars (primary + secondary) |

**How AA is guaranteed.** The overlay alone guarantees AA, whatever the blur does. `materialContrast()`
composites the overlay over pure white and pure black, the worst cases for a blur, and the tests
require:
- 4.5:1 for primary labels on every material, in light, dark and every remote palette
- 4.5:1 for secondary text on thick and chrome

**When it draws a solid surface instead** (`materialMode`):
- iOS Reduce Transparency is on (`useReducedTransparency`)
- Android (expo-blur's Android blur is experimental and costly)
- no blur view is registered

**Real blur is on** (run 42, oversight D72-1, lead decision approved): `app/_layout.tsx` imports
`BlurView` from expo-blur and calls `registerBlurView(BlurView)`. `tests/polish-foundation.test.ts`
allows that one import and still forbids expo-blur anywhere else, so components go through
`BlurMaterial`.

## Motion and haptics

- **One spring:** `src/theme/motion.ts` (damping 18, stiffness 220).
- **Press scale:**
  - pills dip to 0.96
  - cards to 0.98
  - rows highlight their background instead of scaling, as on iOS
- **Every press goes through `PressableScale`.** It plays a haptic from `src/ui/remote/haptics.ts`
  (gated by the Haptics setting):
  - light on actions
  - selection on switches, checks and toggles
  - heavy stays reserved for Power
- **Reduce Motion:**
  - presses dim instead of scaling
  - the large-title swap becomes a step (no fade band)
  - the pull-down growth is off
- **Animations** only touch transform and opacity, on the UI thread.

## Components

| Component | What it does | Key props (all copy comes in as props) |
|---|---|---|
| `LargeTitleHeader` | Scroll scaffold. The large title scrolls under a translucent bar, then the inline title, material and hairline fade in. Pull-down grows the title from its start edge. Leading/trailing slots swap sides in RTL. VoiceOver reads the large title (role header) and hides the inline copy. | `title`, `subtitle`, `leading`, `trailing`, `material`, `background`, `refreshControl`, `onScrollY` |
| `InsetGroupedList` | Rounded group with optional header/footer text. The last row has no separator. | `header`, `footer`, children `Row`s |
| `Row` | Wrapping title/subtitle, optional icon tile. One accessory: `chevron` (mirrored in RTL), `value` (+ optional chevron), `detail` (tint text), `switch` (the whole row toggles, role switch), `check`. Pressed rows highlight. The accessibility label is composed from the props. | `title`, `subtitle`, `icon`, `iconBackground`, `accessory`, `onPress`, `destructive`, `disabled` |
| `Card` | Continuous corners, layered shadow / dark edge. Springs and plays a haptic when pressable. | `onPress`, `elevation`, `padded`, `haptic`, a11y props |
| `PillButton` | Capsule: `filled` (primary), `tinted` (secondary), `plain` (tertiary). `destructive` tone. Min 48pt; grows taller when its label wraps. | `label`, `onPress`, `variant`, `tone`, `size`, `icon`, `stretch` |
| `BlurMaterial` | Material, or a solid fallback. | `material`, `style` |

i18n rule: the primitives contain no user-facing strings. `v2-guard.test.ts` runs the repo's own
scanners over them:
- no hard-coded strings
- no physical left/right
- Text only from `src/ui/Text`
- only installed packages
- Reduce Motion / Reduce Transparency wired up

## Before / after per screen (T68 plan)

Shared change for the stack screens (Settings, Diagnostics, Themes, Plus, Add TV):
- **Header:** each sets `headerShown: false` and uses `LargeTitleHeader`. The back or close control
  is a plain `PillButton` in `leading` / `trailing`; swipe-back still works.
- **Not the native header:** native-stack's `headerLargeTitle` was considered. It is rejected because
  it is iOS-only, cannot take remote-theme colours, and its blur ignores our AA overlay.

| Screen | Before (v1) | After (v2) |
|---|---|---|
| **Remote** | Themed stage with the TV header + status pill at the top. The keys sit on the remote card; sheets are custom panels. | Same remote card, keys, d-pad (never mirrored), glow and textures. No large title, since the remote is a tool, not a list. **Changes:** the TV name + status pill sit in a `chrome` material bar at the top. The TV switcher becomes a pill menu from that title (MARKET.md). Number pad, source and keyboard sheets get the `sheet` radius, `high` elevation and a `thick` material header, under `RemoteDesignProvider` so they follow the theme. |
| **Apps** | `Screen` column with a 4:3 tile grid, skeleton shimmer and empty states. | "Apps" large title. Tiles become `Card`s (`padded={false}`, continuous corners, low shadow); the real TV icons stay full-bleed. A favourites section header comes first (long-press to reorder is an M2 task). The empty state uses a `tinted` PillButton. |
| **TVs** | `Screen` with panels and a Switch per TV. "Add TV" is a link. | "TVs" large title with a trailing plain `PillButton` (add). Saved TVs become an `InsetGroupedList`: icon tile, name, subtitle "Living room · Connected", and a chevron to its details. The active TV shows a `check`. The empty state becomes a `Card` with a filled pill "Add a TV". |
| **Add TV** (modal) | Stacked panels, `Btn` buttons, spinners. | Large title, "Cancel" plain pill in `leading`. The found TVs are rows in an `InsetGroupedList` with a chevron. Manual IP / Wake are a separate group. The step explaining the TV's Allow prompt is a `Card` before pairing. The primary action is a `stretch` filled pill at the bottom. |
| **Settings** | One panel with custom `SwitchRow` / `SegmentRow`, plus links. | "Settings" large title. Groups: **Remote** (theme → value + chevron, glow → value + chevron, haptics switch, simple mode switch), **General** (language → value + chevron, appearance), **Help** (diagnostics → chevron), **Couch Plus** (a `Card` above the groups). The free promise sits in the last group's footer. |
| **Themes** | Swatch grid + mini preview + "Try it" buttons. | Large title. The live mini preview sits in a `Card` (`mid`). The theme list is an `InsetGroupedList` with a colour swatch tile and a `check` on the chosen one. "Try it" is a `tinted` pill and "Use" a `filled` pill. Plus themes say so in the subtitle, never with a lock that blocks a control. |
| **Diagnostics** | Stat blocks and TV panels in a column. | Large title. Each TV is an `InsetGroupedList`: rows of `value` accessories (IP, protocol, latency in `numeric`), a reconnect line in the footer, and "Reconnect" as a `tinted` pill. |
| **Plus** | Header text, benefit list, buy/restore buttons. | Large title. A benefit `Card` lists the extras (themes, widgets, Live Activity, Watch, macros). The price is a `filled` large `stretch` pill; Restore is a plain pill. The footer repeats "every TV control is free". There is no paywall on launch, and never a timer or trial trap. |

T68 migration order, one commit per screen:
1. Settings
2. TVs
3. Diagnostics
4. Plus
5. Themes
6. Add TV
7. Apps
8. Remote chrome + sheets (T79, run 171: TvHeader + Sheet; keys, d-pad, glow and textures unchanged)

Each step keeps `bun test` and `tsc -p tsconfig.core.json` green. Each step can also add its pure
helpers to `tsconfig.core.json`: `src/theme/design.ts`, `src/ui/v2/headerCollapse.ts`,
`src/ui/v2/pillColors.ts`. T67 did not own that file. These three files typecheck cleanly with the
same strict flags.

## Not claimed

- Nothing here has run on a device. The npm registry is unreachable, so there was no Metro, no
  Expo Go and no full `tsc`.
- The primitives were checked three ways:
  - Unit tests for the pure maths and contrast
  - The repo's i18n/RTL scanners
  - `bun build`, to confirm that every relative import resolves
