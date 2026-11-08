// T157: the Toilets tab's map pins. Wheelchair-accessible toilets (OSM wheelchair=yes or designated) get their own
// glyph and colour (sea, the blue of access signs), so they stand out from ordinary toilets (ok green, as on the Map
// tab) on the map view; the list view's wheelchair chip uses the same sea colour. The glyph always says which kind it
// is; the colour also carries the saved / closed state the pins already had (saved: warn, closed now: muted), so an
// accessible toilet keeps its glyph even when saved or closed.
// Theme tokens only (light + dark from src/theme/tokens.ts); contrast is checked in toiletpins.test.ts. Pure TypeScript.
import { wheelchairLevel } from './stepfree.ts';

/** Theme tokens a toilet pin may use (each carries a card-coloured glyph at 3:1 and reads on the map at 3:1). */
export type ToiletPinTone = 'sea' | 'ok' | 'warn' | 'muted';
export type ToiletPinKind = 'accessible' | 'toilet';
export type ToiletPinStyle = { kind: ToiletPinKind; /** Ionicons glyph name. */ icon: string; tone: ToiletPinTone };

/** The look of each kind when it is neither saved nor closed (also the legend under the map). */
export const TOILET_PIN_STYLES: Readonly<Record<ToiletPinKind, { icon: string; tone: ToiletPinTone }>> = {
  accessible: { icon: 'accessibility', tone: 'sea' },
  toilet: { icon: 'male-female', tone: 'ok' }, // as the Map tab's toilet places (poipins.ts)
};

/** Only a clear yes counts: limited, no or untagged toilets keep the ordinary pin (the card still shows the tag). */
export const isWheelchairToilet = (t: { wheelchair?: string }): boolean => wheelchairLevel(t.wheelchair) === 'yes';

export function toiletPinStyle(t: { wheelchair?: string }, state: { saved?: boolean; closed?: boolean } = {}): ToiletPinStyle {
  const kind: ToiletPinKind = isWheelchairToilet(t) ? 'accessible' : 'toilet';
  const base = TOILET_PIN_STYLES[kind];
  const tone: ToiletPinTone = state.saved ? 'warn' : state.closed ? 'muted' : base.tone;
  return { kind, icon: base.icon, tone };
}

/** Which kinds are on the map now, in legend order (accessible first), so the legend only lists what is drawn. */
export function toiletLegend(toilets: readonly { wheelchair?: string }[]): ToiletPinKind[] {
  const kinds = new Set(toilets.map((t) => (isWheelchairToilet(t) ? 'accessible' : 'toilet')));
  return (['accessible', 'toilet'] as const).filter((k) => kinds.has(k));
}
