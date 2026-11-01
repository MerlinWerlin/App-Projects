// T155: per-category look for the Map's place pins (bundled sample points and downloaded city packs). Each offered
// category gets an Ionicons glyph and a theme colour token (light + dark come from src/theme/tokens.ts; no raw
// colours here). The glyph tells categories apart; the colour groups them by family (health red, water and
// transport sea, money amber, food warm), so two categories may share a colour but never a glyph. Pure TypeScript.
import { OFFERED_POI_CATEGORIES, type OfferedCategory } from './packpois.ts';

/** Theme tokens a place pin may use (each one carries a card-coloured glyph at 3:1, checked in poipins.test.ts). */
export type PoiPinTone = 'ok' | 'sea' | 'teal' | 'accentStrong' | 'accentInk' | 'danger' | 'warn' | 'ink';

/**
 * T164: original SVG glyphs a pin may draw instead of its Ionicons glyph (src/ui/stepfreeIcons.tsx; 'lift' is
 * LiftGlyph). The Ionicons `icon` stays as the fallback and keeps the glyph-uniqueness test meaningful.
 */
export type PinSvgGlyph = 'lift';
export const PIN_SVG_GLYPHS: readonly PinSvgGlyph[] = ['lift'];

export type PoiPinStyle = { /** Ionicons glyph name (fallback when `svg` is set). */ icon: string; tone: PoiPinTone; /** T164: draw this original SVG glyph instead. */ svg?: PinSvgGlyph };

export const POI_PIN_STYLES: Readonly<Record<OfferedCategory, PoiPinStyle>> = {
  toilets: { icon: 'male-female', tone: 'ok' },
  drinking_water: { icon: 'water', tone: 'sea' },
  food: { icon: 'restaurant', tone: 'accentStrong' },
  supermarket: { icon: 'cart', tone: 'accentInk' },
  pharmacy: { icon: 'medkit', tone: 'danger' },
  hospital_clinic: { icon: 'medical', tone: 'danger' },
  police: { icon: 'shield', tone: 'ink' },
  embassy: { icon: 'flag', tone: 'ink' },
  atm_bank: { icon: 'cash', tone: 'warn' },
  transport: { icon: 'train', tone: 'sea' },
  fuel: { icon: 'car', tone: 'teal' },
  lift: { icon: 'swap-vertical', tone: 'teal', svg: 'lift' }, // T156: lifts (highway=elevator); T164: drawn with LiftGlyph
};

/** The plain look for a category the map does not know (an old or hand-edited file): the T13 sea pin. */
export const POI_PIN_FALLBACK: PoiPinStyle = { icon: 'location', tone: 'sea' };

export function poiPinStyle(category: string): PoiPinStyle {
  return (OFFERED_POI_CATEGORIES as readonly string[]).includes(category) ? POI_PIN_STYLES[category as OfferedCategory] : POI_PIN_FALLBACK;
}
