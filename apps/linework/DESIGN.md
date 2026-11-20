# Linework: design system ("Drawing table")

Replaces the "bubbly iOS" look of docs/DESIGN_V2.md (kept for history). The flows, i18n/RTL rules, accessibility
rules and component APIs from that doc still hold; the look below wins wherever they differ.

## 1. Direction

Linework is used at a table, with paper, a pencil and the phone on a stand. The app should feel like that table:
**warm paper, graphite, one red pencil.** The person's drawings and the line art are the colour; the interface is
the quiet sheet they sit on.

- **Mode:** Operate. The job is getting to tracing fast; brand lives in the details (the serif title, the red
  pencil accent, the hairline rules), not in decoration.
- **Native first:** standard iOS structure (tab bar, large titles, inset-grouped lists, sheets, system switches),
  drawn in this palette. Nothing a person has to learn.
- **Paper, not plastic:** flat surfaces separated by hairlines and spacing. No floating shadows on content.
- **One accent:** red pencil (`ink`) marks what you can tap and what is selected. Everything else is graphite and
  paper.

## 2. Colour (src/theme/tokensV2.ts)

Token names are unchanged so screens keep working. All text pairs are checked ≥ 4.5:1 in
src/core/contrast.test.ts.

| Token | Light | Dark | Use |
|---|---|---|---|
| paper | `#F6F2EB` | `#141210` | screen background |
| card | `#FFFDF9` | `#1D1A17` | grouped rows, tiles, sheets |
| card2 | `#EFE9E0` | `#272320` | pressed rows, art wells, segmented track |
| line | `#E2DACE` | `#36312B` | hairlines and tile borders |
| graphite | `#1E1B18` | `#F2EDE5` | text, line art |
| muted | `#6B645A` | `#B1A99E` | secondary text, inactive icons |
| ink | `#B23A1F` | `#FF8E6B` | red pencil: actions, links, selection |
| inkSoft | `#F6E3DC` | `#3A221B` | selected chip / tab tint (never a decorative fill) |
| onInk | `#FFFFFF` | `#141210` | text on ink |
| ok / warn | `#2C6E4F` / `#8F540A` | `#6CC796` / `#E5B35A` | status text only |

The six old category pastels and the bubblegum / sunny / mint / lilac / sky accents are retired: `pastels` now
holds paper neutrals (so any leftover use renders as a plain well) and the accent names alias graphite tones.
Do not add new uses of them.

## 3. Type

- **Large titles:** Fraunces SemiBold (already bundled), 34 pt, tracking −0.4. The serif is the brand's one
  flourish, and it reads like the title page of a sketchbook. Non-Latin scripts fall back to the system font
  through `useTypography()`.
- **Everything else:** the system font (SF Pro) on the iOS scale in `typeV2`: title2 22/28 semibold for section
  headings, headline 17, body 17, subhead 15, footnote 13. Dynamic Type capped at 1.4× as before.
- Numbers that change use tabular figures.
- No eyebrow labels above headings, no all-caps kicker text.

## 4. Shape and depth

- **Radii:** xs 6 · sm 8 · md 10 · lg 12 · xl 14 · pill 999. Buttons are 12-radius rounded rectangles,
  not pills; only small chips and the segmented control stay capsule-shaped (as on iOS).
- **Depth:** none on content. Cards and tiles are `card` with a 1 px `line` border. Only the floating tab bar and
  sheets carry a shadow, and only because they float.
- **Spacing:** 4-pt grid, 16 / 20 pt gutters, 28 pt between sections, more space above a heading than below.

## 5. Components

| Component | Look |
|---|---|
| `PillButton` | primary: ink fill, white label, 50 pt, radius 12. secondary: card with a hairline border, ink label. plain: ink label only. |
| `BubbleCard` | flat card, hairline border, radius 12, no shadow, no sparkle. |
| `InsetGroup` / `InsetRow` | iOS inset-grouped list on card; leading icons are bare graphite glyphs (no tinted tiles); switches use ink. |
| `CategoryBubble` | square paper tile (radius 10) with the line-art glyph, label under it; selected = 2 pt ink border + bold ink label. |
| `StatPill` | plain inline text: number in graphite, label in muted. No chip. |
| `Sparkle`, `Ripple` | retired (render nothing). |
| `EmptyStateV2` | the existing line drawings in graphite on a plain bordered card, one action. |
| `LargeTitleHeader` | Fraunces large title collapsing to a system inline title on the frosted bar. |

## 6. Motion

- Press feedback: scale 0.97, quick spring (already in `PressableScale`). No tap ripples.
- Lists may fade-and-rise once on first mount (`StaggerIn`); nothing animates on scroll except the large title.
- Reduce Motion: fades only (existing `useReduceMotion`). Haptics follow the in-app setting.
- The opening pencil-draw (IntroDraw) and the camera screen keep their behaviour.

## 7. Bans

Gradients · glows or coloured halos · icons inside tinted circles or squares · labels or kickers above headings ·
count-up or big-number stat tiles · sparkles and confetti as decoration · pastel candy fills · generic floating
cards with soft shadows · more than one accent colour on a screen · emoji as icons.

## 8. Unchanged rules

i18n (every string from the catalogue, wrapping not truncating, start/end not left/right, mirrored chevrons),
44 pt targets (48 on the camera), labels on every control, AA contrast, and no camera / image / outline mirroring.
