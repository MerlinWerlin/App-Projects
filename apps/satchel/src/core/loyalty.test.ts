// T87: loyalty card store normaliser, form rules, expiry note and the booking match.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  barcodeFits,
  cardExpiry,
  cardFromDraft,
  cardsForItem,
  cleanCards,
  displayNumber,
  draftFromCard,
  LOYALTY_KEY,
  matchText,
  newCardDraft,
  removeCard,
  sortCards,
  upsertCard,
  validateCard,
  type LoyaltyCard,
} from './loyalty.ts';
import type { Item } from './model.ts';

const card = (over: Partial<LoyaltyCard> = {}): LoyaltyCard => ({
  id: 'c1',
  kind: 'air',
  programme: 'Sky Points',
  number: '12345678',
  colour: 'navy',
  barcode: 'code128',
  createdAt: 1,
  ...over,
});

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1',
  tripId: 't1',
  kind: 'flight',
  title: 'Flight to Tokyo',
  start: { local: '2026-11-02T09:00', tz: 'Australia/Sydney' },
  attachments: [],
  ...over,
});

test('cleanCards: non-arrays and junk give no cards; programme and number are required', () => {
  assert.deepEqual(cleanCards(null), []);
  assert.deepEqual(cleanCards('x'), []);
  assert.deepEqual(cleanCards({ id: 'a' }), []);
  assert.deepEqual(cleanCards([null, 3, 'x', {}, { id: 'a', programme: 'P' }, { id: 'b', number: '1' }, { programme: 'P', number: '1' }]), []);
});

test('cleanCards: trims, caps lengths, fixes unknown kind / colour / barcode, drops a bad expiry and empty optionals', () => {
  const [c] = cleanCards([
    {
      id: ' a ',
      kind: 'spaceship',
      programme: '  My   club  ',
      number: ' 99 88 ',
      memberName: '   ',
      tier: ' Gold ',
      expires: '2026-02-30',
      colour: 'neon',
      barcode: 'pdf417',
      createdAt: 'yesterday',
      extra: 'dropped',
    },
  ]);
  assert.deepEqual(c, { id: 'a', kind: 'other', programme: 'My club', number: '99 88', tier: 'Gold', colour: 'slate', barcode: 'none', createdAt: 0 });
  const [long] = cleanCards([{ id: 'b', programme: 'p'.repeat(200), number: '1'.repeat(200) }]);
  assert.equal(long.programme.length, 60);
  assert.equal(long.number.length, 64);
});

test('cleanCards: keeps valid fields, first of duplicate ids wins, undrawable barcode falls back to number only', () => {
  const ok = card({ memberName: 'A Traveller', tier: 'Silver', expires: '2027-05-01', colour: 'teal' });
  const out = cleanCards([ok, { ...ok, programme: 'Other' }, card({ id: 'c2', number: 'Ünï', barcode: 'code128' })]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], ok);
  assert.equal(out[1].barcode, 'none'); // Code 128 can't hold non-ASCII
  // QR holds UTF-8, so the same number stays a QR.
  assert.equal(cleanCards([card({ number: 'Ünï', barcode: 'qr' })])[0].barcode, 'qr');
});

test('a stored card survives a JSON round trip through the normaliser unchanged', () => {
  const c = card({ memberName: 'J B', tier: 'Gold', expires: '2028-01-31', barcode: 'qr', colour: 'amber' });
  assert.deepEqual(cleanCards(JSON.parse(JSON.stringify([c]))), [c]);
});

test('form: required fields, expiry format and a barcode the number fits', () => {
  const d = newCardDraft('hotel');
  assert.equal(d.colour, 'plum');
  assert.equal(d.programme, ''); // never prefilled
  assert.deepEqual(validateCard(d), ['programme', 'number']);
  assert.deepEqual(validateCard({ ...d, programme: 'Stay club', number: '123', expires: '31/12/2027' }), ['expires']);
  assert.deepEqual(validateCard({ ...d, programme: 'Stay club', number: 'Ñ123', barcode: 'code128' }), ['barcode']);
  assert.deepEqual(validateCard({ ...d, programme: 'Stay club', number: 'Ñ123', barcode: 'qr' }), []);
  assert.deepEqual(validateCard({ ...d, programme: 'Stay club', number: 'x'.repeat(64), barcode: 'qr' }), []);
  assert.equal(barcodeFits('none', ''), true);
  assert.equal(barcodeFits('qr', ''), false);
});

test('form: draft round trip and save', () => {
  const c = card({ tier: 'Gold', expires: '2027-01-01' });
  const back = cardFromDraft(draftFromCard(c), c.id, c.createdAt);
  assert.deepEqual(back, c);
  const fresh = cardFromDraft({ ...newCardDraft('rail'), programme: ' Rail pass ', number: ' 42 ', expires: ' ' }, 'n1', 5);
  assert.deepEqual(fresh, { id: 'n1', kind: 'rail', programme: 'Rail pass', number: '42', colour: 'forest', barcode: 'code128', createdAt: 5 });
});

test('upsert, remove and sort', () => {
  const a = card({ id: 'a', kind: 'hotel', programme: 'beta' });
  const b = card({ id: 'b', kind: 'air', programme: 'Zeta' });
  const c = card({ id: 'c', kind: 'hotel', programme: 'Alpha' });
  let list = upsertCard([], a);
  list = upsertCard(list, b);
  list = upsertCard(list, c);
  list = upsertCard(list, { ...a, tier: 'Gold' });
  assert.equal(list.length, 3);
  assert.equal(list[0].tier, 'Gold');
  assert.deepEqual(sortCards(list).map((x) => x.id), ['b', 'c', 'a']);
  assert.deepEqual(removeCard(list, 'c').map((x) => x.id), ['a', 'b']);
});

test('expiry note follows the vault rules (valid on its day, soon within 90 days)', () => {
  assert.equal(cardExpiry({}, '2026-10-31').status, 'none');
  assert.deepEqual(cardExpiry({ expires: '2026-10-31' }, '2026-10-31'), { status: 'soon', days: 0 });
  assert.equal(cardExpiry({ expires: '2026-10-30' }, '2026-10-31').status, 'expired');
  assert.equal(cardExpiry({ expires: '2027-06-01' }, '2026-10-31').status, 'ok');
});

test('displayNumber groups long digit-only numbers in fours', () => {
  assert.equal(displayNumber('123456789012'), '1234 5678 9012');
  assert.equal(displayNumber('1234 5678 9'), '1234 5678 9');
  assert.equal(displayNumber('1234567'), '1234567');
  assert.equal(displayNumber('AB-1234567890'), 'AB-1234567890');
});

test('booking match: programme name as whole words in title, provider, notes or place; accents and case ignored', () => {
  const sky = card({ id: 'sky', programme: 'Sky Points' });
  const stay = card({ id: 'stay', kind: 'hotel', programme: 'Hôtel Club' });
  const tiny = card({ id: 'tiny', programme: 'AB' });
  const cards = [sky, stay, tiny];
  assert.deepEqual(cardsForItem(cards, item({ carrier: 'SKY POINTS partner airline' })).map((c) => c.id), ['sky']);
  assert.deepEqual(cardsForItem(cards, item({ notes: 'Earn with sky-points; ref AB12' })).map((c) => c.id), ['sky']);
  assert.deepEqual(cardsForItem(cards, item({ kind: 'hotel', place: { id: 'p1', name: 'Hotel club Shinjuku' } })).map((c) => c.id), ['stay']);
  // Not a whole-word match, too short, or nothing to look in.
  assert.deepEqual(cardsForItem(cards, item({ notes: 'skypoints' })), []);
  assert.deepEqual(cardsForItem(cards, item({ title: 'AB 123' })), []);
  assert.deepEqual(cardsForItem(cards, item({ title: '' })), []);
  assert.equal(matchText('  Café—Lounge! '), 'cafe lounge');
});

test('cards stay on the phone: own storage key, never in the .satchel trip file code', () => {
  assert.equal(LOYALTY_KEY, 'satchel.loyalty.v1');
  for (const f of ['./tripfile.ts', '../ui/TripExport.tsx', '../ui/TripImport.tsx']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /loyalty/i, f);
  }
});
