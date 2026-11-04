// Owner 4 Nov 2026: purpose-designed, legible widgets for EVERY theme. Original decorative
// pictures are never used as functional backgrounds. Colours follow the theme's icon treatment.
// This small, versioned semantic document is shared by the app preview and native WidgetKit view.
import { ensureContrast, isHex, minContrast, mix, normalizeHex, relativeLuminance } from './colour.ts';
import { iconStyleForLook, type LookTheme } from './iconLook.ts';
import type { LiveArtSpec } from './liveArt.ts';
import { LEGACY_FALLBACK_CLOCK_ID, type HomeOptionSize, type WidgetOption } from './widgetOptions.ts';

export const DESIGNED_WIDGET_VERSION = 1;
export const DESIGNED_WIDGET_CAPABILITY = 5;
export const DESIGNED_KINDS = ['clock', 'battery', 'calendar'] as const;
export type DesignedKind = typeof DESIGNED_KINDS[number];
export const DESIGN_MOTIFS = ['stars', 'orbit', 'leaf', 'wave', 'grid', 'diamond', 'flower', 'stitch', 'none'] as const;
export type DesignMotif = typeof DESIGN_MOTIFS[number];
export type DesignedWidget = {
  v: 1;
  kind: DesignedKind;
  background: [string, string];
  ink: string;
  secondary: string;
  accent: string;
  onAccent: string;
  line: string;
  motif: DesignMotif;
  font: 'rounded' | 'serif' | 'mono';
  clock: 'dial' | 'digital' | 'split';
  battery: 'ring' | 'cells' | 'meter';
};

// Art direction belongs to the theme, rather than arbitrary random styles. A future theme still
// gets complete functional widgets through its palette and subject tags, with no pack download.
export function widgetDirection(theme: Pick<LookTheme, 'id' | 'tags'>): Pick<DesignedWidget, 'motif' | 'font' | 'clock' | 'battery'> {
  const subject = `${theme.id} ${(theme.tags ?? []).join(' ')}`.toLowerCase();
  if (/nebula|observatory|planet|meridian|starlight|cosmic|astral|galaxy|space/.test(subject))
    return { motif: 'orbit', font: 'rounded', clock: 'dial', battery: 'ring' };
  if (/neon|arcade|signal|velocity|blueprint|chromatic|workshop|circuit|robot|pixel|futur|cyber/.test(subject))
    return { motif: 'grid', font: 'mono', clock: 'digital', battery: 'cells' };
  if (/fm\b|disco|matinee|cassette|radio|monsoon|rainlight|after.hours/.test(subject))
    return { motif: 'grid', font: 'mono', clock: 'split', battery: 'meter' };
  if (/tide|abyss|current|sea|lagoon|cove|ocean|harbour|water|coast|pool/.test(subject))
    return { motif: 'wave', font: 'rounded', clock: 'dial', battery: 'meter' };
  if (/fern|grove|conservatory|orchard|garden|olive|outpost|moss|botanic|wood|forest|leaf/.test(subject))
    return { motif: 'leaf', font: 'serif', clock: 'dial', battery: 'ring' };
  if (/lavender|porcelain|rosewater|reverie|ballet|floral|blossom|sakura|petal|tea|cherry/.test(subject))
    return { motif: 'flower', font: 'serif', clock: 'dial', battery: 'ring' };
  if (/archive|bureau|espresso|gambit|caravan|courtyard|desert|saffron|amber|vintage|library|brass/.test(subject))
    return { motif: 'diamond', font: 'serif', clock: 'dial', battery: 'cells' };
  if (/knit|stitch|wool|plush|quilt|honey|cottage|bunny|cat|cute|kawaii/.test(subject))
    return { motif: 'stitch', font: 'rounded', clock: 'dial', battery: 'cells' };
  if (/cloud|moon|night|frost|snow|star|winter|sky|airmail/.test(subject))
    return { motif: 'stars', font: 'rounded', clock: 'dial', battery: 'ring' };
  return { motif: 'none', font: 'rounded', clock: 'digital', battery: 'ring' };
}

function readable(want: string, backgrounds: readonly string[], target = 4.5): string {
  const safe = isHex(want) ? want : '#FFFFFF';
  return ensureContrast(safe, backgrounds, target) ?? (minContrast('#FFFFFF', backgrounds) > minContrast('#000000', backgrounds) ? '#FFFFFF' : '#000000');
}

export function designedWidget(theme: LookTheme, kind: DesignedKind): DesignedWidget {
  const icon = iconStyleForLook(theme, 'themed');
  const bg = icon.background;
  const raw = bg.kind === 'gradient' ? [bg.from, bg.to] : bg.kind === 'solid' ? [bg.colour, bg.colour] : [bg.tint, bg.tint];
  // Match the icons' quiet gradient; avoid mid-tone gradients that cannot support readable text.
  let background = raw.map(normalizeHex) as [string, string];
  if (Math.max(minContrast('#FFFFFF', background), minContrast('#000000', background)) < 4.5) {
    const toward = relativeLuminance(theme.palette.bg) < 0.3 ? '#000000' : '#FFFFFF';
    background = background.map(c => mix(c, toward, 0.22)) as [string, string];
  }
  const ink = readable(icon.glyphColour, background);
  const secondary = readable(mix(ink, background[0], 0.22), background);
  const accent = readable(theme.palette.accent, background, 3);
  return {
    v: 1, kind, background, ink, secondary, accent,
    onAccent: readable(ink, [accent]), line: mix(ink, background[0], 0.15),
    ...widgetDirection(theme),
  };
}

export function parseDesignedWidget(raw: unknown): DesignedWidget | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !DESIGNED_KINDS.includes(r.kind as DesignedKind)) return null;
  if (!Array.isArray(r.background) || r.background.length !== 2 || !r.background.every(c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))) return null;
  for (const key of ['ink', 'secondary', 'accent', 'onAccent', 'line']) {
    if (typeof r[key] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(r[key] as string)) return null;
  }
  if (!DESIGN_MOTIFS.includes(r.motif as DesignMotif) || !['rounded', 'serif', 'mono'].includes(String(r.font)) || !['dial', 'digital', 'split'].includes(String(r.clock)) || !['ring', 'cells', 'meter'].includes(String(r.battery))) return null;
  return {
    v: 1, kind: r.kind as DesignedKind, background: (r.background as string[]).map(normalizeHex) as [string, string],
    ink: normalizeHex(r.ink as string), secondary: normalizeHex(r.secondary as string), accent: normalizeHex(r.accent as string),
    onAccent: normalizeHex(r.onAccent as string), line: normalizeHex(r.line as string), motif: r.motif as DesignMotif,
    font: r.font as DesignedWidget['font'], clock: r.clock as DesignedWidget['clock'], battery: r.battery as DesignedWidget['battery'],
  };
}

export function designedLiveSpec(theme: LookTheme, kind: DesignedKind): LiveArtSpec {
  const design = designedWidget(theme, kind);
  return { kind: kind === 'calendar' ? 'date' : kind, rect: [0, 0, 1, 1], shape: 'plate', cover: false, plate: design.background[0], ink: design.ink, design };
}

/** Old generated editions are replaced, while all original standalone artwork is retained. */
export function isReplacedArtEdition(option: Pick<WidgetOption, 'id'>): boolean {
  return [LEGACY_FALLBACK_CLOCK_ID, 'themed-live-clock', 'themed-live-date', 'themed-live-battery'].includes(option.id);
}

/** Keep the old stable ids: installed widgets upgrade in place after theme sync. */
export function designedOptionId(kind: DesignedKind): string {
  return `themed-live-${kind === 'calendar' ? 'date' : kind}`;
}

export const DESIGNED_SIZE: Record<HomeOptionSize, { w: number; h: number }> = {
  small: { w: 170, h: 170 }, medium: { w: 364, h: 170 }, large: { w: 364, h: 382 },
};

/** Civil dates only. Locale week-start is supplied explicitly; six rows always fit every month. */
export function calendarMonth(date: Date, firstWeekday = 1): { year: number; month: number; today: number; offset: number; days: number; cells: (number | null)[] } {
  const year = date.getFullYear(), month = date.getMonth(), today = date.getDate();
  const first = new Date(year, month, 1), days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() - firstWeekday + 7) % 7;
  return { year, month, today, offset, days, cells: Array.from({ length: 42 }, (_, i) => i >= offset && i < offset + days ? i - offset + 1 : null) };
}
