// Tickets and attachments: pure helpers for the Wallet tab, the ticket view and the booking detail.
// No React Native or Expo imports; the native side (pickers, file copy, brightness) lives in src/native.
import type { Attachment, Item, ItemKind, Trip } from './model.ts';
import { isTransport } from './model.ts';
import { span, zonesReadable } from './timeline.ts';
import { hasCropRect } from './qrcrop.ts';

export type AttachmentKind = 'image' | 'pdf' | 'other';

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** Lower-case extension of a file name or URI ('' when none). */
export function extensionOf(name: string): string {
  const base = (name.split(/[?#]/)[0] ?? '').split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** Best mime type for a picked file: the picker's own type when it is specific, else from the extension. */
export function mimeFor(name: string, mime?: string | null): string {
  const m = (mime ?? '').trim().toLowerCase();
  if (m && m !== 'application/octet-stream' && m.includes('/')) return m;
  return EXT_MIME[extensionOf(name)] ?? (m || 'application/octet-stream');
}

/** How Satchel can show a file: inline image, PDF (opened through the system), or not supported. */
export function attachmentKind(mime: string, name = ''): AttachmentKind {
  const m = mimeFor(name, mime);
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('image/')) return 'image';
  return 'other';
}

/** Only PDFs and images can be attached (docs/spec/STATES_COPY.md error.attachment.unsupported). */
export const isSupportedFile = (mime: string, name = '') => attachmentKind(mime, name) !== 'other';

/** The role a new attachment gets on this kind of booking. */
export function defaultRole(kind: ItemKind): Attachment['role'] {
  if (isTransport(kind) || kind === 'activity') return 'ticket';
  if (kind === 'hotel' || kind === 'car') return 'booking';
  return 'other';
}

/** A file name to show when the picker gives none (photos often have no name). */
export function fallbackName(id: string, mime: string): string {
  const ext = Object.entries(EXT_MIME).find(([, m]) => m === mime)?.[0] ?? (mime === 'application/pdf' ? 'pdf' : 'jpg');
  return `${mime === 'application/pdf' ? 'ticket' : 'photo'}-${id.slice(-6)}.${ext === 'jpeg' ? 'jpg' : ext}`;
}

export function makeAttachment(p: { id: string; uri: string; name?: string | null; mime?: string | null; kind: ItemKind; qrCropUri?: string }): Attachment {
  const rawName = (p.name ?? '').trim();
  const mime = mimeFor(rawName || p.uri, p.mime);
  const a: Attachment = { id: p.id, uri: p.uri, name: rawName || fallbackName(p.id, mime), mime, role: defaultRole(p.kind) };
  if (p.qrCropUri) a.qrCropUri = p.qrCropUri;
  return a;
}

/** New item with `a` appended (or replacing the attachment with the same id). Never mutates `item`. */
export function addAttachment(item: Item, a: Attachment): Item {
  return item.attachments.some((x) => x.id === a.id) ? replaceAttachment(item, a) : { ...item, attachments: [...item.attachments, a] };
}

export function removeAttachment(item: Item, attachmentId: string): Item {
  return { ...item, attachments: item.attachments.filter((a) => a.id !== attachmentId) };
}

/** Replaces the attachment with the same id; unchanged copy if there is none. */
export function replaceAttachment(item: Item, a: Attachment): Item {
  return { ...item, attachments: item.attachments.map((x) => (x.id === a.id ? a : x)) };
}

/** Sets (or with `undefined` clears) the saved QR crop on one attachment. */
export function setQrCrop(item: Item, attachmentId: string, qrCropUri: string | undefined): Item {
  return {
    ...item,
    attachments: item.attachments.map((x) => {
      if (x.id !== attachmentId) return x;
      const { qrCropUri: _old, ...rest } = x;
      if (!qrCropUri) return rest;
      // T28: a new crop image replaces an in-app crop rectangle (the newest choice wins).
      const { qrCrop: _rect, ...plain } = rest;
      return { ...plain, qrCropUri };
    }),
  };
}

/** Files that become unused when an attachment is removed (the file and its separate crop, if any). */
export function filesOf(a: Attachment): string[] {
  return a.qrCropUri && a.qrCropUri !== a.uri ? [a.uri, a.qrCropUri] : [a.uri];
}

/**
 * The attachment the ticket view opens: one with a saved QR crop first, then the first ticket, then the first
 * booking confirmation. Files marked 'other' only count when they carry a QR crop. Null when there is none.
 */
export function primaryTicket(item: Item): Attachment | null {
  const as = item.attachments;
  return as.find((a) => a.qrCropUri || hasCropRect(a)) ?? as.find((a) => a.role === 'ticket') ?? as.find((a) => a.role === 'booking') ?? null;
}

/** The attachment to show: the one asked for by id if it exists, else the primary ticket. */
export function ticketToShow(item: Item, attachmentId?: string): Attachment | null {
  return (attachmentId ? item.attachments.find((a) => a.id === attachmentId) : undefined) ?? primaryTicket(item);
}

export type WalletEntry = {
  /** Stable list key: the item id (ids are unique across trips). */
  key: string;
  item: Item;
  tripId: string;
  tripName: string;
  ticket: Attachment;
  /** Real (UTC) start and end, for sorting and for past/upcoming. */
  start: number;
  end: number;
};

/** Every booking with a ticket and readable zones, across all trips, in real time order (UTC start, then end, then id). */
export function walletEntries(trips: Trip[]): WalletEntry[] {
  const out: WalletEntry[] = [];
  for (const trip of trips) {
    for (const item of trip.items) {
      const ticket = primaryTicket(item);
      // T43: a booking with an unreadable zone has no real time to sort by; its ticket stays on the item (opened
      // from its timeline row, which says the zone needs fixing) and comes back here once the zone is edited.
      if (!ticket || !zonesReadable(item)) continue;
      const s = span(item);
      out.push({ key: item.id, item, tripId: trip.id, tripName: trip.name, ticket, start: s.start, end: s.end });
    }
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * Upcoming (not yet finished: ends now or later, soonest first) and past (finished, most recent first).
 * An item with no end time counts as finished once its start has passed.
 */
export function splitWallet(entries: WalletEntry[], now: number): { upcoming: WalletEntry[]; past: WalletEntry[] } {
  const upcoming = entries.filter((e) => e.end >= now);
  const past = entries.filter((e) => e.end < now).reverse();
  return { upcoming, past };
}

/** Folders under the documents directory that hold Satchel's own copies of files. */
// T152: covers/ holds the phone-only trip cover photos (src/core/covers2.ts).
export const APP_FOLDERS: readonly string[] = ['attachments', 'vault', 'covers'];

/**
 * iOS moves the app's container when the app is updated or restored, so a saved absolute file URI can go stale.
 * Rebases a URI under our documents folder onto the current one (`docDir` ends with '/'). A stored relative path
 * ('attachments/a1-pass.pdf') is resolved against `docDir` too. Other URIs are unchanged.
 */
export function rebaseUri(uri: string, docDir: string | null | undefined, folders: readonly string[] = APP_FOLDERS): string {
  if (!docDir || uri.startsWith(docDir)) return uri;
  for (const f of folders) {
    if (uri.startsWith(`${f}/`)) return `${docDir}${uri}`;
    const i = uri.lastIndexOf(`/${f}/`);
    if (i >= 0 && /\/Documents\/|\/files\//.test(uri.slice(0, i + 1))) return `${docDir}${uri.slice(i + 1)}`;
  }
  return uri;
}

/** The path relative to the documents folder ('attachments/a1-pass.pdf') for one of our files, else null. */
export function appRelativePath(uri: string, docDir: string | null | undefined, folders: readonly string[] = APP_FOLDERS): string | null {
  const abs = rebaseUri(uri, docDir, folders);
  if (!docDir || !abs.startsWith(docDir)) return null;
  const rel = abs.slice(docDir.length);
  return folders.some((f) => rel.startsWith(`${f}/`)) && !rel.split('/').includes('..') ? rel : null;
}

/** True when `uri` is one of Satchel's own copies (safe to delete when its booking or document goes). */
export const isAppFile = (uri: string, docDir: string | null | undefined): boolean => appRelativePath(uri, docDir) !== null;

/** The attachment with its file and crop rebased onto `docDir`; the same object when nothing moved. */
export function rebaseAttachment(a: Attachment, docDir: string | null | undefined): Attachment {
  const uri = rebaseUri(a.uri, docDir);
  const crop = a.qrCropUri ? rebaseUri(a.qrCropUri, docDir) : undefined;
  if (uri === a.uri && crop === a.qrCropUri) return a;
  return crop ? { ...a, uri, qrCropUri: crop } : { ...a, uri };
}

/** Every attachment of every list rebased; the same array when nothing moved (so callers can skip a save). */
export function rebaseAttachments(list: Attachment[], docDir: string | null | undefined): Attachment[] {
  let changed = false;
  const out = list.map((a) => {
    const b = rebaseAttachment(a, docDir);
    if (b !== a) changed = true;
    return b;
  });
  return changed ? out : list;
}

/**
 * T68: a trip journal with its photo paths rebased onto `docDir` (journal photos live in attachments/, so a path
 * saved under an earlier install's container, or a stored relative 'attachments/…' path, points at this install's
 * copy). Malformed rows are left as they are for readJournal to skip; the same array when nothing moved.
 */
export function rebaseJournal<J extends { photos?: unknown }>(journal: J[], docDir: string | null | undefined): J[] {
  if (!docDir) return journal;
  let changed = false;
  const out = journal.map((e) => {
    if (!e || typeof e !== 'object' || !Array.isArray(e.photos)) return e;
    let photosChanged = false;
    const photos = (e.photos as unknown[]).map((p) => {
      if (!p || typeof p !== 'object' || typeof (p as { uri?: unknown }).uri !== 'string') return p;
      const uri = rebaseUri((p as { uri: string }).uri, docDir);
      if (uri === (p as { uri: string }).uri) return p;
      photosChanged = true;
      return { ...(p as object), uri };
    });
    if (!photosChanged) return e;
    changed = true;
    return { ...e, photos };
  });
  return changed ? out : journal;
}

/** All trips with attachment and journal photo paths rebased onto this install's documents folder; the same array when nothing moved. */
export function rebaseTrips(trips: Trip[], docDir: string | null | undefined): Trip[] {
  if (!docDir) return trips;
  let changed = false;
  const out = trips.map((trip) => {
    let next = trip;
    if (Array.isArray(trip.items)) {
      let itemsChanged = false;
      const items = trip.items.map((item) => {
        if (!Array.isArray(item.attachments)) return item;
        const attachments = rebaseAttachments(item.attachments, docDir);
        if (attachments === item.attachments) return item;
        itemsChanged = true;
        return { ...item, attachments };
      });
      if (itemsChanged) next = { ...next, items };
    }
    if (Array.isArray(trip.journal)) {
      const journal = rebaseJournal(trip.journal, docDir);
      if (journal !== trip.journal) next = { ...next, journal };
    }
    if (next !== trip) changed = true;
    return next;
  });
  return changed ? out : trips;
}

/** Every file one booking holds (attachments and separate QR crops), without repeats. */
export function itemFiles(item: Item): string[] {
  return [...new Set(Array.isArray(item.attachments) ? item.attachments.flatMap(filesOf) : [])];
}

/** Every file a trip holds: its bookings' attachments and separate QR crops, and its journal photos (T64), without repeats. */
export function tripFiles(trip: Trip): string[] {
  const journal = Array.isArray(trip.journal) ? trip.journal.flatMap((e) => (Array.isArray(e?.photos) ? e.photos.map((p) => p.uri).filter((u) => typeof u === 'string') : [])) : [];
  return [...new Set([...(trip.items ?? []).flatMap(itemFiles), ...journal])];
}

// ---- T44: the item form's Attachments section (FLOWS §4.1) edits a draft list; files follow Save or Cancel ----

/**
 * Files that go unused when a booking's attachment list changes from `before` to `after` (a file or crop still
 * listed in `after` is kept). The item form deletes these after a successful Save (removed attachments) and, when
 * the form is left without saving, for the files it added (`before` = added this session, `after` = saved list).
 */
export function droppedFiles(before: readonly Attachment[], after: readonly Attachment[]): string[] {
  const keep = new Set(after.flatMap(filesOf));
  return [...new Set(before.flatMap(filesOf))].filter((u) => !keep.has(u));
}

/** True when two attachment lists hold the same files in the same order (the form's "unsaved changes" test). */
export function sameAttachments(a: readonly Attachment[], b: readonly Attachment[]): boolean {
  return a.length === b.length && a.every((x, i) => x.id === b[i].id && x.uri === b[i].uri && x.qrCropUri === b[i].qrCropUri && JSON.stringify(x.qrCrop ?? null) === JSON.stringify(b[i].qrCrop ?? null));
}
