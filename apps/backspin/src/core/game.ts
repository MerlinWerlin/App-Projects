// Game rules that don't touch the phone: packs and lines, daily challenge, streaks, party rounds, verdicts,
// and what Backspin Plus unlocks. Pure TypeScript with node --test coverage (game.test.ts).

export type Line = { id: string; t: string; d: 1 | 2 | 3; n?: string };
export type PackId = 'warmup' | 'party' | 'twisters' | 'animals' | 'aussie' | 'kids' | 'songs';
export type Pack = { id: PackId; emoji: string; free: boolean | number; lines: Line[] };

/** Pack order on the Packs screen. `free: true` = all free, a number = that many lines free, false = Plus. */
export const PACK_META: { id: PackId; emoji: string; free: boolean | number }[] = [
  { id: 'warmup', emoji: '👋', free: true },
  { id: 'party', emoji: '🎉', free: 40 },
  { id: 'animals', emoji: '🐸', free: true },
  { id: 'kids', emoji: '🧸', free: true },
  { id: 'twisters', emoji: '👅', free: 20 },
  { id: 'songs', emoji: '🎶', free: 15 },
  { id: 'aussie', emoji: '🦘', free: 15 },
];

export function buildPacks(lines: Record<string, Line[]>): Pack[] {
  return PACK_META.map((m) => ({ ...m, lines: lines[m.id] ?? [] }));
}

export function isLineFree(pack: Pack, index: number): boolean {
  return pack.free === true || (typeof pack.free === 'number' && index < pack.free);
}

export const canPlayLine = (pack: Pack, index: number, plus: boolean) => plus || isLineFree(pack, index);

/** Small deterministic PRNG (mulberry32) so daily picks and shuffles are the same on every phone. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Today's challenge: one free line per day, the same for everyone (so friends can compare), from the free
 * lines of every pack, medium difficulty on weekdays and a harder one on Saturdays.
 */
export function dailyLine(packs: Pack[], day: string): { pack: PackId; line: Line } | null {
  const pool: { pack: PackId; line: Line }[] = [];
  for (const p of packs) p.lines.forEach((l, i) => isLineFree(p, i) && pool.push({ pack: p.id, line: l }));
  if (!pool.length) return null;
  const sat = new Date(`${day}T12:00:00`).getDay() === 6;
  const want = pool.filter((x) => x.line.d === (sat ? 3 : 2));
  const list = want.length ? want : pool;
  return list[Math.floor(rng(hashStr(`backspin:${day}`))() * list.length)];
}

export type Streak = { current: number; best: number; last: string | null };
export const NO_STREAK: Streak = { current: 0, best: 0, last: null };

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Records a daily played on `day`. Playing twice the same day changes nothing; missing a day restarts at 1. */
export function playDaily(s: Streak, day: string): Streak {
  if (s.last === day) return s;
  const current = s.last && addDays(s.last, 1) === day ? s.current + 1 : 1;
  return { current, best: Math.max(s.best, current), last: day };
}

/** The streak as shown today: still alive if the last daily was today or yesterday. */
export function liveStreak(s: Streak, today: string): number {
  if (!s.last) return 0;
  return s.last === today || addDays(s.last, 1) === today ? s.current : 0;
}

/** Wordle-style share text for the daily (no recording attached). */
export function dailyShareText(day: string, score: number, streak: number): string {
  const blocks = Math.round(score / 20);
  const bar = '🟩'.repeat(blocks) + '⬜'.repeat(5 - blocks);
  return `Backspin daily ${day}\n${bar} ${score}/100\n🔥 ${streak} day streak`;
}

export function randomLine(packs: Pack[], plus: boolean, seed: number, maxDifficulty: 1 | 2 | 3 = 3) {
  const pool: { pack: PackId; line: Line }[] = [];
  for (const p of packs) p.lines.forEach((l, i) => canPlayLine(p, i, plus) && l.d <= maxDifficulty && pool.push({ pack: p.id, line: l }));
  if (!pool.length) return null;
  return pool[Math.floor(rng(seed)() * pool.length)];
}

export function findLine(packs: Pack[], id: string): { pack: Pack; line: Line; index: number } | null {
  for (const p of packs) {
    const i = p.lines.findIndex((l) => l.id === id);
    if (i >= 0) return { pack: p, line: p.lines[i], index: i };
  }
  return null;
}

// ---------- Verdicts ----------
export type Quips = { bands: { min: number; max: number; lines: string[] }[]; titles: string[]; party_dares: string[]; loading: string[] };

export function verdict(q: Quips, score: number, seed: number): string {
  const band = q.bands.find((b) => score >= b.min && score <= b.max) ?? q.bands[0];
  if (!band?.lines.length) return '';
  return band.lines[Math.floor(rng(seed)() * band.lines.length)];
}

/** Rank title from the number of rounds played and the best score. */
export function titleFor(q: Quips, rounds: number, best: number): string {
  if (!q.titles.length) return '';
  const progress = Math.min(1, rounds / 150) * 0.7 + Math.min(1, best / 100) * 0.3;
  return q.titles[Math.min(q.titles.length - 1, Math.floor(progress * q.titles.length))];
}

// ---------- Party ----------
export type PartyMode = 'copy' | 'guess';
export type Player = { name: string; score: number; rounds: number };
export type Party = { mode: PartyMode; players: Player[]; round: number; rounds: number; turn: number; seed: number };

export const MAX_FREE_PLAYERS = 4;
export const MAX_PLAYERS = 8;

export function newParty(names: string[], rounds: number, mode: PartyMode, seed: number): Party {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  return { mode, players: clean.map((name) => ({ name, score: 0, rounds: 0 })), round: 1, rounds: Math.max(1, rounds), turn: 0, seed };
}

/** Points for a turn: copy mode uses the score; guess mode gives 100 for a correct guess, else 0. */
export function finishTurn(p: Party, points: number): Party {
  const players = p.players.map((pl, i) => (i === p.turn ? { ...pl, score: pl.score + Math.round(points), rounds: pl.rounds + 1 } : pl));
  let turn = p.turn + 1;
  let round = p.round;
  if (turn >= players.length) {
    turn = 0;
    round += 1;
  }
  return { ...p, players, turn, round };
}

export const partyOver = (p: Party) => p.round > p.rounds;

/** Players sorted by score (ties keep join order). */
export function standings(p: Party): Player[] {
  return p.players.map((pl, i) => ({ pl, i })).sort((a, b) => b.pl.score - a.pl.score || a.i - b.i).map((x) => x.pl);
}

/** The line for the current turn: every player gets a different line, stable for the party's seed. */
export function partyLine(packs: Pack[], p: Party, plus: boolean) {
  const n = (p.round - 1) * p.players.length + p.turn;
  return randomLine(packs, plus, p.seed + n * 7919, p.round === 1 ? 2 : 3);
}

export function dareFor(q: Quips, seed: number): string {
  return q.party_dares.length ? q.party_dares[Math.floor(rng(seed)() * q.party_dares.length)] : '';
}

/** Guess mode: loose match, ignoring case, punctuation and small words. */
export function guessMatches(guess: string, answer: string): boolean {
  const words = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with'].includes(w));
  const a = words(answer);
  const g = new Set(words(guess));
  if (!a.length) return guess.trim().toLowerCase() === answer.trim().toLowerCase();
  const hit = a.filter((w) => g.has(w)).length;
  return hit / a.length >= 0.6;
}

// ---------- Plus ----------
export const FREE_SAVES = 12;
export const canSaveMore = (saved: number, plus: boolean) => plus || saved < FREE_SAVES;
/** Longest take, in seconds. */
export const maxTakeSeconds = (plus: boolean) => (plus ? 30 : 15);
