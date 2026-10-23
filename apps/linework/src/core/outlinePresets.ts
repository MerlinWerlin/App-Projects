// Outline presets for the Prepare screen. Each preset is a full set of pipeline settings
// (see outline.ts), not a label: choosing one moves the sliders, and moving a slider afterwards
// turns the selection into "Custom".
// Labels here are English fallbacks: the UI translates by id (src/i18n/en/prepare.ts, `prepare.preset.<id>.name`).

import type { BackgroundMode, OutlineStyle, PhotoKind } from './outline.ts';

export type OutlineSettings = {
  detail: number;
  thickness: number;
  taper: number;
  smooth: number;
  background: BackgroundMode;
  kind: PhotoKind;
  /** Line engine (T49). 'classic' = the v2 face/subject-aware pipeline. */
  style: OutlineStyle;
};

export type PresetId =
  | 'best' | 'sketch' | 'lineart' | 'boldlines'
  | 'fine' | 'portrait' | 'clean' | 'bold' | 'simple' | 'illustration';

export type Preset = { id: PresetId; label: string; description: string };

export const PRESETS: readonly Preset[] = [
  { id: 'best', label: 'Best match', description: 'Picks settings for this photo (portrait, drawing or object)' },
  { id: 'sketch', label: 'Sketch', description: 'Soft pencil-like lines; good for faces, pets and soft subjects' },
  { id: 'lineart', label: 'Line art', description: 'Crisp, exact edges; good for objects, buildings and lettering' },
  { id: 'boldlines', label: 'Bold lines', description: 'Only the main edges, drawn thick and easy to see' },
  { id: 'fine', label: 'Fine line art', description: 'Thin, delicate lines with plenty of detail' },
  { id: 'portrait', label: 'Detailed portrait', description: 'Keeps eyes, brows, nose, lips and jaw; quiet background' },
  { id: 'clean', label: 'Clean outline', description: 'Main shapes and clear inner lines, no clutter' },
  { id: 'bold', label: 'Bold outline', description: 'Thick outer lines, thinner inner details' },
  { id: 'simple', label: 'Simplified', description: 'Just the big shapes — easiest to trace' },
  { id: 'illustration', label: 'Detailed illustration', description: 'Lots of texture and folds, background included' },
];

// The T49 styles trace the whole picture (background 'all') and ignore the photo kind.
const BASE: Record<Exclude<PresetId, 'best'>, OutlineSettings> = {
  sketch: { detail: 0.5, thickness: 1.5, taper: 0, smooth: 0, background: 'all', kind: 'auto', style: 'sketch' },
  lineart: { detail: 0.5, thickness: 1.25, taper: 0, smooth: 0, background: 'all', kind: 'auto', style: 'lineart' },
  boldlines: { detail: 0.4, thickness: 5, taper: 0, smooth: 0, background: 'all', kind: 'auto', style: 'bold' },
  fine: { detail: 0.6, thickness: 1, taper: 0.3, smooth: 0, background: 'soft', kind: 'auto', style: 'classic' },
  portrait: { detail: 0.6, thickness: 1.5, taper: 0.45, smooth: 0.1, background: 'subject', kind: 'portrait', style: 'classic' },
  clean: { detail: 0.35, thickness: 2, taper: 0.25, smooth: 0.15, background: 'subject', kind: 'auto', style: 'classic' },
  bold: { detail: 0.3, thickness: 5, taper: 0.6, smooth: 0.25, background: 'subject', kind: 'auto', style: 'classic' },
  simple: { detail: 0.08, thickness: 3, taper: 0.1, smooth: 0.7, background: 'subject', kind: 'auto', style: 'classic' },
  illustration: { detail: 0.85, thickness: 1.25, taper: 0.4, smooth: 0, background: 'all', kind: 'auto', style: 'classic' },
};

/** True for the T49 styles, which ignore the photo kind and background settings. */
export function usesKindAndBackground(s: Pick<OutlineSettings, 'style'>): boolean {
  return (s.style ?? 'classic') === 'classic';
}

/** Settings for a preset. 'best' depends on the detected photo kind. */
export function presetSettings(id: PresetId, detected: Exclude<PhotoKind, 'auto'> = 'object'): OutlineSettings {
  if (id !== 'best') return { ...BASE[id] };
  switch (detected) {
    case 'portrait':
      return { ...BASE.portrait };
    case 'drawing':
      return { ...BASE.illustration, kind: 'drawing', thickness: 1.5 };
    case 'landscape':
      return { ...BASE.fine, background: 'all', kind: 'landscape', detail: 0.45, thickness: 1.25 };
    case 'pet':
      return { ...BASE.clean, kind: 'pet', detail: 0.45 };
    default:
      return { ...BASE.clean, detail: 0.4, thickness: 1.75 };
  }
}

/** True when the settings equal what the preset would set (so the chip stays selected). */
export function matchesPreset(s: OutlineSettings, id: PresetId, detected?: Exclude<PhotoKind, 'auto'>): boolean {
  const p = presetSettings(id, detected);
  const close = (a: number, b: number) => Math.abs(a - b) < 0.011;
  return (
    close(s.detail, p.detail) && close(s.thickness, p.thickness) && close(s.taper, p.taper) &&
    close(s.smooth, p.smooth) && s.background === p.background && s.kind === p.kind &&
    (s.style ?? 'classic') === p.style
  );
}

export const KINDS: readonly { id: PhotoKind; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'pet', label: 'Pet' },
  { id: 'object', label: 'Object' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'drawing', label: 'Drawing' },
];

export const BACKGROUNDS: readonly { id: BackgroundMode; label: string; hint: string }[] = [
  { id: 'subject', label: 'Subject only', hint: 'Removes most background lines' },
  { id: 'soft', label: 'Soft', hint: 'Keeps only strong background lines' },
  { id: 'all', label: 'Everything', hint: 'Traces the whole picture' },
];

export function kindLabel(k: PhotoKind): string {
  return KINDS.find((x) => x.id === k)?.label ?? k;
}

export type ThicknessName = 'hairline' | 'fine' | 'medium' | 'bold' | 'extraBold';

const THICKNESS_NAMES: Record<ThicknessName, string> = {
  hairline: 'Hairline',
  fine: 'Fine',
  medium: 'Medium',
  bold: 'Bold',
  extraBold: 'Extra bold',
};

/** Line width rounded to 0.01 px, as shown next to the slider. */
export function roundThickness(px: number): number {
  return Math.round(px * 100) / 100;
}

/** Name id for a line width in px (the UI shows `prepare.thickness.<id>` from the catalogue). */
export function thicknessName(px: number): ThicknessName {
  const v = roundThickness(px);
  return v <= 0.75 ? 'hairline' : v <= 1.5 ? 'fine' : v <= 2.75 ? 'medium' : v <= 4.5 ? 'bold' : 'extraBold';
}

/** English description of a line width in px (for a 1024 px outline). */
export function thicknessLabel(px: number): string {
  return `${roundThickness(px)} px · ${THICKNESS_NAMES[thicknessName(px)]}`;
}
