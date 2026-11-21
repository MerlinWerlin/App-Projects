# Glaze — DESIGN.md

Direction: **Dreamroom.** Glaze is a surreal exhibition you walk through. The painterly pastel
themes are the exhibits: they open the app at full size on a stage, and each theme's page takes on
that theme's own room colour. Around them the building is quiet (a neutral wall, one cobalt accent),
and the type is a soft, wide display face, Unbounded, that sounds like the art looks.

Mode: **Experience** where art is shown (the Themes stage, a theme's page), **Operate** everywhere
else (installing, widgets, settings). Platform: iOS first (Expo / React Native), Android second.

Supersedes the "bubbly" v2 look in `docs/DESIGN_V2.md` and the first White Cube pass. Token *names*
in `src/core/designV2.ts` stay, so every screen moved with them.

## 1. Principles

1. **Exhibits, not thumbnails.** The first thing on the Themes tab is a stage of large prints you
   swipe through; art is never shrunk to fit chrome around it.
2. **Step into the room.** Opening a theme fills its head and preview with the theme's own colour,
   and its name is set large in that theme's ink.
3. **The art is the only bright colour.** Chrome is neutral wall, white and near-black, plus one
   cobalt for what you can tap. No pastel or gradient chrome competes with the paintings.
4. **A voice in the type.** Titles, section names and theme names are set in Unbounded, tight and
   large. Reading text stays in the system font, which also covers every non-Latin script.
5. **Motion that breathes.** Prints on the stage grow to full size and strength as they reach the
   centre and settle back as they leave, following the finger. Everything else is short and timed;
   Reduce Motion turns movement into stillness or a fade.
6. **The plumbing stays native.** Back swipes, sheets, tab bar, switches, Dynamic Type: the
   exhibition is new, the doors and stairs are the ones people know.

## 2. Colour

One accent (cobalt, the classic ceramic underglaze blue). Selection uses ink, not the accent, so
"selected" and "tap me" never look the same.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F3F3F1` | `#0E0E0D` | The wall: every screen background |
| `surface` | `#FFFFFF` | `#1A1A19` | Inset groups, sheets, panels |
| `surfaceRaised` | `#FFFFFF` | `#242422` | Popovers; a panel inside a sheet |
| `fill` | `#E8E8E5` | `#2A2A28` | Search field, unselected chips, segmented track |
| `separator` | `#DADAD6` | `#363633` | Hairlines; the print edge |
| `ink` | `#161616` | `#F2F2EF` | Primary text; selected chip fill |
| `inkSecondary` | `#5C5C58` | `#ABABA5` | Labels under art, subtitles, values, footers |
| `inkTertiary` | `#84847F` | `#7E7E79` | Chevrons, placeholders, counts (large/icon only) |
| `tint` | `#2B4EA2` | `#80AEF5` | Cobalt: primary button, links, toggles, checks |
| `onTint` | `#FFFFFF` | `#0D1730` | Text on cobalt |
| `tintSoft` / `onTintSoft` | `#E5EAF5` / `#1F3C82` | `#1A2A44` / `#D6E0F8` | Secondary (tinted) button |
| `ok` / `warn` / `danger` | `#1F7247` / `#8F5A06` / `#B42335` | `#72D3A0` / `#F0BE62` / `#FF8A98` | Status |

`pastels.*` remain as API but are all neutral (fill = `fill`, ink = `ink`-ish): chrome never
paints pastel tiles. `glaze` (the old gradient pair) is neutral and unused by chrome.
Every pair is still checked for WCAG AA by `paletteChecks()` / `materialChecks()`.

## 3. Type

Two faces. **Unbounded** (bundled, Latin only) for display; the **system font** (SF Pro / Roboto)
for everything people read. `displayStyle(script, role)` (`src/ui/displayType.ts`) goes last in a
style array: in other scripts it returns nothing and the system role stays.

| Display role | Size / line | Tracking | Use |
|---|---|---|---|
| `masthead` | 31 / 38 | -0.8 | Screen titles (the collapsing large title) |
| `title` | 28 / 34 | -0.6 | A theme's name on its page |
| `stage` | 22 / 28 | -0.4 | Theme names on the stage |
| `section` | 19 / 25 | -0.3 | Browse section titles (count after it in Unbounded Medium) |

System roles (`typeV2`) for the rest: headline 17/600 art labels and rows, body 17, subhead 15,
footnote 13, caption 12/11. No eyebrows: counts follow titles ("Free  10").

## 4. Space and shape

4-pt grid (`spaceV2`): side gutter 16, section top 32, title→content 12, art gap 16.

| Radius | Value | Use |
|---|---|---|
| `control` | 10 | Chips' small cousins, badges, fields |
| `card` | 12 | Art prints (thumbnails, rail art), default panel |
| `group` | 14 | Inset-grouped lists |
| `cardLarge` | 16 | Large art (hero print on a theme page) |
| `sheet` | 28 | Bottom-sheet top corners |
| `pill` | capsule | Every button, chip, search field |

All corners continuous (`borderCurve: 'continuous'`). The print edge is a hairline of `separator`
so pale art never dissolves into the wall.

## 5. Components

- **Stage** (`ThemeStage`): opens the Themes overview. Prints 74% of the screen wide, 1.3× as tall,
  radius `cardLarge`, hairline edge, snapping to the centre. The centre print is full size and
  strength; neighbours sit at 0.9 scale and 55% opacity, driven by the scroll on the UI thread.
  Art is the bundled starters' full-size wallpaper (crisp, offline), never an upscaled thumbnail.
  Name in display `stage`, mood in subhead under it. Plus / Free badge on the art.
- **Exhibit band** (theme page): the head (name in display `title`, mood) and the live preview
  panel take the theme's palette `bg` with its `ink`; both must pass WCAG AA or the page keeps the
  wall. Dark mode uses a deep tint of the theme's accent with the app's ink, never a pale glare.
- **Art print** (`GalleryArtCard`, `ThemeThumbCard`): art at phone aspect, radius `card`, hairline
  edge, no surface, no shadow; name and mood under it on the wall like a gallery label.
- **Section header**: display `section` title + count; optional body line; "See all" is plain cobalt.
- **Chips / pill tabs**: capsule, 48 pt; unselected `fill` + `ink`; selected `ink` + `bg`.
- **Buttons** (`PillButton`): filled cobalt (one per screen), tinted, plain, glass, destructive.
  The corner "Watch how" stays filled (owner request, 1.0.34).
- **Inset groups**: `surface` on the wall, radius `group`, hairlines; bare 20 pt line glyphs.
- **Panels** (`SquircleCard`): flat, radius `card`, no shadow; `fill` for an exact colour.
- **Empty states**: one bare glyph in `inkTertiary`, a headline, a line, one plain action.

## 6. Motion

Tokens in `src/core/motion.ts` / `src/theme/motion.ts`: 120 / 200 / 320 ms, one strong ease-out,
press scale 0.97 (cards) / 0.96 (pills), no springs. The stage's breathing is scroll-driven
(interpolated from the scroll offset), so it is exactly as fast as the finger and can be caught. Lists may fade items in on first mount only
(30 ms stagger, max 8). `useMotionReduced()` (Glaze setting or system) turns every movement into a
short fade. Haptics: selection on chips and rows, light on primary actions, success on finish.

## 7. Do

- Let a theme's art be the largest, most colourful thing on every screen it appears on.
- Put names and moods *under* art, on the wall, in two lines of text.
- Use cobalt only for things that act; use ink for selected state.
- Lead with art at full size: the stage on Themes, the room colour on a theme's page.
- Set titles and theme names in Unbounded; keep reading text in the system font.
- Keep the native plumbing: back chevron and swipe, sheets with Cancel/Done, tab bar.
- Check light, dark and the largest text size for every screen you touch.

## 8. Don't (the AI tells)

- **No gradients** in chrome: no gradient tiles, sheens, glossy CTAs or tinted backdrops.
- **No glow**: no coloured shadows, halos or blurred colour blobs; no shadow on resting cards.
- **No icons in tinted circles or squares**: glyphs stand alone in `inkSecondary`/`tint`.
- **No labels above headings** (eyebrows like "START HERE"); counts go after the title.
- **No count-up stat tiles** or big-number dashboards ("128 themes!").
- **No generic cards**: no white rounded box with a shadow around art or around a single line of
  text; a panel exists only when it groups controls.
- No pastel or violet chrome, no emoji as icons, no decorative illustrations competing with art.
- No bounce, spring overshoot, or animation on things tapped dozens of times a day.
- No upscaled thumbnails at stage size; no display face on body copy or in non-Latin scripts.
