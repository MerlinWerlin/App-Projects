// T87 loyalty and membership cards: the stored shape, the stored-data normaliser, form draft + validation, sort
// order, gentle expiry note, and the booking-text match that offers "Your <programme> card" on a booking.
// Cards live on this phone only (AsyncStorage key LOYALTY_KEY); they are never written into .satchel trip files.
// Programme names are always typed by the user: nothing here knows any airline, hotel or rail brand.
// Pure TypeScript; no React Native or Expo imports.
import { code128Encodable } from './code128.ts';
import type { Item, LocalDate } from './model.ts';
import { encodeQr } from './qr.ts';
import { expiryOf, isLocalDate, type Expiry } from './vault.ts';

export const LOYALTY_KEY = 'satchel.loyalty.v1';

export type LoyaltyKind = 'air' | 'hotel' | 'rail' | 'car' | 'other';
export const LOYALTY_KINDS: readonly LoyaltyKind[] = ['air', 'hotel', 'rail', 'car', 'other'];

export type BarcodeType = 'code128' | 'qr' | 'none';
export const BARCODE_TYPES: readonly BarcodeType[] = ['code128', 'qr', 'none'];

/** Card colours: names of the token-defined card paints (src/theme/tokens.ts cardPaints, light + dark). */
export type CardColour = 'navy' | 'sea' | 'teal' | 'forest' | 'amber' | 'rust' | 'plum' | 'slate';
export const CARD_COLOURS: readonly CardColour[] = ['navy', 'sea', 'teal', 'forest', 'amber', 'rust', 'plum', 'slate'];

/** A colour to start with for each kind (the user can pick any). */
export const DEFAULT_COLOUR: Record<LoyaltyKind, CardColour> = { air: 'navy', hotel: 'plum', rail: 'forest', car: 'rust', other: 'slate' };

export type LoyaltyCard = {
  id: string;
  kind: LoyaltyKind;
  /** Programme name exactly as the user typed it. */
  programme: string;
  memberName?: string;
  /** Membership number as typed (spaces kept for display; the barcode uses it as typed). */
  number: string;
  tier?: string;
  expires?: LocalDate;
  colour: CardColour;
  barcode: BarcodeType;
  /** ms since epoch; for a stable order among equal names. */
  createdAt: number;
  /** T88: optional photo of the card, a file copied into Satchel's own folder (attachments/). Phone only. */
  photo?: string;
};

export const LIMITS = { programme: 60, memberName: 80, number: 64, tier: 40 } as const;
/** Longest stored photo path kept (anything longer is junk and dropped). */
export const MAX_PHOTO_URI = 2048;

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const pick = <T extends string>(v: unknown, all: readonly T[], fallback: T): T => (typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : fallback);

/** One stored card cleaned up, or null when it can't be a card (no programme or no number). */
export function cleanCard(raw: unknown, now = 0): LoyaltyCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 80);
  const programme = str(r.programme, LIMITS.programme);
  const number = str(r.number, LIMITS.number);
  if (!id || !programme || !number) return null;
  const kind = pick(r.kind, LOYALTY_KINDS, 'other');
  const card: LoyaltyCard = {
    id,
    kind,
    programme,
    number,
    colour: pick(r.colour, CARD_COLOURS, DEFAULT_COLOUR[kind]),
    barcode: pick(r.barcode, BARCODE_TYPES, 'none'),
    createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : now,
  };
  const memberName = str(r.memberName, LIMITS.memberName);
  if (memberName) card.memberName = memberName;
  const tier = str(r.tier, LIMITS.tier);
  if (tier) card.tier = tier;
  if (typeof r.expires === 'string' && isLocalDate(r.expires)) card.expires = r.expires;
  if (typeof r.photo === 'string' && r.photo.trim() && r.photo.length <= MAX_PHOTO_URI) card.photo = r.photo.trim();
  // A stored barcode the number can no longer be drawn in falls back to number only (never a broken barcode).
  if (!barcodeFits(card.barcode, card.number)) card.barcode = 'none';
  return card;
}

/** Stored value -> cards: not an array gives [], bad entries are dropped, the first of duplicate ids wins. */
export function cleanCards(raw: unknown): LoyaltyCard[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: LoyaltyCard[] = [];
  for (const r of raw) {
    const c = cleanCard(r);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/** True when the number can be drawn as that barcode ('none' always fits). */
export function barcodeFits(type: BarcodeType, number: string): boolean {
  if (type === 'none') return true;
  if (!number) return false;
  if (type === 'code128') return code128Encodable(number);
  return encodeQr(number) != null;
}

// ---------------------------------------------------------------- form

export type CardDraft = {
  kind: LoyaltyKind;
  programme: string;
  memberName: string;
  number: string;
  tier: string;
  /** YYYY-MM-DD or empty. */
  expires: string;
  colour: CardColour;
  barcode: BarcodeType;
  /** T88: the card photo's file, or empty for none. */
  photo: string;
};
export type CardError = 'programme' | 'number' | 'expires' | 'barcode';

export const newCardDraft = (kind: LoyaltyKind = 'air'): CardDraft => ({
  kind,
  programme: '',
  memberName: '',
  number: '',
  tier: '',
  expires: '',
  colour: DEFAULT_COLOUR[kind],
  barcode: 'code128',
  photo: '',
});

export const draftFromCard = (c: LoyaltyCard): CardDraft => ({
  kind: c.kind,
  programme: c.programme,
  memberName: c.memberName ?? '',
  number: c.number,
  tier: c.tier ?? '',
  expires: c.expires ?? '',
  colour: c.colour,
  barcode: c.barcode,
  photo: c.photo ?? '',
});

export function validateCard(d: CardDraft): CardError[] {
  const e: CardError[] = [];
  if (!d.programme.trim()) e.push('programme');
  if (!d.number.trim()) e.push('number');
  if (d.expires.trim() && !isLocalDate(d.expires.trim())) e.push('expires');
  if (d.number.trim() && !barcodeFits(d.barcode, d.number.trim())) e.push('barcode');
  return e;
}

/** The card a valid draft saves as (cleaned like stored data). */
export function cardFromDraft(d: CardDraft, id: string, createdAt: number): LoyaltyCard {
  return cleanCard({ ...d, id, createdAt, expires: d.expires.trim() || undefined, photo: d.photo || undefined }, createdAt)!;
}

export const upsertCard = (cards: readonly LoyaltyCard[], c: LoyaltyCard): LoyaltyCard[] =>
  cards.some((x) => x.id === c.id) ? cards.map((x) => (x.id === c.id ? c : x)) : [...cards, c];

export const removeCard = (cards: readonly LoyaltyCard[], id: string): LoyaltyCard[] => cards.filter((c) => c.id !== id);

/** By kind (air, hotel, rail, car, other), then programme name, then when added. Returns a new array. */
export function sortCards(cards: readonly LoyaltyCard[]): LoyaltyCard[] {
  return [...cards].sort(
    (a, b) =>
      LOYALTY_KINDS.indexOf(a.kind) - LOYALTY_KINDS.indexOf(b.kind) ||
      a.programme.localeCompare(b.programme, undefined, { sensitivity: 'base' }) ||
      a.createdAt - b.createdAt,
  );
}

/** Same rules as vault documents: still valid on its expiry date, "soon" within 90 days. */
export const cardExpiry = (c: Pick<LoyaltyCard, 'expires'>, today: LocalDate): Expiry => expiryOf(c, today);

/** Digit-only numbers of 8+ digits are shown in groups of four ("1234 5678 9012"); anything else as typed. */
export function displayNumber(n: string): string {
  const compact = n.replace(/\s+/g, '');
  if (/^\d{8,}$/.test(compact)) return compact.replace(/(\d{4})(?=\d)/g, '$1 ');
  return n;
}

// ---------------------------------------------------------------- booking match

/** Lower case, accents dropped, everything that isn't a letter or digit turned into single spaces. */
export function matchText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Programme names shorter than this (after cleaning) are never matched: too likely to hit by chance. */
export const MIN_MATCH = 3;

/** The booking text a card name is looked for in: title, provider (carrier), notes and place names. */
export const itemMatchText = (item: Pick<Item, 'title' | 'carrier' | 'notes' | 'place' | 'from' | 'to'>): string =>
  matchText([item.title, item.carrier, item.notes, item.place?.name].filter(Boolean).join(' '));

/** Saved cards whose programme name appears in the booking's text as whole words (sorted like the Wallet). */
export function cardsForItem(cards: readonly LoyaltyCard[], item: Pick<Item, 'title' | 'carrier' | 'notes' | 'place' | 'from' | 'to'>): LoyaltyCard[] {
  const hay = ` ${itemMatchText(item)} `;
  if (!hay.trim()) return [];
  return sortCards(
    cards.filter((c) => {
      const needle = matchText(c.programme);
      return needle.length >= MIN_MATCH && hay.includes(` ${needle} `);
    }),
  );
}
