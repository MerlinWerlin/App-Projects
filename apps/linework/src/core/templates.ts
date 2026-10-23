// Bundled template catalogue. Templates are original line art authored in this repo as SVG path data
// (src/core/templateArt/*), so Metro needs no SVG transformer; scripts/export-templates.ts writes the same
// art to assets/templates/<id>.svg.
import { animals } from './templateArt/animals.ts';
import { flowers } from './templateArt/flowers.ts';
import { faces } from './templateArt/faces.ts';
import { lettering } from './templateArt/lettering.ts';
import { shapes } from './templateArt/shapes.ts';
import { mandalas } from './templateArt/mandalas.ts';
import { botanical } from './templateArt/botanical.ts';
import { flowers2 } from './templateArt/baked/flowers2.ts';
import { wildlife } from './templateArt/wildlife.ts';
import { ornament } from './templateArt/ornament.ts';
import { scenes } from './templateArt/scenes.ts';
import { cute } from './templateArt/baked/cute.ts';
import { heroes } from './templateArt/baked/heroes.ts';
import { game } from './templateArt/baked/game.ts';
import { movies } from './templateArt/baked/movies.ts';
import { fairytales } from './templateArt/baked/fairytales.ts';
import { kids } from './templateArt/baked/kids.ts';
import { kawaiiFood } from './templateArt/baked/kawaiiFood.ts';
import { kawaiiFriends } from './templateArt/baked/kawaiiFriends.ts';
import { sealife } from './templateArt/baked/sealife.ts';
import { animals2 } from './templateArt/baked/animals2.ts';
import { figures } from './templateArt/baked/figures.ts';
import { stilllife2 } from './templateArt/baked/stilllife2.ts';
import { stilllife3 } from './templateArt/baked/stilllife3.ts';
import { places2 } from './templateArt/baked/places2.ts';
import { fantasy2 } from './templateArt/baked/fantasy2.ts';
import { shapes2 } from './templateArt/baked/shapes2.ts';
import { flash } from './templateArt/baked/flash.ts';
import { game2 } from './templateArt/baked/game2.ts';
import { heroes2 } from './templateArt/baked/heroes2.ts';
import { wildlife3 } from './templateArt/baked/wildlife3.ts';
import { kidsfantasy } from './templateArt/baked/kidsfantasy.ts';
import { mandalas2 } from './templateArt/baked/mandalas2.ts';
import { patterns2 } from './templateArt/baked/patterns2.ts';
import { trade } from './templateArt/trade.ts';

export type TemplateCategory =
  | 'flowers'
  | 'animals'
  | 'wildlife'
  | 'sealife'
  | 'faces'
  | 'lettering'
  | 'patterns'
  | 'mandalas'
  | 'places'
  | 'fantasy'
  | 'stilllife'
  | 'cute'
  | 'heroes'
  | 'game'
  | 'movies'
  | 'fairytales'
  | 'kids'
  | 'shapes'
  | 'trade';

/** Complexity level shown as a filter: beginner = few bold shapes, advanced = intricate detail. */
export type TemplateLevel = 'beginner' | 'intermediate' | 'advanced';

export type Template = {
  id: string;
  name: string;
  category: TemplateCategory;
  /** Complexity (default 'beginner', see templateLevel()). */
  level?: TemplateLevel;
  /**
   * Search / collection tags, lower-case: styles ('botanical', 'vintage', 'gothic', 'whimsical',
   * 'ornamental', 'geometric', 'realistic', 'stylized', 'cute') and occasions ('birthday',
   * 'christmas', 'wedding', 'love', 'thanks', 'baby', 'halloween', 'easter', 'gift').
   */
  tags?: string[];
  /** SVG viewBox, always '0 0 400 400'. */
  viewBox: string;
  /** Main outline path `d` strings, drawn stroked with no fill at strokeWidth. */
  paths: string[];
  /** Optional fine detail lines (veins, hatching, fur, ornament), drawn thinner at detailWidth. */
  detail?: string[];
  /** Stroke width in viewBox units (default DEFAULT_STROKE_WIDTH). */
  strokeWidth?: number;
  /** Stroke width for `detail` paths (default DEFAULT_DETAIL_WIDTH). */
  detailWidth?: number;
};

export const CATEGORIES: readonly { id: TemplateCategory; label: string }[] = [
  { id: 'flowers', label: 'Flowers & botanicals' },
  { id: 'animals', label: 'Animals & pets' },
  { id: 'wildlife', label: 'Birds & insects' },
  { id: 'sealife', label: 'Sea life' },
  { id: 'faces', label: 'Faces & figures' },
  { id: 'lettering', label: 'Lettering' },
  { id: 'patterns', label: 'Frames & patterns' },
  { id: 'mandalas', label: 'Mandalas & geometric' },
  { id: 'places', label: 'Buildings & landscapes' },
  { id: 'fantasy', label: 'Fantasy & gothic' },
  { id: 'stilllife', label: 'Still life & objects' },
  { id: 'cute', label: 'Cute & chibi' },
  { id: 'heroes', label: 'Heroes' },
  { id: 'game', label: 'Game world' },
  { id: 'movies', label: 'Movie night' },
  { id: 'fairytales', label: 'Fairy tales' },
  { id: 'kids', label: 'Kids' },
  { id: 'shapes', label: 'Simple shapes' },
  { id: 'trade', label: 'Trade & workshop' },
];

export const LEVELS: readonly { id: TemplateLevel; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

export const DEFAULT_STROKE_WIDTH = 4;
export const DEFAULT_DETAIL_WIDTH = 2;

export const TEMPLATES: readonly Template[] = [
  ...flowers,
  ...botanical,
  ...flowers2,
  ...animals,
  ...wildlife,
  ...faces,
  ...lettering,
  ...shapes,
  ...mandalas,
  ...mandalas2,
  ...ornament,
  ...scenes,
  ...cute,
  ...heroes,
  ...game,
  ...movies,
  ...fairytales,
  ...kids,
  ...kawaiiFood,
  ...kawaiiFriends,
  ...sealife,
  ...animals2,
  ...figures,
  ...stilllife2,
  ...stilllife3,
  ...places2,
  ...fantasy2,
  ...shapes2,
  ...flash,
  ...game2,
  ...heroes2,
  ...wildlife3,
  ...patterns2,
  ...trade,
  ...kidsfantasy,
];

export function templateLevel(t: Template): TemplateLevel {
  return t.level ?? 'beginner';
}

export function isTemplateCategory(value: unknown): value is TemplateCategory {
  return typeof value === 'string' && CATEGORIES.some((c) => c.id === value);
}

/** Parse a route param such as 'Animals' or 'animals' into a category; anything else → null (All). */
export function parseCategory(value: unknown): TemplateCategory | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== 'string') return null;
  const lower = v.trim().toLowerCase();
  return isTemplateCategory(lower) ? lower : null;
}

export function categoryLabel(category: TemplateCategory): string {
  return CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

/** Templates in a category, or all templates when category is null/undefined. */
export function templatesIn(category?: TemplateCategory | null): Template[] {
  return category ? TEMPLATES.filter((t) => t.category === category) : [...TEMPLATES];
}

export function getTemplate(id: string | null | undefined): Template | undefined {
  if (!id) return undefined;
  return TEMPLATES.find((t) => t.id === id);
}

export type SvgStringOptions = {
  /** Stroke colour (default graphite #22201C). */
  stroke?: string;
  /** Stroke width in viewBox units (default template.strokeWidth ?? DEFAULT_STROKE_WIDTH). */
  strokeWidth?: number;
  /** Optional background colour filled behind the art. */
  background?: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Standalone SVG document for a template. With no options this is exactly assets/templates/<id>.svg. */
export function toSvgString(t: Template, opts: SvgStringOptions = {}): string {
  const stroke = escapeXml(opts.stroke ?? '#22201C');
  const width = opts.strokeWidth ?? t.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const [, , w, h] = t.viewBox.split(/\s+/);
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${escapeXml(t.viewBox)}" width="${escapeXml(w)}" height="${escapeXml(h)}">`,
    `  <title>${escapeXml(t.name)}</title>`,
  ];
  if (opts.background) lines.push(`  <rect width="100%" height="100%" fill="${escapeXml(opts.background)}"/>`);
  lines.push(
    `  <g fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">`,
  );
  for (const d of t.paths) lines.push(`    <path d="${escapeXml(d)}"/>`);
  lines.push('  </g>');
  if (t.detail && t.detail.length > 0) {
    const dw = (opts.strokeWidth ?? t.strokeWidth ?? DEFAULT_STROKE_WIDTH) *
      ((t.detailWidth ?? DEFAULT_DETAIL_WIDTH) / (t.strokeWidth ?? DEFAULT_STROKE_WIDTH));
    lines.push(
      `  <g fill="none" stroke="${stroke}" stroke-width="${Math.round(dw * 100) / 100}" stroke-linecap="round" stroke-linejoin="round">`,
    );
    for (const d of t.detail) lines.push(`    <path d="${escapeXml(d)}"/>`);
    lines.push('  </g>');
  }
  lines.push('</svg>', '');
  return lines.join('\n');
}
