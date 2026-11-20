---
name: Satchel
description: Offline travel wallet; every plan printed on ticket stock.
colors:
  board: "#E9EAE4"
  card: "#FFFFFF"
  hairline: "#C9CBC1"
  carbon-ink: "#16191D"
  muted-ink: "#545961"
  overprint-red: "#C2301F"
  overprint-red-text: "#A12819"
  stock-buff: "#F1E2B8"
  stock-mint: "#D3E7D0"
  stock-salmon: "#F3D3C8"
  stock-sky: "#D3E1F0"
  stock-aqua: "#CDE6E2"
  stock-white: "#FAFAF6"
  head-bottle-green: "#1F4A3A"
  head-oxblood: "#6E2A1E"
  head-ink-blue: "#1C3F5E"
  head-signal-red: "#9E1F17"
  head-teal: "#165A53"
  night-board: "#111315"
  night-card: "#212428"
  night-ink: "#EDEEE8"
typography:
  display-xl:
    fontFamily: "Barlow Condensed"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.6px"
  display-l:
    fontFamily: "Barlow Condensed"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1.1
  display-m:
    fontFamily: "Barlow Condensed"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.14
  title:
    fontFamily: "Barlow Condensed"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.18
  body:
    fontFamily: "Libre Franklin"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.44
  body-strong:
    fontFamily: "Libre Franklin"
    fontSize: "16px"
    fontWeight: 600
  label:
    fontFamily: "Libre Franklin"
    fontSize: "13px"
    fontWeight: 600
rounded:
  s: "6px"
  m: "10px"
  l: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  s: "8px"
  m: "12px"
  l: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.carbon-ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.m}"
    height: "50px"
  button-secondary:
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.m}"
    height: "50px"
  chip-selected:
    backgroundColor: "{colors.carbon-ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.s}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.l}"
    padding: "16px"
  ticket-stub:
    backgroundColor: "{colors.stock-buff}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.l}"
---

# Design System: Satchel

Source of truth in code: `src/theme/tokens.ts` (light, dark, `stock`, `typeScale`, `radius`, `elevation`), shared parts in `src/ui/kit.tsx` and `src/ui/hero.tsx`. Contrast pairs are enforced by `src/theme/contrast.test.ts`.

## Overview

**Creative North Star: "The Ticket Wallet"**

Satchel holds the trip the way a wallet holds paper tickets. Plans are printed stubs on flat ticket stock, times are set in big ticket numerals, and each tab opens under a solid deep-stock head torn off along a perforated edge. The board underneath is a cool grey, never cream. Colour does jobs: stock tells you the kind of plan, carbon red tells you "now", deep stock tells you which tab you are in.

The world lends type, palette and one signature move (the stub with its tear line); navigation and controls stay standard iOS: tab bar, stack, switches, sheets.

**Key characteristics:**
- Flat paper: hairline edges, no blur shadows on cards, no gradients.
- Carbon-ink primary buttons; red is an overprint used a handful of times per screen.
- Condensed titles and tabular numerals; Franklin text in sentence case.
- The mascot, the 25 destination themes and the reminder sounds are brand commitments and sit on top of this system.

## Colors

- **Board** `#E9EAE4` (night `#111315`): the page. Cool, slightly green grey.
- **Carbon ink** `#16191D` (night `#EDEEE8`): text and primary fills.
- **Overprint red** `#C2301F`, text `#A12819`: the tint for "now", live edges, the selected-day accent. Not for decoration.
- **Ticket stocks** (`theme.stock`): buff (flights, food, trip passes), mint (train, bus), salmon (stays), sky (car, activities), aqua (ferry, tours), white (notes, free time). Dark mode uses deep versions of the same stocks.
- **Tab heads** (`theme.hero`): bottle green (Trips), oxblood (Wallet), ink blue (Map), signal red (Emergency), teal (Toilets). Both stops are equal: solid, no gradient. A destination theme repaints Trips, Map and Wallet heads and the accent family with the country's own deep colour.

## Typography

- Barlow Condensed 700 for titles and numerals (`displayXL` 48 down to `title` 22), tabular figures for times and codes.
- Libre Franklin 400/600 for text (`body` 16, `small` 14, `caption` 13 semibold).
- Labels are sentence case. No tracked small-caps labels.

## Layout

16 pt side gutter, 12 pt between cards, 24 pt between groups, headers with more space above than below. Time columns right-align against the itinerary rail.

## Elevation & Depth

Flat. Cards separate from the board by a 1 pt hairline in both appearances; only floating things (sheets, map panels) keep a soft offset shadow (`elevation.mid`/`high`).

## Shapes

Die-cut corners: 6 (chips, stamps), 10 (buttons, fields), 12 (cards, stubs), 16 (large panels). Pills only where iOS uses them. Perforation: a row of punched half-holes in the board colour (`Perforation` in hero.tsx) on tab heads; stubs carry a dashed tear line with punched notches.

## Components

- **Button**: primary carbon fill; secondary 1.5 pt ink outline; quiet hairline outline. 50 pt tall.
- **Chip**: transparent with a hairline; selected fills carbon like a punched ticket. Selection haptic.
- **ToggleRow**: the iOS Switch.
- **Ticket stub** (Next up, itinerary blocks, wallet tickets, trip passes): stock fill, condensed title, status as a rubber-stamp outline (red while live).
- **EmptyState**: straight on the board, no box; mascot or art, condensed title, one action.
- **Motion**: press scales to 0.97 in 120 ms ease-out (dims under Reduce Motion); entrances play once per screen mount, never on tab switches; no springs. Haptics only on commits (primary buttons) and selections (chips, switches).

## Do's and Don'ts

- Do print plans on their stock; do keep red for "now" and danger.
- Don't put a label above a heading; don't put icons in tinted circles; don't add a coloured bar down one side of a rounded card; don't add count-up stat tiles; don't bring back gradients or glow.
- Not canonized: the Passport and Travels screens still carry three stat tiles; they predate this pass.
