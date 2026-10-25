import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import {
  DEMO_DOC_ID,
  DEMO_TICKET_ATTACHMENT,
  DEMO_TICKET_ITEM,
  isSampleCard,
  SAMPLE_CARD,
  sampleDoc,
  samplePassportAttachment,
  sampleTicketAttachment,
  withoutSampleCard,
  withoutSampleDoc,
  withSampleCard,
  withSampleDoc,
  withSampleTicket,
} from './demoExtras.ts';
import { cardStatus, isDialable } from './emergency.ts';
import type { TravelDoc } from './model.ts';
import { ALL_TRIPS, scopeParam } from './places.ts';
import { nativeScheme } from './settings.ts';
import { primaryTicket, walletEntries } from './tickets.ts';
import { cleanDocs } from './vault.ts';

const uri = 'file:///docs/attachments/demo-sample-ticket.png';
const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');

test('the sample ticket lands on the outbound demo flight only, once, and shows as its QR crop', () => {
  const a = withSampleTicket(trip, sampleTicketAttachment(uri));
  const f1 = a.items.find((i) => i.id === DEMO_TICKET_ITEM)!;
  assert.equal(f1.attachments.length, 1);
  assert.equal(primaryTicket(f1)?.id, DEMO_TICKET_ATTACHMENT);
  assert.equal(f1.attachments[0]!.qrCropUri, uri);
  assert.equal(f1.attachments[0]!.mime, 'image/png');
  assert.equal(a.items.filter((i) => i.attachments.length).length, 1);
  assert.deepEqual(walletEntries([a]).map((e) => e.key), [DEMO_TICKET_ITEM]);
  // idempotent: seeding twice keeps one copy (the newer file)
  const b = withSampleTicket(a, sampleTicketAttachment(`${uri}?2`));
  assert.equal(b.items.find((i) => i.id === DEMO_TICKET_ITEM)!.attachments.length, 1);
  assert.equal(b.items.find((i) => i.id === DEMO_TICKET_ITEM)!.attachments[0]!.uri, `${uri}?2`);
  // never on a real trip
  const mine = { ...trip, id: 'mine', demo: false };
  assert.equal(withSampleTicket(mine, sampleTicketAttachment(uri)), mine);
});

test('the sample ticket and card name no real carrier or insurer and are labelled sample', () => {
  const text = JSON.stringify([sampleTicketAttachment(uri), SAMPLE_CARD, sampleDoc('2026-10-24')]);
  assert.match(SAMPLE_CARD.insurer!, /sample/i);
  assert.match(SAMPLE_CARD.policy!, /SAMPLE/);
  assert.match(sampleDoc('2026-10-24').label, /sample/i);
  assert.doesNotMatch(text, /qantas|jal|ana\b|allianz|axa|virgin|delta|emirates/i);
});

test('the sample passport is added once, survives cleaning, expires years out, and goes again', () => {
  const doc = sampleDoc('2026-10-24', samplePassportAttachment('file:///docs/vault/demo-sample-passport.png'));
  assert.equal(doc.expires, '2030-12-24');
  assert.equal(doc.kind, 'passport');
  const mine: TravelDoc = { id: 'mine', kind: 'visa', label: 'My visa', attachments: [] };
  const once = withSampleDoc([mine], doc);
  assert.deepEqual(once.map((d) => d.id), ['mine', DEMO_DOC_ID]);
  assert.deepEqual(withSampleDoc(once, doc).map((d) => d.id), ['mine', DEMO_DOC_ID]);
  assert.deepEqual(cleanDocs(JSON.parse(JSON.stringify(once))), once);
  // the user's own edit of the sample is never replaced on a re-seed
  const edited = once.map((d) => (d.id === DEMO_DOC_ID ? { ...d, label: 'Renamed' } : d));
  assert.equal(withSampleDoc(edited, doc).find((d) => d.id === DEMO_DOC_ID)!.label, 'Renamed');
  assert.deepEqual(withoutSampleDoc(once).map((d) => d.id), ['mine']);
});

test('sample emergency details fill only an empty card, are complete and dialable, and clear only untouched', () => {
  const seeded = withSampleCard({ contacts: [] });
  assert.ok(isSampleCard(seeded));
  assert.ok(cardStatus(seeded).complete);
  assert.ok(isDialable(seeded.insurerPhone));
  assert.ok(seeded.contacts.every((c) => isDialable(c.phone)));
  assert.ok(isSampleCard(withSampleCard(undefined)));
  // seeding is idempotent and never touches the user's own details
  assert.deepEqual(withSampleCard(seeded), seeded);
  const mine = { insurer: 'My cover', contacts: [] };
  assert.equal(withSampleCard(mine), mine);
  // removing the demo clears the untouched sample, keeps an edited card
  assert.deepEqual(withoutSampleCard(seeded), { contacts: [] });
  const edited = { ...seeded, policy: 'MY-123' };
  assert.equal(withoutSampleCard(edited), edited);
  assert.ok(!isSampleCard(null));
  // seeding never shares the constant's contact objects
  seeded.contacts[0]!.name = 'changed';
  assert.equal(SAMPLE_CARD.contacts[0]!.name, 'Sample contact (demo)');
});

test('map scope param: a trip id scopes; missing, empty and "all" mean every trip', () => {
  assert.equal(scopeParam('demo'), 'demo');
  assert.equal(scopeParam(['demo', 'x']), 'demo');
  assert.equal(scopeParam(ALL_TRIPS), null);
  assert.equal(scopeParam(''), null);
  assert.equal(scopeParam(undefined), null);
  assert.equal(scopeParam(null), null);
});

test('system appearance follows the setting; System hands it back to the phone', () => {
  assert.equal(nativeScheme('light'), 'light');
  assert.equal(nativeScheme('dark'), 'dark');
  assert.equal(nativeScheme('system'), 'unspecified');
  assert.equal(nativeScheme(undefined), 'unspecified');
  assert.equal(nativeScheme('purple'), 'unspecified');
});
