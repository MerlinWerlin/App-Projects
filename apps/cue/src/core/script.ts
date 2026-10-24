/**
 * Script model for the prompter. Pure TypeScript (no React Native), unit-tested in Node.
 *
 * Markup is deliberately tiny so it reads fine as plain text in any notes app:
 *   # Heading          -> a section heading (shown smaller, used for "jump to section")
 *   *word*             -> emphasis (drawn in the accent colour)
 *   [pause] [breathe]  -> a cue chip; voice-follow and auto-scroll hold briefly on it
 *   [[private note]]   -> a note for the presenter that is never spoken (shown dim, skipped by voice-follow)
 *   ---                -> a page break (gap + "next take" divider)
 * Everything else is spoken text.
 */

export type Segment =
  | { kind: 'text'; text: string; emph: boolean; firstWord: number; wordCount: number }
  | { kind: 'cue'; label: string }
  | { kind: 'note'; text: string };

export type Block =
  | { kind: 'heading'; text: string; firstWord: number }
  | { kind: 'para'; segments: Segment[]; firstWord: number }
  | { kind: 'break' };

export interface ParsedScript {
  blocks: Block[];
  /** Spoken words in order (normalised for voice-follow). */
  words: string[];
  /** Number of [pause]-style cues (each adds CUE_SECONDS to the read time). */
  cueCount: number;
  sections: { title: string; firstWord: number; blockIndex: number }[];
}

export const CUE_SECONDS = 1.5;
export const DEFAULT_WPM = 140;
export const MIN_WPM = 60;
export const MAX_WPM = 260;

const CUE_RE = /\[(?!\[)([^\[\]\n]{1,24})\](?!\])/;

/** Lower-case, strip punctuation and diacritics so "Don't," matches a recogniser's "dont". */
export function normWord(w: string): string {
  return w
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Splits spoken text into words (keeps CJK runs as single "words" per character). */
export function splitWords(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\s+/)) {
    if (!raw) continue;
    // CJK has no spaces: count each ideograph/kana as a word so pacing and follow still work.
    if (/[぀-ヿ㐀-鿿]/.test(raw)) {
      for (const ch of raw) if (normWord(ch)) out.push(ch);
      continue;
    }
    if (normWord(raw)) out.push(raw);
  }
  return out;
}

/** Splits one paragraph line into text / cue / note segments. */
function lineSegments(line: string, wordStart: number, words: string[]): { segs: Segment[]; cues: number } {
  const segs: Segment[] = [];
  let cues = 0;
  let rest = line;
  let w = wordStart;
  const pushText = (s: string) => {
    // *emphasis* runs inside plain text.
    const parts = s.split(/(\*[^*\n]+\*)/);
    for (const p of parts) {
      if (!p) continue;
      const emph = p.length > 2 && p.startsWith('*') && p.endsWith('*');
      const text = emph ? p.slice(1, -1) : p;
      const ws = splitWords(text);
      for (const x of ws) words.push(normWord(x));
      segs.push({ kind: 'text', text, emph, firstWord: w, wordCount: ws.length });
      w += ws.length;
    }
  };
  while (rest.length) {
    const note = rest.indexOf('[[');
    const cueM = CUE_RE.exec(rest);
    const cueAt = cueM ? cueM.index : -1;
    const next = [note, cueAt].filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (next === undefined) {
      pushText(rest);
      break;
    }
    if (next > 0) pushText(rest.slice(0, next));
    if (next === note) {
      const end = rest.indexOf(']]', note + 2);
      if (end < 0) {
        pushText(rest.slice(note));
        break;
      }
      segs.push({ kind: 'note', text: rest.slice(note + 2, end).trim() });
      rest = rest.slice(end + 2);
    } else if (cueM) {
      segs.push({ kind: 'cue', label: cueM[1]!.trim() });
      cues += 1;
      rest = rest.slice(cueAt + cueM[0].length);
    }
  }
  return { segs, cues };
}

export function parseScript(body: string): ParsedScript {
  const blocks: Block[] = [];
  const words: string[] = [];
  const sections: ParsedScript['sections'] = [];
  let cueCount = 0;
  const paras = body.replace(/\r\n?/g, '\n').split(/\n/);
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join(' ').trim();
    buf = [];
    if (!text) return;
    const firstWord = words.length;
    const { segs, cues } = lineSegments(text, firstWord, words);
    cueCount += cues;
    if (segs.length) blocks.push({ kind: 'para', segments: segs, firstWord });
  };
  for (const raw of paras) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      flush();
      blocks.push({ kind: 'break' });
      continue;
    }
    const h = /^#{1,3}\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const title = h[1]!.trim();
      sections.push({ title, firstWord: words.length, blockIndex: blocks.length });
      blocks.push({ kind: 'heading', text: title, firstWord: words.length });
      continue;
    }
    buf.push(line);
  }
  flush();
  return { blocks, words, cueCount, sections };
}

export function clampWpm(wpm: number): number {
  if (!Number.isFinite(wpm)) return DEFAULT_WPM;
  return Math.min(MAX_WPM, Math.max(MIN_WPM, Math.round(wpm)));
}

/** Estimated read-aloud time in seconds at `wpm`, including cue holds. */
export function readSeconds(p: Pick<ParsedScript, 'words' | 'cueCount'>, wpm: number): number {
  return Math.round((p.words.length / clampWpm(wpm)) * 60 + p.cueCount * CUE_SECONDS);
}

/** "0:45", "2:05", "1:02:03". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Words per minute needed to fit the script into `targetSeconds` (for "fit to 60 s"). */
export function wpmForTarget(p: Pick<ParsedScript, 'words' | 'cueCount'>, targetSeconds: number): number {
  const speaking = targetSeconds - p.cueCount * CUE_SECONDS;
  if (speaking <= 0 || p.words.length === 0) return MAX_WPM;
  return clampWpm((p.words.length / speaking) * 60);
}

/** First line (or first words) as a title for an untitled script. */
export function autoTitle(body: string, max = 40): string {
  const first = body
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').replace(/\[\[[^\]]*\]\]|\[[^\]]*\]|\*/g, '').trim())
    .find(Boolean);
  if (!first) return '';
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}
