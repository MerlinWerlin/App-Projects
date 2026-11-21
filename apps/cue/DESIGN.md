---
name: Cue
description: Teleprompter that waits for you. Design direction "Signal" (21 Nov 2026), replacing "Running order" the same day.
colors:
  sign: "#FFCC00"
  sign-ink: "#0A0A0A"
  # Light
  ground-light: "#EDEDE9"
  sheet-light: "#FFFFFF"
  field-light: "#E0E0DB"
  ink-light: "#0A0A0A"
  ink-2-light: "#4C4C47"
  ink-3-light: "#5F5F59"
  rule-light: "#D3D3CD"
  sign-text-light: "#6B5000"
  # Dark
  ground-dark: "#0A0A0A"
  sheet-dark: "#161616"
  field-dark: "#232323"
  ink-dark: "#F5F5F0"
  ink-2-dark: "#ABABA5"
  ink-3-dark: "#8E8E88"
  rule-dark: "#2A2A2A"
  # Shared
  on-air: "#E5383B"
  stage-panel: "#151515"
typography:
  monument:
    fontFamily: "Atkinson Hyperlegible"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1.07
    letterSpacing: "-1.5px"
  display:
    fontFamily: "Atkinson Hyperlegible"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.8px"
  title:
    fontFamily: "Atkinson Hyperlegible"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.19
  headline:
    fontFamily: "Atkinson Hyperlegible"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.29
  body:
    fontFamily: "Atkinson Hyperlegible"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.35
  script:
    fontFamily: "Atkinson Hyperlegible"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.53
rounded:
  chip: "4px"
  control: "6px"
  panel: "6px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  gutter: "20px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  sign-band:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.sign-ink}"
    padding: "24px 20px 16px"
  button-sign:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.sign-ink}"
    rounded: "{rounded.control}"
    height: "52px"
  button-on-sign:
    backgroundColor: "{colors.sign-ink}"
    textColor: "{colors.sign}"
    rounded: "{rounded.control}"
    height: "52px"
  button-ink:
    backgroundColor: "{colors.ink-light}"
    textColor: "{colors.sheet-light}"
    rounded: "{rounded.control}"
    height: "52px"
  play-key:
    backgroundColor: "{colors.sign}"
    textColor: "{colors.sign-ink}"
    rounded: "{rounded.control}"
    size: "64px"
---

# Design System: Cue

## Overview

**Signal.** Cue is built like airport wayfinding. On a concourse one yellow band tells you where to go next, in big plain letters, and the gate number is the biggest thing on it. A teleprompter has the same job: show your eyes where to go next. So in Cue, **yellow means "look here next" and nothing else**. It paints the reading line, the next script in your library, the sign dock under the editor, and the play key. Everything else is black, white and grey.

Signature moves:
- **Sign bands.** Full-width yellow bands with black type, edge to edge, no card around them. One per screen at most.
- **Gate numbers.** Read times are set at monument scale (56 pt on the library band, 40 pt in the editor) because the time is the answer people look for.
- **Departure-board digits.** When the read time changes (speed nudged, text edited), its digits flip: the old one leaves upward and the new one arrives from below.
- **Edge arrows.** The prompter's reading line is marked by yellow arrows locked to both screen edges, the way signage pins an arrow to the edge it points past.

Scene: a person alone with a phone on a stand, arm's length away, often in a dim room just before filming. Both appearances are designed; the prompter and camera are always dark.

## Colors

- **Sign yellow `#FFCC00`** with **sign ink `#0A0A0A`** on it (13:1). Used for: the next-script band, the editor's sign dock, the paywall's top band, the forward action (Get Plus, play), the reading-line arrows and band tint, switch tracks, the active mirror/flip keys. Never for decoration, borders or headings.
- **Sign text** is yellow on dark ground and `#6B5000` on light ground, for the rare word that must carry the sign colour.
- **Neutrals** are true greys. Ink, ink 2 and ink 3 meet 4.5:1 on ground, sheet and field in both appearances.
- **On air red `#E5383B`** for recording only (shutter, recording border, the dot on the Record button) and the iOS destructive role.
- **Ink fill** (black in light, white in dark) is the strong neutral button: New script, Start free trial.
- Prompter palettes: Classic (black, warm white, yellow emphasis and marks), Paper, Night red and High contrast keep their identities.

### Named rules
- **The wayfinding rule.** If a yellow thing is not where your eyes or thumb should go next, it should not be yellow.
- **One band per screen.**

## Typography

- **Atkinson Hyperlegible for everything** (it was drawn for legibility at a distance, which is the whole job). Regular for reading, Bold for every heading, label and number. Bricolage Grotesque is retired.
- Scale: monument 56, display 40, title 26, headline 17 bold, body 17, subhead 15, footnote 13, caption 12, script 19/29. Big sizes take negative tracking (-0.8 to -1.5 px); body sits at 0.
- Sentence case everywhere. No uppercase tracked labels, no eyebrows above headings.
- Dynamic Type: everything scales. Dense chrome caps its growth (`maxFontSizeMultiplier` 1.2 to 1.6 on bands, docks, time columns, segmented controls and steppers; the countdown never scales) so the largest sizes cannot clip it.

## Layout

- 4 pt base; screen gutter 20. Bands run edge to edge; lists and groups sit in the gutter.
- **Library:** its own header (Scripts at display size, Import and Settings as square keys), search, then the next script as a sign band (arrow and title, two lines of preview, the read time at monument size, a black Prompt button on the yellow), then the board: every other script as a line with its read time in a right-hand column. A bottom bar holds the count and New script.
- **Editor:** a 34 pt title, Write / Preview, the markup chips, the script, and the sign dock: flipping read time, speed keys, Fit to time, Prompt (black on yellow) and Record (outlined, red dot).
- **Prompter:** words first. A close key and the timer at the top; a full-width black dock at the bottom with the state line, the Steady / Voice Pace / Voice Follow control and the transport (restart, sections, slower, the yellow play key with the speed under it, faster, mirror, flip).
- Checked at 375 and 440 points wide and at the largest accessibility text size.

## Elevation & Depth

Flat. No shadows. Depth comes from the yellow band against the ground, from sheets on the ground, and from the system material behind the library's bottom bar.

## Shapes

Signage corners: 6 for buttons, keys and panels; 4 for chips. Icon keys are squares, not circles. Round is reserved for the record shutter and status dots.

## Components

- **Btn** `sign` (yellow, the forward action), `onSign` (black on a yellow band), `ink` (solid black or white), `plain` (field). 52 tall, Atkinson Bold 17.
- **IconBtn** square keys (44 pt) on bands and docks; active toggles fill yellow.
- **FlapText** for numbers that change while you watch.
- **Segmented** with an ink fill for the chosen option in the app, a yellow fill on the always-dark prompter.
- **Section / Row** for Settings and the paywall's feature list: Atkinson Bold headers, sheet rows, arrow for rows that open something.
- **Tag** "Plus" as a small ink capsule; Plus colours and modes show a lock.

## Motion

- The next-script band rises 12 pt and fades in when it changes (320 ms). Board rows slide to their new place when pinned or edited instead of jumping.
- Digits flip in 220 ms on read-time changes; nothing animates until the screen has settled (about 0.7 s), so the push stays clean.
- Prompter chrome fades in 180 ms and out 240 ms. Press feedback: 0.97 scale with a dim.
- Reduce Motion (system or the in-app switch): no movement at all; band, rows and digits just change, chrome cross-fades, and the launch intro is skipped.

## Do's and Don'ts

### Do
- Spend yellow on the next thing to look at or press. Once per screen as a band.
- Set read times big. They are the answer.
- Keep every control a real control: system sheets, alerts, action sheets, switches, keyboard and edge-swipe back.
- Check light and dark, 375 and 440 wide, and the largest Dynamic Type before calling a screen done.

### Don't
- No gradients, glows, light sweeps or blurs used as decoration.
- No icons in tinted circles or rounded squares. Glyphs sit bare, or as a black key on yellow.
- No eyebrows or small labels above headings; no uppercase tracked captions.
- No count-up numbers, stat tiles or vanity metrics. A number appears only when it measures the user's script or take.
- No generic cards, nested containers, drop shadows, or a coloured bar down one side of a box.
- No sparkles for "premium", no violet, no brass.
- Yellow never decorates: not for headings, borders, icons in lists or illustrations.
