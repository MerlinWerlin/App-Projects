# Screedline design system: "Screed"

- **Idea:** a job-site tool read in full sun with gloves on. Concrete greys, charcoal and one hi-vis amber
  (`#FFB300`). The amber "screed line" is the brand mark: a short thick bar above every top-level title, the left
  edge of the result slab, the focus ring on fields and the primary button.
- **Result slab:** every calculator pins a dark slab with the answer at 64 pt (Barlow Condensed Bold) to the top of the
  screen while you type. Its left edge turns red for high risk (pour weather).
- **Type:** Barlow Condensed for numbers and titles (tall, narrow, tabular); Atkinson Hyperlegible for everything you
  read (designed for low vision, holds up in glare). Dynamic Type on, with caps so big numbers never break layout.
- **Targets:** 56 pt minimum (`TARGET`), fields 64 pt tall with 30 pt digits, segmented choices 52 pt.
- **Themes:** light, dark and **Sun** (pure black on white, 2.5 pt borders). Tokens in `src/theme/theme.ts`; no raw
  colours in screens except the paywall's fixed dark header.
- **Motion:** system pushes and sheets only; pressed states scale to 0.98. Haptics on save, purchase and choice change,
  with a setting to turn them off.
