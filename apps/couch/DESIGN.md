---
name: Couch
description: A universal TV remote that feels like part of the living room, not a gadget dashboard.
colors:
  ground-linen: "#ECEAE5"
  cushion-paper: "#FBFAF8"
  cushion-pressed-linen: "#E4E1DA"
  ink: "#1A1917"
  ink-secondary: "#5C5850"
  ink-tertiary: "#8A857B"
  seam-linen: "#DDD9D1"
  fill-linen: "#E2DFD8"
  bronze: "#7E5518"
  bronze-wash: "#F0E5D1"
  bronze-wash-ink: "#6A4511"
  ground-charcoal: "#0E0E0F"
  cushion-charcoal: "#1C1C1B"
  cushion-pressed-charcoal: "#292927"
  ink-warm-white: "#F4EEE3"
  ink-warm-secondary: "#B3ACA0"
  ink-warm-tertiary: "#827C72"
  seam-charcoal: "#30302D"
  brass: "#D2AB72"
  brass-ink: "#1A1208"
  brass-wash: "#3A2E1C"
  brass-wash-ink: "#E6C796"
  destructive-light: "#B0382C"
  destructive-dark: "#FF8A7E"
typography:
  large-title:
    fontFamily: "Sora"
    fontSize: "34pt"
    fontWeight: 700
    lineHeight: "41pt"
  title:
    fontFamily: "Sora"
    fontSize: "22pt"
    fontWeight: 700
    lineHeight: "28pt"
  headline:
    fontFamily: "SF Pro (system)"
    fontSize: "17pt"
    fontWeight: 600
    lineHeight: "22pt"
  body:
    fontFamily: "SF Pro (system)"
    fontSize: "17pt"
    fontWeight: 400
    lineHeight: "22pt"
  footnote:
    fontFamily: "SF Pro (system)"
    fontSize: "13pt"
    fontWeight: 400
    lineHeight: "18pt"
    fontFeature: "tnum"
rounded:
  key: "14pt"
  row-group: "18pt"
  cushion: "20pt"
  tab: "16pt"
  sheet: "28pt"
  pill: "999pt"
spacing:
  xs: "4pt"
  sm: "8pt"
  md: "12pt"
  lg: "16pt"
  xl: "20pt"
  group-gap: "28pt"
components:
  tab-cushion:
    backgroundColor: "{colors.cushion-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tab}"
    height: "58pt"
  tab-cushion-selected:
    backgroundColor: "{colors.bronze}"
    textColor: "{colors.cushion-paper}"
    rounded: "{rounded.tab}"
    height: "58pt"
  row-group:
    backgroundColor: "{colors.cushion-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row-group}"
    padding: "11pt 16pt"
  button-primary:
    backgroundColor: "{colors.bronze}"
    textColor: "{colors.cushion-paper}"
    rounded: "{rounded.pill}"
    height: "48pt"
  button-tinted:
    backgroundColor: "{colors.bronze-wash}"
    textColor: "{colors.bronze-wash-ink}"
    rounded: "{rounded.pill}"
    height: "48pt"
---

# Design System: Couch

## Overview

**Creative North Star: "Upholstery and brass", with the logo remote at its centre**

Couch is the remote that lives on the sofa, so its screens are built like the sofa: soft, matte surfaces grouped
like cushions, with one warm metal for the thing your thumb reaches for next. The remote itself is the object in the
app icon and opening animation, made real and full size: a charcoal panel lit from the top left, a spun-gold d-pad
sunk in a dark well, dark triangular arrow nubs, a big round OK disc in a black groove, and every key a domed cap
sitting in its own socket. The chrome around it stays quiet so the remote reads first.

Dark is the evening scene: the app icon's near-black ground (#0E0E0F), charcoal cushions and the icon's brass. Light
is daytime linen with paper cushions and a deep bronze that holds AA contrast as text. Both follow the phone's
appearance setting.

What this replaces: the stock iOS settings greys with a generic system-ish blue tint, a flat gold disc with chevrons
and rectangular keys that only gestured at the icon, a cinema glow and gradient texture behind the default remote,
drop-shadowed cards, icons sitting in tinted tiles, and a monospace latency readout dressed as "technical".

**Key Characteristics:**
- Warm neutrals with one accent: bronze in light, brass in dark. The accent only marks the current selection and the
  primary action, never decoration.
- Flat cushions on a ground in the app's lists and cards. No drop shadows there except a floating layer (sheets,
  toasts, the volume HUD).
- The remote is the one place with material: lit metal, wells, sockets and domed caps, all drawn from the opening
  animation's own shape generators (`src/core/introRemote.ts`) so remote, splash and icon match.
- iOS structure: tab bar of four sections, large titles that collapse, inset-grouped lists, native switches and
  sheets, swipe back.
- SF Pro for everything you read in a list; Sora only for large titles and a few remote key faces.
- Motion: one spring for presses, native pushes and sheets, a cross-fade when Reduce Motion is on.

## Colors

The palette is warm-neutral with a single metal accent. Roles live in `src/theme/design.ts` (`designLight`,
`designDark`) and `src/theme/tokens.ts` mirrors them for older screens; `design.test.ts` proves every text pair at
WCAG AA in light, dark and every remote theme.

### Primary
- **Bronze** (#7E5518, light) and **Brass** (#D2AB72, dark): filled buttons, the selected tab cushion, switch on,
  checkmarks, links. Text on bronze is white; text on brass is near-black (#1A1208).
- **Bronze wash / Brass wash** (#F0E5D1 / #3A2E1C): tinted (secondary) buttons and callouts, with their own ink.

### Neutral
- **Linen ground** (#ECEAE5) / **Charcoal ground** (#0E0E0F): behind everything.
- **Paper cushion** (#FBFAF8) / **Charcoal cushion** (#1C1C1B): rows, groups, cards, tab cushions.
- **Ink** (#1A1917 / #F4EEE3), **secondary ink** (#5C5850 / #B3ACA0), **tertiary ink** for glyphs only
  (#8A857B / #827C72).
- **Seams** (#DDD9D1 / #30302D): row separators inside a group only.

### Named Rules
**The One Metal Rule.** Brass/bronze appears only where the user acts or what is selected. A screen with brass on a
decorative element is wrong.

**The No-Blue Rule.** No system-ish blue as the app tint. Remote themes keep their own accents (Midnight is blue by
design); the app chrome never borrows them.

## Typography

**Display Font:** Sora (bundled), large titles and titles only.
**UI Font:** SF Pro, the system font, for headlines, rows, body, footnotes and buttons.

**Character:** a soft geometric display over Apple's own text face; numbers that change (latency, volume, counts) use
tabular figures in the system font, not a monospace costume.

### Hierarchy
- **Large title** (Sora 700, 34/41): top of each tab and pushed screen; collapses into the bar on scroll.
- **Title** (Sora 700, 22/28): the paywall promise, a card's lead line.
- **Headline** (SF 600, 17/22): TV name on the remote, sheet titles, empty-state titles.
- **Body** (SF 400, 17/22): row titles and running text.
- **Footnote** (SF 400, 13/18): section footers, latency, hints.

Everything follows Dynamic Type; rows stack their value under the title at accessibility sizes.

## Layout

One reading column, 16 pt from the screen edges. Inset-grouped lists for anything settings-shaped, 28 pt between
groups. The remote is one full-width body; one-handed mode narrows it toward the thumb. The tab bar is a row of four
cushions with 6 pt gaps above the home indicator.

## Elevation & Depth

Flat by default. Surfaces separate by tone (cushion on ground), never by a shadow or a hairline edge. A shadow means
"floating above the screen": sheets, toasts and the volume HUD. Remote keys keep a short physical bottom edge (keyEdge)
because they are keys.

## Shapes

Continuous (squircle) corners everywhere. Key 14, row group 18, cushion card 20, tab 16, sheet 28, buttons are
capsules. No icon tiles: icons sit bare beside their text in secondary ink, or in the accent when they mark the
current item.

## Components

- **Tab cushions** (`src/ui/TabBar.tsx`): four flat cushions, each in its own box with a hairline edge and a 14 pt label (owner, 1 Nov); the current one is brass/bronze with
  dark/white ink. No shadow.
- **Inset-grouped list** (`src/ui/v2/InsetGroupedList.tsx`): paper/charcoal group, seams between rows, chevrons in
  tertiary ink, native Switch with the brass track.
- **Card** (`src/ui/v2/Card.tsx`): a cushion; no shadow unless `elevation="high"`.
- **Pill button** (`src/ui/v2/PillButton.tsx`): filled (primary), tinted, plain. Springs on press; dims only under
  Reduce Motion.
- **The logo remote** (`src/ui/remote/machined.ts`, `DPad.tsx`, `RemoteKey.tsx`, `PanelFinish.tsx`): the signature.
  - D-pad: spun-metal ring (the icon's own gold samples on Charcoal & Gold; the same light pattern in the theme's
    colour on Brushed Aluminium; a smooth ring on the other themes) in a dark well, four arrow nubs, an OK disc about
    52% of the ring (owner fb-1017b) in a black groove. Hit areas and sizes still come from `dpadGeometry`.
  - Press feel: the pad rocks 5 degrees toward the pressed arrow on the motion spring and a glint of light runs over
    the metal on that side; OK sinks and shades with a medium haptic; keys sink into their sockets and shade. Reduce
    Motion keeps the light and shade, drops the movement.
  - Keys: domed caps lit from the top left with a rim, each in a recessed socket. Power, Source and Settings are round
    caps with their name under them on the body; Back, Home and Menu are the icon's three big round keys under the
    pad; volume and channel are tall rocker caps; the voice key is a long cap with the mic in the accent.
  - Body: the icon's panel finish in the theme's body colour (lit top left, falling off bottom right, a rim along the
    top). Themes still change colours, texture, glow, radius and press feel only. The Cinema glow setting still works;
    Charcoal & Gold has no glow by default.
- **Sheets** (`src/ui/Sheet.tsx`): grabber, SF headline title, close button, the only shadowed surface.

## Do's and Don'ts

### Do:
- **Do** take every colour from `useDesign()` / `useTheme()` roles; add a role to design.ts (and its contrast pair)
  before adding a hex in a screen.
- **Do** keep brass/bronze for selection and the primary action only.
- **Do** keep iOS conventions: tab bar, large titles, inset-grouped lists, native switches, sheets with a grabber.
- **Do** check light, dark and an accessibility text size on a simulator before calling a screen done.

### Don't:
- **Don't** use gradients, glows, glass or drop shadows as decoration in the app's lists, cards and chrome. Light
  and shade belong to the remote's material only, and only where they describe a real surface (metal, a well, a cap).
- **Don't** put icons in tinted circles or tiles.
- **Don't** put a small label above a heading, or build count-up stat tiles.
- **Don't** use a monospace face for numbers that are not code.
- **Don't** add generic cards to hold one line of text; use a grouped row.
- **Don't** change what a control does, the Couch Plus gate or paywall logic in a design pass.
