// Prompt template for making a missing app icon in an EXTERNAL image tool (owner review §5).
// Glaze never generates images and never contacts any AI service: this only builds text the
// user copies into ChatGPT or any image tool of their choice, with the real image specs.
//
// Specs come from the code, not guesses (docs/AUDIT_2026-10-12.md "Exact icon image specs"):
//  - Profile (bulk install) icons are rendered at PROFILE_ICON_SIZE px; icons saved to Photos for
//    the Shortcuts method at PHOTO_ICON_SIZE px. An uploaded image is drawn into the icon shape and
//    captured at those sizes, so a square image of at least PHOTO_ICON_SIZE px is enough.
//  - A circle mask keeps only the inscribed circle, whose inscribed square is 1/√2 ≈ 70 % of the
//    side, and iOS rounds the corners again: keep important artwork in the central ~70 %.
// Pure TS (no React Native / Expo).

import { getMotif } from './artwork.ts';
import { PHOTO_ICON_SIZE, PROFILE_ICON_SIZE } from './install.ts';
import type { Theme } from './themes.ts';

/** Smallest image that fills the largest icon Glaze renders (the Photos / Shortcuts icon). */
export const MIN_UPLOAD_SIZE = PHOTO_ICON_SIZE;
/**
 * A comfortable size to ask for: the common square output of image tools. Not a Glaze
 * requirement (anything ≥ MIN_UPLOAD_SIZE works; larger is only downscaled).
 */
export const IDEAL_UPLOAD_SIZE = 1024;
/** Central safe area, as a whole percentage: the square inside the circle mask (1/√2). */
export const SAFE_AREA_PERCENT = Math.floor(100 / Math.SQRT2);
/** Formats the image picker accepts for an override image. */
export const UPLOAD_FORMATS: readonly string[] = Object.freeze(['PNG', 'JPEG']);

export type IconPromptInput = {
  appName: string;
  theme: Pick<Theme, 'name' | 'tagline' | 'palette' | 'art' | 'iconStyle'>;
};

const PALETTE_ROLES: readonly [keyof Theme['palette'], string][] = [
  ['bg', 'background'],
  ['surface', 'light surface'],
  ['accent', 'accent'],
  ['ink', 'dark ink'],
  ['glyph', 'symbol colour'],
];

const ART_ROLES: readonly [keyof Theme['art']['colours'], string][] = [
  ['primary', 'main illustration colour'],
  ['secondary', 'second illustration colour'],
  ['accent', 'highlight'],
];

/** The theme's colours as unique upper-case hex values with a role, palette first. */
export function themeColours(theme: IconPromptInput['theme']): { hex: string; role: string }[] {
  const out: { hex: string; role: string }[] = [];
  const seen = new Set<string>();
  const add = (raw: unknown, role: string) => {
    if (typeof raw !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw)) return;
    const hex = raw.toUpperCase();
    if (seen.has(hex)) return;
    seen.add(hex);
    out.push({ hex, role });
  };
  for (const [k, role] of PALETTE_ROLES) add(theme.palette[k], role);
  for (const [k, role] of ART_ROLES) add(theme.art?.colours?.[k], role);
  return out;
}

/** "leaf-sprig" -> "leaf sprig" (used when a motif has no display name). */
export function humanize(id: string): string {
  return id.replace(/[-_]+/g, ' ').trim().toLowerCase();
}

/** The theme's motif names in plain words ("strawberries"-style display names from artwork.ts). */
export function themeMotifs(theme: IconPromptInput['theme']): string[] {
  const ids = theme.art?.motifs ?? [];
  const names = ids.map((id) => (getMotif(id)?.name ?? humanize(id)).toLowerCase());
  return [...new Set(names)];
}

function listWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function styleWords(theme: IconPromptInput['theme']): string[] {
  const out: string[] = [];
  const art = theme.art;
  if (art?.frame && art.frame !== 'none') out.push(`a ${humanize(art.frame)} border`);
  if (art?.texture && art.texture !== 'none') out.push(`a soft ${humanize(art.texture)} texture`);
  if (art?.stickers && art.stickers.length > 0) out.push('a small decorative sticker near one corner');
  return out;
}

/** Clean an app name for the prompt (trimmed, single line, bounded). */
function cleanName(name: string): string {
  const n = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return n || 'the app';
}

/**
 * Text to copy into ChatGPT or any image tool. It asks the user to attach a screenshot of the
 * original icon and a Glaze theme sample, and states the real Glaze image specs.
 */
export function buildIconPrompt({ appName, theme }: IconPromptInput): string {
  const app = cleanName(appName);
  const themeName = (theme.name ?? '').trim() || 'my';
  const colours = themeColours(theme);
  const motifs = themeMotifs(theme);
  const style = styleWords(theme);
  const lines: string[] = [];

  lines.push(`Please design a new iPhone app icon for "${app}" that matches my "${themeName}" theme.`);
  lines.push('');
  lines.push('I have attached two images:');
  lines.push(`1. A screenshot of the original ${app} icon, so you know which app it is for.`);
  lines.push(`2. A sample of the "${themeName}" theme, so you can match its look.`);
  lines.push('');
  lines.push('What to make:');
  lines.push(`- A new icon that clearly represents ${app}, redrawn in the theme's style. Do not copy the original logo exactly.`);
  if (colours.length > 0) {
    lines.push(`- Use the theme's colours: ${colours.map((c) => `${c.hex} (${c.role})`).join(', ')}.`);
  }
  if (motifs.length > 0) {
    lines.push(`- Use the theme's illustrations where they fit: ${listWords(motifs)}.`);
  }
  const mood = (theme.tagline ?? '').trim().replace(/[.!]+$/, '');
  lines.push(
    `- Match the theme's artistic style${mood ? ` ("${mood.replace(/"/g, "'")}")` : ''}${style.length ? `, for example ${listWords(style)}` : ''}.`,
  );
  lines.push('- Compose it as an app icon: one clear, centred subject on a filled background. Not a wallpaper or a full scene.');
  lines.push(`- No text or letters, unless the app's name is part of how ${app} looks.`);
  lines.push('');
  lines.push('Image requirements:');
  lines.push('- Square canvas (1:1).');
  lines.push(
    `- ${UPLOAD_FORMATS.join(' or ')}, at least ${MIN_UPLOAD_SIZE} × ${MIN_UPLOAD_SIZE} px. ${IDEAL_UPLOAD_SIZE} × ${IDEAL_UPLOAD_SIZE} px is ideal; larger is fine.`,
  );
  lines.push(
    `- Keep everything important inside the central ${SAFE_AREA_PERCENT}% of the square. The edges can be cut off: the icon is masked to a shape and iPhone rounds the corners again.`,
  );
  lines.push('- Fill the whole square edge to edge: no transparent areas, white border or drop shadow around the icon.');
  lines.push(
    `(For reference: Glaze turns the image into ${PROFILE_ICON_SIZE} × ${PROFILE_ICON_SIZE} px and ${PHOTO_ICON_SIZE} × ${PHOTO_ICON_SIZE} px Home Screen icons.)`,
  );
  return lines.join('\n');
}
