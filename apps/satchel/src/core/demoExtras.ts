// Demo trip extras for the screenshot kit (T33, docs/SCREENSHOTS.md): a sample ticket on the outbound demo flight,
// a sample passport in the vault and sample emergency details. All invented and labelled sample: no real carrier,
// insurer, person or document number. Seeding is idempotent (fixed ids; the card is only filled when empty) and
// removing the demo trip takes the extras away again (the card only if it still holds exactly the sample details).
// T58: sample spending (an AUD budget, a JPY rate and a few yen expenses) so the Spending card isn't empty on first
// open. Only fresh demo seeds get it; a demo trip already on a phone is never changed.
import type { Attachment, Budget, EmergencyCard, Expense, LocalDate, TravelDoc, Trip } from './model.ts';
import { cardStatus } from './emergency.ts';
import { addDays } from './tz.ts';
import { addMonths } from './vault.ts';

export const DEMO_TRIP_ID = 'demo';
/** The booking that carries the sample ticket (the outbound demo flight). */
export const DEMO_TICKET_ITEM = 'demo-f1';
export const DEMO_TICKET_ATTACHMENT = 'demo-f1-ticket';
export const DEMO_DOC_ID = 'demo-doc-passport';
export const DEMO_DOC_ATTACHMENT = 'demo-doc-passport-page';

/** File names under the documents folder: attachments/<ticket>, vault/<passport>. */
export const DEMO_TICKET_FILE = 'demo-sample-ticket.png';
export const DEMO_PASSPORT_FILE = 'demo-sample-passport.png';

/** The sample ticket attachment for a file at `uri`: the image is its own QR crop, so the code shows big. */
export function sampleTicketAttachment(uri: string): Attachment {
  return { id: DEMO_TICKET_ATTACHMENT, uri, name: 'Sample boarding pass.png', mime: 'image/png', role: 'ticket', qrCropUri: uri };
}

export function samplePassportAttachment(uri: string): Attachment {
  return { id: DEMO_DOC_ATTACHMENT, uri, name: 'Sample passport page.png', mime: 'image/png', role: 'other' };
}

/** The demo trip with the sample ticket on its outbound flight (replacing an older copy). Other trips unchanged. */
export function withSampleTicket(trip: Trip, ticket: Attachment): Trip {
  if (trip.id !== DEMO_TRIP_ID || !trip.demo) return trip;
  return {
    ...trip,
    items: trip.items.map((i) =>
      i.id === DEMO_TICKET_ITEM ? { ...i, attachments: [...i.attachments.filter((a) => a.id !== ticket.id), ticket] } : i,
    ),
  };
}

/** A sample passport (no number anywhere) that expires about four years after `today`. */
export function sampleDoc(today: LocalDate, attachment?: Attachment): TravelDoc {
  return { id: DEMO_DOC_ID, kind: 'passport', label: 'Sample passport (demo)', expires: addMonths(today, 50), attachments: attachment ? [attachment] : [] };
}

/** Adds the sample passport once; a vault that already has it (or any edit of it) is returned unchanged. */
export function withSampleDoc(docs: readonly TravelDoc[], doc: TravelDoc): TravelDoc[] {
  return docs.some((d) => d.id === DEMO_DOC_ID) ? [...docs] : [...docs, doc];
}

export const withoutSampleDoc = (docs: readonly TravelDoc[]): TravelDoc[] => docs.filter((d) => d.id !== DEMO_DOC_ID);

/**
 * Invented details: a made-up insurer, an obviously sample policy number, and phone numbers from Australia's
 * ranges set aside for fiction (02 5550 xxxx, 0491 570 156-159), so nothing real is ever dialled.
 */
export const SAMPLE_CARD: EmergencyCard = {
  insurer: 'Sample Travel Cover (demo)',
  policy: 'SAMPLE-000-DEMO',
  insurerPhone: '+61 2 5550 0101',
  contacts: [{ id: 'demo-contact-1', name: 'Sample contact (demo)', phone: '+61 491 570 156', relation: 'Sample' }],
  medicalNotes: 'Sample note (demo): no known allergies.',
};

/** Fills an empty card with the sample details; a card with anything of the user's in it is never touched. */
export const withSampleCard = (card: EmergencyCard | null | undefined): EmergencyCard =>
  !card || cardStatus(card).empty ? { ...SAMPLE_CARD, contacts: SAMPLE_CARD.contacts.map((c) => ({ ...c })) } : card;

/** True when the card still holds exactly the sample details (so removing the demo can clear it). */
export function isSampleCard(card: EmergencyCard | null | undefined): boolean {
  if (!card) return false;
  const s = SAMPLE_CARD;
  const c = card.contacts ?? [];
  return (
    card.insurer === s.insurer &&
    card.policy === s.policy &&
    card.insurerPhone === s.insurerPhone &&
    card.medicalNotes === s.medicalNotes &&
    c.length === s.contacts.length &&
    c.every((x, k) => x.name === s.contacts[k]!.name && x.phone === s.contacts[k]!.phone && (x.relation ?? '') === (s.contacts[k]!.relation ?? ''))
  );
}

/** The card after the demo trip is removed: cleared if it is still the untouched sample, otherwise unchanged. */
export const withoutSampleCard = (card: EmergencyCard): EmergencyCard => (isSampleCard(card) ? { contacts: [] } : card);

// ---- T58 sample spending ----

/** Sample budget: A$2,500 in cents (the demo traveller flies from Sydney). */
export const SAMPLE_BUDGET: Budget = { currency: 'AUD', amount: 250000 };
/** A typed sample rate, 1 JPY = 0.0102 AUD (a round late-2026-ish figure; the app never fetches rates). */
export const SAMPLE_RATES: Readonly<Record<string, number>> = { JPY: 0.0102 };

/** Sample yen expenses (whole yen; JPY has no minor unit): day offset from the trip start, amount, category, note. */
const SAMPLE_EXPENSES: readonly { id: string; day: number; amount: number; category: Expense['category']; note: string }[] = [
  { id: 'demo-x1', day: 0, amount: 600, category: 'transport', note: 'Airport train to Asakusa (sample)' },
  { id: 'demo-x2', day: 1, amount: 3000, category: 'transport', note: 'Transit card top-up (sample)' },
  { id: 'demo-x3', day: 1, amount: 1200, category: 'food', note: 'Ramen lunch (sample)' },
  { id: 'demo-x4', day: 2, amount: 4800, category: 'food', note: 'Izakaya dinner (sample)' },
  { id: 'demo-x5', day: 5, amount: 500, category: 'activities', note: 'Temple entry (sample)' },
  { id: 'demo-x6', day: 5, amount: 1800, category: 'shopping', note: 'Matcha sweets (sample)' },
];

/** Ids of the sample expenses, so the UI or a later clean-up can tell them apart from the traveller's own. */
export const SAMPLE_EXPENSE_IDS: readonly string[] = SAMPLE_EXPENSES.map((e) => e.id);
export const isSampleExpense = (e: Pick<Expense, 'id'>): boolean => SAMPLE_EXPENSE_IDS.includes(e.id);

/**
 * The demo trip with the sample budget, rate and expenses, dated from the trip's own first day. Any other trip, or a
 * demo trip that already has a budget or expenses (the traveller's own or an earlier seed), is returned unchanged.
 */
export function withSampleSpending(trip: Trip, now = new Date().toISOString()): Trip {
  if (trip.id !== DEMO_TRIP_ID || !trip.demo) return trip;
  if (trip.budget || (Array.isArray(trip.expenses) && trip.expenses.length > 0)) return trip;
  const expenses: Expense[] = SAMPLE_EXPENSES.map((e) => ({
    id: e.id,
    amount: e.amount,
    currency: 'JPY',
    category: e.category,
    day: addDays(trip.startDate, e.day),
    note: e.note,
    createdAt: now,
  }));
  return { ...trip, budget: { ...SAMPLE_BUDGET }, rates: { ...SAMPLE_RATES }, expenses };
}
