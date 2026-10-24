/**
 * Voice-follow alignment: given the script's normalised words and the recogniser's running transcript,
 * find where the speaker is. Pure TS; the speech engine is a separate seam (src/native/speech.ts).
 *
 * Rules learnt from competitors' reviews ("it loses my place", "it jumps ahead when I ad-lib"):
 *  - only search a window ahead of the current position (and a few words back), never the whole script;
 *  - match the last few heard words as a phrase, not single words, so common words ("the") can't jump;
 *  - an ad-lib that matches nothing leaves the position where it was;
 *  - small slips (a skipped or misheard word) still match through a fuzzy similarity score.
 */
import { normWord } from './script';

export interface FollowOptions {
  /** How many of the latest heard words to match as a phrase. */
  tail: number;
  /** How far ahead of the current word to look. */
  ahead: number;
  /** How far back (re-reading a line) to look. */
  back: number;
  /** Minimum average similarity (0..1) to accept a move. */
  minScore: number;
}

export const FOLLOW_DEFAULTS: FollowOptions = { tail: 4, ahead: 40, back: 6, minScore: 0.62 };

/** Similarity of two normalised words in 0..1 (1 = equal). Cheap edit-distance ratio. */
export function wordSim(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > Math.max(n, m) / 2) return 0;
  let prev = new Array<number>(m + 1);
  let cur = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return 1 - prev[m]! / Math.max(n, m);
}

/** Normalised words of a transcript. */
export function heardWords(transcript: string): string[] {
  return transcript
    .split(/\s+/)
    .map(normWord)
    .filter(Boolean);
}

/**
 * Returns the index of the script word just AFTER the matched phrase (i.e. the next word to say),
 * or `current` when nothing matches well enough.
 */
export function alignPosition(
  script: readonly string[],
  heard: readonly string[],
  current: number,
  opts: FollowOptions = FOLLOW_DEFAULTS,
): number {
  if (!script.length || !heard.length) return current;
  const tail = heard.slice(-opts.tail);
  const k = tail.length;
  const from = Math.max(0, current - opts.back);
  const to = Math.min(script.length - k, current + opts.ahead);
  let best = -1;
  let bestScore = 0;
  for (let start = from; start <= to; start++) {
    let score = 0;
    for (let i = 0; i < k; i++) score += wordSim(script[start + i]!, tail[i]!);
    score /= k;
    // Prefer the nearest forward match on ties: distance penalty is tiny.
    const dist = Math.abs(start + k - current);
    const adjusted = score - dist * 0.0005;
    if (adjusted > bestScore) {
      bestScore = adjusted;
      best = start;
    }
  }
  // A single short heard word is too weak to move on its own.
  if (best < 0 || bestScore < opts.minScore || (k === 1 && (tail[0]!.length < 4 || bestScore < 0.95))) return current;
  return best + k;
}

/**
 * Stateful follower: feed it partial transcripts; it only ever moves forward by default
 * (a re-read moves back only when the phrase match is strong).
 */
export class Follower {
  private pos = 0;
  constructor(
    private readonly words: readonly string[],
    private readonly opts: FollowOptions = FOLLOW_DEFAULTS,
  ) {}
  get position(): number {
    return this.pos;
  }
  jumpTo(word: number): void {
    this.pos = Math.max(0, Math.min(this.words.length, word));
  }
  /** Feed the whole partial transcript so far; returns the new position. */
  hear(transcript: string): number {
    const heard = heardWords(transcript);
    const next = alignPosition(this.words, heard, this.pos, this.opts);
    if (next >= this.pos || this.pos - next <= this.opts.back) this.pos = next;
    return this.pos;
  }
  get done(): boolean {
    return this.pos >= this.words.length;
  }
}
