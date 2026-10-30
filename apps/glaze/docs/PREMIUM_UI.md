# Premium interface (T173, owner-1030 E)

Glaze is the App Factory's flagship paid app, so the interface should feel calm, rich and editorial: closer to a well-made magazine or a first-party Apple app than a utility. This doc **builds on docs/DESIGN_V2.md** (palette, type scale, radii, elevation, materials, components) and on the 30 Oct consolidation (one token set, the design guard). It does not restart the design. Where the two disagree, this doc wins for the screens it has reached (progress table below); DESIGN_V2.md §1.5 "springy" is superseded everywhere by the owner's standing rule: **no spring, no bounce**, only timed ease-out or fades (`src/theme/motion.ts`, D145-1).

## 1. Direction

1. **Calm.** Fewer things on the first screen, more room around each. One action per region is obvious; the rest is quiet. Nothing moves unless the user moved something.
2. **Rich, art-led.** The theme artwork is the hero of every browse surface: large cards, art edge to edge inside the card, chrome receding to small type and soft surfaces. Colour comes from the art; chrome stays neutral with the single berry `tint` for action.
3. **Editorial.** Long lists read as sections with a small eyebrow label, a title and one line of body ("START HERE / Starter themes"). Section rhythm is fixed: 32 pt above a section, 12 pt below its title, 16 pt between cards (`editorialV2`).
4. **Generous spacing.** 16 pt side gutters, 16 pt card gaps, 4-pt grid (`spaceV2`). When in doubt, add space rather than a divider.
5. **Refined type.** System font, the DESIGN_V2 scale plus one new role, `eyebrow` (13 pt semibold, tracked +0.8, upper-case in Latin scripts only). Titles never exceed `title2` inside lists; `largeTitle` is for the screen name only.
6. **Depth from layered surfaces, not lines.** Cards lift with the one soft layered shadow (`shadowV2`) and, in dark mode, a one-step lighter surface (`surfaceRaised`) instead of hairline borders. Bars and sheets use the glass materials (blur) from DESIGN_V2 §6. Borders only for selection rings and form fields.
7. **Subtle haptics.** `select` for picks and opening a card, `light` for primary actions, `success` once at the end of a flow (apply, install, purchase). Never a haptic on scroll or on an automatic change. All follow Settings › Haptics.
8. **Smooth, timed transitions.** Durations from `motion.ts` (120 / 200 / 320 ms, nothing over 350), ease-out curve, transform and opacity only, on the UI thread. **No spring, no bounce, no overshoot.** Reduce Motion (Glaze setting or system) turns movement into a short fade or nothing.

## 2. Consistency rules (every screen)

- **One token set:** `src/theme/tokensV2.ts` only (palette via `useColorsV2`, `textV2`, `spaceV2`, `chromeRadiusV2`, `shadowV2`, `editorialV2`, `fontScaleCap`). Raw colours / font sizes / radii are ratcheted by `src/core/designGuard.test.ts`.
- **One icon style:** Feather line icons for chrome (18 pt inline, 22 pt in bars), tinted `inkSecondary` or `tint`; pastel circle backgrounds only for empty states and row icons. No filled/outlined mixing, no emoji in chrome.
- **Skeletons, not spinners:** any wait over ~300 ms shows `Skeleton` in the final layout's shape (calm opacity pulse, still under Reduce Motion). `ActivityIndicator` is allowed only inside a pressed button (PillButton `loading`) and is being removed screen by screen.
- **Contrast:** every colour pair is in `paletteChecks()` / `materialChecks()` (WCAG AA); text on art uses `onArtV2` with a scrim.
- **Dynamic Type:** every `Text` and `TextInput` sets `maxFontSizeMultiplier={fontScaleCap(role)}` (titles 1.25 to 1.5, reading text 2.0); layouts wrap, never truncate labels; fixed-height chrome (large title block) relies on the lower title caps.
- **Accessibility:** labels and hints on every control, one heading per section (`SectionHeader` reads eyebrow + title as one header), ≥ 48 pt targets, start/end layout for RTL.
- **i18n:** every new string in all 11 locales under `src/i18n/ns/<ns>/<locale>.ts`.
- **Performance:** browse screens stay virtualised (FlatList with `LIST_WINDOW`, memoised rows, stable keys); `perfBudget.test.ts` must stay green. If a list adds `getItemLayout`, any card height change updates it in the same commit.
- **No new screens, no new native code** in this task: it restyles what exists.

## 3. Screen-by-screen plan (in order)

### 3.1 Onboarding (intro → first screen)
Glaze has no onboarding carousel by design (owner fb-1024 A: the app opens straight on Themes). "Onboarding" is the Prism intro (`IntroGlaze`, calm, already reduce-motion aware) handing over to the Themes first screen, plus the first-session language line.
- [x] Large title and subtitle honour Dynamic Type with caps so the collapsing title block never overflows (run 182).
- [x] First-session "Language: English · Change" line capped and kept quiet (run 182).
- [x] No spinner between intro and Themes (entry route is a plain background + redirect).
- [ ] The intro's last frame and the Themes background match exactly in light and dark (check on device).
- [ ] First screen above the fold: title, category bubbles, one editorial section start; nothing else competing.

### 3.2 Themes browse
Large art-led cards, theme preview on a phone mock (HomeMock), editorial sections.
- [x] Editorial `SectionHeader` (eyebrow + title + body) for Starters, Free art, Space, Plus packs; quieter group header per pack (run 182).
- [x] 16 pt card rhythm in the showcase and the pack rows (`editorialV2.cardGap`) (run 182).
- [x] Pack cards: dark mode depth from `surfaceRaised` instead of a hairline border; roomier name row (run 182).
- [x] Showcase placeholders are calm skeletons in the theme's own colour (run 182).
- [x] Dynamic Type caps on every text and the search field (run 182).
- [x] Still one virtualised list; rows are variable height (no `getItemLayout` to keep in step).
- [ ] One-column "feature" card for the first starter on wide phones (art larger than the grid).
- [ ] Seasonal banner and Live hero restyled to the same surface + eyebrow language.

### 3.3 Theme detail
- [x] Hero preview: the phone mock large and centred on a soft surface, Home / Lock toggle as a quiet segmented pill under it (run 183).
- [x] Editorial blocks below (eyebrow + title): What's inside, Icons, Widgets, Wallpaper, Credits; Credits only when the theme has a photo or art credit (run 183).
- [x] Apply flow: one primary pill pinned at the bottom on glass ("Choose icons" kept as a quiet plain link under it); `success` haptic once at the end (step ticks and the icon ripple are `light`) (run 183).
- [ ] Apply flow: progress as a skeleton of the result (today the waits are in-pill busy states and the pack download keeps its determinate bar).
- [x] Remaining raw radii (5) to tokens, plus ShapePicker's last one (design guard 0 for both); the preview's wallpaper art draws with expo-image (RN `Image` stays only for `Image.getSize` in the save path) (run 183).
- [x] Dynamic Type caps on every Text in the screen, ShapePicker, ThemeOverrideRow, Segmented and PillButton (run 183).
- [ ] Check on device: hero and pill at the largest text size, dark mode surface, VoiceOver reads each block as one heading.

### 3.4 Widgets
- [x] Art-led widget cards on the same 16 pt rhythm; editorial section headers per family (run 183: `SectionHeader` for Your theme / Everyday / Habits from `src/core/widgetFamilies.ts`, rows split per family, cards on `editorialV2.cardGap`; dark mode lifts by `surfaceRaised` with no hairline via `SquircleCard outline={false}`).
- [x] Widget Studio preview on a soft raised surface, controls as inset groups (run 183: no dark hairline, "Live preview" eyebrow read as one heading with the widget's name and size; controls were already `InsetGroup`s).
- [x] Previews wait as skeletons in their final shape while a photo wallpaper is sampled; no spinners on the tab or in the Studio (run 183).
- [x] Dynamic Type caps on every `Text` / `TextInput` in the tab and the Studio; raw radius in the tab gone (design guard entry removed) (run 183).
- [x] Still one virtualised list of memoised rows; the ~16 pt spacer above the first section stays (T166).
- [ ] Check on device: at the largest accessibility text size the Studio's pinned preview (eyebrow line wraps) still leaves room to scroll the controls.

### 3.5 Install flow
- [x] Step cards as a calm numbered sequence (one step visible as "current"), timed fades between steps.
- [x] Waiting states (rendering icons, saving) as skeletons of the result, no spinners.
- [x] Finished state with one `success` haptic and a clear "Done".

### 3.6 Plus sheet
- [x] Thick glass sheet, art collage hero, three benefit rows with line icons, one price, one primary pill, restore as a plain link.
- [x] No pressure patterns: no timers, no strike-through prices, "one-time unlock, never a subscription" stays.

### 3.7 Settings
- [x] Inset groups only, editorial group titles, row icons in pastel circles, values in `inkSecondary`.
- [x] Storage (packs) rows with skeleton sizes while measuring.

## 4. "Done" checklist (per screen)

A screen is **done** when all of these hold:
1. Only tokens (design guard count for the file is 0, or lowered with a reason).
2. Large title (main screens) or `title2` sheet header; editorial section headers where the screen has sections.
3. Spacing on the 4-pt grid with the editorial rhythm; no stacked dividers.
4. Depth from surfaces/shadow/glass, not borders (selection rings and inputs excepted).
5. Every wait over 300 ms is a skeleton; no `ActivityIndicator` outside a pressed button.
6. Motion: timed, ease-out, ≤ 350 ms, UI thread, no spring; Reduce Motion checked.
7. Haptics only on user actions, matching §1.7.
8. Every `Text`/`TextInput` has a Dynamic Type cap; checked at the largest accessibility size without clipping.
9. Contrast AA in light and dark; VoiceOver reads every control with a label and each section as one heading.
10. New strings in all 11 locales; RTL checked.
11. Lists virtualised where they can grow; perf-budget and design-guard tests green.
12. A TestFlight yes/no question for Jared recorded in the run's reply.

## 5. Progress

| Screen | Status | Run |
|---|---|---|
| Onboarding (intro → first screen) | Started: Dynamic Type caps on large title, subtitle, language line | 182 |
| Themes browse | First slice shipped: editorial headers, 16 pt rhythm, layered dark cards, skeleton placeholders, Dynamic Type caps | 182 |
| Theme detail | Slice shipped: hero on a soft surface with the Home / Lock pill under it, editorial blocks, one primary pill in the glass bar, radii to tokens, expo-image art, Dynamic Type caps (skeleton apply progress still open) | 183 |
| Widgets | Slice shipped: family section headers, 16 pt rhythm, lifted cards without hairlines, skeleton previews, Studio preview on a raised surface with an eyebrow, Dynamic Type caps, tokens only | 183 |
| Install flow | Slice shipped: numbered step sequence with one current step, timed fades (Reduce Motion shorter), skeleton waits, Done panels, one success haptic, Dynamic Type caps; T156 Safari copy | 184 |
| Plus sheet | Slice shipped: glass sheet with art-collage hero, three benefit rows, one price, one Unlock pill, Restore as a plain link, no pressure patterns | 184 |
| Settings | Slice shipped: inset groups with editorial titles, pastel circle row icons, values in inkSecondary, Storage skeletons while measuring | 184 |

## 6. Tokens added for this pass (in `src/core/designV2.ts`, re-exported by `tokensV2`)

- `typeV2.eyebrow` (13/18, 600, +0.8) and `eyebrowCaseFor(script)`.
- `fontScaleCapV2` / `fontScaleCap(role)`: `maxFontSizeMultiplier` per type role.
- `editorialV2`: `sectionTop` 32, `sectionBottom` 12, `cardGap` 16.
- Component: `src/ui/SectionHeader.tsx`; `src/ui/Skeleton.tsx` now a calm opacity pulse (no sweep, no raw colours, optional `colour`).
- `SquircleCard` `outline` prop (default true): premium screens pass `outline={false}` with `tone="raised"` in dark mode so cards lift by surface, not a hairline (run 183).
- `src/core/widgetFamilies.ts`: Widgets tab families (theme / everyday / habits) and per-family rows (run 183); guarded by `src/core/premiumWidgets.test.ts`.

Run 184 guards: `src/core/premiumInstall.test.ts` (§3.5), `src/core/premiumPlusSettings.test.ts` (§3.6/§3.7). `InsetGroup` gained `title`/`eyebrow` props (SectionHeader); shared row icons are pastel circles.

Guards: `src/core/premiumUi.test.ts` (tokens, skeleton motion, no spinners, editorial headers, Dynamic Type caps on the Themes browse path, this doc's table).
`src/core/premiumThemeDetail.test.ts` (§3.3: block order and strings in all locales, hero layout and timed cross-fade, one primary pill, expo-image art, Dynamic Type caps on the theme detail path).
