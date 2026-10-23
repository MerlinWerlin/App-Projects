# Linework design v2 — "bubbly iOS" (T72, market-1018 M3)

Owner brief (18 Oct): "more bubbly and cute and more like iPhone/iOS". This is the spec the M3 migration tasks (T73–T76) follow. It changes the **look**, not the flows, the outline engine or the i18n/RTL rules. Everything stays Expo Go-compatible (react-native, react-native-svg, expo-blur, expo-linear-gradient, expo-haptics, RN Animated with the native driver; no new native modules).

Original look: we follow Apple's Human Interface Guidelines patterns (large titles, inset-grouped lists, materials), which belong to the platform, and do not imitate any competitor's screens, colours or art (docs/MARKET.md rules).

## 1. Principles
1. **Soft and round.** Big continuous-corner shapes, generous padding, nothing sharp. Cards feel like pebbles, buttons like pills.
2. **iOS first.** System font (SF Pro via `fontFamily: undefined` / `System`) with Dynamic Type-friendly sizes; large titles; inset-grouped settings; translucent bars and sheets.
3. **Playful, not noisy.** One friendly accent per screen, springy presses, little sparkles in empty states. The camera screen stays calm and uncluttered.
4. **Paper stays the hero.** Warm paper background remains; graphite text; drawings are always black-on-paper.

## 2. Palette (light / dark)
Keeps the existing token names so screens migrate without renames; adds bubbly accents.

| Token | Light | Dark | Use |
|---|---|---|---|
| paper (bg) | `#F7F3EE` | `#121110` | grouped background |
| card | `#FFFFFF` | `#1E1C1A` | cells, cards |
| card2 | `#FBF8F4` | `#262320` | nested/secondary fill |
| line | `#E7E0D6` | `#35312C` | hairlines |
| graphite (text) | `#1F1D1A` | `#F1ECE4` | primary text |
| muted | `#6F685E` | `#A8A096` | secondary text (AA on card) |
| ink (accent) | `#3B5BDB` | `#91A7FF` | primary actions, selection |
| inkSoft | `#E6EBFC` | `#1F2747` | accent tint backgrounds |
| bubblegum | `#FF7AA2` | `#FF8FB1` | hearts, cute category, celebrations |
| sunny | `#FFC94D` | `#FFD36E` | streaks, sparkles |
| mint | `#4CC9A0` | `#6ED8B4` | success, saved |
| lilac | `#A78BFA` | `#B9A2FF` | lessons/course accents |
| ok / warn | `#2C7A54` / `#B4690E` | `#6CC796` / `#E5B35A` | status |

**Contrast adjustments (T73 token test):** two values above failed the 4.5:1 check and ship changed in `src/theme/tokensV2.ts`: light `warn` `#B4690E` → `#9C5B0B` (was 3.8:1 on paper) and dark `muted` `#A8A096` → `#B4ACA1` (was 4.1:1 on the sunny pastel over a card). T73 also adds a sixth accent, `sky` (`#4DABF7` / `#74C0FC`), as the source of the `#E3F4FF` pastel.

Category bubbles each get one pastel fill from `[inkSoft, #FFE3EC, #FFF2CC, #DDF6EC, #EEE8FF, #E3F4FF]` (dark: 18% alpha of the matching accent). Text on fills always ≥ 4.5:1 (checked in a token test).

## 3. Type scale (system font, iOS sizes)
| Style | Size / line | Weight | Use |
|---|---|---|---|
| largeTitle | 34 / 41 | 700 | screen title (collapses) |
| title2 | 22 / 28 | 700 | section heroes |
| title3 | 20 / 25 | 600 | card titles |
| headline | 17 / 22 | 600 | row titles, buttons |
| body | 17 / 22 | 400 | text |
| callout | 16 / 21 | 400 | hints |
| subhead | 15 / 20 | 400 | secondary |
| footnote | 13 / 18 | 400 | group footers |
| caption | 12 / 16 | 500 | chips, badges |
Numbers use `fontVariant: ['tabular-nums']`. CJK / Devanagari / Arabic keep the taller line heights from `useTypography()`. Fraunces stays only for the Home wordmark; Inter is replaced by the system font (smaller bundle, closer to iOS).

## 4. Shape, depth, materials
- **Radii (continuous corners via `borderCurve: 'continuous'` on iOS):** xs 10 · sm 14 · md 20 · lg 28 · xl 36 · pill 999. Cards md–lg, hero cards xl, buttons pill.
- **Shadows (soft, layered):** `e1` y2 blur8 8% · `e2` y6 blur18 10% + y1 blur3 6% · `e3` y12 blur32 14%. Dark mode uses a 1 px top highlight `rgba(255,255,255,.06)` instead of shadows.
- **Materials:** `GlassBar` = expo-blur `BlurView` (tint `systemChromeMaterial`, intensity 60) for nav/tab-like bars and bottom sheets; falls back to a 92% opaque card colour where blur is unavailable or Reduce Transparency is on. Camera controls keep dark glass (`systemUltraThinMaterialDark`) pills.
- **Spacing:** 4-pt grid; screen gutter 16 (20 on ≥ 400 pt wide); section gap 28.

## 5. Motion & haptics (from src/theme/motion.ts)
- Press: scale 0.96 with the spring preset (damping 18, stiffness 220); selection pop 1.0 → 1.08 → 1.0 for chips/bubbles/hearts.
- Large title collapse: title font interpolates 34 → 17 over the first 52 pt of scroll; the GlassBar fades in behind it.
- Lists stagger on first mount (existing StaggerIn). Sheets spring up over a 30% dim.
- Haptics: light on primary actions, selection on chips/toggles/detents, success on save/lock/finish. Reduce Motion → fades only; Haptics setting respected.

## 6. Components (T73 builds these in src/ui/v2/ — screens migrate through them)
| Component | What it is |
|---|---|
| `ScreenV2` | paper background + safe area + optional `LargeTitleHeader` wired to a ScrollView/FlatList scroll value |
| `LargeTitleHeader` | large title that collapses into an inline title on a `GlassBar`; back chevron mirrored for RTL |
| `InsetGroup` / `InsetRow` | iOS inset-grouped section with header/footer text; rows with icon bubble, title, detail, chevron/switch; hairline separators inset to text start |
| `BubbleCard` | squircle card (radius lg, e2 shadow), optional pastel fill and sparkle accent |
| `PillButton` | primary (ink fill), secondary (inkSoft), plain; 50 pt tall, icon + label, grows for long translations (wraps, never truncates) |
| `CategoryBubble` | 76 pt round pastel bubble with an original line-art glyph + label under it; selected = ink ring + pop |
| `IconBubble` | 30 pt rounded-square icon tile used in rows |
| `GlassBar` / `GlassSheet` | blur material bar / bottom sheet with grabber |
| `Sparkle` | tiny static SVG sparkle accents for empty states and celebrations |
| `StatPill` | rounded stat chip (tabular numbers) for progress |
Existing `PressableScale`, `Toast`, `Skeleton`, `StaggerIn`, `EmptyState` are reused and restyled with v2 tokens; the v1 `GlassButton` was retired in T94 (camera controls use `v2/CameraButton`, captions `v2/CameraCaption`).

## 7. Screens — before → after
| Screen | Before (v1) | After (v2) |
|---|---|---|
| Home | Fraunces title, two hero buttons with ink sheen, chips row, recents, progress card, My drawings row | Large title "Linework" (wordmark), two big **BubbleCards** ("Trace a photo" ink, "Templates" bubblegum) with original doodle art; **category bubbles** scroller; "Continue" recents row; progress as **StatPills**; My drawings as an InsetRow |
| Templates | search + level ChoiceBar + chip filters + 2-col grid | Large title + search field in the header; **horizontal CategoryBubble scroller**; level as a pill segmented control; **large-preview grid** (2 col, square BubbleCards with radius lg, heart pop); tip card as a pastel BubbleCard |
| Prepare | toolbar + preview + sliders | preview in a BubbleCard; style choice as three big pill chips (Line art / Sketch / Bold); sliders in an InsetGroup inside a GlassSheet; primary PillButton "Start tracing" |
| Trace | dark glass pills, focus mode, bottom bar | unchanged layout (uncluttered); pills get v2 radii + `systemUltraThinMaterialDark` blur; captions stay; lock morph stays |
| Lightbox | white screen + controls | same; controls in a GlassBar pill |
| Settings | custom rows | **inset-grouped** sections (Tracing, Look & feel, Language, About) with IconBubbles, switches, footers |
| My drawings | 3-col grid | large title, 3-col squircle grid, pastel empty state with Sparkles |
| Plus | card list | BubbleCard hero + InsetGroup of packs; never gates tracing |

## 8. Rules that do not change
- i18n: every string from the catalogue; text expansion wraps; start/end not left/right; chevrons mirrored; camera/image/outline never mirrored; numbers LTR-isolated.
- Accessibility: 44 pt minimum targets (48 on camera), labels on every control, Dynamic Type caps as today, contrast AA (token test).
- Performance: blur only on bars/sheets (not per cell); idle animations paused when unfocused.

## 9. Migration order
T73 tokens + components (with tests: contrast, radii, RTL props) → T74 Home + Settings → T75 Templates → T76 Prepare / Plus / Lightbox / Trace pills / My drawings → T77 store screenshots from the migrated screens.

## Implemented in T73
Foundation only; no screen uses it yet (T74–T76 migrate). Tokens: `src/theme/tokensV2.ts` (v2 palette light/dark with the v1 names plus `card2`, accents, `sky`, six category pastels, highlight/glass/scrim; radii; e1–e3 elevation with Android `elevation` and the dark-mode top highlight via `elevationV2()`; the §3 type scale on the system font; 4-pt spacing, `gutterFor()`, component sizes) and `useThemeV2()` in `src/theme/useTheme.ts` (v1 `useTheme()` unchanged; `text(name)` applies script-aware line heights). Motion: `pressScaleV2` 0.96 and `selectPop` in `src/core/motion.ts`, `popTo()` in `src/theme/motion.ts`. Pure helpers with node tests: `src/core/contrast.ts` (WCAG luminance/contrast, alpha compositing; `contrast.test.ts` checks every spec text-on-fill pair in both schemes) and `src/core/largeTitle.ts` (collapse progress, 34 → 17 sizing, Animated interpolation configs incl. the Reduce Motion swap). Components in `src/ui/v2/` (barrel `index.ts`): `ScreenV2`, `LargeTitleHeader` + `LargeTitle` + `useLargeTitleScroll`, `InsetGroup`/`InsetRow`, `BubbleCard`, `PillButton`, `CategoryBubble`, `IconBubble`, `Glass.tsx` (`GlassBar`, `GlassSheet`), `Sparkle`, `StatPill`. **expo-blur is not in package.json** (registry unreachable), so GlassBar/GlassSheet use the 92% opaque fallback with a TODO in `Glass.tsx`; elevations use one shadow layer per level (iOS draws one shadow per view).

## Blur (T79, oversight D72-2)
expo-blur and expo-linear-gradient are in package.json and installed by START_TRIAL / start-trial.sh / VERIFY (`npx expo install expo-blur expo-linear-gradient` right after `expo install expo@latest`, which writes the SDK-correct pins; Expo Go ships both). GlassBar/GlassSheet draw a BlurView (systemChromeMaterialLight/Dark, intensity 60) under a 55% wash on iOS through the guarded adapter `src/native/blur.ts`; Android, a missing module and Reduce Transparency keep the solid 92% AA fallback. Decision logic in `src/core/materials.ts` (tested).

## Implemented in T75 (Templates)
`app/templates.tsx` on v2: own large title + back chevron (`LargeTitleHeader` over an `Animated.FlatList`), search field under the title, a tablist of `CategoryBubble`s (All, **New**, then categories in `SHELF_ORDER`), level as `PillSegmented` (new `src/ui/v2/PillSegmented.tsx`, not in the barrel yet), Favourites + collections (occasions, seasons, styles) as v2 pill toggles that still combine with a bubble, a 2-column grid of tall `TemplateCard`s (BubbleCard radius lg, e2, art on a card2 tile, level + New badges, heart pop) on a pastel panel (row wrappers + rounded caps), designed empty state with one "Clear filters" PillButton, and the F5 tip as a lilac BubbleCard under the grid. Pure logic in `src/core/templateShelf.ts` (+ tests): `NEW_SETS` (the newest set, now Cute & chibi; update it when a set ships), bubble order, `?category=new`, pool/glyph helpers.

## Premium touches (T83–T84, ref-1018)
- **StepIndicator** (`src/ui/v2/StepIndicator.tsx`, logic `src/core/steps.ts`): Pick image → Outline → Trace dots (done = tick on inkSoft, current = ink with halo + selection pop, to do = outline), half-cell connecting lines on start/end so RTL mirrors; one a11y element "Step 2 of 3: Outline" (`common.steps.*`). Shown at the top of Prepare (step 2).
- **Tap ripple** (`src/ui/v2/Ripple.tsx`, maths `src/core/ripple.ts`): `PressableScale` `ripple` colour prop → two staggered concentric rings from the touch point, clipped to the control's radius, native driver; on PillButton primary and pressable BubbleCards. Reduce Motion → none.
- **Slider value pop-ups** (`src/core/sliderBubble.ts`): LabeledSlider shows a magnified ink bubble (22 pt digits, tail at the thumb, clamped inside the track) that springs in on grab and out on release; the camera VerticalSlider's percent bubble is enlarged the same way (44 pt, tail towards the slider), trace layout unchanged. Reduce Motion → fade only.
