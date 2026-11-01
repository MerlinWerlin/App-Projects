// T125 Travel games for the wait: offline games for queues, flights, trains and car trips, for two or a family.
//   - Travel bingo: a 5x5 card drawn from the mode's original icon tiles (src/content/games.json, drawn by
//     src/ui/gameIcons.tsx), a deterministic shuffle by seed (same seed, same card), a free centre, tap to mark and
//     line detection (5 rows, 5 columns, 2 diagonals).
//   - I spy / spot it: a short list of things to spot for the mode, ticked off.
//   - Question deck: family-friendly "would you rather", "tell me about" and trip memory prompts, drawn without
//     repeats until the deck runs out (then a fresh round). Memory answers can be saved to the trip journal.
//   - Score keeper: You plus the trip's companions, a point up or down each.
// Game state lives on this phone only (GAMES_KEY), never in a trip or a trip file. Pure TypeScript; Node runs it.
import type { Companion, ItemKind } from './model.ts';

export const GAMES_KEY = 'satchel.games.v1';

export const GAME_MODES = ['air', 'train', 'road', 'city'] as const;
export type GameMode = (typeof GAME_MODES)[number];
export const isGameMode = (x: unknown): x is GameMode => typeof x === 'string' && (GAME_MODES as readonly string[]).includes(x);

/** Every glyph src/ui/gameIcons.tsx draws. A tile names one of these (content test). */
export const GAME_ICONS = [
  'plane', 'suitcase', 'passport', 'ticket', 'tower', 'clock', 'coffee', 'window', 'cloud', 'sun', 'headphones', 'trolley',
  'escalator', 'sign', 'carousel', 'buckle', 'pillow', 'book', 'bottle', 'sandwich', 'wing', 'moon', 'backpack', 'camera',
  'plug', 'map', 'train', 'track', 'bench', 'whistle', 'bridge', 'tunnel', 'cow', 'tree', 'house', 'river', 'mountain',
  'bicycle', 'umbrella', 'bird', 'flower', 'car', 'fuel', 'trafficlight', 'cone', 'truck', 'bus', 'turbine', 'tent', 'boat',
  'flag', 'rainbow', 'apple', 'stop', 'fountain', 'monument', 'icecream', 'balloon', 'tram', 'crossing', 'lamp', 'postbox',
  'palette', 'awning', 'bread', 'door',
] as const;
export type GameIcon = (typeof GAME_ICONS)[number];
export const isGameIcon = (x: unknown): x is GameIcon => typeof x === 'string' && (GAME_ICONS as readonly string[]).includes(x);

export type BingoTile = { id: string; label: string; icon: GameIcon };
export type SpyItem = { id: string; text: string };
export const DECKS = ['rather', 'tell', 'memory'] as const;
export type DeckId = (typeof DECKS)[number];
export const isDeckId = (x: unknown): x is DeckId => typeof x === 'string' && (DECKS as readonly string[]).includes(x);
export type DeckCard = { id: string; text: string };

export type GamesContent = {
  version: number;
  written: string;
  note: string;
  bingo: Record<GameMode, BingoTile[]>;
  spy: Record<GameMode, SpyItem[]>;
  decks: Record<DeckId, DeckCard[]>;
};

// ---------------------------------------------------------------- seeded randomness

/** A 32-bit seed from any text (FNV-1a). */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A small seeded generator (mulberry32): numbers in [0, 1), the same run for the same seed. */
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

/** A new copy of `list` in a seeded order (Fisher-Yates). The input is never changed. */
export function shuffle<T>(list: readonly T[], seed: number): T[] {
  const out = list.slice();
  const next = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** A fresh seed for a new card (the UI passes Date.now(); tests pass a fixed number). */
export const newSeed = (now: number): number => seedFrom(`seed:${now}`);

// ---------------------------------------------------------------- bingo

export const BINGO_SIZE = 5;
export const BINGO_CELLS = BINGO_SIZE * BINGO_SIZE;
/** The free middle square (always marked). */
export const FREE_INDEX = Math.floor(BINGO_CELLS / 2);
export const FREE = 'free';
/** Tiles a mode needs for a card (every square but the free one). */
export const TILES_NEEDED = BINGO_CELLS - 1;

export type BingoCard = { mode: GameMode; seed: number; cells: string[] };

/** The card for a mode and seed: 24 tile ids in seeded order with FREE in the middle. Null with too few tiles. */
export function buildCard(tiles: readonly BingoTile[], mode: GameMode, seed: number): BingoCard | null {
  const ids = [...new Set(tiles.map((t) => t.id))].sort();
  if (ids.length < TILES_NEEDED) return null;
  const picked = shuffle(ids, seedFrom(`${mode}:${seed}`)).slice(0, TILES_NEEDED);
  const cells = [...picked.slice(0, FREE_INDEX), FREE, ...picked.slice(FREE_INDEX)];
  return { mode, seed, cells };
}

export type LineKind = 'row' | 'col' | 'diag';
export type BingoLine = { id: string; kind: LineKind; cells: number[] };

/** All 12 lines on a 5x5 card. */
export const ALL_LINES: readonly BingoLine[] = (() => {
  const n = BINGO_SIZE;
  const out: BingoLine[] = [];
  for (let r = 0; r < n; r++) out.push({ id: `row${r}`, kind: 'row', cells: Array.from({ length: n }, (_, c) => r * n + c) });
  for (let c = 0; c < n; c++) out.push({ id: `col${c}`, kind: 'col', cells: Array.from({ length: n }, (_, r) => r * n + c) });
  out.push({ id: 'diag0', kind: 'diag', cells: Array.from({ length: n }, (_, i) => i * n + i) });
  out.push({ id: 'diag1', kind: 'diag', cells: Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)) });
  return out;
})();

/** Marked square indexes, cleaned: whole numbers on the card, no repeats, sorted, the free square always in. */
export function cleanMarks(marks: readonly unknown[]): number[] {
  const set = new Set<number>([FREE_INDEX]);
  for (const m of marks) if (typeof m === 'number' && Number.isInteger(m) && m >= 0 && m < BINGO_CELLS) set.add(m);
  return [...set].sort((a, b) => a - b);
}

/** Marks with square `i` flipped. The free square never unmarks. */
export function toggleMark(marks: readonly number[], i: number): number[] {
  if (i === FREE_INDEX) return cleanMarks(marks);
  return cleanMarks(marks.includes(i) ? marks.filter((m) => m !== i) : [...marks, i]);
}

/** The complete lines for these marks. */
export function bingoLines(marks: readonly number[]): BingoLine[] {
  const set = new Set(cleanMarks(marks));
  return ALL_LINES.filter((l) => l.cells.every((c) => set.has(c)));
}

/** Lines complete after a change that were not complete before it (what to highlight and announce). */
export function newLines(before: readonly number[], after: readonly number[]): BingoLine[] {
  const had = new Set(bingoLines(before).map((l) => l.id));
  return bingoLines(after).filter((l) => !had.has(l.id));
}

/** Square indexes on any complete line. */
export function cellsOnLines(lines: readonly BingoLine[]): Set<number> {
  return new Set(lines.flatMap((l) => l.cells));
}

/** Every square marked. */
export const isFullCard = (marks: readonly number[]): boolean => cleanMarks(marks).length === BINGO_CELLS;

// ---------------------------------------------------------------- travel mode from a booking

/** The bingo / spy mode that suits a booking kind (flight: air; train: train; car or bus: road; anything else: city). */
export function modeForKind(kind: ItemKind | undefined): GameMode {
  if (kind === 'flight') return 'air';
  if (kind === 'train') return 'train';
  if (kind === 'car' || kind === 'bus') return 'road';
  return 'city';
}

// ---------------------------------------------------------------- spot it

/** Ticked spot-it ids, cleaned against the mode's list (stored order kept, no repeats). */
export function cleanTicks(ticks: readonly unknown[], items: readonly SpyItem[]): string[] {
  const known = new Set(items.map((i) => i.id));
  return [...new Set(ticks.filter((x): x is string => typeof x === 'string' && known.has(x)))];
}

export const toggleTick = (ticks: readonly string[], id: string): string[] => (ticks.includes(id) ? ticks.filter((x) => x !== id) : [...ticks, id]);

// ---------------------------------------------------------------- question deck

/** `seed` is the one to keep for the next draw (it moves on by one when a new round starts). */
export type DeckDraw = { card: DeckCard; seen: string[]; newRound: boolean; seed: number };

/**
 * The next card from a deck without repeats: the first card, in the seed's order, not seen yet. When every card has
 * been seen a new round starts (seen resets and the seed moves on, so the order reshuffles), so a card never comes
 * back until the whole deck has been through. Null for an empty deck.
 */
export function drawCard(cards: readonly DeckCard[], seen: readonly string[], seed: number): DeckDraw | null {
  if (!cards.length) return null;
  const known = new Set(cards.map((c) => c.id));
  let kept = [...new Set(seen.filter((id) => known.has(id)))];
  let newRound = false;
  let s = seed >>> 0;
  if (kept.length >= known.size) {
    kept = [];
    newRound = true;
    s = (s + 1) >>> 0;
  }
  const sorted = cards.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const order = shuffle(sorted, seedFrom(`deck:${s}`));
  const pick = order.find((c) => !kept.includes(c.id)) as DeckCard;
  return { card: pick, seen: [...kept, pick.id], newRound, seed: s };
}

// ---------------------------------------------------------------- score keeper

export const MAX_PLAYERS = 12;
export const MAX_SCORE = 999;
export const MAX_PLAYER_NAME = 24;
export type Player = { id: string; name: string; score: number };

const tidyName = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, MAX_PLAYER_NAME);

/** You plus the trip's companions, each on 0 (capped at MAX_PLAYERS). */
export function playersFor(companions: readonly Companion[], youName: string): Player[] {
  const out: Player[] = [{ id: 'me', name: tidyName(youName) || 'Me', score: 0 }];
  for (const c of companions) {
    const name = tidyName(c.name);
    if (!name || out.some((p) => p.id === c.id)) continue;
    out.push({ id: c.id, name, score: 0 });
  }
  return out.slice(0, MAX_PLAYERS);
}

/** Companions who are not on the board yet (prefill a board that was started earlier). */
export function missingPlayers(players: readonly Player[], companions: readonly Companion[]): Player[] {
  const have = new Set(players.map((p) => p.id));
  return companions.filter((c) => !have.has(c.id) && tidyName(c.name)).map((c) => ({ id: c.id, name: tidyName(c.name), score: 0 }));
}

export const clampScore = (n: number): number => Math.max(0, Math.min(MAX_SCORE, Math.round(Number.isFinite(n) ? n : 0)));

export const addPoints = (players: readonly Player[], id: string, delta: number): Player[] =>
  players.map((p) => (p.id === id ? { ...p, score: clampScore(p.score + delta) } : p));

export const resetScores = (players: readonly Player[]): Player[] => players.map((p) => ({ ...p, score: 0 }));

/** Adds a player by name; unchanged when the name is empty, already on the board or the board is full. */
export function addPlayer(players: readonly Player[], name: string, id: string): Player[] {
  const n = tidyName(name);
  if (!n || players.length >= MAX_PLAYERS || players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return players.slice();
  return [...players, { id, name: n, score: 0 }];
}

export const removePlayer = (players: readonly Player[], id: string): Player[] => players.filter((p) => p.id !== id);

/** The players with the top score (empty when everyone is on 0). */
export function leaders(players: readonly Player[]): Player[] {
  const top = Math.max(0, ...players.map((p) => p.score));
  return top > 0 ? players.filter((p) => p.score === top) : [];
}

export function cleanPlayers(raw: unknown): Player[] {
  if (!Array.isArray(raw)) return [];
  const out: Player[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const r = p as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id || typeof r.name !== 'string' || !tidyName(r.name)) continue;
    if (out.some((x) => x.id === r.id)) continue;
    out.push({ id: r.id, name: tidyName(r.name), score: clampScore(typeof r.score === 'number' ? r.score : 0) });
  }
  return out.slice(0, MAX_PLAYERS);
}

// ---------------------------------------------------------------- journal

export const MAX_ANSWER = 1000;

/** The journal page text for a trip memory prompt and its answer ("prompt" then the answer). Empty answer: ''. */
export function memoryNote(prompt: string, answer: string): string {
  const a = answer.trim().slice(0, MAX_ANSWER);
  if (!a) return '';
  return `${prompt.trim()}\n${a}`;
}

// ---------------------------------------------------------------- stored state (this phone only)

export type BingoState = { mode: GameMode; seed: number; marks: number[] };
export type GamesState = {
  bingo?: BingoState;
  spy: Partial<Record<GameMode, string[]>>;
  seen: Partial<Record<DeckId, string[]>>;
  deckSeed: number;
  players: Player[];
};

export const emptyGames = (): GamesState => ({ spy: {}, seen: {}, deckSeed: 1, players: [] });

/** The stored value, cleaned on every read: unknown fields dropped, bad values reset. */
export function cleanGames(raw: unknown): GamesState {
  const out = emptyGames();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  const b = r.bingo as Record<string, unknown> | undefined;
  if (b && isGameMode(b.mode) && typeof b.seed === 'number' && Number.isFinite(b.seed)) {
    out.bingo = { mode: b.mode, seed: b.seed >>> 0, marks: cleanMarks(Array.isArray(b.marks) ? b.marks : []) };
  }
  const spy = r.spy as Record<string, unknown> | undefined;
  if (spy && typeof spy === 'object') {
    for (const m of GAME_MODES) {
      const v = spy[m];
      if (Array.isArray(v)) out.spy[m] = [...new Set(v.filter((x): x is string => typeof x === 'string'))];
    }
  }
  const seen = r.seen as Record<string, unknown> | undefined;
  if (seen && typeof seen === 'object') {
    for (const d of DECKS) {
      const v = seen[d];
      if (Array.isArray(v)) out.seen[d] = [...new Set(v.filter((x): x is string => typeof x === 'string'))];
    }
  }
  if (typeof r.deckSeed === 'number' && Number.isFinite(r.deckSeed)) out.deckSeed = r.deckSeed >>> 0;
  out.players = cleanPlayers(r.players);
  return out;
}

// ---------------------------------------------------------------- content checks

const ID = /^[a-z][a-z0-9-]*$/;

/** Problems with a games content file (empty when fine): ids, counts, icons, lengths and spacing. */
export function contentProblems(c: GamesContent): string[] {
  const out: string[] = [];
  const text = (where: string, s: unknown, max: number) => {
    if (typeof s !== 'string' || !s.trim()) out.push(`${where}: empty`);
    else {
      if (s.length > max) out.push(`${where}: longer than ${max}`);
      if (/\s{2,}|^\s|\s$/.test(s)) out.push(`${where}: spacing`);
    }
  };
  const ids = new Set<string>();
  const id = (where: string, x: unknown) => {
    if (typeof x !== 'string' || !ID.test(x)) out.push(`${where}: bad id`);
    else if (ids.has(x)) out.push(`${where}: duplicate id ${x}`);
    else ids.add(x);
  };
  for (const m of GAME_MODES) {
    const tiles = c.bingo?.[m] ?? [];
    if (tiles.length < TILES_NEEDED) out.push(`bingo.${m}: ${tiles.length} tiles, needs ${TILES_NEEDED}`);
    for (const t of tiles) {
      id(`bingo.${m}`, t.id);
      text(`bingo.${m}.${t.id}`, t.label, 18);
      if (!isGameIcon(t.icon)) out.push(`bingo.${m}.${t.id}: unknown icon ${String(t.icon)}`);
    }
    const spy = c.spy?.[m] ?? [];
    if (spy.length < 10) out.push(`spy.${m}: only ${spy.length}`);
    for (const s of spy) {
      id(`spy.${m}`, s.id);
      text(`spy.${m}.${s.id}`, s.text, 70);
    }
  }
  for (const d of DECKS) {
    const cards = c.decks?.[d] ?? [];
    if (cards.length < 20) out.push(`decks.${d}: only ${cards.length}`);
    for (const k of cards) {
      id(`decks.${d}`, k.id);
      text(`decks.${d}.${k.id}`, k.text, 120);
    }
  }
  return out;
}
