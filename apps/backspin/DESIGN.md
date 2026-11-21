---
name: Backspin
description: Reverse-singing party game, printed in two spot inks on paper.
colors:
  paper: "#F3F1EB"
  paper-slip: "#E8E5DC"
  paper-slip-deep: "#DDD9CD"
  rule: "#D3CFC4"
  ink: "#17151C"
  ink-soft: "#55515E"
  fluoro-pink: "#FF4FA8"
  pink-tint: "#F6CDDC"
  pink-text: "#8B3262"
  riso-blue: "#3255A4"
  blue-tint: "#D0D5DE"
  overprint-violet: "#321A6C"
  pass-green: "#0B6A3B"
  stop-red: "#C2272D"
  night-stock: "#131217"
  night-slip: "#1D1B22"
  night-slip-deep: "#27252D"
  night-rule: "#34313B"
  night-ink: "#F3F1EB"
  night-ink-soft: "#B4AFBD"
  night-pink: "#FF5FB1"
  night-blue: "#7A97F0"
typography:
  display-hero:
    fontFamily: "BackspinDisplay (Bricolage Grotesque 96pt ExtraBold, static cut)"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1.075
    letterSpacing: "-0.6px"
  display-line:
    fontFamily: "BackspinDisplay"
    fontSize: "36px"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.4px"
  display-title:
    fontFamily: "BackspinDisplay"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.07
  display-h:
    fontFamily: "BackspinDisplay"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.18
  score:
    fontFamily: "BackspinDisplay"
    fontSize: "104px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-2px"
    fontFeature: "tnum"
  body:
    fontFamily: "SF Pro (system)"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.41
  body-strong:
    fontFamily: "SF Pro (system)"
    fontSize: "17px"
    fontWeight: 600
  small:
    fontFamily: "SF Pro (system)"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  s: "8px"
  m: "14px"
  l: "20px"
  pill: "999px"
spacing:
  unit: "4px"
  gutter: "20px"
  group: "32px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.fluoro-pink}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    height: "56px"
  button-rewind:
    backgroundColor: "{colors.riso-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    height: "56px"
  button-quiet:
    backgroundColor: "{colors.paper-slip-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "56px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
  slip:
    backgroundColor: "{colors.paper-slip}"
    rounded: "{rounded.l}"
    padding: "16px"
  slip-featured:
    backgroundColor: "{colors.pink-tint}"
    rounded: "{rounded.l}"
    padding: "20px"
  record-button:
    backgroundColor: "{colors.fluoro-pink}"
    textColor: "{colors.ink}"
    size: "148px"
---

# Design System: Backspin

Source of truth in code: `src/ui/theme.ts` (tokens, the Print skin, type scale, motion), `src/ui/kit.tsx`
(components), `src/ui/icons.tsx` (icons). Hex values above are the light "Print" skin; the night values are its dark
mode. Tints and the overprint colour are computed in `makeTheme`, so they follow whichever skin is on.

## Overview

**Creative North Star: "The Two-Ink Party Flyer."** Backspin is printed like a risograph flyer for a house party:
uncoated paper, two spot inks, chunky type. The two inks are the game. **Fluoro pink is your voice going forwards**
(record, your copy, the main action). **Riso blue is that voice played backwards** (the reversed clip, its play
button, its waveform). When the two are printed over each other they make a third colour, the deep overprint
violet, and that is what a good copy looks like: on the score screen your flipped copy (pink) is printed over the
original (blue), and where they line up the inks overprint. Backwards is shown, not described: once a line has been
said it prints mirrored in blue, the wordmark carries its own backwards echo, and big buttons sit slightly out of
register over a plate of the other ink and press down into register. It should feel like a game you hold, not a
utility. The tab bar, back chevron, switches and alerts stay native, so nobody has to learn the controls.

Mood: a loud room, one phone passed hand to hand. Loud in colour, type and motion; one obvious next step per
screen; big targets.

Anti-references: the old "late-night record booth" (purple night, neon red glow, gradient buttons, emoji icons,
tiles of icon + title + subtitle). Also not Satchel's ticket-stock look: no ticket stubs, perforations, condensed
type or multi-colour stock system here.

## Colors

Strategy: **committed two-ink**. Paper and ink neutrals carry the screen; pink and blue each own a meaning and
appear as solid fields (buttons, the record disc, the daily slip), never as accents sprinkled for decoration.

- **Paper** (#F3F1EB / night #131217): the ground of every screen. Light mode is uncoated stock; dark mode is black
  stock, not a purple night.
- **Paper slip** (#E8E5DC, deeper #DDD9CD): quiet fills for inputs, playback slips, the quiet button. A slip is a
  second sheet of the same paper, never a white card with a shadow.
- **Ink** (#17151C / night #F3F1EB) and **soft ink** (#55515E / night #B4AFBD): all text. Soft ink meets 4.5:1 on
  paper, slips and both tints.
- **Fluoro pink** (#FF4FA8 / night #FF5FB1): record, Quick play, Next, the selected option. Text on pink is ink, never
  white. Pink is too light to be text on paper, so pink *text* uses **pink-text** (`theme.recText`, computed: the
  nearest pink that reaches 4.5:1).
- **Riso blue** (#3255A4 / night #7A97F0): anything backwards: the reversed clip, its play control, Share (the clip
  you send is mostly backwards). White text on blue in light mode, ink on blue at night.
- **Overprint violet** (computed: pink × blue multiply in light, screen at night): only where the two inks overlap,
  plus the "Flipped" playback slip. Never a fill on its own, never a gradient.
- **Tints** (pink 22%, blue 18% of the ink on paper): the featured daily slip, a selected party mode, the backwards
  playback pill. Flat screen tints, the way riso prints a lighter shade.
- **Pass green / stop red**: done states and destructive actions only.

Alternate skins in Settings keep their own palettes but render flat in this system: their old gradient and glow
values are ignored.

## Typography

- **Display: BackspinDisplay**, a static ExtraBold cut of Bricolage Grotesque (OFL, the studio brand face in
  `marketing/brand/fonts`, instanced at opsz 96 / wght 800 / wdth 100 and renamed per the OFL). Used for screen
  titles, section headings, the challenge line, quips and the score. Its ink traps and chunky shapes are the
  "printed" voice. Loaded at startup with expo-font; if it fails, headings fall back to SF.
- **Text: SF Pro (system)** for everything people read or tap: body 17, body-strong 17 semibold, small 15. Follows
  Dynamic Type.
- Scale (pt): hero 40, line 36, title 30, h 22, body 17, small 15, score 104. Tracking tightens with size (-0.6 at
  40, -2 at 104); body stays at 0. Headings carry their own weight: no labels above them.
- Numbers that change (the score, take scores) use tabular figures.

## Layout

- 4-point grid. Screen gutter 20. Related items 8-12 apart, groups 24-32, sections 40.
- One column, max 640 wide (centred on iPad).
- Each screen leads with its real content at full size: the challenge line on a round, the daily line on Home, the
  pack names on Packs. Lists are ruled lists (hairline dividers, chevrons), not grids of tiles.
- The main action sits low and full width (56 tall); secondary actions are smaller pills or ghost buttons under it.
- Large titles on tab screens; inline navigation-bar titles (display face, 20) on pushed screens, back chevron only.

## Elevation & Depth

Flat. Depth comes from tone (paper, slip, deeper slip) and from ink overprinting, never from shadows, blur or glow.
The only stacked surfaces are iOS's own (sheets, alerts).

## Shapes

- Radius: slips 20, small slips and inputs 14, tiny marks 8, every control a pill.
- The record button and the record disc are perfect circles. Difficulty is one to three ink dots; stars on the score
  are five small circles, filled pink.
- Lines: hairline dividers in `rule`; outlines 1.5 (chips, ghost buttons), 2 for a selected slip, 3 for the
  recording ring.

## Components

- **Buttons** (one family, all pills): primary pink with ink label; rewind blue; quiet slip; ghost ink outline.
  56 tall (44 small). Icon on the left at 20 (18 small), drawn from `icons.tsx`.
- **Chips**: 44 tall, ink outline off, solid ink on. Locked chips show a lock and read "locked" to VoiceOver.
- **Slip** (`Card`): flat paper slip, radius 20, padding 16, no border or shadow. `selected` prints it in the pink
  tint with a 2 pt pink rule. Use slips for grouped settings and for choices; never as a frame for a heading + text.
- **Record button**: 148 pink disc. Idle shows the mic, recording shows an ink stop square inside a 3 pt ink ring,
  countdown shows the number in the display face. The live level meter above it (pink bars) is the feedback.
- **Step rule**: four 4 pt rules at the top of a round; done in ink, current in the step's ink (blue while listening
  backwards, pink otherwise).
- **Ink plate (misregistration)**: big primary and rewind buttons have a plate of the other ink 4 pt down-right
  behind them; pressing moves the button 3 pt into register, and it springs back with a small bounce. The record
  button has the same blue plate and sits in register while recording.
- **Wordmark**: "Backspin" in ink with the same word mirrored in blue overlapping its lower half (blend overprint).
- **Mirrored line**: in the listen and copy steps the challenge line is printed backwards (scaleX -1) in blue.
  VoiceOver reads it normally. The intro's "Hear it backwards" card echoes its title the same way.
- **Stickers**: the daily slip (-1.2°), pack flyers (alternating pink tint, blue tint, plain stock at ±1°), the
  party winner on a pink stamp (-2.5°) and the score (-4°) sit at an angle. Body text never rotates more than 1.2°.
- **Record ring**: a dashed ink ring around the record button, line-coloured when idle; it turns while recording.
- **Disc**: the record, printed flat in ink with knocked-out grooves and a pink (forwards) or blue (backwards) label.
  Turns only while sound plays.
- **Waveforms**: rounded bars in the ink of what they show. The overprint pair on the score screen uses
  `mixBlendMode` (multiply / screen).
- **Icons**: 24 grid, 2 pt round strokes, one colour, no containers.
- **Lists**: ruled rows, 16 vertical padding, title + soft-ink line, chevron right.

## Motion

Motion is part of the game, and each move means something. Durations are from `MOTION` in theme.ts.

- Press: plated buttons press into register (spring, slight bounce on release); everything else presses to 0.97,
  critically damped.
- Steps of a round slide in once: from the right going forwards (say, flip), from the left for the backwards steps
  (listen, copy). Pack flyers and the daily slip enter the same way, staggered by 40 ms.
- The disc turns while audio plays, forwards or backwards; the record ring turns while recording.
- The flip: the score is rubber-stamped (1.35 to 1, -9° to -4°, 240 ms, exponential ease-out), the pink copy slides
  14 pt into register over the blue original (420 ms), then the star dots pop in one by one (70 ms apart).
- Screens use the standard iOS push and modal transitions.
- **Reduce Motion / Calm motion**: no slides, stamps, spins, bounces or pops. Presses dim instead, steps fade in
  over 160 ms, and the score, stars and overprint simply appear.

## Do's and Don'ts

Do:
- Give pink and blue their meanings and keep them: pink forwards, blue backwards, violet only where they meet.
- Print the content big: the line, the score, pack names.
- Use native iOS structure and controls (tab bar, navigation bar, switches, alerts, sheets).
- Keep text at 4.5:1 on every surface it sits on (skins.test.ts checks paper, slips and tints).
- Draw every icon from `icons.tsx`.

Don't (each of these is a tell that made the old look read as AI-made):
- No gradients of any kind (backgrounds, buttons, text). `expo-linear-gradient` is no longer used by any screen.
- No glow, coloured halos or zero-offset shadows; no drop shadows on slips.
- No icons in tinted circles or rounded squares; no emoji standing in for icons.
- No small uppercase labels above headings (eyebrows), and no "1 / 3" counters above titles.
- No count-up numbers and no stat tiles: the score is stamped once; stats are a sentence.
- No motion without a meaning: things move forwards or backwards, press into register, or get stamped.
- No generic cards (icon + title + subtitle tiles in a grid); use a ruled list or print the content itself.
- No white text on pink, no pink text on paper (use `recText`).
- No new colours per feature; a third ink only appears as the overprint.
