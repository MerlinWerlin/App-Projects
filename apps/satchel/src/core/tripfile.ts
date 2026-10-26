// .satchel trip files (PLAN §2 "trip sharing by exporting a .satchel file"; EDGE_CASES "Trip export and import").
// A trip file is one JSON object: the trip, its bookings, its saved places (FLOWS §11.2), its packing list when it
// has one, and the bytes of the bookings' attachments as base64. Pure TypeScript: the UI reads and writes files.
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
import type { PackItem, PackList } from './packing.ts';
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
export type FileTrip = Omit<Trip, 'items' | 'places'>;
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
};

/** Why a file was refused. 'format': not a Satchel trip; 'version': made by a newer Satchel; 'damaged': fails a check; 'too-large'. */
export type TripFileError = 'format' | 'version' | 'damaged' | 'too-large';
export type ParseResult = { ok: true; file: TripFile } | { ok: false; error: TripFileError; detail?: string };

/** Base64 bytes read from the device for an attachment, keyed by attachment id. A missing entry drops that attachment. */
export type Payloads = Record<string, { data: string; crop?: string } | undefined>;

export type BuildResult = { file: TripFile; /** Attachments left out because their file couldn't be read. */ skipped: number };

/** Builds the file for one trip. Only that trip, its items, places, packing list and attachments are read. */
export function buildTripFile(trip: Trip, payloads: Payloads, opts: { packing?: PackList | null; now?: string } = {}): BuildResult {
  const { items: _items, places: _places, ...rest } = trip;
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
      refs.push({ id: a.id, name: a.name, mime: a.mime, role: a.role, ...(hasCrop || cropSame ? { hasCrop: true } : {}) });
      attachments.push({ id: a.id, name: a.name, mime: a.mime, data_base64: p.data, ...(hasCrop ? { crop_base64: p.crop } : {}) });
    }
    const { attachments: _a, ...fields } = item;
    return { ...fields, tripId: trip.id, attachments: refs };
  });
  const file: TripFile = {
    format: TRIP_FILE_FORMAT,
    version: TRIP_FILE_VERSION,
    exported_at: opts.now ?? new Date().toISOString(),
    trip: rest,
    items,
    places: trip.places ?? [],
    attachments,
  };
  if (opts.packing && opts.packing.tripId === trip.id) {
    const { tripId: _t, ...packing } = opts.packing;
    file.packing = packing;
  }
  return { file, skipped };
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

const damaged = (detail: string): ParseResult => ({ ok: false, error: 'damaged', detail });

/** Checks a decoded JSON value in full. Nothing about it is trusted until this says ok. */
export function parseTripFile(data: unknown): ParseResult {
  if (!isObj(data) || data.format !== TRIP_FILE_FORMAT) return { ok: false, error: 'format' };
  if (!isNum(data.version) || !Number.isInteger(data.version) || data.version < 1) return damaged('version');
  if (data.version > TRIP_FILE_VERSION) return { ok: false, error: 'version' };
  const t = data.trip;
  if (!isObj(t) || !isStr(t.name) || !isDate(t.startDate) || !isDate(t.endDate)) return damaged('trip');
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
  let packing: TripFile['packing'];
  if (data.packing !== undefined) {
    const p = data.packing;
    if (!isObj(p) || !Array.isArray(p.items) || p.items.length > MAX_ROWS || !p.items.every(isPackItem)) return damaged('packing');
    packing = p as unknown as TripFile['packing'];
  }
  const { items: _i, places: _p, demo, ...tripFields } = t;
  const trip: FileTrip = {
    ...(tripFields as unknown as FileTrip),
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
      items: data.items as FileItem[],
      places: places as SavedPlace[],
      ...(packing ? { packing } : {}),
      attachments: data.attachments as FilePayload[],
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
  const places: SavedPlace[] = file.places.map((p) => ({ ...p, id: newId('place') }));
  const trip: Trip = { ...file.trip, id: tripId, items, places, createdAt: now };
  const packing: PackList | null = file.packing
    ? { ...file.packing, tripId, items: file.packing.items.map((i) => ({ ...i, id: newId('pack') })) }
    : null;
  return { trip, packing, files };
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
