// Pattern text -> steps the app can walk through one row/round at a time.
//
// Handles what real written patterns look like:
//   "Rnd 1: 6 sc in MR (6)"            one round with a stitch count
//   "Rnds 7-12: sc in each st (36)"   a range, expanded into 6 steps
//   "R5 - 8: ..."  "Row 3." "Round 4)" label variants
//   "HEAD" / "Body:"                   section headers (row numbers restart per section)
//   anything else                      notes attached to the next step
// Plus a best-effort stitch-count check for single-crochet style instructions (amigurumi).

export type StepKind = 'row' | 'round';

export interface PatternStep {
  /** Index in the steps array. */
  i: number;
  section: string;
  kind: StepKind;
  /** Row/round number as written. */
  n: number;
  /** For an expanded range: which of how many (1-based), else undefined. */
  of?: { k: number; total: number };
  text: string;
  /** Stitch count written in the pattern, e.g. (18). */
  count?: number;
  /** Notes written between the previous step and this one. */
  notes: string[];
}

export interface ParsedPattern {
  steps: PatternStep[];
  sections: string[];
  /** Lines before the first step (materials, abbreviations ...). */
  intro: string[];
  /** Notes after the last step (finishing). */
  outro: string[];
}

const LABEL =
  /^\s*(rows?|rnds?|rounds?|r)\s*\.?\s*(\d{1,4})(?:\s*(?:-|–|—|to|through|thru)\s*(\d{1,4}))?\s*(?:[:.)\]–—-]\s*|\s+)(.*)$/i;
/** "Rnds 4, 6 and 8:" -> list. */
const LIST_LABEL = /^\s*(rows?|rnds?|rounds?|r)\s*(\d{1,4}(?:\s*(?:,|&|and)\s*\d{1,4})+)\s*[:.)]\s*(.*)$/i;
const COUNT = /(?:[([]\s*(\d{1,4})\s*(?:sts?|stitches|sc|dc|hdc|tr|htr)?\s*[)\]]|[-–—=]\s*(\d{1,4})\s*(?:sts?|stitches)\s*\.?)\s*\.?\s*$/i;

/** Headers that describe the pattern rather than a part you crochet; they stay as notes. */
const INFO_HEADERS =
  /^(?:materials?|supplies|abbreviations?|stitches used|notes?|gauge|tension|finished size|size|skill level|yarn|hooks?|notions|you will need|special stitches|terms|pattern notes|difficulty|assembly|finishing)$/i;

function kindOf(word: string): StepKind {
  const w = word.toLowerCase();
  return w.startsWith('row') ? 'row' : 'round';
}

function isSectionHeader(line: string): string | null {
  const s = line.trim();
  if (!s || s.length > 40) return null;
  if (/^\d/.test(s)) return null;
  const plain = s.replace(/[:\-–—*#=_]+$/g, '').replace(/^[#*=_\s]+/, '').trim();
  if (!plain || plain.length < 2) return null;
  if (/[.,;[\]]/.test(plain.replace(/\([^)]*\)/g, ''))) return null;
  const words = plain.split(/\s+/);
  if (words.length > 5) return null;
  const core = plain.replace(/\([^)]*\)/g, '').trim();
  const allCaps = core === core.toUpperCase() && /[A-Z]/.test(core);
  const colon = /:\s*$/.test(s);
  const markdown = /^#{1,4}\s/.test(s);
  if (allCaps || colon || markdown) return titleCase(plain);
  return null;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function readCount(text: string): number | undefined {
  const m = text.match(COUNT);
  if (!m) return undefined;
  const v = Number(m[1] ?? m[2]);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/** Parse pattern text into walkable steps. Never throws; unknown lines become notes. */
export function parsePattern(src: string, opts: { maxRange?: number } = {}): ParsedPattern {
  const maxRange = opts.maxRange ?? 200;
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const steps: PatternStep[] = [];
  const sections: string[] = [];
  const intro: string[] = [];
  let section = '';
  let pending: string[] = [];

  const push = (kind: StepKind, n: number, text: string, of?: { k: number; total: number }) => {
    steps.push({ i: steps.length, section, kind, n, of, text: text.trim(), count: readCount(text), notes: pending });
    pending = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\t/g, ' ').trimEnd();
    if (!line.trim()) continue;

    const list = line.match(LIST_LABEL);
    if (list) {
      const nums = list[2].split(/\s*(?:,|&|and)\s*/i).map(Number).filter((x) => x > 0);
      nums.forEach((n, k) => push(kindOf(list[1]), n, list[3], { k: k + 1, total: nums.length }));
      continue;
    }

    const m = line.match(LABEL);
    if (m && m[4] !== undefined && m[4].trim() !== '') {
      const a = Number(m[2]);
      const b = m[3] ? Number(m[3]) : a;
      const kind = kindOf(m[1]);
      if (b > a && b - a < maxRange) {
        const total = b - a + 1;
        for (let n = a; n <= b; n++) push(kind, n, m[4], { k: n - a + 1, total });
      } else {
        push(kind, a, m[4]);
      }
      continue;
    }

    const header = isSectionHeader(line);
    if (header && !INFO_HEADERS.test(header)) {
      if (steps.length === 0) {
        intro.push(...pending);
        pending = [];
      }
      section = header;
      if (!sections.includes(header)) sections.push(header);
      continue;
    }

    pending.push(line.trim());
  }

  // Headers that never got a step under them, and lines before the first step, are intro.
  const cleanNotes = (ns: string[]) => ns.filter((x) => !x.startsWith('§'));
  for (const s of steps) s.notes = cleanNotes(s.notes);
  const outro = cleanNotes(pending);
  if (steps.length === 0) {
    return { steps, sections: [], intro: cleanNotes([...intro, ...outro]), outro: [] };
  }
  // Sections actually used by steps, in order.
  const used: string[] = [];
  for (const s of steps) if (s.section && !used.includes(s.section)) used.push(s.section);
  // Notes before the first step belong to the intro when the first step has no section header above it.
  const first = steps[0];
  const introAll = [...intro, ...first.notes];
  first.notes = [];
  return { steps, sections: used, intro: introAll, outro };
}

/** Short label for a step: "Rnd 7 · 2 of 6". */
export function stepLabel(s: PatternStep): string {
  const base = `${s.kind === 'row' ? 'Row' : 'Rnd'} ${s.n}`;
  return s.of && s.of.total > 1 ? `${base} · ${s.of.k} of ${s.of.total}` : base;
}

// ---------------------------------------------------------------------------------------------------------
// Stitch-count check (single-crochet style, amigurumi). Best effort: returns undefined when unsure.

export interface CountCheck {
  /** Stitches this step makes. */
  made: number;
  /** Stitches of the previous round it uses. */
  used: number;
}

interface Acc {
  made: number;
  used: number;
  /** "around"/"in each st" seen: uses all remaining stitches of the previous round. */
  rest: boolean;
}

const NUM = '(\\d{1,3})';

function evalSegment(seg: string): Acc | null {
  const acc: Acc = { made: 0, used: 0, rest: false };
  let s = seg.toLowerCase().trim();
  if (!s) return acc;
  // Remove harmless bits.
  s = s
    .replace(/\b(?:in|into)\s+(?:the\s+)?(?:next|following)\b/g, ' ')
    .replace(/\b(?:blo|flo|back loops? only|front loops? only)\b/g, ' ')
    .replace(/\bstitch(?:es)?\b/g, 'st')
    .replace(/\binvdec\b|\binv dec\b|\bsc2tog\b/g, 'dec')
    .replace(/\binc(?:rease)?s?\b/g, 'inc')
    .replace(/\bdec(?:rease)?s?\b/g, 'dec');

  const tokens = s.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
  for (const t0 of tokens) {
    const t = t0.replace(/\s+/g, ' ');
    let m: RegExpMatchArray | null;
    if ((m = t.match(new RegExp(`^${NUM} sc (?:in|into) (?:a |the )?(?:mr|magic ring|magic loop|ring|2nd ch from hook|second ch from hook)`)))) {
      acc.made += Number(m[1]);
      continue;
    }
    if (/^sc (?:in each st|in every st|around|in each st around|each st)(?: around)?$/.test(t) || /^(?:sc )?around$/.test(t)) {
      acc.rest = true;
      continue;
    }
    if ((m = t.match(new RegExp(`^(?:sc ${NUM}|${NUM} sc|sc in (?:each of )?(?:the )?(?:next )?${NUM}(?: st)?)$`)))) {
      const n = Number(m[1] ?? m[2] ?? m[3]);
      acc.made += n;
      acc.used += n;
      continue;
    }
    if (t === 'sc' || t === 'sc 1' || t === '1 sc') {
      acc.made += 1;
      acc.used += 1;
      continue;
    }
    if ((m = t.match(new RegExp(`^(?:inc|sc inc)(?: ${NUM}| x ?${NUM})?$`))) || (m = t.match(new RegExp(`^${NUM} inc$`)))) {
      const n = Number(m[1] ?? m[2] ?? 1);
      acc.made += 2 * n;
      acc.used += n;
      continue;
    }
    if ((m = t.match(new RegExp(`^dec(?: ${NUM}| x ?${NUM})?$`))) || (m = t.match(new RegExp(`^${NUM} dec$`)))) {
      const n = Number(m[1] ?? m[2] ?? 1);
      acc.made += n;
      acc.used += 2 * n;
      continue;
    }
    if ((m = t.match(new RegExp(`^${NUM} sc in (?:the )?(?:same|next|each) st$`)))) {
      acc.made += Number(m[1]);
      acc.used += 1;
      continue;
    }
    // Anything else (chains, slip stitches to join, colour changes, "stuff") does not change the count when it
    // is clearly a join/finish, otherwise we give up.
    if (/^(?:sl st|ss|join|fo|fasten off|stuff|ch 1|turn|change colou?r|cc|leave a long tail|place marker|pm)\b/.test(t)) continue;
    return null;
  }
  return acc;
}

/** Expand "[sc, inc] x6", "(sc 2, inc) 6 times", "*sc, inc* x6", "*sc, inc; rep from * 6 times". */
function expandRepeats(text: string): string | null {
  let s = text;
  const rep = /[[(*]\s*([^[\]()*]+?)\s*[\])*]\s*(?:x|×|\*)\s*(\d{1,3})(?:\s*times)?|[[(]\s*([^[\]()]+?)\s*[\])]\s*(\d{1,3})\s*times/i;
  for (let guard = 0; guard < 20; guard++) {
    const m = s.match(rep);
    if (!m) break;
    const body = (m[1] ?? m[3]).trim();
    const n = Number(m[2] ?? m[4]);
    if (!(n > 0 && n < 200)) return null;
    s = s.replace(m[0], Array.from({ length: n }, () => body).join(', '));
  }
  // "*sc, inc; rep from * 5 more times" / "rep from * around"
  const star = s.match(/\*\s*([^*]+?)\s*;?\s*rep(?:eat)?\s+from\s+\*\s+(\d{1,3})\s+(more\s+)?times/i);
  if (star) {
    const total = Number(star[2]) + (star[3] ? 1 : 0);
    s = s.replace(star[0], Array.from({ length: total }, () => star[1]).join(', '));
  }
  if (/[[\]*]/.test(s)) return null;
  return s;
}

/**
 * Count what a step makes. prev = stitches in the previous round (for "sc around").
 * Returns undefined when the instruction isn't something we can count reliably.
 */
export function checkCount(text: string, prev?: number): CountCheck | undefined {
  // Drop the trailing stitch count and anything after a full stop that's an aside.
  let body = text.replace(COUNT, '').trim();
  body = body.replace(/\.\s*$/, '');
  const expanded = expandRepeats(body);
  if (expanded == null) return undefined;
  const acc = evalSegment(expanded);
  if (!acc) return undefined;
  if (acc.rest) {
    if (prev == null) return undefined;
    const left = prev - acc.used;
    if (left < 0) return undefined;
    acc.made += left;
    acc.used += left;
  }
  if (acc.made === 0) return undefined;
  return { made: acc.made, used: acc.used };
}

export interface StepIssue {
  i: number;
  kind: 'count' | 'uses';
  expected: number;
  got: number;
}

/** Walk steps in order and flag rounds whose written count doesn't match what the instructions make. */
export function findCountIssues(steps: PatternStep[]): StepIssue[] {
  const issues: StepIssue[] = [];
  let prev: number | undefined;
  let prevSection = '';
  for (const s of steps) {
    if (s.section !== prevSection) {
      prev = undefined;
      prevSection = s.section;
    }
    const c = checkCount(s.text, prev);
    if (c && s.count != null && c.made !== s.count) {
      issues.push({ i: s.i, kind: 'count', expected: s.count, got: c.made });
    } else if (c && prev != null && c.used !== prev && s.count != null && c.made === s.count && s.kind === 'round') {
      issues.push({ i: s.i, kind: 'uses', expected: prev, got: c.used });
    }
    prev = c?.made ?? s.count;
  }
  return issues;
}
