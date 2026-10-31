// Trip journal (T64, owner feedback "less bland, deepen each tab"): a per-day travel diary on a trip. Each entry is
// a short note, up to six photos copied into Satchel (never uploaded), an optional saved place from the trip, and a
// mood and weather picked from icon chips. Pure logic only: add / edit / delete, the day an entry belongs to (in
// the zone the traveller is in on the trip, not the phone's zone), grouping by trip day, the photo cap, and the
// .satchel file side (text, plus the photos' bytes only when the sender asks; the file records how many were left out).
// src/native/journal.ts copies photos; app/journal/[tripId].tsx and app/journal-edit.tsx show it. No RN imports.
import type { LocalDate, SavedPlace, Trip } from './model.ts';
import { sortItems, span, zonesReadable } from './timeline.ts';
import { daysBetween, fromUtc, isLocalDateTime, isValidZone, localDate } from './tz.ts';

export const JOURNAL_MOODS = ['joyful', 'relaxed', 'adventurous', 'grateful', 'tired', 'meh'] as const;
export type JournalMood = (typeof JOURNAL_MOODS)[number];
export const JOURNAL_WEATHER = ['sunny', 'partly', 'cloudy', 'rain', 'storm', 'snow'] as const;
export type JournalWeather = (typeof JOURNAL_WEATHER)[number];

/** Photos per entry (the task's cap). */
export const MAX_JOURNAL_PHOTOS = 6;
/** A short note: longer text is cut here (characters). */
export const MAX_JOURNAL_NOTE = 4000;
/** Entries per trip a file may carry. */
export const MAX_JOURNAL_ENTRIES = 2000;

/** A photo copied into Satchel's documents folder (attachments/), local only. */
export type JournalPhoto = { id: string; uri: string; name: string; mime: string; size?: number };

export type JournalEntry = {
  id: string;
  /** The trip day the page is for, in the zone the traveller was in. */
  day: LocalDate;
  note: string;
  photos: JournalPhoto[];
  /** A SavedPlace id on the same trip. */
  placeId?: string;
  mood?: JournalMood;
  weather?: JournalWeather;
  createdAt: string;
  updatedAt?: string;
};

export const isMood = (x: unknown): x is JournalMood => typeof x === 'string' && (JOURNAL_MOODS as readonly string[]).includes(x);
export const isWeather = (x: unknown): x is JournalWeather => typeof x === 'string' && (JOURNAL_WEATHER as readonly string[]).includes(x);

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isDate = (x: unknown): x is LocalDate => isStr(x) && /^\d{4}-\d{2}-\d{2}$/.test(x) && isLocalDateTime(`${x}T00:00`);

/** The trip's journal, read defensively (absent on older trips; malformed rows are skipped). */
export function readJournal(trip: Pick<Trip, 'journal'>): JournalEntry[] {
  const list = (trip as { journal?: unknown }).journal;
  if (!Array.isArray(list)) return [];
  return list.filter((e): e is JournalEntry => isObj(e) && isStr(e.id) && isDate(e.day) && isStr(e.note) && Array.isArray(e.photos));
}

// ---- where the traveller is ----

/**
 * The zone the traveller is in at `utc` on this trip: the arrival zone of the last journey that has landed, else the
 * zone of the last booking that has started, else the trip's home zone. Unreadable zones are skipped.
 */
export function tripZoneAt(trip: Trip, utc: number): string {
  let zone = isValidZone(trip.homeTz) ? trip.homeTz : 'UTC';
  for (const it of sortItems(trip.items ?? [])) {
    if (!zonesReadable(it)) continue;
    const s = span(it);
    if (s.start > utc) break;
    if (it.end && s.end <= utc) zone = it.end.tz;
    else if (it.end && it.end.tz !== it.start.tz) continue; // still travelling: keep the zone you left from
    else zone = it.start.tz;
  }
  return zone;
}

/** Today's date where the traveller is on this trip. */
export const journalToday = (trip: Trip, now = Date.now()): LocalDate => localDate(fromUtc(now, tripZoneAt(trip, now)));

/** The day a new page goes on: today when the trip is on, else its first day (or last, once it's over). */
export function defaultJournalDay(trip: Trip, now = Date.now()): LocalDate {
  const today = journalToday(trip, now);
  if (today < trip.startDate) return trip.startDate;
  if (today > trip.endDate) return trip.endDate;
  return today;
}

/** True while the trip is on (in the traveller's zone): the trip screen shows the "Today's page" prompt. */
export function showTodayPrompt(trip: Trip, now = Date.now()): boolean {
  const today = journalToday(trip, now);
  return today >= trip.startDate && today <= trip.endDate;
}

// ---- editing ----

export type JournalDraft = { day: LocalDate; note: string; photos: JournalPhoto[]; placeId?: string; mood?: JournalMood; weather?: JournalWeather };
export type JournalError = 'empty' | 'day' | 'photos';

export const newJournalDraft = (day: LocalDate): JournalDraft => ({ day, note: '', photos: [] });

export function draftFromEntry(e: JournalEntry): JournalDraft {
  return { day: e.day, note: e.note, photos: [...e.photos], placeId: e.placeId, mood: e.mood, weather: e.weather };
}

/** Problems with a draft: a page needs something on it, a real day, and at most six photos. */
export function validateJournal(d: JournalDraft): JournalError[] {
  const out: JournalError[] = [];
  if (!isDate(d.day)) out.push('day');
  if (d.photos.length > MAX_JOURNAL_PHOTOS) out.push('photos');
  if (!d.note.trim() && !d.photos.length && !d.mood && !d.weather && !d.placeId) out.push('empty');
  return out;
}

/** How many more photos a draft can take. */
export const photosLeft = (photos: readonly JournalPhoto[]) => Math.max(0, MAX_JOURNAL_PHOTOS - photos.length);

/** Adds photos up to the cap; `added` are the ones kept and `refused` the ones over it (their copies should go). */
export function addPhotos(photos: readonly JournalPhoto[], more: readonly JournalPhoto[]): { photos: JournalPhoto[]; added: JournalPhoto[]; refused: JournalPhoto[] } {
  const room = photosLeft(photos);
  const added = more.slice(0, room);
  return { photos: [...photos, ...added], added, refused: more.slice(room) };
}

export const removePhoto = (photos: readonly JournalPhoto[], id: string): JournalPhoto[] => photos.filter((p) => p.id !== id);

/** The entry a draft saves as (new when `prev` is absent). The note is trimmed and capped; the photo list capped. */
export function entryFromDraft(d: JournalDraft, newId: (prefix: string) => string, prev?: JournalEntry, now = new Date().toISOString()): JournalEntry {
  const out: JournalEntry = {
    id: prev?.id ?? newId('jrnl'),
    day: d.day,
    note: d.note.trim().slice(0, MAX_JOURNAL_NOTE),
    photos: d.photos.slice(0, MAX_JOURNAL_PHOTOS),
    createdAt: prev?.createdAt ?? now,
  };
  if (prev) out.updatedAt = now;
  if (d.placeId) out.placeId = d.placeId;
  if (d.mood && isMood(d.mood)) out.mood = d.mood;
  if (d.weather && isWeather(d.weather)) out.weather = d.weather;
  return out;
}

/** The trip with `entry` added, or replacing the entry with the same id. */
export function upsertEntry(trip: Trip, entry: JournalEntry): Trip {
  const list = readJournal(trip);
  const i = list.findIndex((e) => e.id === entry.id);
  return { ...trip, journal: i < 0 ? [...list, entry] : list.map((e, n) => (n === i ? entry : e)) };
}

export function removeEntry(trip: Trip, id: string): Trip {
  return { ...trip, journal: readJournal(trip).filter((e) => e.id !== id) };
}

export const findEntry = (trip: Trip, id: string): JournalEntry | undefined => readJournal(trip).find((e) => e.id === id);

/** Photo files no longer listed after a change from `before` to `after` (delete these once saved). */
export function droppedPhotos(before: readonly JournalPhoto[], after: readonly JournalPhoto[]): string[] {
  const keep = new Set(after.map((p) => p.uri));
  return [...new Set(before.map((p) => p.uri))].filter((u) => !keep.has(u));
}

/** Every photo file in the trip's journal (for clean-up when the trip goes). */
export function journalFiles(trip: Pick<Trip, 'journal'>): string[] {
  return [...new Set(readJournal(trip).flatMap((e) => e.photos.map((p) => p.uri)))];
}

/** The saved place an entry points at, if it is still on the trip. */
export function entryPlace(trip: Trip, e: JournalEntry): SavedPlace | undefined {
  return e.placeId ? (trip.places ?? []).find((p) => p.id === e.placeId) : undefined;
}

// ---- the Journal screen ----

export type JournalDay = {
  day: LocalDate;
  /** 1-based day of the trip, or null for a page outside the trip's dates (dates changed after writing). */
  dayNumber: number | null;
  /** Which colour the day header takes (cycles through the palette; the UI maps it to theme gradients). */
  tone: number;
  entries: JournalEntry[];
  photoCount: number;
};

/** Pages grouped by trip day, days in date order, pages in the order they were written. */
export function groupJournal(trip: Trip, tones = 4): JournalDay[] {
  const byDay = new Map<LocalDate, JournalEntry[]>();
  for (const e of readJournal(trip)) {
    const list = byDay.get(e.day);
    if (list) list.push(e);
    else byDay.set(e.day, [e]);
  }
  return [...byDay.keys()].sort().map((day) => {
    const entries = byDay.get(day)!.slice().sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
    const inTrip = day >= trip.startDate && day <= trip.endDate;
    const dayNumber = inTrip ? daysBetween(trip.startDate, day) + 1 : null;
    const n = dayNumber ?? Math.abs(daysBetween(trip.startDate, day)) + 1;
    return { day, dayNumber, tone: (n - 1) % Math.max(1, tones), entries, photoCount: entries.reduce((s, e) => s + e.photos.length, 0) };
  });
}

/** Summary numbers for the Journal header and the trip screen prompt. */
export function journalStats(trip: Trip): { entries: number; days: number; photos: number } {
  const list = readJournal(trip);
  return { entries: list.length, days: new Set(list.map((e) => e.day)).size, photos: list.reduce((s, e) => s + e.photos.length, 0) };
}

/** Today's pages (where the traveller is). */
export const entriesOn = (trip: Trip, day: LocalDate): JournalEntry[] => readJournal(trip).filter((e) => e.day === day);

// ---- .satchel files: text, and photos only when asked (T68) ----

/** A photo carried in a trip file (T68, "Include journal photos"): its bytes are in the file's journal_photos. */
export type FileJournalPhoto = { id: string; name: string; mime: string; size?: number };

/**
 * A page as written to a trip file: no device paths. `photoFiles` lists the photos whose bytes travel in the file
 * (only when the sender turned on "Include journal photos"); `photoCount` is how many stayed on the sender's phone.
 */
export type FileJournalEntry = Omit<JournalEntry, 'photos'> & { photoCount?: number; photoFiles?: FileJournalPhoto[] };

/**
 * The journal for a trip file. Photos whose id is in `included` are listed in photoFiles (their bytes go in the
 * file separately); every other photo only counts towards photoCount. Absent when the trip has no pages.
 */
export function journalForFile(trip: Pick<Trip, 'journal'>, included: ReadonlySet<string> = new Set()): FileJournalEntry[] | undefined {
  const list = readJournal(trip);
  if (!list.length) return undefined;
  return list.map(({ photos, ...rest }) => {
    const files: FileJournalPhoto[] = photos
      .filter((p) => included.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, mime: p.mime, ...(typeof p.size === 'number' ? { size: p.size } : {}) }));
    const left = photos.length - files.length;
    return { ...rest, ...(left ? { photoCount: left } : {}), ...(files.length ? { photoFiles: files } : {}) };
  });
}

/** Every journal photo on the trip, in page order (what "Include journal photos" would add to the file). */
export const journalPhotos = (trip: Pick<Trip, 'journal'>): JournalPhoto[] => readJournal(trip).flatMap((e) => e.photos);

/**
 * For the export size note: how many journal photos there are and their size in bytes. `unknown` counts photos
 * saved without a size (picked before sizes were recorded); the note then says "at least".
 */
export function journalPhotoSize(trip: Pick<Trip, 'journal'>): { count: number; bytes: number; unknown: number } {
  let bytes = 0;
  let unknown = 0;
  const all = journalPhotos(trip);
  for (const p of all) {
    if (typeof p.size === 'number' && Number.isFinite(p.size) && p.size > 0) bytes += p.size;
    else unknown++;
  }
  return { count: all.length, bytes, unknown };
}

const optStr = (x: unknown) => x === undefined || isStr(x);
const isFilePhoto = (x: unknown): x is FileJournalPhoto =>
  isObj(x) && isStr(x.id) && isStr(x.name) && isStr(x.mime) && (x.size === undefined || (typeof x.size === 'number' && Number.isFinite(x.size) && x.size >= 0));

/**
 * Checks a trip file's `journal` (absent on older files). Structure must be right in full (else the whole file is
 * refused); a mood or weather this version doesn't know is dropped on import rather than refusing the file.
 */
export function checkFileJournal(t: Record<string, unknown>): boolean {
  const j = t.journal;
  if (j === undefined) return true;
  if (!Array.isArray(j) || j.length > MAX_JOURNAL_ENTRIES) return false;
  const ids = new Set<string>();
  const photoIds = new Set<string>();
  for (const e of j) {
    if (!isObj(e) || !isStr(e.id) || !isDate(e.day) || !isStr(e.note) || !isStr(e.createdAt)) return false;
    if (!optStr(e.placeId) || !optStr(e.mood) || !optStr(e.weather) || !optStr(e.updatedAt)) return false;
    if (e.photoCount !== undefined && !(typeof e.photoCount === 'number' && Number.isInteger(e.photoCount) && e.photoCount >= 0)) return false;
    if (e.photoFiles !== undefined) {
      if (!Array.isArray(e.photoFiles) || e.photoFiles.length > MAX_JOURNAL_PHOTOS || !e.photoFiles.every(isFilePhoto)) return false;
      for (const p of e.photoFiles as FileJournalPhoto[]) {
        if (photoIds.has(p.id)) return false;
        photoIds.add(p.id);
      }
    }
    if (ids.has(e.id)) return false;
    ids.add(e.id);
  }
  return true;
}

/** The ids of the photos a checked file journal says it carries (each must have its bytes in the file). */
export const fileJournalPhotoIds = (list: readonly FileJournalEntry[] | undefined): string[] => (list ?? []).flatMap((e) => (e.photoFiles ?? []).map((p) => p.id));

/** A checked file journal, cleaned to known fields (unknown moods / weather dropped). */
export function readFileJournal(j: unknown): FileJournalEntry[] | undefined {
  if (!Array.isArray(j)) return undefined;
  return j.map((e: Record<string, unknown>) => {
    const out: FileJournalEntry = { id: e.id as string, day: e.day as LocalDate, note: (e.note as string).slice(0, MAX_JOURNAL_NOTE), createdAt: e.createdAt as string };
    if (isStr(e.updatedAt)) out.updatedAt = e.updatedAt;
    if (isStr(e.placeId)) out.placeId = e.placeId;
    if (isMood(e.mood)) out.mood = e.mood;
    if (isWeather(e.weather)) out.weather = e.weather;
    if (typeof e.photoCount === 'number' && e.photoCount > 0) out.photoCount = e.photoCount;
    if (Array.isArray(e.photoFiles) && e.photoFiles.length) {
      out.photoFiles = (e.photoFiles as FileJournalPhoto[]).map((p) => ({ id: p.id, name: p.name, mime: p.mime, ...(typeof p.size === 'number' ? { size: p.size } : {}) }));
    }
    return out;
  });
}

/** A journal photo to write on import: the new photo id and the bytes from the file. */
export type ImportJournalPhoto = { photoId: string; name: string; mime: string; data_base64: string };

/**
 * The imported journal: new ids, place links remapped to the imported places' new ids (a link to a place not in
 * the file is dropped). Photos the file carries (bytes in `photoBytes`, keyed by the file's photo id) come back
 * with new ids and an empty uri, listed in `files` for the UI to write (then withJournalFiles); the rest stayed on
 * the sender's phone.
 */
export function importJournalFile(
  list: readonly FileJournalEntry[] | undefined,
  newId: (prefix: string) => string,
  placeIds: ReadonlyMap<string, string>,
  photoBytes: ReadonlyMap<string, string> = new Map(),
): { journal: JournalEntry[] | undefined; files: ImportJournalPhoto[] } {
  const files: ImportJournalPhoto[] = [];
  if (!list) return { journal: undefined, files };
  const journal = list.map(({ photoCount: _n, photoFiles, placeId, ...rest }) => {
    const photos: JournalPhoto[] = [];
    for (const p of (photoFiles ?? []).slice(0, MAX_JOURNAL_PHOTOS)) {
      const data = photoBytes.get(p.id);
      if (data === undefined) continue;
      const id = newId('jph');
      files.push({ photoId: id, name: p.name, mime: p.mime, data_base64: data });
      photos.push({ id, uri: '', name: p.name, mime: p.mime, ...(typeof p.size === 'number' ? { size: p.size } : {}) });
    }
    const out: JournalEntry = { ...rest, id: newId('jrnl'), photos };
    const mapped = placeId ? placeIds.get(placeId) : undefined;
    if (mapped) out.placeId = mapped;
    return out;
  });
  return { journal, files };
}

/** importJournalFile without photos (T64 behaviour: every photo stayed on the sender's phone). */
export function importJournal(list: readonly FileJournalEntry[] | undefined, newId: (prefix: string) => string, placeIds: ReadonlyMap<string, string>): JournalEntry[] | undefined {
  return importJournalFile(list, newId, placeIds).journal;
}

/** The imported trip's journal with the written photo paths filled in; photos whose file couldn't be written go. */
export function withJournalFiles<T extends Pick<Trip, 'journal'>>(trip: T, written: Readonly<Record<string, string | undefined>>): T {
  if (!Array.isArray(trip.journal)) return trip;
  return {
    ...trip,
    journal: trip.journal.map((e) => ({
      ...e,
      photos: e.photos.flatMap((p): JournalPhoto[] => {
        if (p.uri) return [p];
        const uri = written[p.id];
        return uri ? [{ ...p, uri }] : [];
      }),
    })),
  };
}

/** Photos a file left out: they stayed on the sender's phone (the import notice says how many). */
export const fileJournalPhotos = (list: readonly FileJournalEntry[] | undefined): number => (list ?? []).reduce((s, e) => s + (e.photoCount ?? 0), 0);
