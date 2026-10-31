// The demo trip (Sydney -> Tokyo -> Kyoto -> Sydney), built relative to a start date so "Next up" always has
// something to show. Every name, number and reference is invented (no real carrier or hotel brands).
import type { Item, LocalDate, Place, Trip } from './model.ts';
import { addDays } from './tz.ts';

// Stations and airports with an approximate map position, so the map pins every leg of the demo trip.
const SYD: Place = { id: 'syd', name: 'Sydney Airport T1', lat: -33.9366, lon: 151.1658 };
const HND: Place = { id: 'hnd', name: 'Haneda Airport T3', lat: 35.5447, lon: 139.7682 };
const TYO: Place = { id: 'tyo', name: 'Tokyo Station', lat: 35.6812, lon: 139.7671 };
const KYO: Place = { id: 'kyo', name: 'Kyoto Station', lat: 34.9858, lon: 135.7588 };
const KIX: Place = { id: 'kix', name: 'Kansai Airport T1', lat: 34.4347, lon: 135.2441 };

export function demoTrip(start: LocalDate, now = new Date().toISOString()): Trip {
  const d = (n: number) => addDays(start, n);
  const id = 'demo';
  const it = (x: Omit<Item, 'tripId' | 'attachments'> & Partial<Pick<Item, 'attachments'>>): Item => ({ attachments: [], tripId: id, ...x });
  const items: Item[] = [
    it({
      id: 'demo-f1',
      kind: 'flight',
      title: 'Sydney → Tokyo Haneda',
      carrier: 'Demo Air',
      number: 'DA 21',
      seat: '34K',
      ref: 'DMO4KX',
      start: { local: `${d(0)}T09:30`, tz: 'Australia/Sydney' },
      end: { local: `${d(0)}T17:45`, tz: 'Asia/Tokyo' },
      from: SYD,
      to: HND,
    }),
    it({
      id: 'demo-h1',
      kind: 'hotel',
      title: 'Hotel Asakusa Lantern (demo)',
      ref: 'H-58213',
      start: { local: `${d(0)}T19:30`, tz: 'Asia/Tokyo' }, // T76: after DA 21 lands (17:45), so the route reads flight -> hotel
      end: { local: `${d(4)}T11:00`, tz: 'Asia/Tokyo' },
      place: { id: 'h1', name: 'Hotel Asakusa Lantern (demo)', address: '2-1 Asakusa, Taito City, Tokyo', localAddress: '東京都台東区浅草2-1', lat: 35.7148, lon: 139.7967 },
    }),
    it({
      id: 'demo-a1',
      kind: 'activity',
      title: 'Morning at the fish market',
      start: { local: `${d(1)}T07:30`, tz: 'Asia/Tokyo' },
      end: { local: `${d(1)}T10:00`, tz: 'Asia/Tokyo' },
      place: { id: 'a1', name: 'Tsukiji Outer Market', lat: 35.6655, lon: 139.7707 },
    }),
    it({
      id: 'demo-t1',
      kind: 'train',
      title: 'Tokyo → Kyoto',
      number: 'Shinkansen 215',
      seat: 'Car 7, 12E',
      ref: 'JR-90314',
      start: { local: `${d(4)}T12:03`, tz: 'Asia/Tokyo' },
      end: { local: `${d(4)}T14:18`, tz: 'Asia/Tokyo' },
      from: TYO,
      to: KYO,
    }),
    it({
      id: 'demo-h2',
      kind: 'hotel',
      title: 'Gion Garden Inn (demo)',
      ref: 'GG-7781',
      start: { local: `${d(4)}T15:00`, tz: 'Asia/Tokyo' },
      end: { local: `${d(7)}T10:00`, tz: 'Asia/Tokyo' },
      place: { id: 'h2', name: 'Gion Garden Inn (demo)', address: '570 Gionmachi, Higashiyama Ward, Kyoto', localAddress: '京都府京都市東山区祇園町570', lat: 35.0037, lon: 135.7788 },
    }),
    it({
      id: 'demo-n1',
      kind: 'note',
      title: 'Temple day: carry cash, shoes off inside',
      start: { local: `${d(5)}T08:00`, tz: 'Asia/Tokyo' },
    }),
    it({
      id: 'demo-f2',
      kind: 'flight',
      title: 'Osaka Kansai → Sydney',
      carrier: 'Demo Air',
      number: 'DA 6',
      seat: '41A',
      ref: 'DMO4KX',
      start: { local: `${d(7)}T21:30`, tz: 'Asia/Tokyo' },
      end: { local: `${d(8)}T08:50`, tz: 'Australia/Sydney' },
      from: KIX,
      to: SYD,
    }),
  ];
  return { id, name: 'Tokyo & Kyoto (demo)', startDate: d(0), endDate: d(8), homeTz: 'Australia/Sydney', items, demo: true, createdAt: now };
}
