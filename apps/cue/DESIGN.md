---
name: Cue
description: Teleprompter that waits for you. Design direction "Running order" (21 Nov 2026).
colors:
  # App shell, light
  ground-light: "#F2F2EF"
  sheet-light: "#FFFFFF"
  field-light: "#E7E7E3"
  ink-light: "#141414"
  ink-2-light: "#55554F"
  ink-3-light: "#6B6B64"
  rule-light: "#D9D9D3"
  go-light: "#17804A"
  go-text-light: "#136B3E"
  standby-light: "#A35F00"
  # App shell, dark
  ground-dark: "#0C0C0C"
  sheet-dark: "#18181A"
  field-dark: "#242427"
  ink-dark: "#F2F2EE"
  ink-2-dark: "#A9A9A3"
  ink-3-dark: "#8C8C86"
  rule-dark: "#2C2C2F"
  go-dark: "#3CCB7F"
  go-text-dark: "#4ED18B"
  standby-dark: "#F2B544"
  # Shared
  on-air: "#E5383B"
  on-go-light: "#FFFFFF"
  on-go-dark: "#07140C"
typography:
  script-title:
    fontFamily: "Atkinson Hyperlegible, -apple-system"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-0.01em"
  script-heading:
    fontFamily: "Atkinson Hyperlegible"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
  script-body:
    fontFamily: "Atkinson Hyperlegible"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.53
  ui-body:
    fontFamily: "SF Pro (system)"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.29
  ui-subhead:
    fontFamily: "SF Pro (system)"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.33
  ui-footnote:
    fontFamily: "SF Pro (system)"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.38
  time:
    fontFamily: "SF Pro (system), tabular figures"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.29
  time-large:
    fontFamily: "SF Pro (system), tabular figures"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: "-0.01em"
rounded:
  control: "12px"
  group: "12px"
  chip: "8px"
  round: "999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  touch: "44px"
components:
  button-go:
    backgroundColor: "{colors.go-light}"
    textColor: "{colors.on-go-light}"
    rounded: "{rounded.control}"
    height: "50px"
    typography: "{typography.ui-body}"
  button-plain:
    backgroundColor: "{colors.field-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.control}"
    height: "50px"
  list-row:
    backgroundColor: "{colors.sheet-light}"
    textColor: "{colors.ink-light}"
    padding: "12px 16px"
    height: "44px"
---

# Design System: Cue

## Overview

**Running order.** A broadcast running order is the page a presenter actually trusts: every item has a slug on the left and its duration in a ruled column on the right, and the only colours on it mean something (standby, go, on air). Cue takes four things from that world and nothing else: its ruled density, its right-hand time column, its stage-light colour vocabulary, and the hard split between the words being read and the furniture around them. Navigation, lists, sheets, switches and the segmented control stay standard iPhone.

Scene that sets the appearance: a person alone with a phone on a stand, arm's length away, often in a dim room just before they film. The prompter is always dark-first; the shell follows the system appearance and both appearances are designed.

The signature move: **time is set like a running order.** Every script, section and take reads its duration in a right-aligned, tabular time column, and the three cue-light colours carry state across the app: amber standby (paused, waiting for your voice), green go (start prompting, listening), red on air (recording only).

The second rule, from the type-specimen discipline: **the script is set in Atkinson Hyperlegible, everything else in the system face.** You can always tell what you will read aloud from what operates the app.

## Colors

Restrained shell, three working colours. Colour never decorates.

### Primary: Go green
`go` fills the primary action on each screen (Prompt, New script, Get Plus), the switch track, selected states and the navigation tint. `go-text` is the same hue darkened or lifted for text and icons on the ground (4.5:1 or better in both appearances).

### Secondary: Standby amber
Paused, waiting, "listening but you are quiet", the countdown. Never a fill behind text; it is a dot, a word or a number.

### Tertiary: On air red
Recording only: the shutter, the recording border, the record dot on the Record button. Also the destructive role (Delete) because iOS uses red for both.

### Neutral
Ground, sheet (grouped rows, bars), field (inputs, segmented track, plain buttons), ink in three steps, and the rule. Neutrals are true greys with no tint; ink 3 is the faintest text allowed and meets 4.5:1 on ground and sheet.

### Prompter palettes
Classic (default), Paper, Night and High contrast keep their identities. Classic: near-black ground, warm white words, emphasis in a pale amber, pauses and section names in standby amber, a flat reading band. The reading line is a flat band with hard edges, not a glow.

### Named rules
- **The cue-light rule.** Green means go, amber means waiting, red means recording. If a colour does not mean one of those, it is a neutral.
- **One fill per screen.** Only one green-filled button is visible at a time.

## Typography

- **Atkinson Hyperlegible** (shipped): the script and its title. Library row titles, the editor title and body, the preview, the prompter, the paywall title. Built for legibility at distance, which is the job.
- **San Francisco** (system, follows Dynamic Type): every label, row, button, caption, number and navigation title. Numbers that measure time use tabular figures and semibold weight.
- Bricolage Grotesque is retired.

### Hierarchy
- Large title (navigation, Atkinson Bold 34) on the library only; deeper screens use the inline 17 pt system title.
- Script title in a row: Atkinson Bold 17. Preview line: system 15, ink 2, two lines.
- Time column: system 17 semibold tabular, right-aligned; its unit below in footnote ink 3.
- Group headers in Settings: system footnote, ink 2, sentence case, no tracking.
- No text under 12 pt. No uppercase tracked labels anywhere.

## Layout

- 4 pt base: 4, 8, 12, 16, 24, 32. Screen gutter 16. Row minimum 44, list rows 60 to 72 with two lines.
- The library is a full-width list with hairline rules inset 16 on the left (iOS plain list), not a stack of cards.
- Bottom bars (library, editor) sit on the system material with a hairline top rule; they carry the one primary action within thumb reach.
- Every screen is checked at 375 and 440 points wide and in both appearances.

## Elevation & Depth

Flat. Depth comes from the system materials behind bars and the prompter dock, from grouping (sheet on ground) and from rules, never from drop shadows. No shadow tokens exist.

## Shapes

- Controls and grouped lists: 12. Chips (markup toolbar, prompter status): 8. Round only for the play button, the shutter and 44 pt icon buttons.
- Rules are hairlines (`StyleSheet.hairlineWidth`) in `rule`.

## Components

### Buttons
- **Go** (primary): solid `go`, `on-go` label, system 17 semibold, 50 tall, radius 12. Optional leading glyph in the label colour.
- **Plain** (secondary): `field` fill, ink label. No borders, no outlines.
- **Destructive**: only inside system alerts and action sheets.
- Press: scale 0.97 and opacity 0.9 at once, released in 160 ms; Reduce Motion keeps the opacity step and drops the scale.

### Lists and rows
- Plain list (library): title, preview, time column; long-press and the trailing ellipsis open the system action sheet. Pinned scripts show a small pin glyph before the title and sort first; there is no coloured edge bar.
- Grouped list (Settings, paywall features): `sheet` rows on `ground`, radius 12, hairline separators inset 16, no row icons, chevron only where a row opens something.

### Inputs
- Search field and access code: `field` fill, radius 10, system 17, ink 3 placeholder, green caret.

### Markup toolbar (editor)
- Chips show the markup itself, so the toolbar teaches the syntax: `#` Section, `*` Emphasis, `[pause]`, `[[ ]]` Note, `—` Break. The token is set in ink 2, the word in ink. Field fill, radius 8, 36 tall with 44 hit area.

### Prompter dock
- System dark material, radius 24, no gradient. Play is a 64 pt solid green circle (pause glyph while running). Speed reads as a tabular percentage between minus and plus. Mirror and flip show their active state as a white fill with dark glyph.
- Status chip: a 8 pt dot plus a word. Green dot "Listening", amber dot "Waiting for you".

### Paywall
- Title, one-line promise, the trial state as a plain amber line, then a grouped list of what Plus adds (name and one line each, no icons), then what stays free, then the price buttons with the terms above them, Restore and close always visible.

### Navigation
- Standard stack with large title on the library, inline elsewhere, edge-swipe back, close at the top left of full-screen covers, green tint.

## Motion

- System pushes and sheets. Full-screen prompter and camera fade up from the bottom; with Reduce Motion everything crossfades.
- Prompter chrome fades in 180 ms and out 240 ms, ease-out. Nothing else animates on its own.
- The launch intro rolls "Cue" up into the reading band once (about 1.2 s, tap to skip, off with Reduce Motion). No light sweep.
- Haptics on commit only (start, finish, saved take), as now.

## Do's and Don'ts

### Do
- Let the words be the biggest thing on every screen that shows a script.
- Put durations in the right-hand time column, tabular, the same way everywhere.
- Use green for go, amber for waiting, red for recording, and nothing else.
- Use platform controls: Switch, segmented control, action sheets, alerts, swipe-back.
- Check light and dark, 375 and 440 wide, and the largest Dynamic Type size before calling a screen done.

### Don't
- No gradients, glows, sheen or light sweeps, on buttons, marks, bands or backgrounds. (The prompter's top and bottom edge fades stay: they are scroll-edge masks to the same colour, not decoration.)
- No icons sitting in tinted circles or rounded squares, anywhere: not in rows, not on the paywall, not on empty or permission screens.
- No small labels or eyebrows above headings, no uppercase tracked captions.
- No count-up numbers, stat tiles or big-number-with-small-label blocks. A number appears only where it measures something the person set or did.
- No generic cards: no stacks of rounded shadowed boxes for list content, no bar down one side of a box, no nested containers.
- No sparkles for "premium". Plus is marked with the word Plus or a lock.
- No drop shadows, no glass used as decoration, no custom navigation chrome.
- No brass, gold or violet.
