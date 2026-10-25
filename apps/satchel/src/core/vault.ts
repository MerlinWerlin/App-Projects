// Document vault rules: expiry status, trip warnings (incl. the passport 6-month reminder), sort order, form
// validation, stored-data cleaning and the lock policy. Pure TypeScript; no React Native or Expo imports.
import type { Attachment, DocKind, LocalDate, Trip, TravelDoc } from './model.ts';
import { rebaseAttachments } from './tickets.ts';
import { daysBetween } from './tz.ts';

export const DOC_KINDS: readonly DocKind[] = ['passport', 'visa', 'licence', 'insurance', 'other'];

/** A document is "soon" when it expires within this many days (inclusive). */
export const SOON_DAYS = 90;
/** Many countries ask for this many months of passport validity beyond the stay. A reminder, not a rule. */
export const PASSPORT_MONTHS = 6;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written YYYY-MM-DD (2026-02-30 is false). */
export function isLocalDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number);
  if (y < 1900 || y > 2200) return false;
  const back = new Date(Date.UTC(y, mo - 1, d));
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d;
}

/** Calendar months later, clamped to the month's last day (2026-08-31 + 6 months = 2027-02-28). */
export function addMonths(date: LocalDate, n: number): LocalDate {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`bad date: ${date}`);
  const [y, mo, d] = m.slice(1).map(Number);
  const total = y * 12 + (mo - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`;
}

// ---------------------------------------------------------------- expiry

export type ExpiryStatus = 'expired' | 'soon' | 'ok' | 'none';
export type Expiry = { status: ExpiryStatus; /** Days from today to the expiry date (negative once expired). */ days?: number };

/** Status of a document on `today`. A document is still valid on its expiry date (0 days = "expires today"). */
export function expiryOf(doc: Pick<TravelDoc, 'expires'>, today: LocalDate): Expiry {
  if (!doc.expires || !isLocalDate(doc.expires) || !isLocalDate(today)) return { status: 'none' };
  const days = daysBetween(today, doc.expires);
  if (days < 0) return { status: 'expired', days };
  if (days <= SOON_DAYS) return { status: 'soon', days };
  return { status: 'ok', days };
}

export const expiryStatus = (doc: Pick<TravelDoc, 'expires'>, today: LocalDate): ExpiryStatus => expiryOf(doc, today).status;

const expiryFmts = new Map<string, Intl.DateTimeFormat>();
/** "14 May 2031" in the app language (the calendar date as written, never shifted by the phone's zone). */
export function formatExpiry(date: LocalDate, lang = 'en'): string {
  if (!isLocalDate(date)) return date;
  let f = expiryFmts.get(lang);
  if (!f) {
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
    try {
      f = new Intl.DateTimeFormat(lang, opts);
    } catch {
      f = new Intl.DateTimeFormat('en', opts);
    }
    expiryFmts.set(lang, f);
  }
  return f.format(new Date(`${date}T00:00:00Z`));
}

// ---------------------------------------------------------------- trip warnings

export type TripRef = Pick<Trip, 'id' | 'name' | 'startDate' | 'endDate'> & { demo?: boolean };
/**
 * - `during-trip`: the document expires before the trip's last day (it will not cover the whole trip).
 * - `six-months`: a passport valid on the last day but for less than 6 months after it.
 */
export type TripWarning = { docId: string; tripId: string; tripName: string; kind: 'during-trip' | 'six-months'; expires: LocalDate };

/** Trips that have not ended yet on `today` (demo trips are skipped: they are not real travel). */
export function upcomingTrips<T extends TripRef>(trips: readonly T[], today: LocalDate): T[] {
  return trips.filter((t) => !t.demo && isLocalDate(t.endDate) && t.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Warnings for one document against every trip that has not ended. Expired documents get no trip warning
 *  (their own "expired" status already says more). */
export function tripWarnings(doc: TravelDoc, trips: readonly TripRef[], today: LocalDate): TripWarning[] {
  const exp = doc.expires;
  if (!exp || !isLocalDate(exp) || exp < today) return [];
  const out: TripWarning[] = [];
  for (const trip of upcomingTrips(trips, today)) {
    const base = { docId: doc.id, tripId: trip.id, tripName: trip.name, expires: exp };
    if (exp < trip.endDate) out.push({ ...base, kind: 'during-trip' });
    else if (doc.kind === 'passport' && exp < addMonths(trip.endDate, PASSPORT_MONTHS)) out.push({ ...base, kind: 'six-months' });
  }
  return out;
}

export const allTripWarnings = (docs: readonly TravelDoc[], trips: readonly TripRef[], today: LocalDate): TripWarning[] =>
  docs.flatMap((d) => tripWarnings(d, trips, today));

// ---------------------------------------------------------------- order and summary

const URGENCY: Record<ExpiryStatus, number> = { expired: 0, soon: 1, ok: 2, none: 2 };

/** Expired first, then expiring soon (earliest first), then by kind (passport, visa, licence, insurance, other),
 *  then by label. Returns a new array. */
export function sortDocs<D extends TravelDoc>(docs: readonly D[], today: LocalDate): D[] {
  const kindRank = (k: DocKind) => {
    const i = DOC_KINDS.indexOf(k);
    return i < 0 ? DOC_KINDS.length : i;
  };
  return docs
    .map((doc) => ({ doc, e: expiryOf(doc, today) }))
    .sort((a, b) => {
      const u = URGENCY[a.e.status] - URGENCY[b.e.status];
      if (u) return u;
      if (URGENCY[a.e.status] < 2 && a.e.days !== b.e.days) return (a.e.days ?? 0) - (b.e.days ?? 0);
      const k = kindRank(a.doc.kind) - kindRank(b.doc.kind);
      if (k) return k;
      return a.doc.label.localeCompare(b.doc.label);
    })
    .map((x) => x.doc);
}

/** Counts only (no labels, no dates), safe to show on the Wallet tab while the vault is locked. */
export type VaultSummary = { total: number; expired: number; soon: number; tripWarnings: number };

export function vaultSummary(docs: readonly TravelDoc[], trips: readonly TripRef[], today: LocalDate): VaultSummary {
  let expired = 0;
  let soon = 0;
  for (const d of docs) {
    const s = expiryStatus(d, today);
    if (s === 'expired') expired++;
    else if (s === 'soon') soon++;
  }
  return { total: docs.length, expired, soon, tripWarnings: allTripWarnings(docs, trips, today).length };
}

// ---------------------------------------------------------------- form

export type DocDraft = { kind: DocKind; label: string; expires: string; attachments: Attachment[] };
export type DocError = 'label' | 'expires';
export const MAX_LABEL = 80;

export const newDocDraft = (): DocDraft => ({ kind: 'passport', label: '', expires: '', attachments: [] });

export const draftFromDoc = (d: TravelDoc): DocDraft => ({ kind: d.kind, label: d.label, expires: d.expires ?? '', attachments: [...d.attachments] });

/** Label is required; expiry is optional but must be a real YYYY-MM-DD date when given. */
export function validateDoc(d: DocDraft): DocError[] {
  const errors: DocError[] = [];
  if (!d.label.trim()) errors.push('label');
  const exp = d.expires.trim();
  if (exp && !isLocalDate(exp)) errors.push('expires');
  return errors;
}

export function docFromDraft(d: DocDraft, id: string): TravelDoc {
  const exp = d.expires.trim();
  return { id, kind: d.kind, label: d.label.trim().slice(0, MAX_LABEL), ...(exp ? { expires: exp } : {}), attachments: d.attachments };
}

export const upsertDoc = (docs: readonly TravelDoc[], doc: TravelDoc): TravelDoc[] =>
  docs.some((d) => d.id === doc.id) ? docs.map((d) => (d.id === doc.id ? doc : d)) : [...docs, doc];

export const removeDoc = (docs: readonly TravelDoc[], id: string): TravelDoc[] => docs.filter((d) => d.id !== id);

/** Attachment uris present in `before` but not in `after` (files to delete once the change is saved). */
export const droppedFiles = (before: readonly Attachment[], after: readonly Attachment[]): string[] =>
  before.filter((a) => !after.some((b) => b.uri === a.uri)).map((a) => a.uri);

// ---------------------------------------------------------------- files

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** The picker's mime type if it gave one, else a guess from the file extension. */
export function mimeFor(name: string, given?: string | null): string {
  if (given && /^[\w.+-]+\/[\w.+-]+$/.test(given)) return given.toLowerCase();
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

export const isImage = (a: Pick<Attachment, 'mime'>) => a.mime.startsWith('image/');
export const isPdf = (a: Pick<Attachment, 'mime'>) => a.mime === 'application/pdf';

// ---------------------------------------------------------------- stored data

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Whatever came out of storage, as valid documents (bad entries dropped, bad fields repaired). Never throws. */
export function cleanDocs(raw: unknown): TravelDoc[] {
  if (!Array.isArray(raw)) return [];
  const out: TravelDoc[] = [];
  for (const v of raw) {
    if (!isObj(v) || typeof v.id !== 'string' || !v.id) continue;
    const kind = DOC_KINDS.includes(v.kind as DocKind) ? (v.kind as DocKind) : 'other';
    const label = typeof v.label === 'string' ? v.label : '';
    const expires = typeof v.expires === 'string' && isLocalDate(v.expires) ? v.expires : undefined;
    const attachments = Array.isArray(v.attachments)
      ? v.attachments.filter(
          (a): a is Attachment => isObj(a) && typeof a.id === 'string' && typeof a.uri === 'string' && typeof a.name === 'string' && typeof a.mime === 'string',
        )
      : [];
    out.push({ id: v.id, kind, label, ...(expires ? { expires } : {}), attachments });
  }
  return out;
}

/** Documents with their file paths rebased onto this install's documents folder (iOS moves the app's container
 *  on update or restore). The same array when nothing moved. */
export function rebaseDocs(docs: TravelDoc[], docDir: string | null | undefined): TravelDoc[] {
  if (!docDir) return docs;
  let changed = false;
  const out = docs.map((d) => {
    const attachments = rebaseAttachments(d.attachments, docDir);
    if (attachments === d.attachments) return d;
    changed = true;
    return { ...d, attachments };
  });
  return changed ? out : docs;
}

// ---------------------------------------------------------------- lock policy

/** The vault locks again when the app comes back after more than this long in the background. */
export const RELOCK_AFTER_MS = 60_000;

/**
 * - `unlocked`: authentication passed (or the user chose to open without a lock: `unprotected`).
 * - `backgroundAt`: when the app went to the background while unlocked.
 */
export type LockState = { unlocked: boolean; unprotected: boolean; backgroundAt: number | null };
export type LockEvent =
  | { type: 'unlocked'; unprotected?: boolean }
  | { type: 'lock' }
  /** The user left the vault screens (back to the Wallet): the next visit asks again. */
  | { type: 'leave' }
  /** AppState 'background'. iOS 'inactive' (Face ID sheet, Control Centre) is deliberately not an event. */
  | { type: 'background'; at: number }
  | { type: 'active'; at: number };

/** The vault starts locked on every launch. */
export const LOCKED: LockState = { unlocked: false, unprotected: false, backgroundAt: null };

export function lockReducer(s: LockState, e: LockEvent): LockState {
  switch (e.type) {
    case 'unlocked':
      return { unlocked: true, unprotected: !!e.unprotected, backgroundAt: null };
    case 'lock':
    case 'leave':
      return LOCKED;
    case 'background':
      if (!s.unlocked) return s;
      // Keep the first time it went away if several background events arrive.
      return s.backgroundAt == null ? { ...s, backgroundAt: e.at } : s;
    case 'active': {
      if (s.backgroundAt == null) return s;
      const away = e.at - s.backgroundAt;
      // A clock that moved backwards is treated as "too long" (safer to ask again).
      if (away > RELOCK_AFTER_MS || away < 0) return LOCKED;
      return { ...s, backgroundAt: null };
    }
    default:
      return s;
  }
}

export const requiresUnlock = (s: LockState) => !s.unlocked;
