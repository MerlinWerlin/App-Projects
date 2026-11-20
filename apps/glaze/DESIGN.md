# Glaze — DESIGN.md

Direction: **White Cube.** Glaze's chrome is the gallery wall, not a second artwork. The painterly
pastel themes hang on it as prints; everything else (titles, buttons, lists) behaves like the
wall label beside them: neutral, exact, small, and always secondary to the picture.

Mode: **Operate** (an iPhone tool for theming the Home Screen) with **Experience** moments where a
theme's art fills the screen. Platform: iOS first (Expo / React Native), Android second.

Supersedes the "bubbly" v2 look in `docs/DESIGN_V2.md` (lilac neutrals, berry tint, six pastel
accents, glaze gradient, eyebrows, soft plum shadows). The token *names* in
`src/core/designV2.ts` stay, so every screen moved with them; the values and the rules below are new.

## 1. Principles

1. **The art is the only colour.** Theme art is painterly and pastel. Chrome is neutral grey,
   white and near-black, plus one cobalt accent for what you can tap. No pastel fills in chrome.
2. **Prints, not cards.** Artwork sits directly on the wall with a small corner and a hairline
   edge. Its name and mood sit under it as a label, on the wall, never inside a white box.
3. **Label, then title — never label over title.** Headings stand alone. Counts and metadata sit
   after or under a title in secondary text, the way a museum label lists medium and year.
4. **Native first.** Large titles, inset-grouped lists, capsule buttons, sheets, system font,
   SF-style glyphs, Dynamic Type, swipe back. Nothing replaces a standard iOS control.
5. **Flat by default.** Depth comes from colour steps (wall → surface → raised), not shadows.
   Shadows exist only for things that genuinely float (toasts, popovers, sheets).
6. **Motion confirms, never performs.** Short timed ease-outs, no springs, no bounce, no stagger
   cascades on revisits; Reduce Motion swaps movement for a fade.

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

System font (SF Pro / Roboto) only; it covers every script Glaze ships in. Hierarchy from size and
weight together, tracking per Apple's tables (negative at body size, slightly open at titles).

| Role | Size / line | Weight | Use |
|---|---|---|---|
| `largeTitle` | 34 / 41 | 700 | Screen title (collapses into the bar) |
| `title1` | 28 / 34 | 700 | Theme name on its detail page |
| `title2` | 22 / 28 | 600 | Section title on browse screens |
| `title3` | 20 / 25 | 600 | Group title, sheet title |
| `headline` | 17 / 22 | 600 | Art label name, emphasised rows |
| `body` | 17 / 22 | 400 | Rows, paragraphs |
| `subhead` | 15 / 20 | 400 | Chips, small buttons, mood lines |
| `footnote` | 13 / 18 | 400 | Group headers/footers, art mood line |
| `caption1/2` | 12 / 16, 11 / 13 | 400 / 500 | Badges, icon labels |

No eyebrows: the `eyebrow` role is retired from chrome. Section counts are set in `inkTertiary`
tabular figures after the title ("Space & Night  24").

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

- **Art print** (`GalleryArtCard`, `ThemeThumbCard`): art at phone aspect, radius `card`, hairline
  edge, no surface, no shadow. Below it on the wall: name (`headline`/`footnote` 600, `ink`) and
  mood (`footnote`, `inkSecondary`). Badges (Plus, Free) are small solid capsules on the art's
  corner. Heart stays a ≥ 48 pt target beside the label.
- **Section header**: title (`title2`) + optional count in `inkTertiary` on the same baseline,
  optional one-line body under it. "See all" is a plain cobalt text button on the title line.
- **Chips / pill tabs**: capsule, 48 pt; unselected `fill` + `ink`; selected `ink` + `bg`.
- **Buttons** (`PillButton`): filled cobalt (one per screen), tinted, plain, glass (over art),
  destructive. Capsules, 52 / 48 pt.
- **Inset groups**: `surface` on the wall, radius `group`, hairline separators. Row glyphs are
  bare 20 pt line icons in `inkSecondary` — no tinted circle behind them.
- **Panels** (`SquircleCard`): flat `surface`, radius `card`, no shadow; dark mode adds a hairline.
- **Empty states**: one bare glyph in `inkTertiary`, a headline, a line, one plain action.
- **Bars and sheets**: clear at rest, `bar` material once content scrolls under; sheets use the
  system-like 28 pt corner and a neutral scrim (black 32% light / 60% dark).

## 6. Motion

Tokens in `src/core/motion.ts` / `src/theme/motion.ts`: 120 / 200 / 320 ms, one strong ease-out,
press scale 0.97 (cards) / 0.96 (pills), no springs. Lists may fade items in on first mount only
(30 ms stagger, max 8). `useMotionReduced()` (Glaze setting or system) turns every movement into a
short fade. Haptics: selection on chips and rows, light on primary actions, success on finish.

## 7. Do

- Let a theme's art be the largest, most colourful thing on every screen it appears on.
- Put names and moods *under* art, on the wall, in two lines of text.
- Use cobalt only for things that act; use ink for selected state.
- Keep standard iOS navigation: large titles, back chevron, sheets with Cancel/Done.
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
