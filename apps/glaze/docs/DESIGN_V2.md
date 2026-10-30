# Glaze design v2: "bubbly" iOS-native look

Owner brief: docs/OWNER_1018.md M3. Backlog: T54 (this doc, tokens, shared components), T55 (Themes tab, theme detail, install), T56 (Icons, Live, Settings, add-app, sheets and the rest).

The aim is an app that looks like it ships with iOS 26 but has more joy in it: large titles that collapse on scroll, inset-grouped lists, continuous-corner (squircle) cards and pill buttons, big soft rounded shapes, soft layered shadows, translucent bars and sheets, system font weights, springy press and selection motion, cheerful pastel accents and haptics. Every value below is original to Glaze.

Where things live:

| What | File | Tested |
|---|---|---|
| Palette, type scale, radii, spacing, elevation, materials, large-title maths, contrast audit | `src/core/designV2.ts` | `src/core/designV2.test.ts` (node:test) |
| React Native shapes of those tokens (`textV2`, `shadowV2`, `materialFill`, `continuous`) | `src/theme/tokensV2.ts` | via core |
| `useColorsV2()` hook (palette + scheme) | `src/theme/useTokens.ts` | — |
| Shared components | `src/ui/LargeTitleHeader.tsx`, `InsetGroup.tsx`, `PillButton.tsx`, `SquircleCard.tsx`, `GlassBar.tsx`, barrel `src/ui/v2.ts` | i18n/RTL guards |

Every screen and component is on v2 (T56/T83/T84). Since T163 (30 Oct) `src/theme/tokensV2.ts` is the only token set: the v1 `tokens.ts` is deleted and the phone mocks take their brand fonts from `artFontsV2`; `useColors()` and the legacy Button are gone (guard tests in src/core/guard.test.ts and src/core/designGuard.test.ts).

## 1. Principles

1. **Content first, chrome second.** Bars are clear at rest and turn to glass only when content scrolls under them.
2. **Soft and round.** No sharp corners anywhere: radii 14 to 32 pt, capsules for every button, superellipse icon tiles. On iOS `borderCurve: 'continuous'` gives true squircles; Android draws the same radius with circular corners.
3. **Pastel accents on soft neutrals.** Neutrals have a faint lilac warmth (never pure grey). Colour comes from six pastel accents, used in fills, never as text colour on white.
4. **One accent for action.** Berry `tint` marks what you can tap: primary pill, links, chevron rows' selected check. Pastels decorate; they never mean "tap me" alone.
5. **Springy, never slow.** Every movement uses the existing motion tokens (`src/core/motion.ts`: one spring, damping 18 / stiffness 220; 120/200/320 ms; nothing over 350 ms). Reduce Motion (the Glaze setting or the system one, `useMotionReduced()`) swaps movement for a short fade.
6. **Feel it.** Presses fire the haptic that matches the action (`src/ui/haptics.ts`): light for primary actions, selection for rows/toggles/pickers, success on completion. All follow the Haptics setting.
7. **Accessible by construction.** Every colour pair a component uses is in `paletteChecks()`/`materialChecks()` and the test fails if one drops below WCAG AA. Touch targets ≥ 48 pt. Text wraps, never truncates labels. Layout uses start/end only.

## 2. Palette

Light and dark are designed together. `ink*` are text colours, `fill`s are backgrounds.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F4F1F7` | `#0F0D12` | Grouped screen background |
| `surface` | `#FFFFFF` | `#1C1A20` | Cards, inset groups, sheets |
| `surfaceRaised` | `#FFFFFF` | `#27242C` | Popovers, selected tile |
| `fill` | `#ECE7F1` | `#2F2B35` | Search field, segmented track, quiet chips |
| `separator` | `#E2DBE8` | `#3A3541` | Hairlines |
| `ink` | `#1D1A21` | `#F5F0F7` | Primary text |
| `inkSecondary` | `#5E5766` | `#B3AABB` | Subtitles, values, footnotes |
| `inkTertiary` | `#8A8292` | `#857D8E` | Chevrons, placeholders (≥ 3:1, large/icon only) |
| `tint` | `#A2337F` | `#F5A3DA` | Accent: primary pill, links, selection |
| `onTint` | `#FFFFFF` | `#2B0E22` | Text on `tint` |
| `tintSoft` / `onTintSoft` | `#FBE1F1` / `#7A1F5E` | `#4A2140` / `#FFD6EF` | Tinted (secondary) pill, selected row |
| `ok` / `warn` / `danger` | `#22784F` / `#9A5B06` / `#C2273D` | `#72D3A0` / `#F0BE62` / `#FF8A98` | Status text and icons |
| `onDanger` | `#FFFFFF` | `#2A0B10` | Destructive pill label |
| `glaze` | `#F7A8D8 → #FFC9A3` | `#B8488F → #E07D55` | Glossy gradient, used sparingly (hero card, CTA sheen) |

Pastels (`fill` / `ink` on that fill):

| Pastel | Light | Dark |
|---|---|---|
| berry | `#FFD3EA` / `#7A1F5E` | `#4E2343` / `#FFD3EA` |
| lilac | `#E3D9FF` / `#4B2F9A` | `#352B5C` / `#E3D9FF` |
| mint | `#C9F1DE` / `#16633F` | `#1D4636` / `#C9F1DE` |
| butter | `#FFEDB0` / `#6E4D00` | `#4A3B12` / `#FFEDB0` |
| peach | `#FFDCCB` / `#8A3413` | `#52291A` / `#FFDCCB` |
| sky | `#CFE7FF` / `#174D86` | `#1C3A5A` / `#CFE7FF` |

In dark mode the pastels invert: deep fills with the light pastel as text, so tiles still read as "pastel" without glowing.

**Contrast (computed by `paletteChecks()` with `src/core/colour.ts`, all ≥ AA).** Light: ink/bg 15.4, inkSecondary/bg 6.2, inkSecondary/fill 5.7, tint/surface 6.3, onTint/tint 6.3, onTintSoft/tintSoft 7.8, pastel inks 5.9 to 7.2, inkTertiary/bg 3.3 (3:1 rule). Dark: ink/bg 17.2, inkSecondary/fill 6.2, tint/bg 10.3, onTint/tint 9.4, pastel inks 8.6 to 9.7, inkTertiary/surface 4.4.

## 3. Type scale

System font (SF Pro on iOS, Roboto on Android) with weights, so it feels native and covers CJK, Devanagari and Arabic without a fallback swap. Unbounded/Manrope stay for artwork and store screenshots only. Non-Latin scripts get taller line heights through `textStyleFor(script, style)` (src/ui/i18nLayout.ts).

| Role | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `largeTitle` | 34 / 41 | 800 | 0.37 | Screen titles (collapsing) |
| `title1` | 28 / 34 | 700 | 0.36 | Hero card titles |
| `title2` | 22 / 28 | 700 | 0.35 | Sheet titles, section heroes |
| `title3` | 20 / 25 | 600 | 0.38 | Card titles |
| `headline` | 17 / 22 | 600 | -0.41 | Emphasised rows |
| `body` | 17 / 22 | 400 | -0.41 | Rows, paragraphs |
| `callout` | 16 / 21 | 400 | -0.32 | Card descriptions |
| `subhead` | 15 / 20 | 400 | -0.24 | Small pill labels, subtitles |
| `footnote` | 13 / 18 | 400 | -0.08 | Group headers (600) and footers |
| `caption1` / `caption2` | 12 / 16, 11 / 13 | 400 / 500 | 0 / 0.06 | Icon labels, badges |
| `button` / `navTitle` | 17 / 22 | 600 | -0.41 | Pill labels, collapsed bar title |

Numbers that change keep tabular figures (`tabularV2` in tokensV2.ts).

## 4. Shape, space, size

| Token | Value | Use |
|---|---|---|
| `radiusV2.control` | 14 | Chips, badges, text fields |
| `radiusV2.group` | 22 | Inset-grouped sections |
| `radiusV2.card` | 24 | Default card |
| `radiusV2.cardLarge` | 28 | Hero/showcase cards, category bubbles |
| `radiusV2.sheet` | 32 | Bottom sheets (top corners) |
| `radiusV2.pill` | 999 | Every button, segmented thumb, search field |
| `iconTileRadius(size)` | 22.37% of side | Icon tiles (row icons, icon previews) |

Spacing is a 4-pt grid: `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · inset 20 · xl 24 · xxl 32 · xxxl 44`. Sizes: touch 48, row min 52, pill 52 (small 48), row icon tile 30, nav bar 52, large-title block 52.

## 5. Elevation

Two layers per level, a tight contact shadow plus a wide soft ambient one, tinted warm plum (`#3B1F38`) in light mode instead of black. On iOS they render through React Native's `boxShadow` list (RN 0.76+); Android uses `elevation` (it ignores layered shadows). Dark mode also draws a hairline border on cards, because shadows barely show on near-black.

| Level | Light layers | Use |
|---|---|---|
| `flat` | none | Inset groups (they sit on `bg` by colour alone) |
| `card` | 0 1 2 / 6% + 0 6 16 −2 / 8% | Cards, theme tiles |
| `raised` | 0 2 4 / 7% + 0 12 28 −4 / 12% | Selected/hero card, floating pill bar |
| `floating` | 0 4 8 / 8% + 0 18 40 −6 / 16% | Toasts, popovers |
| `overlay` | 0 6 12 / 10% + 0 28 64 −8 / 22% | Sheets |

## 6. Materials (glass)

| Material | Light tint / alpha | Dark tint / alpha | Use |
|---|---|---|---|
| `bar` | `#F8F6FA` / 0.90 | `#1C1A20` / 0.90 | Navigation and tab bars |
| `thick` | `#FFFFFF` / 0.92 | `#27242C` / 0.92 | Sheets, popovers |
| `chrome` | `#FFFFFF` / 0.88 | `#1C1A20` / 0.88 | Floating controls over photos and wallpapers |

Sheets and modal overlays dim what is behind them with `scrimV2` (`scrimColour(scheme)`): warm plum `#3B1F38` at 0.40 in light mode, black at 0.60 in dark mode.

The alphas are set by contrast, not taste: `materialChecks()` composites each material over pure black and pure white (a blur only averages the backdrop, so nothing is worse) and requires ink, inkSecondary and tint to stay ≥ 4.5:1. Lowest results: light inkSecondary/bar 5.1, light tint/bar 4.7, dark inkSecondary/thick 5.3. With iOS **Reduce Transparency** on, `GlassBar` uses the opaque fallback.

**Blur status.** `expo-blur` works in Expo Go but is not in `package.json`: the registry is unreachable from the cloud and docs/POLISH.md / ops/DECISIONS.md (run 9) decided not to add unverifiable dependencies. `GlassBar` therefore draws the translucent tint alone today, which is the exact layer a BlurView would sit under. When the PC run is green, `npx expo install expo-blur` and add one `<BlurView intensity={blurIntensity} tint={scheme} />` inside GlassBar's backdrop (the comment at the top of `src/ui/GlassBar.tsx` shows where). No other file changes.

## 7. Motion and haptics

| Interaction | Motion (normal) | Reduce Motion | Haptic |
|---|---|---|---|
| Pill press | spring to 0.96 | dim to 0.85 | light (filled) / selection (others) |
| Card press | spring to 0.97 | dim | light |
| Row press | spring to 0.98 | dim | selection |
| Card selected | spring pop to 1.04 + 2 pt tint ring | ring only | (caller's press haptic) |
| Large title | fades over 50–100% of its height, stretches to 1.08 on pull-down; bar title fades in over 70–100%; glass + hairline over 85–115% | no stretch; bar title/material cross-fade (120 ms) at 60% | none |
| Lists | existing `staggerIn` / `listLayout` | fade | none |

All springs and durations come from `src/theme/motion.ts`; press scales are `pressV2` in core. Transform and opacity only, on the UI thread.

## 8. Components (src/ui, exported through src/ui/v2.ts)

- **LargeTitleScrollView** `{ title, subtitle?, leading?, trailing?, children }`: screen scaffold. Grouped `bg`, Animated.ScrollView with a reanimated scroll handler, `LargeTitle` as the first content item, `LargeTitleHeader` floating over it. Interpolation ranges come from `largeTitleRanges()` (core, tested against a reference `largeTitleFrame()`).
- **LargeTitleHeader** `{ title, scrollY, leading?, trailing? }` + **LargeTitle** `{ title, subtitle?, scrollY }` + **useLargeTitleScroll()**: the parts, for screens built on Animated.FlatList. The inline title is hidden from screen readers (the large title is the header).
- **InsetGroup** `{ header?, footer?, children }`: rounded (22) section on `bg`, 16 pt side margin, footnote header (600) and footer, hairline separators that start at the row title (after the icon tile when there is one).
- **InsetRow** `{ title, subtitle?, value?, icon?, iconTone?, accessory?, trailing?, onPress?, selected?, destructive?, disabled? }`: ≥ 52 pt; pastel squircle icon tile; trailing value; chevron (RTL-aware) for navigation rows, check for picker rows, or any trailing control such as a Switch.
- **PillButton** `{ label, onPress, variant, size, icon?, iconAfter?, block?, busy?, disabled? }`: variants `filled` (tint), `tinted` (tintSoft), `plain`, `glass` (chrome material, for buttons over previews), `destructive`. 52 pt (small 48), labels wrap.
- **SquircleCard** `{ tone, size, elevation, padding, selected?, onPress?, onLongPress? }`: continuous 24/28 corners, layered shadow, tones `surface` / `raised` / any pastel; clips artwork to the corners; selection pop.
- **GlassBar** `{ material, hairline, progress?, children }`: translucent material with optional animated visibility (used by LargeTitleHeader; T56 uses it for the tab bar and sheets). `useReduceTransparency()` exported.

Restyled during migration (all done): `Segmented` (pill track on `fill` with a raised sliding thumb), `Switch` (tint track), `Sheet` (thick material, 32 corners, grabber), `Toast` (floating level, pill), `ThemeCard` (SquircleCard large, T84), search field (pill on `fill`).

All strings come in through props, so the components themselves add no catalogue keys; screens pass `t()` values.

## 9. Before and after, per screen

| Screen | Now (v1) | v2 |
|---|---|---|
| Tab bar `(tabs)/_layout` | Opaque card-coloured bar, Manrope labels, plum tint | `bar` glass with a top hairline, system 11 pt labels, berry tint; icons fill when selected |
| Stack headers `_layout` | Porcelain header, plum back tint, Manrope bold title, no shadow | Large titles via LargeTitleScrollView on root screens; pushed screens use the native header with `headerLargeTitle`-style inline title and berry tint |
| Themes `(tabs)/themes` | Unbounded 28 pt hero title row, subtitle, tip cards, Live hero card, search field, category chips, seasonal banner, 2-column ThemeCard grid | Collapsing "Themes" large title with "?" in the bar; pill search on `fill`; category chips become pastel pills (T57 turns them into big category bubbles); tips as pastel SquircleCards with a dismiss pill; Live hero as a `cardLarge` with the glaze gradient; theme tiles as large SquircleCards with `card` shadow and selection pop |
| Theme detail `theme/[id]` | Native header, phone mocks, palette swatches, segmented controls, ShapePicker, sheen "Apply" button | Mocks on a large SquircleCard; palette as round pastel dots; options in InsetGroups; sticky `chrome` GlassBar at the bottom with a block `filled` PillButton "Apply this look" |
| Icons `(tabs)/icons` | Hero title, Segmented controls, Swatches, HomeMock preview, app list with buttons | Collapsing title; live preview card stays on top; style controls as InsetGroups (shape, background, glyph colour, labels); app picker rows as InsetRows with icon tiles and check accessories; floating "Install icons" pill |
| Install `install` | Long ScrollView: method cards, progress bar, step cards, checklist, 12 buttons | Method choice as two SquircleCards (recommended one raised + "Recommended" badge pill); steps as an InsetGroup with numbered pastel tiles; progress inside the card; Shortcuts checklist as InsetRows with copy pills |
| Live `(tabs)/live` | Screen title, PhoneFrame preview, project list, 5 buttons, "needs full build" Sheet | Collapsing title; preview on a large card; projects as InsetRows with thumbnail tiles; New loop as a filled pill; unavailable sheet on `thick` material |
| Live editor `live/[id]` | Native header, PhoneFrame, trim/crop controls, 4 buttons | Native inline header; editor on `bg`; trim/speed controls in InsetGroups; Save/Set as a bottom glass pill bar |
| Settings `(tabs)/settings` | Screen title, bordered card sections with Segmented, SwitchRows, custom Row + Divider, Plus card on plumSoft | The model screen for v2: collapsing title; every section an InsetGroup (Style, Feel, Help, Privacy, About) with pastel icon tiles; SwitchRows become InsetRows with a trailing Switch; Plus as a tinted SquircleCard |
| Wallpaper `wallpaper` | LockMock preview, local Segmented, Stepper, 6 buttons | Preview card with `raised` shadow; pattern/colour options as pill segmented controls in InsetGroups; export as a filled pill with busy state |
| Add app `add-app` | Search + list, prompt box, 11 buttons | InsetGroup steps (find app, copy prompt, save sample, upload); copy/save as tinted small pills; chosen image previewed in an icon tile |
| Feedback `feedback` | Form fields, 6 buttons, fallback address block | Fields in an InsetGroup (rows with inline inputs); Send as a filled block pill; fallback actions as tinted pills |
| Tips `tips` | Grouped list of tips with Show again / Hide buttons | InsetGroups per feature; each tip an InsetRow with status value and a small tinted pill |
| Sheets (`Sheet`, LivePhotoSheet, IconOverrideSheet...) | Card with title row, close icon, spring up over dimmed backdrop | `thick` material, 32 pt top corners, grabber, `title2` header, `overlay` shadow; same spring, fade with Reduce Motion |

## 30 Oct consolidation (T163, owner-1030 B)

- **One token set.** `src/theme/tokens.ts` is deleted. What the five phone mocks used from it moved into `src/core/designV2.ts` (re-exported by tokensV2) with the same values: `artFontsV2` (Unbounded/Manrope, artwork only), `brandGlazeV2` (`#7A2E6B → #E0794F`, HomeMock's no-wallpaper gradient), and v1 `tabular` = `tabularV2`. Nothing looks different.
- **The system in tokensV2:** type scale `typeV2`/`textV2` (named steps); spacing `spaceV2` (4-pt grid, `xxs` 2 is the only half step); chrome radii `chromeRadiusV2` = exactly **card 24 / control 14 / pill 999** (`radiusV2.group` 22, `cardLarge` 28 and `sheet` 32 stay as legacy names with their own values; folding them into `card` is a visual decision for the critique round); shape radii kept apart: `iconTileRadius(size)` and the new `circleRadius(size)` (half the side) for dots, discs and number badges; one elevation style `shadowV2(level, scheme)` (`elevationV2` levels; v1 `elevation` is gone with tokens.ts); `onArtV2` (`ink #FFFFFF`, `black #000000`) for ink over photos and artwork, the same in both schemes.
- **Guard ratchet** `src/core/designGuard.test.ts`: counts raw hex / `rgb(a)(` colours, numeric `fontSize` and numeric `border*Radius` literals in `app/**/*.tsx` and `src/ui/**/*.tsx`. `BASELINE` holds per-file counts; a file going up, or a new file adding any, fails. Artwork files (phone mocks, widget previews, intro art, pet pixel art, widget option art, swatch ink picker) are in `ART_ALLOWLIST` with a reason and not counted. Lower a file's baseline when you clean it.
- **Mechanical cleanup (exact values only):** chrome colours 90 → 79, font sizes 3 → 2, radii 40 → 25 across the scanned files (allowlisted art included in these totals). Circles now use `circleRadius(n)`, the pill button `radiusV2.pill`, the pets preview `radiusV2.card`, WallpaperTile's live badge `typeV2.caption2.fontSize`, white/black over art `onArtV2`.
- **Left for later:** `app/(tabs)/*.tsx` and `app/theme/[id].tsx` were not touched (parallel workers); their counts are recorded. Remaining non-art literals are scrims over art (`rgba(0,0,0,0.3…0.6)`, several distinct alphas), the Skeleton shimmer gradient, LivePhotoGuide's illustration, the tab-bar label size 11 and a few non-circle radii (6, 20, 36, 9, 3 grabber) that match no token.

## 10. Rules that carry over

- Expo Go libraries only; no new native modules or dependencies (see §6 for blur).
- Every user-facing string through `t()`; start/end, never left/right; Home/Lock mocks and artwork keep `noMirror`.
- `src/core` stays pure TS; the contrast audit and collapse maths live there so Node tests them.
- No competitor names outside docs/MARKET.md.
