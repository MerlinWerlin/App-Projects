// T171 "Scan my Home Screen": iOS can't list installed apps, so the user picks screenshots of their
// Home Screen pages, on-device text recognition (Vision, modules/glaze-home-scan) reads the labels
// under the icons, and this file turns the raw text into a list of apps:
//   1. clean   drop status-bar text (time, battery %, carrier, 5G), widget text (dates, temperatures,
//              long sentences, big type), page dots and the "Search" pill
//   2. split   one OCR line holding several labels ("Photos   Camera") is split on wide gaps or,
//              failing that, into runs of words that are catalogue names
//      merge   two boxes side by side on the same row with a tiny gap are one label ("You" "Tube")
//   3. match   normalise (case, diacritics, ellipsis "Photosh…") and fuzzy-match catalogue names and
//              aliases: exact > alias > truncated prefix > edit-distance / word similarity
//   4. dedupe  across every screenshot; reading order (page, row, column) is kept so apps are added
//              in Home Screen order
// Nothing here touches images or the network: the OCR runs on the phone and only text reaches here.
// Pure TypeScript (no React Native / Expo) so Node runs the tests.

import { CATALOGUE, editDistance, type CatalogueEntry } from './catalogue.ts';
import { MAX_LABEL_LENGTH, addApps, addCustomApp, type StudioState } from './studio.ts';

/**
 * One recognised line of text. Box fields are optional and NORMALISED to 0..1 with a TOP-LEFT
 * origin (the Swift module flips Vision's bottom-left boxes). confidence is Vision's 0..1.
 */
export type OcrObservation = { text: string; confidence?: number; x?: number; y?: number; w?: number; h?: number };

export type ScanMatch = {
  /** The catalogue app's name (what the confirm list shows). */
  name: string;
  catalogueId: string;
  /** 0..1, how sure the match is (1 = exact name). */
  confidence: number;
  /** The label as read on the screenshot, e.g. "Photosh…". */
  label: string;
};

export type ScanResult = { matched: ScanMatch[]; unmatched: string[] };

/** Minimum match confidence; below this a label becomes an unmatched (custom) app. */
export const MATCH_THRESHOLD = 0.75;
/** Vision lines below this confidence are ignored. */
export const MIN_OCR_CONFIDENCE = 0.3;
/** Top band of a screenshot (status bar) ignored when boxes are known. */
export const STATUS_BAR_BAND = 0.06;
/** Text taller than this multiple of the typical label height is widget / clock text. */
export const TALL_TEXT_FACTOR = 1.8;
/** Most screenshots one scan reads. */
export const MAX_SCREENSHOTS = 12;

const MAX_LABEL_WORDS = 3;
const MAX_LABEL_CHARS = 24;

// ---------------------------------------------------------------- normalise

const ELLIPSIS = /(?:\u2026|\.{2,}|\s*\u00b7{2,})\s*$/;

/** Lowercase, strip diacritics, unify quotes/dashes, collapse whitespace. */
export function normalizeLabel(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Letters and digits only (after normalizeLabel). */
export function compactLabel(s: string): string {
  return normalizeLabel(s).replace(/[^a-z0-9]/g, '');
}

function wordsOf(s: string): string[] {
  return normalizeLabel(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The label without a trailing ellipsis, and whether iOS truncated it ("Photosh…" -> Photosh, true). */
export function stripEllipsis(label: string): { text: string; truncated: boolean } {
  const raw = String(label ?? '').trim();
  const text = raw.replace(ELLIPSIS, '').trim();
  return { text, truncated: text !== raw && text.length > 0 };
}

/** Display form of a label: trimmed, single spaces, no ellipsis, no stray edge punctuation, bounded. */
export function cleanDisplayName(label: string): string {
  return stripEllipsis(label)
    .text.replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}+!)]+$/gu, '')
    .trim()
    .slice(0, MAX_LABEL_LENGTH);
}

// ---------------------------------------------------------------- clean (junk lines)

const TIME = /^\d{1,2}[:.]\d{2}(?:\s*[ap]\.?\s?m\.?)?$/i;
const PERCENT = /\d\s*%/;
const DEGREES = /-?\d+\s*°/;
const NUMERIC = /^[\d\s.,:;%°+\-–—/()]+$/;
const DOTS = /^[\s•·.○●◦∙⋅oO]+$/;
const SEARCH = /^(?:q|o|ⓠ|🔍)?\s*search$/i;
const WEEKDAY = /^(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|urday|rsday)?\b,?\s+\d{1,2}\b/i;
const MONTH_DAY = /^(?:\d{1,2}\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|^\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*$/i;
const URLISH = /(?:https?:\/\/|www\.|\.com\b|@)/i;
const NETWORK_TOKENS = new Set(['sos', 'lte', '3g', '4g', '5g', '5ge', '5g+', 'lte+', 'e', 'h+', 'wifi', 'wi-fi', 'no service', 'searching']);
const CARRIERS = new Set([
  'telstra', 'optus', 'vodafone', 'tpg', 'boost', 'amaysim', 'belong', 'aldimobile', 'lebara',
  'at&t', 'att', 'verizon', 't-mobile', 'tmobile', 'sprint', 'mint', 'cricket', 'visible',
  'ee', 'o2', 'three', '3', 'giffgaff', 'tesco mobile', 'sky', 'bt',
]);
const WIDGET_PHRASES = /^(?:no (?:more )?events|no events today|tomorrow|today|up next|all day|now playing|not playing|battery|batteries|h:\s*-?\d|l:\s*-?\d|mostly |partly |chance of)\b/i;

/** True when a line is status-bar, widget or chrome text rather than an app label. */
export function isJunkLine(text: string): boolean {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (!/\p{L}/u.test(t)) return true; // no letters: numbers, badges, dots, symbols
  if (TIME.test(t) || PERCENT.test(t) || DEGREES.test(t) || NUMERIC.test(t) || DOTS.test(t)) return true;
  if (SEARCH.test(t)) return true;
  if (WEEKDAY.test(t) || MONTH_DAY.test(t) || WIDGET_PHRASES.test(t)) return true;
  if (URLISH.test(t)) return true;
  const n = normalizeLabel(t);
  if (NETWORK_TOKENS.has(n) || CARRIERS.has(n)) return true;
  // A line made only of network tokens / carrier names ("Telstra 5G", "SOS LTE").
  const parts = n.split(' ');
  if (parts.length > 1 && parts.every((p) => NETWORK_TOKENS.has(p) || CARRIERS.has(p))) return true;
  if (compactLabel(t).length < 1) return true;
  return false;
}

/** A label-shaped string: some letters, short, a few words (longer lines are widget sentences). */
export function isPlausibleLabel(text: string): boolean {
  const t = cleanDisplayName(text);
  if (!t || !/\p{L}/u.test(t)) return false;
  if (compactLabel(t).length < 2 && !/^[\p{L}]$/u.test(t)) return false;
  if (t.length > MAX_LABEL_CHARS) return false;
  if (t.split(' ').length > MAX_LABEL_WORDS) return false;
  if (/[.!?]\s+\p{L}/u.test(t)) return false; // sentence punctuation mid-line
  return true;
}

// ---------------------------------------------------------------- catalogue index + matching

type IndexedEntry = { entry: CatalogueEntry; name: string; nameC: string; nameWords: string[]; aliasesC: string[] };

const INDEX_CACHE = new WeakMap<readonly CatalogueEntry[], IndexedEntry[]>();

function indexFor(catalogue: readonly CatalogueEntry[]): IndexedEntry[] {
  const hit = INDEX_CACHE.get(catalogue);
  if (hit) return hit;
  const built = catalogue.map((entry) => ({
    entry,
    name: normalizeLabel(entry.name),
    nameC: compactLabel(entry.name),
    nameWords: wordsOf(entry.name),
    aliasesC: (entry.aliases ?? []).map(compactLabel).filter((a) => a.length >= 2),
  }));
  INDEX_CACHE.set(catalogue, built);
  return built;
}

/** 1 - edit distance / longer length, on compact strings. */
export function stringSimilarity(a: string, b: string): number {
  const x = compactLabel(a);
  const y = compactLabel(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  return Math.max(0, 1 - editDistance(x, y) / Math.max(x.length, y.length));
}

/** Word-level similarity: share of words that match (exactly or within one edit for longer words). */
export function tokenSimilarity(a: string, b: string): number {
  const x = wordsOf(a);
  const y = wordsOf(b);
  if (x.length === 0 || y.length === 0) return 0;
  const used = new Set<number>();
  let hits = 0;
  for (const w of x) {
    const i = y.findIndex((v, k) => !used.has(k) && (v === w || (w.length >= 5 && v.length >= 5 && editDistance(w, v) <= 1)));
    if (i >= 0) {
      used.add(i);
      hits++;
    }
  }
  return (2 * hits) / (x.length + y.length);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Best catalogue match for one label, or null below MATCH_THRESHOLD. Scores:
 *   exact name 1 · exact alias 0.85 · truncated label ("Photosh…") that starts a single name 0.9
 *   (0.78 if several names share that start; shortest wins) · an untruncated label of 7+ letters
 *   that starts exactly one name 0.8 · otherwise the best of string / word similarity (very short
 *   labels need an exact match, since "Mail" vs "Mali" is a different app).
 */
export function matchLabel(
  label: string,
  catalogue: readonly CatalogueEntry[] = CATALOGUE,
): { entry: CatalogueEntry; confidence: number } | null {
  const { text, truncated } = stripEllipsis(label);
  const qc = compactLabel(text);
  if (!qc) return null;
  const index = indexFor(catalogue);

  for (const x of index) if (x.nameC === qc) return { entry: x.entry, confidence: 1 };

  // Truncated (or long) labels: the label is the start of a name.
  if (truncated ? qc.length >= 3 : qc.length >= 7) {
    const starts = index.filter((x) => x.nameC.length > qc.length && x.nameC.startsWith(qc));
    if (starts.length > 0) {
      starts.sort((a, b) => a.nameC.length - b.nameC.length || a.entry.name.localeCompare(b.entry.name));
      const conf = truncated ? (starts.length === 1 ? 0.9 : 0.78) : starts.length === 1 ? 0.8 : 0;
      if (conf >= MATCH_THRESHOLD) return { entry: starts[0].entry, confidence: conf };
    }
  }

  for (const x of index) if (x.aliasesC.includes(qc) && qc.length >= 3) return { entry: x.entry, confidence: 0.85 };

  if (qc.length < 5) return null; // short labels: exact only
  let best: { entry: CatalogueEntry; confidence: number } | null = null;
  for (const x of index) {
    if (Math.abs(x.nameC.length - qc.length) > 3 && !truncated) continue;
    let s = Math.max(stringSimilarity(qc, x.nameC), tokenSimilarity(text, x.name) * 0.95);
    if (truncated && x.nameC.length > qc.length) s = Math.max(s, stringSimilarity(qc, x.nameC.slice(0, qc.length)) * 0.9);
    if (!best || s > best.confidence) best = { entry: x.entry, confidence: s };
  }
  if (best && best.confidence >= MATCH_THRESHOLD) return { entry: best.entry, confidence: round2(best.confidence) };
  return null;
}

// ---------------------------------------------------------------- split / merge

/** Splits on wide gaps (2+ spaces, tabs, pipes): OCR sometimes reads a row of labels as one line. */
export function splitOnGaps(text: string): string[] {
  return String(text ?? '')
    .split(/\s{2,}|\t|\s\|\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * A line of single-spaced words that is not itself an app ("Photos Camera Mail") split into runs of
 * 1..3 words that each match the catalogue. Returns null unless every word is covered.
 */
export function segmentWords(text: string, catalogue: readonly CatalogueEntry[] = CATALOGUE): string[] | null {
  const parts = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  // best[i] = segmentation of parts[0..i) with the most total confidence, or null
  const best: (null | { segs: string[]; score: number })[] = new Array(parts.length + 1).fill(null);
  best[0] = { segs: [], score: 0 };
  for (let i = 1; i <= parts.length; i++) {
    for (let k = 1; k <= 3 && k <= i; k++) {
      const prev = best[i - k];
      if (!prev) continue;
      const seg = parts.slice(i - k, i).join(' ');
      const m = matchLabel(seg, catalogue);
      if (!m || m.confidence < 0.85) continue;
      // Prefer fewer, longer segments ("Google Maps" over "Google" + "Maps").
      const score = prev.score + m.confidence * k + (k - 1) * 0.1;
      if (!best[i] || score > best[i]!.score) best[i] = { segs: [...prev.segs, seg], score };
    }
  }
  const out = best[parts.length];
  return out && out.segs.length >= 2 ? out.segs : null;
}

/**
 * Joins boxes that sit on the same row with only a word gap between them (Vision occasionally
 * reads one label as two observations). Labels of neighbouring icons are far apart and stay separate.
 * Observations without boxes pass through unchanged. Output is in reading order (top to bottom,
 * left to right) when boxes are known.
 */
export function mergeAdjacent(obs: readonly OcrObservation[]): OcrObservation[] {
  const boxed = obs.filter(hasBox);
  const loose = obs.filter((o) => !hasBox(o));
  const rows = [...boxed].sort((a, b) => a.y! + a.h! / 2 - (b.y! + b.h! / 2) || a.x! - b.x!);
  // Group into rows by vertical centre, then sort each row left to right.
  const grouped: OcrObservation[][] = [];
  for (const o of rows) {
    const cy = o.y! + o.h! / 2;
    const row = grouped.find((r) => Math.abs(r[0].y! + r[0].h! / 2 - cy) < Math.max(r[0].h!, o.h!) * 0.5);
    if (row) row.push(o);
    else grouped.push([o]);
  }
  const out: OcrObservation[] = [];
  for (const row of grouped) {
    row.sort((a, b) => a.x! - b.x!);
    let cur: OcrObservation | null = null;
    for (const o of row) {
      if (cur && o.x! - (cur.x! + cur.w!) < Math.max(cur.h!, o.h!) * 0.6) {
        const right = Math.max(cur.x! + cur.w!, o.x! + o.w!);
        const top = Math.min(cur.y!, o.y!);
        const bottom = Math.max(cur.y! + cur.h!, o.y! + o.h!);
        cur = {
          text: `${cur.text} ${o.text}`,
          confidence: Math.min(cur.confidence ?? 1, o.confidence ?? 1),
          x: cur.x,
          y: top,
          w: right - cur.x!,
          h: bottom - top,
        };
      } else {
        if (cur) out.push(cur);
        cur = { ...o };
      }
    }
    if (cur) out.push(cur);
  }
  return [...out, ...loose];
}

function hasBox(o: OcrObservation): boolean {
  return [o.x, o.y, o.w, o.h].every((v) => typeof v === 'number' && Number.isFinite(v)) && (o.h ?? 0) > 0 && (o.w ?? 0) >= 0;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Box-based filtering for one screenshot: drops the status-bar band and text much taller than the
 * typical label (clock, widget headlines). With no boxes, everything passes.
 */
export function filterByLayout(obs: readonly OcrObservation[]): OcrObservation[] {
  const boxed = obs.filter(hasBox);
  const labelish = boxed.filter((o) => !isJunkLine(o.text) && isPlausibleLabel(o.text)).map((o) => o.h!);
  const typical = median(labelish.length > 0 ? labelish : boxed.map((o) => o.h!));
  return obs.filter((o) => {
    if (!hasBox(o)) return true;
    if (o.y! + o.h! <= STATUS_BAR_BAND) return false;
    if (typical > 0 && o.h! > typical * TALL_TEXT_FACTOR) return false;
    return true;
  });
}

// ---------------------------------------------------------------- whole scan

/** The label candidates found in one screenshot's OCR lines, in reading order. */
export function labelsFromPage(obs: readonly OcrObservation[], catalogue: readonly CatalogueEntry[] = CATALOGUE): string[] {
  const usable = (Array.isArray(obs) ? obs : []).filter(
    (o): o is OcrObservation => !!o && typeof o.text === 'string' && (typeof o.confidence !== 'number' || o.confidence >= MIN_OCR_CONFIDENCE),
  );
  const lines = mergeAdjacent(filterByLayout(usable));
  const out: string[] = [];
  for (const line of lines) {
    for (const piece of splitOnGaps(line.text)) {
      if (isJunkLine(piece)) continue;
      const whole = matchLabel(piece, catalogue);
      if (whole) {
        out.push(piece);
        continue;
      }
      const segs = segmentWords(piece, catalogue);
      if (segs) {
        out.push(...segs);
        continue;
      }
      if (isPlausibleLabel(piece)) out.push(piece);
    }
  }
  return out;
}

/**
 * Turns the OCR of every picked screenshot (one array per page) into matched catalogue apps and
 * unmatched names, de-duplicated across pages and kept in Home Screen reading order.
 */
export function scanHomeScreens(
  pages: readonly (readonly OcrObservation[])[],
  catalogue: readonly CatalogueEntry[] = CATALOGUE,
): ScanResult {
  const matched: ScanMatch[] = [];
  const unmatched: string[] = [];
  const seenIds = new Map<string, number>();
  const seenNames = new Set<string>();
  for (const page of (Array.isArray(pages) ? pages : []).slice(0, MAX_SCREENSHOTS)) {
    for (const label of labelsFromPage(page, catalogue)) {
      const m = matchLabel(label, catalogue);
      if (m) {
        const at = seenIds.get(m.entry.id);
        if (at === undefined) {
          seenIds.set(m.entry.id, matched.length);
          matched.push({ name: m.entry.name, catalogueId: m.entry.id, confidence: round2(m.confidence), label: label.trim() });
        } else if (m.confidence > matched[at].confidence) {
          matched[at] = { ...matched[at], confidence: round2(m.confidence), label: label.trim() };
        }
        continue;
      }
      const name = cleanDisplayName(label);
      const key = compactLabel(name);
      if (!name || !key || seenNames.has(key)) continue;
      seenNames.add(key);
      unmatched.push(name);
    }
  }
  // An unmatched name that is a truncated form of a matched app (seen whole on another page) goes.
  const matchedKeys = matched.map((m) => compactLabel(m.name));
  const rest = unmatched.filter((n) => {
    const k = compactLabel(n);
    return !matchedKeys.some((mk) => mk === k || (k.length >= 4 && mk.startsWith(k)));
  });
  return { matched, unmatched: rest };
}

// ---------------------------------------------------------------- adding to the studio

export type ScanApplyResult = { state: StudioState; addedCatalogue: number; addedCustom: number };

/**
 * Adds the confirmed apps: catalogue ids are selected (keeping their glyph); each name becomes a
 * custom app with a monogram (or selects an existing custom app with the same name). Order is kept.
 */
export function applyScan(
  s: StudioState,
  picked: { catalogueIds: readonly string[]; customNames: readonly string[] },
): ScanApplyResult {
  const before = new Set(s.selected);
  let state = addApps(s, picked.catalogueIds ?? []);
  const addedCatalogue = state.selected.filter((id) => !before.has(id)).length;
  let addedCustom = 0;
  const done = new Set<string>();
  for (const raw of picked.customNames ?? []) {
    const name = cleanDisplayName(raw);
    const key = compactLabel(name);
    if (!name || !key || done.has(key)) continue;
    done.add(key);
    const existing = state.customApps.find((c) => compactLabel(c.name) === key);
    if (existing) {
      const next = addApps(state, [existing.id]);
      if (next.selected.length > state.selected.length) addedCustom++;
      state = next;
      continue;
    }
    const r = addCustomApp(state, { name });
    if (r.ok) {
      state = r.state;
      addedCustom++;
    }
  }
  return { state, addedCatalogue, addedCustom };
}
