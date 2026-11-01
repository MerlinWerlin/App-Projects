// T163 Screenshot demo travels: two invented past trips, added only when the traveller taps "Add sample past trips"
// in Settings, so Your travels and the passport stamps have something to show for App Store screenshots.
//   marker     the trip id starts with SAMPLE_TRAVEL_PREFIX; the trips are also demo: true, so every demo rule
//              (Your travels' "Include demo trips" switch, the backup reminder) treats them as samples too.
//   dates      both trips end before today (built relative to it), so they count as past trips and earn stamps.
//   content    every name, number and reference is invented: no real people, carriers, hotels or brands.
//   never out  backups drop them from the stored trips list (src/core/backup.ts pickKeys) and the trip screen
//              offers no .satchel export for them (canExportTrip).
// Pure TypeScript; Node runs it directly.
import type { Item, LocalDate, Place, Trip } from './model.ts';
import { addDays } from './tz.ts';

export const SAMPLE_TRAVEL_PREFIX = 'sample-past-';

/** One of the screenshot sample trips (by id, so a stray demo flag elsewhere never makes a trip one). */
export const isSampleTravel = (t: { id?: unknown } | null | undefined): boolean => !!t && typeof t.id === 'string' && t.id.startsWith(SAMPLE_TRAVEL_PREFIX);

export const hasSampleTravels = (trips: readonly { id?: unknown }[]): boolean => trips.some(isSampleTravel);

/** Sample trips never leave the phone as a .satchel file. */
export const canExportTrip = (t: { id?: unknown }): boolean => !isSampleTravel(t);

/**
 * T165: "Plan this trip again" is not offered on a sample trip: a copy would carry invented bookings into a real
 * trip with no Sample mark (the copy drops the demo flag and gets a new id), so the button and screen stay away.
 */
export const canPlanAgain = (t: { id?: unknown }): boolean => !isSampleTravel(t);

/**
 * T165: whether adding the samples is the thing that turned Your travels' "Include demo trips" on. Only true when
 * the switch was off before (so removing the samples can put it back the way the traveller had it).
 */
export const samplesTurnOnDemo = (includeDemoBefore: boolean): boolean => !includeDemoBefore;

/**
 * T165: the "Include demo trips" value after the samples are removed: back off when the samples turned it on,
 * otherwise left as the traveller set it.
 */
export const includeDemoAfterRemove = (includeDemo: boolean, turnedOnBySamples: boolean): boolean => (turnedOnBySamples ? false : includeDemo);

const SYD: Place = { id: 'syd', name: 'Sydney Airport T1', lat: -33.9366, lon: 151.1658 };
const LIS: Place = { id: 'lis', name: 'Lisbon Airport T1', lat: 38.7742, lon: -9.1342 };
const LISS: Place = { id: 'lis-st', name: 'Lisbon Oriente Station', lat: 38.7679, lon: -9.0991 };
const OPOS: Place = { id: 'opo-st', name: 'Porto Campanhã Station', lat: 41.1488, lon: -8.5855 };
const OPO: Place = { id: 'opo', name: 'Porto Airport', lat: 41.2481, lon: -8.6814 };
const YVR: Place = { id: 'yvr', name: 'Vancouver Airport', lat: 49.1967, lon: -123.1815 };

/** The two sample past trips, ending 4 and 1 months before `today`. Ids are fixed, so adding twice replaces them. */
export function sampleTravels(today: LocalDate, now = new Date().toISOString()): Trip[] {
  return [portugal(addDays(today, -150), now), vancouver(addDays(today, -45), now)];
}

function build(id: string, name: string, start: LocalDate, days: number, now: string, make: (d: (n: number) => LocalDate, it: (x: Omit<Item, 'tripId' | 'attachments'>) => Item) => Item[]): Trip {
  const d = (n: number) => addDays(start, n);
  const it = (x: Omit<Item, 'tripId' | 'attachments'>): Item => ({ attachments: [], tripId: id, ...x, id: `${id}-${x.id}` });
  return { id, name, startDate: d(0), endDate: d(days), homeTz: 'Australia/Sydney', items: make(d, it), demo: true, createdAt: now };
}

function portugal(start: LocalDate, now: string): Trip {
  return build(`${SAMPLE_TRAVEL_PREFIX}1`, 'Lisbon & Porto (sample)', start, 9, now, (d, it) => [
    it({
      id: 'f1',
      kind: 'flight',
      title: 'Sydney → Lisbon',
      carrier: 'Demo Air',
      number: 'DA 88',
      seat: '42C',
      ref: 'SMP7QL',
      start: { local: `${d(0)}T21:15`, tz: 'Australia/Sydney' },
      end: { local: `${d(1)}T13:40`, tz: 'Europe/Lisbon' },
      from: SYD,
      to: LIS,
    }),
    it({
      id: 'h1',
      kind: 'hotel',
      title: 'Tile House Rooms (sample)',
      ref: 'TH-40217',
      start: { local: `${d(1)}T15:00`, tz: 'Europe/Lisbon' },
      end: { local: `${d(5)}T11:00`, tz: 'Europe/Lisbon' },
      place: { id: 'sp-h1', name: 'Tile House Rooms (sample)', address: 'Alfama, Lisbon', lat: 38.7118, lon: -9.1300 },
    }),
    it({
      id: 'a1',
      kind: 'activity',
      title: 'Tram ride and custard tarts',
      start: { local: `${d(2)}T10:00`, tz: 'Europe/Lisbon' },
      end: { local: `${d(2)}T13:00`, tz: 'Europe/Lisbon' },
    }),
    it({
      id: 't1',
      kind: 'train',
      title: 'Lisbon → Porto',
      number: 'Intercity 523',
      seat: 'Car 3, 41',
      ref: 'CP-77120',
      start: { local: `${d(5)}T12:09`, tz: 'Europe/Lisbon' },
      end: { local: `${d(5)}T15:01`, tz: 'Europe/Lisbon' },
      from: LISS,
      to: OPOS,
    }),
    it({
      id: 'h2',
      kind: 'hotel',
      title: 'River Steps Guesthouse (sample)',
      ref: 'RS-1189',
      start: { local: `${d(5)}T16:00`, tz: 'Europe/Lisbon' },
      end: { local: `${d(8)}T10:00`, tz: 'Europe/Lisbon' },
      place: { id: 'sp-h2', name: 'River Steps Guesthouse (sample)', address: 'Ribeira, Porto', lat: 41.1407, lon: -8.6131 },
    }),
    it({
      id: 'f2',
      kind: 'flight',
      title: 'Porto → Sydney',
      carrier: 'Demo Air',
      number: 'DA 89',
      seat: '38A',
      ref: 'SMP7QL',
      start: { local: `${d(8)}T13:20`, tz: 'Europe/Lisbon' },
      end: { local: `${d(9)}T22:05`, tz: 'Australia/Sydney' },
      from: OPO,
      to: SYD,
    }),
  ]);
}

function vancouver(start: LocalDate, now: string): Trip {
  return build(`${SAMPLE_TRAVEL_PREFIX}2`, 'Vancouver long weekend (sample)', start, 5, now, (d, it) => [
    it({
      id: 'f1',
      kind: 'flight',
      title: 'Sydney → Vancouver',
      carrier: 'Demo Air',
      number: 'DA 31',
      seat: '27D',
      ref: 'SMP2VX',
      start: { local: `${d(0)}T10:20`, tz: 'Australia/Sydney' },
      end: { local: `${d(0)}T07:05`, tz: 'America/Vancouver' },
      from: SYD,
      to: YVR,
    }),
    it({
      id: 'h1',
      kind: 'hotel',
      title: 'Harbour Lantern Inn (sample)',
      ref: 'HL-5530',
      start: { local: `${d(0)}T14:00`, tz: 'America/Vancouver' },
      end: { local: `${d(4)}T11:00`, tz: 'America/Vancouver' },
      place: { id: 'sp-h3', name: 'Harbour Lantern Inn (sample)', address: 'Gastown, Vancouver', lat: 49.2838, lon: -123.1066 },
    }),
    it({
      id: 'a1',
      kind: 'activity',
      title: 'Seawall bike loop',
      start: { local: `${d(1)}T09:30`, tz: 'America/Vancouver' },
      end: { local: `${d(1)}T12:30`, tz: 'America/Vancouver' },
    }),
    it({
      id: 'f2',
      kind: 'flight',
      title: 'Vancouver → Sydney',
      carrier: 'Demo Air',
      number: 'DA 32',
      seat: '30K',
      ref: 'SMP2VX',
      start: { local: `${d(4)}T23:40`, tz: 'America/Vancouver' },
      end: { local: `${d(6)}T09:15`, tz: 'Australia/Sydney' },
      from: YVR,
      to: SYD,
    }),
  ]);
}

/** The list without the sample trips (the same array when there are none). */
export function withoutSampleTravels<T extends { id?: unknown }>(trips: readonly T[]): readonly T[] {
  return hasSampleTravels(trips) ? trips.filter((t) => !isSampleTravel(t)) : trips;
}

/** The list with fresh sample trips added at the end (any older copies replaced). */
export function withSampleTravels(trips: readonly Trip[], today: LocalDate, now?: string): Trip[] {
  return [...withoutSampleTravels(trips), ...sampleTravels(today, now)];
}

/**
 * The stored trips text (satchel.trips.v1) with the sample trips taken out, for backups. Text that isn't a JSON
 * list, or holds no sample trip, comes back unchanged (byte for byte).
 */
export function stripSampleTravelsText(text: string): string {
  let list: unknown;
  try {
    list = JSON.parse(text);
  } catch {
    return text;
  }
  if (!Array.isArray(list)) return text;
  const isSample = (t: unknown) => !!t && typeof t === 'object' && isSampleTravel(t as { id?: unknown });
  if (!list.some(isSample)) return text;
  return JSON.stringify(list.filter((t) => !isSample(t)));
}
