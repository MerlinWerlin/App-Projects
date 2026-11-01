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
- [x] The intro's last frame and the Themes background match exactly in light and dark: both read the `bg` token (run 187; check on device).
- [x] First screen above the fold: title, category bubbles, one editorial section start; story chips moved below the gallery (run 187).

### 3.2 Themes browse
Large art-led cards, theme preview on a phone mock (HomeMock), editorial sections.
- [x] Editorial `SectionHeader` (eyebrow + title + body) for Starters, Free art, Space, Plus packs; quieter group header per pack (run 182).
- [x] 16 pt card rhythm in the showcase and the pack rows (`editorialV2.cardGap`) (run 182).
- [x] Pack cards: dark mode depth from `surfaceRaised` instead of a hairline border; roomier name row (run 182).
- [x] Showcase placeholders are calm skeletons in the theme's own colour (run 182).
- [x] Dynamic Type caps on every text and the search field (run 182).
- [x] Still one virtualised list; rows are variable height (no `getItemLayout` to keep in step).
- [x] One-column "feature" card for the first starter on wide phones ≥ 414 pt (art larger than the grid) (run 187).
- [x] Seasonal banner and Live hero restyled to the same surface + eyebrow language (run 187).

**Owner-1031 (run 189, T177): the gallery is rebuilt around the remote catalogue.** The owner's TestFlight note ("all of the old themes which need to go ... none of the new themes from GitHub") outranks the items above. The tab is now two editorial sections composed in `src/core/gallery.ts`: **New collection** (eyebrow "Just in", every theme in the remote catalogue from `useRemoteArtThemes()`, data-driven, so a later batch needs no app change) then **Starters** (only the bundled art packs Deep Sea, Starry Night, Sunset Dunes). Cards are art-led (`src/ui/GalleryArtCard.tsx`): the artwork edge to edge at phone aspect, the catalogue thumbnail through expo-image with its ThumbHash placeholder, then name and mood line on a raised surface, a heart as its own target. Two columns on phones because the catalogue thumbs are 240 x 520 px (a full-width card would upscale them past sharp); three on wide screens. While the catalogue is empty (first launch, offline, a 404) the New collection shows skeleton cards in the final shape, never an error. Removed from the gallery: the starter showcase (and its feature card), themesNew / themesStoryPlay lists, Space, the Plus packs, the seasonal banner, story chips, category bubbles and the New / Our picks sub-tabs; kept: search, All / Liked, the Live hero, Your look, Make a wallpaper. Old theme ids still resolve (`getAnyTheme`). Pull to refresh fetches `catalog.json` now; the list allows the iOS overscroll only while resting at the top (needed for the pull), never elsewhere. Guard: `src/core/premiumGallery.test.ts` (it lists the older guards it retired).
- [ ] Check on device: New collection cards on first launch (skeletons, then art), pull to refresh, dark mode surfaces, largest text size.

### 3.3 Theme detail
- [x] Hero preview: the phone mock large and centred on a soft surface, Home / Lock toggle as a quiet segmented pill under it (run 183).
- [x] Editorial blocks below (eyebrow + title): What's inside, Icons, Widgets, Wallpaper, Credits; Credits only when the theme has a photo or art credit (run 183).
- [x] Apply flow: one primary pill pinned at the bottom on glass ("Choose icons" kept as a quiet plain link under it); `success` haptic once at the end (step ticks and the icon ripple are `light`) (run 183).
- [x] Apply flow: progress as a skeleton of the result: icon tiles while the icon style renders, a phone-shaped wallpaper in the theme's surface colour while it saves (the pill keeps its busy label; the pack download keeps its determinate bar) (run 185).
- [x] Remaining raw radii (5) to tokens, plus ShapePicker's last one (design guard 0 for both); the preview's wallpaper art draws with expo-image (RN `Image` stays only for `Image.getSize` in the save path) (run 183).
- [x] Dynamic Type caps on every Text in the screen, ShapePicker, ThemeOverrideRow, Segmented and PillButton (run 183).
- [x] Remote catalogue theme (the free Codex art packs, owner-1031 T179): the hero phone shows the catalogue thumb (expo-image, thumbhash placeholder) and switches to the downloaded wallpaper, with a quiet "preview / downloaded" line under it; the glass bar holds one filled "Download · size" pill, then a determinate bar (capped at 99 % until verified), then Apply; offline, a 404 or a damaged file read as one calm line with Try again (never an error code); a Plus pack without Plus offers Unlock (the sheet then downloads). Apply: the Wallpaper step saves the downloaded .webp (read now if the page hadn't resolved it; never the drawn fallback), the widgets step uses the downloaded widget art, the Icons step draws Glaze glyphs in the palette with a short note. Lookups by id fall back to the remote theme (Widget Studio, wallpaper maker, Your look, Icons tab: `src/native/useAnyTheme.ts`); a remote id opened before the cached catalogue is read waits on a skeleton, not "not found". A finished download is a `light` haptic (`success` stays the end of the apply flow). Guard `src/core/remoteThemePage.test.ts` (run 189).
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

### 3.8 Icons tab
The Icon Studio tab (`app/(tabs)/icons.tsx`): live preview on top, Your apps, Add apps (the virtualised results), the custom-app form and Style. Make-your-own icons stay free: nothing on the tab imports Plus.
- [x] Editorial `SectionHeader` (eyebrow + title + body) for Your apps, Add apps and Style; the preview card carries a quiet "Live preview" eyebrow read as a heading; the inset groups (custom app, Shape, Background, Symbol colour, Symbol size) use editorial group titles instead of the small grey header (run 188).
- [x] 16 pt card rhythm in the list header and footer (`editorialV2.cardGap`), 32 pt above a section and 12 pt under its title (run 188).
- [x] Dark mode depth from `surfaceRaised` with `SquircleCard outline={false}` (preview, empty state, loading) and raised category chips; no hairline cards (run 188).
- [x] Loading is a skeleton of the screen (title, the preview card's icon grid, a section header), not a centred grid and spinner; no `ActivityIndicator` on the tab (run 188).
- [x] Empty state icon in a soft circle; tokens only (design guard 0 for the file) (run 188).
- [x] Dynamic Type caps on every `Text` / `TextInput` in the tab, plus `ContextTip` and the collapsed nav title in `LargeTitleHeader` (run 188).
- [x] Still one virtualised list of memoised rows (T166); `perfBudget.test.ts` green; guarded by `src/core/premiumIcons.test.ts` (run 188).
- [ ] Check on device: at the largest accessibility text size the section bodies wrap without clipping and the glass Install pill still leaves the Style controls reachable.

### 3.9 Wallpapers (tab and wallpaper maker)
- [x] Editorial `SectionHeader` per wallpaper group on the tab: Made by you (your photo, saved loops, "make one") / Free originals / Plus collection, from `src/core/wallpaperGroups.ts`; rows split per group so a row never mixes two. Only the unfiltered views are grouped (Still and Pairs on All, and Live); New / Our picks / Liked keep their own order as one grid without headers (run 188).
- [x] Art-led tiles on the 16 pt rhythm (`editorialV2.cardGap` between tiles and rows; 32 pt above a section); in dark mode the pair tile lifts by `surfaceRaised` and its phone frames drop the hairline (run 188).
- [x] Waits as skeletons in the final shape: the Live view shows two tile-shaped skeletons until the saved loops are read (no false "no clips yet"); the maker's preview waits in its phone shape while the saved background loads; a save shows a phone-shaped skeleton of the image beside "Rendering…" (the Save pills keep their busy label; no `ActivityIndicator` outside a pressed `PillButton`) (run 188).
- [x] Wallpaper maker: cards lift by surface (raised in dark, soft card shadow in light) with no hairline; each card opens with a group `SectionHeader` (one heading); status toast without a border; last raw radius gone (design guard entry removed); segmented controls on the 4-pt grid (run 188).
- [x] Dynamic Type caps on every `Text` in the tab, the tiles, the maker, the pair card, `SwitchRow` and `ContextTip` (run 188).
- [x] Still one virtualised list of memoised rows (`perfBudget.test.ts` green); Save to Photos unchanged (same saver hooks, `expo-media-library/legacy`). Guard: `src/core/premiumWallpapers.test.ts` (run 188).
- [ ] Check on device: the maker at the largest accessibility text size (group titles wrap, Stepper labels), and dark mode tile and card surfaces.

### 3.10 Live (tab + loop editor)
The Live area is "Make a Live Photo" (owner 24 Oct): the first 3 seconds of a loop saved to Photos, then Photos › Share › Use as Wallpaper. It never promises a constantly looping Lock Screen on iPhone; Android keeps its existing live wallpaper button.
- [x] Live tab: two editorial sections, "Make a Live Photo / Start with a clip" (new-loop pill + Live Photo guide) and "Saved in Glaze / Your loops"; 16 pt rhythm inside sections (run 188).
- [x] Each loop is its own lifted card (`SquircleCard outline={false}`, dark mode `surfaceRaised`) on `editorialV2.cardGap`, no hairline separators; the empty state is the same card (run 188).
- [x] Loading is a skeleton loop card (thumbnail tile, name and meta lines) instead of a plain bar (run 188).
- [x] Loop editor: skeleton in the editor's shape (name field, phone-shaped preview on its card, trim bar) instead of `ActivityIndicator` (run 188).
- [x] Editor preview, zoom controls and guide note on one raised surface without a hairline; editorial sections "Lock Screen / Frame it", "Clip / Trim", Speed (group), "Finish / Save it"; the size warning is a surface, not an outline (run 188).
- [x] Tokens only (design guard entries for both files removed; the empty-state art uses `onArtV2`, the trim knob is a capsule via `circleRadius`); Dynamic Type caps on every Text / TextInput; timed fades only (run 188).
- [x] Live Photo export flow, the guide and the honest copy unchanged (`src/core/premiumLive.test.ts`).
- [ ] Check on device: preview phone size inside its card on a small phone (SE) and at the largest text size; dark mode cards.

### 3.11 Screens changed by the owner's 1 Nov brief (owner-1101d, T210)
T202 made Install all at once the main method, T194 added Clean up old icons, T200 made "Set it up" a bold section on the theme page. This pass brings those screens back up to the criteria.
- [x] Install flow (`app/install.tsx`): every card lifts by surface (`tone` raised in dark, `outline={false}`), no hairline anywhere on the screen (saved profile files are soft filled rows, the "Your apps" monogram rows are spaced, not ruled).
- [x] Install flow: the summary card is the hero: the set's first icons on a soft well, then one editorial heading ("Your icon set" eyebrow + the count line, `SectionHeader level="group"`).
- [x] Install flow: Install all at once is an editorial header (eyebrow "The quick way", title, the "One profile adds N icons…" line as its body); the Prefer Shortcuts link stays a small plain pill, centred at the card's foot after the main pill.
- [x] Install flow: the first load is a skeleton of the screen (summary card, method header, method card with a pill-shaped block), not a centred grid and a line of text; the Shortcuts undo steps use an editorial group title.
- [x] Clean up old icons (`app/icons-cleanup.tsx`): each way is an editorial group title on the 32 pt section rhythm.
- [x] Theme page "Set it up": three lifted entry cards on the 16 pt rhythm instead of one ruled inset group; each leads with a small piece of the theme itself (a phone in its wallpaper colours, four of its own icons, a widget in its palette), then the name, one line, and "Saved to Photos ✓" on the wallpaper card once saved. One VoiceOver element per card, `select` haptic, timed press ease.
- [x] Settings: Help has a Clean up old icons row; the How icons work sheet now says Install all at once is the main way (it still said "Shortcuts recommended, Bulk beta") and shows the removal steps as one numbered sequence (tint number circles on a soft well).
- [ ] Check on device: the Set it up cards at the largest text size (title and line wrap beside the art well), the install summary well on an SE, dark mode surfaces on all three screens.
Guards: `src/core/premiumInstall.test.ts`, `src/core/premiumThemeDetail.test.ts`, `src/core/premiumPlusSettings.test.ts` (the T210 tests).

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
| Themes gallery (owner-1031) | Rebuilt: New collection (remote catalogue, data-driven, skeletons while empty, no error on 404) then 3 bundled starters; old themes, Space, Plus packs, seasonal banner, chips and bubbles left the gallery (ids still resolve); art-led two-column cards with ThumbHash placeholders; pull to refresh | 189 |
| Theme detail | Slice shipped: hero on a soft surface with the Home / Lock pill under it, editorial blocks, one primary pill in the glass bar, radii to tokens, expo-image art, Dynamic Type caps; skeleton apply progress (run 185) | 183, 185 |
| Widgets | Slice shipped: family section headers, 16 pt rhythm, lifted cards without hairlines, skeleton previews, Studio preview on a raised surface with an eyebrow, Dynamic Type caps, tokens only | 183 |
| Install flow | Slice shipped: numbered step sequence with one current step, timed fades (Reduce Motion shorter), skeleton waits, Done panels, one success haptic, Dynamic Type caps; T156 Safari copy | 184 |
| Plus sheet | Slice shipped: glass sheet with art-collage hero, three benefit rows, one price, one Unlock pill, Restore as a plain link, no pressure patterns | 184 |
| Settings | Slice shipped: inset groups with editorial titles, pastel circle row icons, values in inkSecondary, Storage skeletons while measuring | 184 |
| Icons tab | Slice shipped: editorial section headers (Your apps / Add apps / Style) and group titles, 16 pt rhythm, raised dark cards without hairlines, skeleton loading screen, Dynamic Type caps, still virtualised and free | 188 |
| Wallpapers | Slice shipped: group section headers (Made by you / Free / Plus) on the unfiltered views, 16 pt rhythm, lifted tiles and maker cards without hairlines, Live and maker skeleton waits, Dynamic Type caps, tokens only; Save to Photos unchanged | 188 |
| Live | Slice shipped: editorial sections on the tab and in the loop editor, lifted loop cards without hairlines, skeletons in the result's shape (no spinner), preview on a raised surface, tokens only, Dynamic Type caps; Live Photo flow and honest copy unchanged | 188 |
| Owner-1101d screens (§3.11) | Slice shipped: install flow lifted cards with no hairlines, summary hero, editorial Install all at once with the quiet Shortcuts link, screen skeleton; Clean up titles; theme page Set it up as three art-led cards; Settings Clean up row, honest How icons work copy, numbered removal steps | T210 |

## 6. Tokens added for this pass (in `src/core/designV2.ts`, re-exported by `tokensV2`)

- `typeV2.eyebrow` (13/18, 600, +0.8) and `eyebrowCaseFor(script)`.
- `fontScaleCapV2` / `fontScaleCap(role)`: `maxFontSizeMultiplier` per type role.
- `editorialV2`: `sectionTop` 32, `sectionBottom` 12, `cardGap` 16.
- Component: `src/ui/SectionHeader.tsx`; `src/ui/Skeleton.tsx` now a calm opacity pulse (no sweep, no raw colours, optional `colour`).
- `SquircleCard` `outline` prop (default true): premium screens pass `outline={false}` with `tone="raised"` in dark mode so cards lift by surface, not a hairline (run 183).
- `src/core/widgetFamilies.ts`: Widgets tab families (theme / everyday / habits) and per-family rows (run 183); guarded by `src/core/premiumWidgets.test.ts`.

Run 188 guard: `src/core/premiumIcons.test.ts` (§3.8, Icons tab).

Run 188 guards: `src/core/premiumLive.test.ts` (§3.10), `src/core/premiumWallpapers.test.ts` (§3.9).

Run 184 guards: `src/core/premiumInstall.test.ts` (§3.5), `src/core/premiumPlusSettings.test.ts` (§3.6/§3.7). `InsetGroup` gained `title`/`eyebrow` props (SectionHeader); shared row icons are pastel circles.

Run 189 guard: `src/core/premiumGallery.test.ts` (§3.2 owner-1031 gallery).

Guards: `src/core/premiumUi.test.ts` (tokens, skeleton motion, no spinners, editorial headers, Dynamic Type caps on the Themes browse path, this doc's table).
`src/core/premiumThemeDetail.test.ts` (§3.3: block order and strings in all locales, hero layout and timed cross-fade, one primary pill, expo-image art, Dynamic Type caps on the theme detail path).
