// Letters styles (owner 24 Oct 2026: "letters is a requirement, with its own categories like Workshop, but not its own
// tab ... one template is one letter ... bubble font, calligraphy, pixel, heaps of cool fonts for hand-made stuff").
// Each one-character template (src/core/templateArt/letters/, id `char-<style>-<char>`) carries exactly one
// `style-<id>` tag; the older lettering sheets (words, phrases, drills) count as 'words'. The Templates screen shows
// these as style tiles when the Letters bubble is selected. Pure TS.
import type { Template } from './templates.ts';

export const LETTER_STYLES = [
  'bubble',
  'retro',
  'calligraphy',
  'script',
  'pixel',
  'graffiti',
  'blackletter',
  'serif',
  'stencil',
  'western',
  'deco',
  'handwritten',
  'neon',
  'typewriter',
  'block',
  'marker',
  'words',
] as const;
export type LetterStyle = (typeof LETTER_STYLES)[number];

/** Style of a lettering template: its `style-<id>` tag, else 'words' (the older words and phrases sheets). */
export function letterStyleOf(t: Pick<Template, 'tags' | 'category'>): LetterStyle | null {
  if (t.category !== 'lettering') return null;
  for (const tag of t.tags ?? []) {
    if (tag.startsWith('style-')) {
      const id = tag.slice(6) as LetterStyle;
      if ((LETTER_STYLES as readonly string[]).includes(id)) return id;
    }
  }
  return 'words';
}

/** Lettering templates in one style (null = all of them). */
export function inLetterStyle<T extends Pick<Template, 'tags' | 'category'>>(pool: readonly T[], style: LetterStyle | null): T[] {
  return style ? pool.filter((t) => letterStyleOf(t) === style) : [...pool];
}

/** Count per style, for the tiles (empty ones are hidden). */
export function letterStyleCounts(pool: readonly Pick<Template, 'tags' | 'category'>[]): Record<LetterStyle, number> {
  const out = Object.fromEntries(LETTER_STYLES.map((s) => [s, 0])) as Record<LetterStyle, number>;
  for (const t of pool) {
    const s = letterStyleOf(t);
    if (s) out[s]++;
  }
  return out;
}

/** The template a style tile shows as its sample: capital A (or the first in the style). */
export function letterStyleSample<T extends Pick<Template, 'id' | 'tags' | 'category'>>(pool: readonly T[], style: LetterStyle): T | undefined {
  if (style !== 'words') {
    const a = pool.find((t) => t.id === `char-${style}-a`);
    if (a) return a;
  }
  return pool.find((t) => letterStyleOf(t) === style);
}
