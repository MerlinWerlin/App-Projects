// Store-capture helper (simulator only): writes a .satchel trip file the way Satchel's own Send trip file does
// (buildTripFile + JSON.stringify, src/state/tripTransfer.ts), for the "a friend sent me their trip" check:
// the workflow drops it in the app's Documents/Inbox (where iOS puts AirDrop / Open in files) and opens it through
// app/openin, the same route app/+native-intent.tsx uses for a tapped file.
// Usage: node store/capture/tripfile.ts <out.satchel> [YYYY-MM-DD start]
import { writeFileSync } from 'node:fs';
import { buildTripFile } from '../../src/core/tripfile.ts';
import type { Item, Trip } from '../../src/core/model.ts';

const out = process.argv[2];
if (!out) throw new Error('usage: tripfile.ts <out.satchel> [start]');
const start = process.argv[3] ?? new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.parse(`${start}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const id = 'lisbon-friend';
const it = (x: Omit<Item, 'tripId' | 'attachments'>): Item => ({ ...x, tripId: id, attachments: [] });
const trip: Trip = {
  id,
  name: 'Lisbon long weekend',
  startDate: day(0),
  endDate: day(3),
  homeTz: 'Europe/London',
  createdAt: new Date().toISOString(),
  items: [
    it({ id: 'l1', kind: 'flight', title: 'London Gatwick → Lisbon', carrier: 'Southern Skies', number: 'SK 402', ref: 'R8M2QL', start: { local: `${day(0)}T07:10`, tz: 'Europe/London' }, end: { local: `${day(0)}T09:55`, tz: 'Europe/Lisbon' } }),
    it({ id: 'l2', kind: 'hotel', title: 'Alfama Tile House', ref: 'AT-3301', start: { local: `${day(0)}T14:00`, tz: 'Europe/Lisbon' }, end: { local: `${day(3)}T11:00`, tz: 'Europe/Lisbon' }, place: { id: 'p1', name: 'Alfama Tile House', address: 'Rua de São Miguel 12, Lisbon', lat: 38.7112, lon: -9.1295 } }),
    it({ id: 'l3', kind: 'activity', title: 'Tram 28 and the castle', start: { local: `${day(1)}T10:00`, tz: 'Europe/Lisbon' }, end: { local: `${day(1)}T13:00`, tz: 'Europe/Lisbon' }, place: { id: 'p2', name: 'Castelo de São Jorge', lat: 38.7139, lon: -9.1335 } }),
    it({ id: 'l4', kind: 'activity', title: 'Day trip to Sintra', start: { local: `${day(2)}T09:00`, tz: 'Europe/Lisbon' }, end: { local: `${day(2)}T17:00`, tz: 'Europe/Lisbon' } }),
    it({ id: 'l5', kind: 'flight', title: 'Lisbon → London Gatwick', carrier: 'Southern Skies', number: 'SK 407', ref: 'R8M2QL', start: { local: `${day(3)}T18:20`, tz: 'Europe/Lisbon' }, end: { local: `${day(3)}T21:00`, tz: 'Europe/London' } }),
  ],
};
const built = buildTripFile(trip, {});
writeFileSync(out, JSON.stringify(built.file));
console.log(`wrote ${out}: ${trip.name}, ${trip.items.length} plans`);
