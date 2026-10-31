// .satchel trip files (PLAN §2 "trip sharing by exporting a .satchel file"; EDGE_CASES "Trip export and import").
// A trip file is one JSON object: the trip (with its budget, exchange rates and expenses when it has them, T54),
// its bookings, its saved places (FLOWS §11.2), its packing list when it has one, and the bytes of the bookings' attachments as base64. Pure TypeScript: the UI reads and writes files.
// T64: the trip journal travels as text (notes, day, mood, weather, place link, and how many photos stayed on the
// phone). T68: journal photos go in only when the sender turns on "Include journal photos" (off by default); their
// bytes sit in `journal_photos`, and photos that couldn't be read or didn't fit stay counted in photoCount. Older
// files have no journal or no journal_photos and import as before.
//
// What never goes in: travel documents (the vault), the emergency card and medical notes. They are not part of a
// Trip in the model, and buildTripFile only ever sees the one trip and its own packing list, so they cannot leak in.
//
// Importing never overwrites anything: the trip, every booking, place, packing row and attachment get new ids, so
// importing the same file twice gives two separate trips. A file is checked in full before anything is imported;
// a file that fails any check is rejected whole (no partial import). Unreadable time zones are kept as they are
// (the app already shows those as "zone not recognised"); dates that can't be placed on a timeline are rejected.
import type { Attachment, Item, Place, SavedPlace, Trip } from './model.ts';
import { ITEM_KINDS } from './model.ts';
import {
  checkFileJournal,
  fileJournalPhotoIds,
  fileJournalPhotos,
  importJournalFile,
  journalForFile,
  journalPhotos,
  readFileJournal,
  type FileJournalEntry,
  type ImportJournalPhoto,
} from './journal.ts';
import { importIdeas, readFileIdeas } from './ideas.ts';
import { importTodos, readFileTodos } from './todos.ts';
import type { PackItem, PackList } from './packing.ts';
import { readCover } from './covers.ts';
import { readAirport } from './leaveby.ts';
import { checkFileSpending } from './spending.ts';
import { cleanFileTogether } from './together.ts';
import { isLocalDateTime } from './tz.ts';

export const TRIP_FILE_FORMAT = 'satchel-trip';
export const TRIP_FILE_VERSION = 1;
export const TRIP_FILE_EXT = '.satchel';
export const TRIP_FILE_MIME = 'application/json';
/** Largest file we try to read (characters of JSON, base64 attachments included): about 60 MB. */
export const MAX_TRIP_FILE_CHARS = 60 * 1024 * 1024;
const MAX_ROWS = 5000;

/** A booking's attachment as written in the file: no device path, just the id of its bytes in `attachments`. */
export type FileAttachmentRef = Omit<Attachment, 'uri' | 'qrCropUri'> & { hasCrop?: boolean };
export type FileItem = Omit<Item, 'attachments'> & { attachments: FileAttachmentRef[] };
export type FileTrip = Omit<Trip, 'items' | 'places' | 'journal'> & { journal?: FileJournalEntry[] };
/** The bytes of one attachment (and of its saved QR crop when it is a separate file). */
export type FilePayload = { id: string; name: string; mime: string; data_base64: string; crop_base64?: string };

export type TripFile = {
  format: typeof TRIP_FILE_FORMAT;
  version: typeof TRIP_FILE_VERSION;
  exported_at: string;
  trip: FileTrip;
  items: FileItem[];
  places: SavedPlace[];
  packing?: Omit<PackList, 'tripId'>;
  attachments: FilePayload[];
  /** T68: bytes of the journal photos the sender chose to include (absent when none were). */
  journal_photos?: FilePayload[];
};

/** Why a file was refused. 'format': not a Satchel trip; 'version': made by a newer Satchel; 'damaged': fails a check; 'too-large'. */
export type TripFileError = 'format' | 'version' | 'damaged' | 'too-large';
export type ParseResult = { ok: true; file: TripFile } | { ok: false; error: TripFileError; detail?: string };

/** Base64 bytes read from the device for an attachment, keyed by attachment id. A missing entry drops that attachment. */
export type Payloads = Record<string, { data: string; crop?: string } | undefined>;

export type BuildResult = {
  file: TripFile;
  /** Attachments left out because their file couldn't be read. */
  skipped: number;
  /** T68: journal photos asked for but left out (unreadable, or the file would have been too large to import). */
  photosSkipped: number;
};

/** Room kept for the file's text (bookings, notes, JSON) when deciding how many journal photos fit. */
const TEXT_ROOM = 2 * 1024 * 1024;

export type BuildOptions = {
  packing?: PackList | null;
  now?: string;
  /** T68: base64 bytes of the journal photos to include, keyed by photo id. Absent: no photos (the default). */
  journalPhotos?: Readonly<Record<string, string | undefined>>;
};

/** Builds the file for one trip. Only that trip, its items, places, packing list and attachments are read. */
export function buildTripFile(trip: Trip, payloads: Payloads, opts: BuildOptions = {}): BuildResult {
  const { items: _items, places: _places, journal: _journal, ...fields } = trip;
  const attachments: FilePayload[] = [];
  let skipped = 0;
  const items: FileItem[] = (trip.items ?? []).map((item) => {
    const refs: FileAttachmentRef[] = [];
    for (const a of item.attachments ?? []) {
      const p = payloads[a.id];
      if (!p || typeof p.data !== 'string') {
        skipped++;
        continue;
      }
      const hasCrop = !!(a.qrCropUri && a.qrCropUri !== a.uri && p.crop);
      // An attachment whose crop is the same file keeps that link through hasCrop with no extra bytes.
      const cropSame = !!(a.qrCropUri && a.qrCropUri === a.uri);
      // T85: every field but the device paths goes in (so one added to Attachment later travels too).
      const { uri: _uri, qrCropUri: _crop, ...meta } = a;
      refs.push({ ...meta, ...(hasCrop || cropSame ? { hasCrop: true } : {}) });
      attachments.push({ id: a.id, name: a.name, mime: a.mime, data_base64: p.data, ...(hasCrop ? { crop_base64: p.crop } : {}) });
    }
    const { attachments: _a, ...fields } = item;
    return { ...fields, tripId: trip.id, attachments: refs };
  });
  // T68: journal photos in page order while the whole file stays under what import accepts.
  const journalPayloads: FilePayload[] = [];
  let photosSkipped = 0;
  if (opts.journalPhotos) {
    let room = MAX_TRIP_FILE_CHARS - TEXT_ROOM - attachments.reduce((n, a) => n + a.data_base64.length + (a.crop_base64?.length ?? 0), 0);
    const seen = new Set<string>();
    for (const p of journalPhotos(trip)) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const data = opts.journalPhotos[p.id];
      if (typeof data !== 'string' || !data || data.length > room) {
        photosSkipped++;
        continue;
      }
      room -= data.length;
      journalPayloads.push({ id: p.id, name: p.name, mime: p.mime, data_base64: data });
    }
  }
  const journal = journalForFile(trip, new Set(journalPayloads.map((p) => p.id)));
  const rest: FileTrip = journal ? { ...fields, journal } : fields;
  const file: TripFile = {
    format: TRIP_FILE_FORMAT,
    version: TRIP_FILE_VERSION,
    exported_at: opts.now ?? new Date().toISOString(),
    trip: rest,
    items,
    places: trip.places ?? [],
    attachments,
  };
  if (journalPayloads.length) file.journal_photos = journalPayloads;
  if (opts.packing && opts.packing.tripId === trip.id) {
    const { tripId: _t, ...packing } = opts.packing;
    file.packing = packing;
  }
  return { file, skipped, photosSkipped };
}

/** A safe file name for the trip: '<trip name>.satchel' without characters Files or AirDrop refuse. */
export function tripFileName(name: string): string {
  const base = name
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 60)
    .trim();
  return `${base || 'Trip'}${TRIP_FILE_EXT}`;
}

// ---- reading ----

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const optStr = (x: unknown) => x === undefined || typeof x === 'string';
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const optNum = (x: unknown) => x === undefined || isNum(x);
const isDate = (x: unknown) => isStr(x) && /^\d{4}-\d{2}-\d{2}$/.test(x) && isLocalDateTime(`${x}T00:00`);
const isStamp = (x: unknown) => isObj(x) && isStr(x.local) && isLocalDateTime(x.local) && isStr(x.tz);
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const isBase64 = (x: unknown): x is string => isStr(x) && x.length % 4 === 0 && BASE64.test(x);
const ROLES: readonly string[] = ['ticket', 'booking', 'other'];

const isPlace = (x: unknown): x is Place =>
  isObj(x) && isStr(x.id) && isStr(x.name) && optStr(x.address) && optStr(x.localAddress) && optNum(x.lat) && optNum(x.lon) && optStr(x.phone);
const optPlace = (x: unknown) => x === undefined || isPlace(x);
const isSavedPlace = (x: unknown): x is SavedPlace =>
  isPlace(x) && isNum((x as SavedPlace).lat) && isNum((x as SavedPlace).lon) && isStr((x as SavedPlace).savedAt) && optStr((x as SavedPlace).category);
const isRef = (x: unknown): x is FileAttachmentRef => isObj(x) && isStr(x.id) && isStr(x.name) && isStr(x.mime) && isStr(x.role) && ROLES.includes(x.role);
const isItem = (x: unknown): x is FileItem =>
  isObj(x) &&
  isStr(x.id) &&
  (ITEM_KINDS as readonly unknown[]).includes(x.kind) &&
  isStr(x.title) &&
  isStamp(x.start) &&
  (x.end === undefined || isStamp(x.end)) &&
  optPlace(x.from) &&
  optPlace(x.to) &&
  optPlace(x.place) &&
  ['ref', 'seat', 'carrier', 'number', 'notes'].every((k) => optStr(x[k])) &&
  Array.isArray(x.attachments) &&
  x.attachments.every(isRef);
const isPayload = (x: unknown): x is FilePayload =>
  isObj(x) && isStr(x.id) && isStr(x.name) && isStr(x.mime) && isBase64(x.data_base64) && (x.crop_base64 === undefined || isBase64(x.crop_base64));
const isPackItem = (x: unknown): x is PackItem => isObj(x) && isStr(x.id) && isStr(x.label) && typeof x.done === 'boolean' && optStr(x.category) && optNum(x.qty);

/**
 * T74: a booking's airport fields (terminal, gate, boarding, bag drop, buffer, travel time) are optional. A value this
 * build can't read is dropped rather than refusing the whole trip; keys it doesn't know are kept (readAirport).
 */
function fileAirport(item: FileItem): FileItem {
  if (!('airport' in item)) return item;
  const { airport, ...rest } = item;
  const clean = readAirport(airport);
  return clean ? { ...rest, airport: clean } : rest;
}

const damaged = (detail: string): ParseResult => ({ ok: false, error: 'damaged', detail });

/** Checks a decoded JSON value in full. Nothing about it is trusted until this says ok. */
export function parseTripFile(data: unknown): ParseResult {
  if (!isObj(data) || data.format !== TRIP_FILE_FORMAT) return { ok: false, error: 'format' };
  if (!isNum(data.version) || !Number.isInteger(data.version) || data.version < 1) return damaged('version');
  if (data.version > TRIP_FILE_VERSION) return { ok: false, error: 'version' };
  const t = data.trip;
  if (!isObj(t) || !isStr(t.name) || !isDate(t.startDate) || !isDate(t.endDate)) return damaged('trip');
  // T54: budget, rates and expenses are optional (older files have none); when present they must be valid in full.
  if (!checkFileSpending(t)) return damaged('spending');
  // T64: the journal is optional (older files have none); when present its structure must be valid in full.
  if (!checkFileJournal(t)) return damaged('journal');
  if (!Array.isArray(data.items) || !Array.isArray(data.attachments)) return damaged('lists');
  const places = data.places === undefined ? [] : data.places;
  if (!Array.isArray(places)) return damaged('places');
  if (data.items.length > MAX_ROWS || places.length > MAX_ROWS || data.attachments.length > MAX_ROWS) return { ok: false, error: 'too-large' };
  if (!data.items.every(isItem)) return damaged('item');
  if (!places.every(isSavedPlace)) return damaged('place');
  if (!data.attachments.every(isPayload)) return damaged('attachment');
  const payloadIds = new Set<string>();
  for (const p of data.attachments as FilePayload[]) {
    if (payloadIds.has(p.id)) return damaged('attachment-duplicate');
    payloadIds.add(p.id);
  }
  // Every attachment a booking lists must have its bytes in the file, once (EDGE_CASES: missing or mismatched).
  const used = new Set<string>();
  for (const item of data.items as FileItem[]) {
    for (const a of item.attachments) {
      if (!payloadIds.has(a.id) || used.has(a.id)) return damaged('attachment-missing');
      used.add(a.id);
    }
  }
  // T68: journal photo bytes are optional; every photo a page lists must have its bytes here, once.
  const journalPhotoData = data.journal_photos === undefined ? [] : data.journal_photos;
  if (!Array.isArray(journalPhotoData) || journalPhotoData.length > MAX_ROWS) return damaged('journal-photos');
  if (!journalPhotoData.every((p) => isPayload(p) && p.crop_base64 === undefined)) return damaged('journal-photos');
  const photoIds = new Set<string>();
  for (const p of journalPhotoData as FilePayload[]) {
    if (photoIds.has(p.id)) return damaged('journal-photos');
    photoIds.add(p.id);
  }
  for (const id of fileJournalPhotoIds(t.journal as FileJournalEntry[] | undefined)) if (!photoIds.has(id)) return damaged('journal-photos');
  let packing: TripFile['packing'];
  if (data.packing !== undefined) {
    const p = data.packing;
    if (!isObj(p) || !Array.isArray(p.items) || p.items.length > MAX_ROWS || !p.items.every(isPackItem)) return damaged('packing');
    packing = p as unknown as TripFile['packing'];
  }
  // T82: companions, payers, splits and settlements are optional; unreadable ones are dropped, never the trip.
  const { items: _i, places: _p, demo, journal: rawJournal, ideas: rawIdeas, cover: rawCover, todos: rawTodos, ...tripFields } = cleanFileTogether(t);
  const journal = readFileJournal(rawJournal);
  // T81: ideas are optional (older files have none); unreadable rows are left out rather than refusing the file.
  const ideas = readFileIdeas(rawIdeas);
  // T83: the cover choice travels with the trip; a value that isn't a plain id is dropped (never refuses the file).
  const cover = readCover(rawCover);
  // T93: to-dos are optional too; unreadable rows are left out.
  const todos = readFileTodos(rawTodos);
  const trip: FileTrip = {
    ...(tripFields as unknown as FileTrip),
    ...(journal ? { journal } : {}),
    ...(ideas ? { ideas } : {}),
    ...(cover ? { cover } : {}),
    ...(todos ? { todos } : {}),
    id: isStr(t.id) ? t.id : '',
    homeTz: isStr(t.homeTz) ? t.homeTz : 'UTC',
    createdAt: isStr(t.createdAt) ? t.createdAt : '',
    ...(demo === true ? { demo: true } : {}),
  };
  return {
    ok: true,
    file: {
      format: TRIP_FILE_FORMAT,
      version: TRIP_FILE_VERSION,
      exported_at: isStr(data.exported_at) ? data.exported_at : '',
      trip,
      items: (data.items as FileItem[]).map(fileAirport),
      places: places as SavedPlace[],
      ...(packing ? { packing } : {}),
      attachments: data.attachments as FilePayload[],
      ...(journalPhotoData.length ? { journal_photos: journalPhotoData as FilePayload[] } : {}),
    },
  };
}

/** Reads the text of a picked file: size check, JSON, then parseTripFile. */
export function parseTripFileText(text: string): ParseResult {
  if (text.length > MAX_TRIP_FILE_CHARS) return { ok: false, error: 'too-large' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'format' };
  }
  return parseTripFile(data);
}

// ---- importing ----

/** A file to write for the imported trip: its new attachment id and the bytes (and crop bytes) to save. */
export type ImportFile = { attachmentId: string; name: string; mime: string; data_base64: string; crop_base64?: string };
export type Imported = {
  /** The new trip. Attachment uris are empty until the UI has written the files (then call withFiles). */
  trip: Trip;
  packing: PackList | null;
  files: ImportFile[];
  /** T68: journal photos to write (then withJournalFiles); empty when the file carried none. */
  journalFiles: ImportJournalPhoto[];
  /** T68: journal photos that weren't in the file (they stayed on the sender's phone): the import notice. */
  journalPhotosLeftOut: number;
};

/**
 * Turns a checked file into a new trip with new ids for everything (never the ids in the file), references
 * remapped. Demo and sample flags are kept, so sample data stays labelled.
 */
export function importTripFile(file: TripFile, newId: (prefix: string) => string, now = new Date().toISOString()): Imported {
  const tripId = newId('trip');
  const attIds = new Map<string, string>();
  const placeIds = new Map<string, string>();
  const remapPlace = <P extends Place>(p: P | undefined): P | undefined => {
    if (!p) return p;
    let id = placeIds.get(p.id);
    if (!id) {
      id = newId('place');
      placeIds.set(p.id, id);
    }
    return { ...p, id };
  };
  const byPayload = new Map(file.attachments.map((p) => [p.id, p]));
  const files: ImportFile[] = [];
  const items: Item[] = file.items.map((it) => {
    const { attachments: refs, from, to, place, ...fields } = it;
    const attachments: Attachment[] = refs.map((r) => {
      const id = newId('att');
      attIds.set(r.id, id);
      const p = byPayload.get(r.id);
      if (p) files.push({ attachmentId: id, name: r.name, mime: r.mime, data_base64: p.data_base64, ...(p.crop_base64 ? { crop_base64: p.crop_base64 } : {}) });
      const { hasCrop, ...meta } = r;
      // qrCropUri is filled by withFiles once the files are written ('' marks "crop is the main file").
      return { ...meta, id, uri: '', ...(hasCrop ? { qrCropUri: '' } : {}) };
    });
    const out: Item = { ...fields, id: newId('item'), tripId, attachments };
    const f = remapPlace(from);
    const tt = remapPlace(to);
    const pl = remapPlace(place);
    if (f) out.from = f;
    if (tt) out.to = tt;
    if (pl) out.place = pl;
    return out;
  });
  // Saved places are separate pins: each gets its own new id.
  const savedIds = new Map<string, string>();
  const places: SavedPlace[] = file.places.map((p) => {
    const id = newId('place');
    savedIds.set(p.id, id);
    return { ...p, id };
  });
  const { journal: fileJournal, ...tripFields } = file.trip;
  const trip: Trip = { ...tripFields, id: tripId, items, places, createdAt: now };
  // T64: journal pages get new ids and point at the imported places' new ids. T68: photos the file carries come
  // with them; the rest stayed on the sender's phone and are counted for the import notice.
  const photoBytes = new Map((file.journal_photos ?? []).map((p) => [p.id, p.data_base64]));
  const { journal, files: journalFiles } = importJournalFile(fileJournal, newId, savedIds, photoBytes);
  if (journal) trip.journal = journal;
  // T81: ideas get new ids too (their map spots are coordinates, so nothing to remap).
  const ideas = importIdeas(file.trip.ideas, newId);
  if (ideas) trip.ideas = ideas;
  else delete trip.ideas;
  // T93: to-dos get new ids; suggestion ticks are keyed by what they are about, so nothing to remap.
  const todos = importTodos(file.trip.todos, newId);
  if (todos) trip.todos = todos;
  else delete trip.todos;
  // T54: expenses get new ids like everything else.
  if (file.trip.expenses) trip.expenses = file.trip.expenses.map((e) => ({ ...e, id: newId('exp') }));
  const packing: PackList | null = file.packing
    ? { ...file.packing, tripId, items: file.packing.items.map((i) => ({ ...i, id: newId('pack') })) }
    : null;
  return { trip, packing, files, journalFiles, journalPhotosLeftOut: fileJournalPhotos(fileJournal) };
}

/** The imported trip with the written file paths filled in. Attachments whose file couldn't be written are dropped. */
export function withFiles(trip: Trip, written: Record<string, { uri: string; cropUri?: string } | undefined>): Trip {
  return {
    ...trip,
    items: trip.items.map((item) => ({
      ...item,
      attachments: item.attachments.flatMap((a): Attachment[] => {
        const w = written[a.id];
        if (!w) return [];
        const { qrCropUri, ...rest } = a;
        if (qrCropUri === undefined) return [{ ...rest, uri: w.uri }];
        return [{ ...rest, uri: w.uri, qrCropUri: w.cropUri ?? w.uri }];
      }),
    })),
  };
}

// ---- names on import (T45) ----

/**
 * The name for an imported trip: unchanged when no trip on the phone has it (compared trimmed, ignoring case),
 * otherwise the first free '<name> (copy)', '<name> (copy 2)', ... from `copyName` (the UI passes catalogue strings).
 */
export function uniqueTripName(name: string, existing: readonly string[], copyName: (name: string, n: number) => string): string {
  const key = (s: string) => s.trim().toLocaleLowerCase();
  const taken = new Set(existing.map(key));
  if (!taken.has(key(name))) return name;
  for (let n = 1; n < 10000; n++) {
    const candidate = copyName(name, n);
    if (!taken.has(key(candidate))) return candidate;
  }
  return copyName(name, Date.now());
}
