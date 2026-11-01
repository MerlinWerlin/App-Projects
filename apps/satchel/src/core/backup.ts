// Backup and restore (T17, owner-1101s-5): one versioned `.satchelbackup` file so changing phones never loses trips.
// Pure TypeScript (no React Native): the device side (src/native/backup.ts) lists AsyncStorage and the files, this
// module decides what goes in, writes the JSON text in parts (one file's base64 at a time), checks a picked file and
// plans a Merge or a Replace. See docs/BACKUP.md.
//
// File shape (JSON, version 1):
//   { format: 'satchel-backup', version: 1, app: '0.1.0', created: ISO, docDir: string | null,
//     includesDocuments: boolean, keys: { 'satchel.trips.v1': '<stored text>', ... },
//     files: [{ path: 'attachments/a1-pass.pdf', size, sha256, data: '<base64>' }, ...], counts: {...} }
// `keys` holds every AsyncStorage key with the `satchel.` prefix, value as stored (text), except the transient ones
// below. Vault documents (key and vault/ files) only when "Include documents" is on.
import { base64ToBytes } from './tar.ts';
import { addDays } from './tz.ts';

export const BACKUP_FORMAT = 'satchel-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_EXT = '.satchelbackup';
export const BACKUP_MIME = 'application/json';
export const KEY_PREFIX = 'satchel.';
/** Above this the screens warn first (the file is read and written in memory on the phone). */
export const LARGE_BACKUP_BYTES = 100 * 1024 * 1024;

/** This phone's own backup record (last date, the documents switch, dismissed reminders). Never in a backup. */
export const BACKUP_STATE_KEY = 'satchel.backup.v1';
export const TRIPS_KEY = 'satchel.trips.v1';
export const VAULT_KEY = 'satchel.vault.v1';

/** Keys never backed up: caches, this phone's recovery copy and its backup record. */
export const TRANSIENT_KEYS: readonly string[] = [
  'satchel.trips.v1.unreadable', // recovery copy of a damaged list, this phone only
  BACKUP_STATE_KEY,
];
/** Key prefixes never backed up (downloaded or re-fetchable caches). */
export const TRANSIENT_PREFIXES: readonly string[] = [
  'satchel.weather.v1.', // forecast cache per place (src/core/weather.ts cacheKey); fetched again when online
];
/** Keys that hold the documents vault (passport, visa, licence copies): only with "Include documents". */
export const DOCUMENT_KEYS: readonly string[] = [VAULT_KEY];
/** Document folders under <documents>/ backed up: attachments always, vault only with "Include documents". */
export const FILE_FOLDERS = ['attachments', 'vault'] as const;
export const DOCUMENT_FOLDERS: readonly string[] = ['vault'];
/** Not backed up (re-downloadable): offline city map packs and their catalog live in <documents>/maps/. */
export const EXCLUDED_FOLDERS: readonly string[] = ['maps'];

export type BackupState = { lastAt?: string; includeDocuments: boolean; dismissed: string[] };
export const DEFAULT_BACKUP_STATE: BackupState = { includeDocuments: false, dismissed: [] };

export function normaliseBackupState(raw: unknown): BackupState {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: BackupState = {
    includeDocuments: o.includeDocuments === true,
    dismissed: Array.isArray(o.dismissed) ? o.dismissed.filter((x): x is string => typeof x === 'string').slice(-50) : [],
  };
  if (typeof o.lastAt === 'string' && !Number.isNaN(Date.parse(o.lastAt))) out.lastAt = o.lastAt;
  return out;
}

export const isDocumentKey = (key: string) => DOCUMENT_KEYS.includes(key);
export const isTransientKey = (key: string) => TRANSIENT_KEYS.includes(key) || TRANSIENT_PREFIXES.some((p) => key.startsWith(p));

/** True when `key` goes into a backup made with this documents setting. */
export function shouldBackUpKey(key: string, includeDocuments: boolean): boolean {
  if (!key.startsWith(KEY_PREFIX) || isTransientKey(key)) return false;
  return includeDocuments || !isDocumentKey(key);
}

/** A safe relative path ('attachments/x.pdf') inside one of the backed-up folders, else null. */
export function cleanFilePath(path: unknown): string | null {
  if (typeof path !== 'string' || !path || path.length > 300) return null;
  const parts = path.split('/');
  if (parts.length < 2 || parts.some((p) => !p || p === '.' || p === '..') || path.includes('\\')) return null;
  return (FILE_FOLDERS as readonly string[]).includes(parts[0]) ? path : null;
}

export function shouldBackUpFile(path: string, includeDocuments: boolean): boolean {
  const p = cleanFilePath(path);
  if (!p) return false;
  return includeDocuments || !DOCUMENT_FOLDERS.includes(p.split('/')[0]);
}

// ---- SHA-256 (pure, for the per-file check) ----

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Lower-case hex SHA-256 of the bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const len = bytes.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const tail = new Uint8Array(total - Math.floor(len / 64) * 64);
  const tailStart = Math.floor(len / 64) * 64;
  tail.set(bytes.subarray(tailStart));
  tail[len - tailStart] = 0x80;
  const bits = len * 8;
  const dv = new DataView(tail.buffer);
  dv.setUint32(tail.length - 8, Math.floor(bits / 0x100000000));
  dv.setUint32(tail.length - 4, bits >>> 0);
  const block = (src: Uint8Array, off: number) => {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = ((src[j] << 24) | (src[j + 1] << 16) | (src[j + 2] << 8) | src[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  };
  for (let off = 0; off < tailStart; off += 64) block(bytes, off);
  for (let off = 0; off < tail.length; off += 64) block(tail, off);
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}

// ---- building ----

export type BackupFile = { path: string; size: number; sha256: string; data: string };
export type BackupCounts = { trips: number; items: number; files: number; documents: number; keys: number; bytes: number };
export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: string;
  created: string;
  /** The documents folder on the phone that made it, so stored file paths can be moved onto the new phone's. */
  docDir: string | null;
  includesDocuments: boolean;
  keys: Record<string, string>;
  files: BackupFile[];
  counts: BackupCounts;
};
export type BackupMeta = { app: string; created: string; docDir: string | null; includeDocuments: boolean };

/** One file entry with its size and checksum; null when the base64 isn't valid or the path isn't ours. */
export function fileEntry(path: string, base64: string): BackupFile | null {
  const p = cleanFilePath(path);
  const bytes = base64ToBytes(base64);
  if (!p || !bytes) return null;
  return { path: p, size: bytes.length, sha256: sha256Hex(bytes), data: base64 };
}

/** The keys that go in, sorted, from the stored [key, value] pairs (null values are skipped). */
export function pickKeys(entries: readonly (readonly [string, string | null])[], includeDocuments: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of [...entries].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (typeof v === 'string' && shouldBackUpKey(k, includeDocuments)) out[k] = v;
  }
  return out;
}

const parseJson = (s: string | undefined): unknown => {
  if (s == null) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};

export function countBackup(keys: Record<string, string>, files: readonly { size: number }[]): BackupCounts {
  const trips = parseJson(keys[TRIPS_KEY]);
  const list = Array.isArray(trips) ? trips : [];
  const items = list.reduce((n: number, t) => n + (t && typeof t === 'object' && Array.isArray((t as { items?: unknown }).items) ? (t as { items: unknown[] }).items.length : 0), 0);
  const vault = parseJson(keys[VAULT_KEY]);
  return {
    trips: list.length,
    items,
    files: files.length,
    documents: Array.isArray(vault) ? vault.length : 0,
    keys: Object.keys(keys).length,
    bytes: files.reduce((n, f) => n + f.size, 0),
  };
}

/** The whole backup as one object (tests, small backups). The device writes it in parts with backupParts. */
export function buildBackup(meta: BackupMeta, entries: readonly (readonly [string, string | null])[], files: readonly { path: string; base64: string }[]): Backup {
  const keys = pickKeys(entries, meta.includeDocuments);
  const list: BackupFile[] = [];
  for (const f of files) {
    if (!shouldBackUpFile(f.path, meta.includeDocuments)) continue;
    const e = fileEntry(f.path, f.base64);
    if (e) list.push(e);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: meta.app,
    created: meta.created,
    docDir: meta.docDir,
    includesDocuments: meta.includeDocuments,
    keys,
    files: list,
    counts: countBackup(keys, list),
  };
}

/**
 * The file text in parts, so the device appends one file's base64 at a time instead of holding every file in one
 * string: head() first, then file(entry, index) for each file, then tail(entries). Joined, it is the same JSON as
 * serializeBackup(buildBackup(...)).
 */
export const backupParts = {
  head(meta: BackupMeta, keys: Record<string, string>): string {
    const h = { format: BACKUP_FORMAT, version: BACKUP_VERSION, app: meta.app, created: meta.created, docDir: meta.docDir, includesDocuments: meta.includeDocuments, keys };
    return `${JSON.stringify(h).slice(0, -1)},"files":[`;
  },
  file(entry: BackupFile, index: number): string {
    return `${index ? ',' : ''}${JSON.stringify(entry)}`;
  },
  tail(keys: Record<string, string>, files: readonly { size: number }[]): string {
    return `],"counts":${JSON.stringify(countBackup(keys, files))}}`;
  },
};

export function serializeBackup(b: Backup): string {
  const meta: BackupMeta = { app: b.app, created: b.created, docDir: b.docDir, includeDocuments: b.includesDocuments };
  return backupParts.head(meta, b.keys) + b.files.map((f, i) => backupParts.file(f, i)).join('') + backupParts.tail(b.keys, b.files);
}

/** '2026-11-01' style day stamp for the file name: Satchel backup 2026-11-01.satchelbackup */
export const backupFileName = (createdIso: string) => `Satchel backup ${createdIso.slice(0, 10)}${BACKUP_EXT}`;

// ---- reading ----

export type BackupFailure = 'not-backup' | 'newer' | 'damaged';
export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; reason: BackupFailure };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Checks a picked file. Not JSON or not a Satchel backup: 'not-backup' (a .satchel trip file says so too); a later
 * version: 'newer' (nothing is guessed); a backup whose parts don't add up (missing fields, a key outside satchel.,
 * a file whose bytes don't match its size or checksum): 'damaged'.
 */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // A cut-off backup still starts like one: call it damaged rather than "not a backup".
    return { ok: false, reason: /^\s*\{\s*"format"\s*:\s*"satchel-backup"/.test(text) ? 'damaged' : 'not-backup' };
  }
  if (!isObj(data) || data.format !== BACKUP_FORMAT) return { ok: false, reason: 'not-backup' };
  if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1) return { ok: false, reason: 'damaged' };
  if (data.version > BACKUP_VERSION) return { ok: false, reason: 'newer' };
  if (typeof data.created !== 'string' || Number.isNaN(Date.parse(data.created)) || !isObj(data.keys) || !Array.isArray(data.files)) return { ok: false, reason: 'damaged' };
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(data.keys)) {
    if (!k.startsWith(KEY_PREFIX) || typeof v !== 'string') return { ok: false, reason: 'damaged' };
    if (!isTransientKey(k)) keys[k] = v;
  }
  const files: BackupFile[] = [];
  const seen = new Set<string>();
  for (const f of data.files) {
    if (!isObj(f) || typeof f.data !== 'string' || typeof f.size !== 'number' || typeof f.sha256 !== 'string') return { ok: false, reason: 'damaged' };
    const p = cleanFilePath(f.path);
    if (!p || seen.has(p)) return { ok: false, reason: 'damaged' };
    const bytes = base64ToBytes(f.data);
    if (!bytes || bytes.length !== f.size || sha256Hex(bytes) !== f.sha256.toLowerCase()) return { ok: false, reason: 'damaged' };
    seen.add(p);
    files.push({ path: p, size: f.size, sha256: f.sha256.toLowerCase(), data: f.data });
  }
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: data.version,
      app: typeof data.app === 'string' ? data.app : '',
      created: data.created,
      docDir: typeof data.docDir === 'string' ? data.docDir : null,
      includesDocuments: data.includesDocuments === true,
      keys,
      files,
      counts: countBackup(keys, files),
    },
  };
}

export type BackupPreview = { created: string; app: string; includesDocuments: boolean } & BackupCounts;
export const backupPreview = (b: Backup): BackupPreview => ({ created: b.created, app: b.app, includesDocuments: b.includesDocuments, ...countBackup(b.keys, b.files) });

// ---- restoring ----

export type RestoreMode = 'merge' | 'replace';
export type RestorePlan = {
  /** Keys to write, value as text. */
  set: Record<string, string>;
  /** Keys to delete (Replace only: phone keys the backup doesn't have). */
  remove: string[];
  /** Files to write under <documents>/ (relative path + base64). */
  files: { path: string; data: string }[];
};

/** Stored file paths from the old phone's documents folder moved onto this phone's (iOS gives each install its own). */
export function moveDocPaths(value: string, from: string | null, to: string | null): string {
  if (!from || !to || from === to) return value;
  // Stored values are JSON text: the folder appears as-is (no characters in a file URI need escaping) or with
  // escaped slashes; replace both spellings.
  const esc = (s: string) => s.replace(/\//g, '\\/');
  return value.split(from).join(to).split(esc(from)).join(esc(to));
}

const hasId = (v: unknown): v is { id: string } => isObj(v) && typeof v.id === 'string';
const isIdList = (v: unknown): v is { id: string }[] => Array.isArray(v) && v.length > 0 && v.every(hasId);

/** The newer of two same-id records by updatedAt when both carry one; otherwise the incoming one. */
function pickNewer(local: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const a = typeof local.updatedAt === 'string' ? Date.parse(local.updatedAt) : NaN;
  const b = typeof incoming.updatedAt === 'string' ? Date.parse(incoming.updatedAt) : NaN;
  if (!Number.isNaN(a) && !Number.isNaN(b) && a > b) return local;
  return incoming;
}

/**
 * Merge of two stored values: lists of records with ids keep both sides by id (same id: newer updatedAt, else the
 * incoming); objects merge key by key; anything else takes the incoming value.
 */
export function mergeValue(local: unknown, incoming: unknown): unknown {
  if (local === undefined) return incoming;
  if (incoming === undefined) return local;
  const emptyList = (v: unknown) => Array.isArray(v) && v.length === 0;
  if ((isIdList(local) || emptyList(local)) && (isIdList(incoming) || emptyList(incoming)) && !(emptyList(local) && emptyList(incoming))) {
    const loc = local as { id: string }[];
    const inc = incoming as { id: string }[];
    const byId = new Map(inc.map((x) => [x.id, x] as const));
    const out = loc.map((x) => {
      const y = byId.get(x.id);
      return y ? pickNewer(x as Record<string, unknown>, y as Record<string, unknown>) : x;
    });
    const have = new Set(loc.map((x) => x.id));
    for (const y of inc) if (!have.has(y.id)) out.push(y);
    return out;
  }
  if (isObj(local) && isObj(incoming)) {
    const out: Record<string, unknown> = { ...local };
    for (const [k, v] of Object.entries(incoming)) out[k] = k in local ? mergeValue(local[k], v) : v;
    return out;
  }
  return incoming;
}

/** Merge of one stored text value (JSON when both sides parse, else the incoming text). */
export function mergeStored(local: string | undefined, incoming: string): string {
  if (local == null || local === incoming) return incoming;
  let a: unknown;
  let b: unknown;
  try {
    a = JSON.parse(local);
    b = JSON.parse(incoming);
  } catch {
    return incoming;
  }
  return JSON.stringify(mergeValue(a, b));
}

/**
 * What a restore writes. `current`: this phone's satchel.* keys now. Merge keeps both sides; Replace makes the
 * phone match the backup, except the documents vault is left alone when the backup has no documents, and caches
 * and this phone's backup record are never touched.
 */
export function planRestore(b: Backup, current: Record<string, string>, mode: RestoreMode, docDir: string | null): RestorePlan {
  const set: Record<string, string> = {};
  for (const [k, raw] of Object.entries(b.keys)) {
    if (isTransientKey(k)) continue;
    const v = moveDocPaths(raw, b.docDir, docDir);
    const next = mode === 'merge' ? mergeStored(current[k], v) : v;
    if (current[k] !== next) set[k] = next;
  }
  const remove =
    mode === 'replace'
      ? Object.keys(current)
          .filter((k) => k.startsWith(KEY_PREFIX) && !isTransientKey(k) && !(k in b.keys) && (b.includesDocuments || !isDocumentKey(k)))
          .sort()
      : [];
  return { set, remove, files: b.files.map((f) => ({ path: f.path, data: f.data })) };
}

// ---- the gentle reminder ----

export const REMINDER_TRIP_DAYS = 7;
export const REMINDER_STALE_DAYS = 30;

/**
 * The trip the one-line reminder is about: the first own (non-demo) trip starting within 7 days, when there has
 * been no backup in the last 30 days and the line wasn't dismissed for that trip. Else null.
 */
export function backupReminderTrip<T extends { id: string; startDate: string; demo?: boolean }>(trips: readonly T[], state: BackupState, today: string, nowMs: number): T | null {
  if (state.lastAt && nowMs - Date.parse(state.lastAt) < REMINDER_STALE_DAYS * 86_400_000) return null;
  const last = addDays(today, REMINDER_TRIP_DAYS);
  const soon = trips
    .filter((t) => !t.demo && t.startDate >= today && t.startDate <= last && !state.dismissed.includes(t.id))
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  return soon[0] ?? null;
}
