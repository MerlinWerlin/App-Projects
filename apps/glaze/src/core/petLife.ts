// T188 (owner-1101 #6): Island pets come alive. A pure, deterministic behaviour model: from the
// pet, the local time, quiet hours and the last feed / play / tap it returns what the pet is doing
// now (state + mood + caption + frame set + where it sits), and WHEN that next changes. The app
// pushes a Live Activity update only at those boundaries (sparse, battery-light), and also hands
// the extension the following state so iOS can switch to it at the staleDate without the app.
//
// Day plan (local time, 5-minute grid):
//   quiet hours            sleeping
//   first 20 min after     waking (big stretch)
//   breakfast / lunch / dinner (30 min each, skipped when they fall in quiet hours)  eating
//   the rest of the day    30-minute blocks of idle / wandering / playing, picked by a per-pet
//                          hash of (pet, day, block) so the same minute always gives the same answer.
// Interactions sit on top: a tap gives a short reaction (happy, or a sleepy stir at night) that
// decays after REACTION_MS; Feed gives EAT_MS of eating; Play gives PLAY_MS of playing. Quiet hours
// win over Feed and Play (a sleeping pet is never woken by them).
import type { PetId, PetMood } from './islandPets.ts';

export const PET_LIFE_STATES = ['sleeping', 'waking', 'idle', 'eating', 'playing', 'wandering', 'happy'] as const;
export type PetLifeState = (typeof PET_LIFE_STATES)[number];
export const PET_LIFE_MOODS = ['sleepy', 'content', 'happy', 'playful', 'hungry'] as const;
export type PetLifeMood = (typeof PET_LIFE_MOODS)[number];

/** Pose / frame set drawn for each state (app art and the native Live Activity share these ids). */
export const PET_FRAMES = {
  sleeping: 'sleep', waking: 'stretch', idle: 'sit', eating: 'eat', playing: 'play', wandering: 'walk', happy: 'cheer',
} as const satisfies Record<PetLifeState, string>;
export type PetFrameSet = (typeof PET_FRAMES)[PetLifeState];

/** Caption keys in the `pets` i18n namespace (and `pet.<key>` in the widget Localizable.strings). */
export const PET_CAPTIONS = ['lifeSleeping', 'lifeStir', 'lifeWaking', 'lifeIdle', 'lifeEating', 'lifePlaying', 'lifeWandering', 'lifeHappy'] as const;
export type PetCaption = (typeof PET_CAPTIONS)[number];

export const MINUTE = 60_000;
export const DAY_MIN = 1440;
export const STEP_MIN = 5;
export const BLOCK_MIN = 30;
export const WAKE_MIN = 20;
export const MEAL_MIN = 30;
/** Wander moves to a new spot every this many minutes (so at most one extra update per block). */
export const WANDER_MIN = 15;
export const SPOTS = 5;
export const REACTION_MS = 6_000;
export const EAT_MS = 10 * MINUTE;
export const PLAY_MS = 15 * MINUTE;
/** A feed or a hello keeps the pet happy this long. */
export const HAPPY_MS = 2 * 60 * MINUTE;
/** Pets get hungry this long before a meal unless fed within FED_RECENT_MS. */
export const HUNGRY_LEAD_MIN = 30;
export const FED_RECENT_MS = 3 * 60 * MINUTE;
/** Sleepy in the last hour before bedtime. */
export const WIND_DOWN_MIN = 60;
export const DEFAULT_QUIET = { start: 22 * 60, end: 7 * 60 } as const;
const LUNCH = 12 * 60 + 30;
const DINNER = 18 * 60 + 30;
const BREAKFAST_AFTER_WAKE = 40;
/** Never look further than this for the next change. */
const HORIZON_MS = DAY_MIN * MINUTE;

/** Per-pet temperament: chance out of 100 of idle / wandering / playing in a free block. */
const TEMPERAMENT: Record<PetId, readonly [number, number, number]> = {
  cat: [60, 20, 20],
  fox: [30, 40, 30],
  bunny: [45, 35, 20],
};

export type PetLifeInput = {
  pet: PetId;
  /** Epoch ms. */
  now: number;
  /** Minutes east of UTC for the local clock (in the app: -new Date().getTimezoneOffset()). */
  offsetMin: number;
  /** Minutes after local midnight; snapped to the 5-minute grid. */
  quietStart?: number;
  quietEnd?: number;
  lastFedAt?: number | null;
  lastPlayAt?: number | null;
  lastTapAt?: number | null;
};

export type PetLifeFrame = {
  state: PetLifeState;
  mood: PetLifeMood;
  caption: PetCaption;
  frames: PetFrameSet;
  /** 0..SPOTS-1, left to right; wandering moves between spots. */
  spot: number;
};

export type PetLife = PetLifeFrame & {
  /** Epoch ms of the next change of state, mood, caption or spot (use it as staleDate). */
  until: number;
  /** What the pet does from `until` on if nothing else happens. */
  next: PetLifeFrame;
  /** A tap reaction is showing (it ends at `until`). */
  reacting: boolean;
  /** Feed and Play are offered only while the pet is awake. */
  canFeed: boolean;
  canPlay: boolean;
};

const mod = (n: number, m: number) => ((n % m) + m) % m;
export const snapMinutes = (m: number) => mod(Math.round((Number.isFinite(m) ? m : 0) / STEP_MIN) * STEP_MIN, DAY_MIN);

/** True when minute `m` of the day is in [from, from + len) on the 24 h circle. */
function within(m: number, from: number, len: number): boolean {
  return len > 0 && mod(m - from, DAY_MIN) < len;
}

/** Small deterministic string hash (FNV-1a, 32-bit). */
export function lifeHash(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

type Quiet = { start: number; len: number; end: number };
function quietOf(input: PetLifeInput): Quiet {
  const start = snapMinutes(input.quietStart ?? DEFAULT_QUIET.start);
  const end = snapMinutes(input.quietEnd ?? DEFAULT_QUIET.end);
  return { start, end, len: mod(end - start, DAY_MIN) };
}

/** Meal starts for these quiet hours: breakfast after waking, lunch, dinner; none overlap sleep or each other. */
export function mealStarts(quietStart: number, quietEnd: number): number[] {
  const q = quietOf({ pet: 'cat', now: 0, offsetMin: 0, quietStart, quietEnd });
  const awake = (m: number) => !within(m, q.start, q.len) && !within(m, q.end, q.len === 0 ? 0 : WAKE_MIN);
  const out: number[] = [];
  for (const start of [q.len === 0 ? 8 * 60 : mod(q.end + BREAKFAST_AFTER_WAKE, DAY_MIN), LUNCH, DINNER]) {
    if (!awake(start) || !awake(mod(start + MEAL_MIN - 1, DAY_MIN))) continue;
    if (out.some(o => within(start, o, MEAL_MIN) || within(o, start, MEAL_MIN))) continue;
    out.push(start);
  }
  return out;
}

type Base = { state: PetLifeState; spot: number };
/** The plan for local minute `m` of local day `day`, ignoring interactions. */
function baseAt(pet: PetId, day: number, m: number, q: Quiet, meals: number[]): Base {
  if (within(m, q.start, q.len)) return { state: 'sleeping', spot: 1 };
  if (q.len > 0 && within(m, q.end, WAKE_MIN)) return { state: 'waking', spot: 1 };
  if (meals.some(s => within(m, s, MEAL_MIN))) return { state: 'eating', spot: 3 };
  const block = Math.floor(m / BLOCK_MIN);
  const [idle, wander] = TEMPERAMENT[pet] ?? TEMPERAMENT.cat;
  const roll = lifeHash(pet, day, block) % 100;
  if (roll < idle) return { state: 'idle', spot: 2 };
  if (roll < idle + wander) return { state: 'wandering', spot: lifeHash(pet, day, 'walk', Math.floor(m / WANDER_MIN)) % SPOTS };
  return { state: 'playing', spot: lifeHash(pet, day, 'play', block) % SPOTS };
}

const recent = (at: number | null | undefined, now: number, span: number) =>
  typeof at === 'number' && Number.isFinite(at) && at <= now && now < at + span;

/** What the pet is doing at `now` (no look-ahead). */
export function petFrameAt(input: PetLifeInput): PetLifeFrame & { reacting: boolean } {
  const q = quietOf(input);
  const meals = mealStarts(q.start, q.end);
  const local = input.now + input.offsetMin * MINUTE;
  const day = Math.floor(local / (DAY_MIN * MINUTE));
  const m = Math.floor(mod(local, DAY_MIN * MINUTE) / MINUTE);
  const base = baseAt(input.pet, day, m, q, meals);
  const asleep = base.state === 'sleeping';
  let state = base.state;
  let spot = base.spot;
  let caption: PetCaption | null = null;
  const reacting = recent(input.lastTapAt, input.now, REACTION_MS);
  if (reacting) {
    if (asleep) { state = 'waking'; caption = 'lifeStir'; } else state = 'happy';
  } else if (!asleep && recent(input.lastFedAt, input.now, EAT_MS)) { state = 'eating'; spot = 3; }
  else if (!asleep && recent(input.lastPlayAt, input.now, PLAY_MS)) { state = 'playing'; spot = 2; }

  let mood: PetLifeMood;
  if (state === 'sleeping' || state === 'waking') mood = 'sleepy';
  else if (state === 'happy') mood = 'happy';
  else if (state !== 'eating' && meals.some(s => within(m, mod(s - HUNGRY_LEAD_MIN, DAY_MIN), HUNGRY_LEAD_MIN)) &&
    !recent(input.lastFedAt, input.now, FED_RECENT_MS)) mood = 'hungry';
  else if (state === 'playing' || state === 'wandering') mood = 'playful';
  else if (q.len > 0 && within(m, mod(q.start - WIND_DOWN_MIN, DAY_MIN), WIND_DOWN_MIN)) mood = 'sleepy';
  else if (recent(input.lastTapAt, input.now, HAPPY_MS) || recent(input.lastFedAt, input.now, HAPPY_MS)) mood = 'happy';
  else mood = 'content';

  const captions: Record<PetLifeState, PetCaption> = {
    sleeping: 'lifeSleeping', waking: 'lifeWaking', idle: 'lifeIdle', eating: 'lifeEating',
    playing: 'lifePlaying', wandering: 'lifeWandering', happy: 'lifeHappy',
  };
  return { state, mood, caption: caption ?? captions[state], frames: PET_FRAMES[state], spot, reacting };
}

const same = (a: PetLifeFrame, b: PetLifeFrame) =>
  a.state === b.state && a.mood === b.mood && a.caption === b.caption && a.spot === b.spot;

/** Current frame plus the next boundary and the frame after it. */
export function petLife(input: PetLifeInput): PetLife {
  const now = Number.isFinite(input.now) ? input.now : 0;
  const at = (t: number) => petFrameAt({ ...input, now: t });
  const current = at(now);
  // Candidate boundaries: every 5-minute local grid point ahead, plus each interaction expiry.
  const step = STEP_MIN * MINUTE;
  const local = now + input.offsetMin * MINUTE;
  const firstGrid = now + (step - mod(local, step));
  const expiries: number[] = [];
  for (const [t, spans] of [
    [input.lastTapAt, [REACTION_MS, HAPPY_MS]],
    [input.lastFedAt, [EAT_MS, HAPPY_MS, FED_RECENT_MS]],
    [input.lastPlayAt, [PLAY_MS]],
  ] as const) {
    if (typeof t !== 'number' || !Number.isFinite(t)) continue;
    for (const span of spans) if (t + span > now && t + span < firstGrid + HORIZON_MS) expiries.push(t + span);
  }
  const candidates = expiries;
  for (let g = firstGrid; g <= now + HORIZON_MS; g += step) candidates.push(g);
  candidates.sort((a, b) => a - b);
  let until = now + HORIZON_MS;
  for (const t of candidates) {
    if (!same(at(t), current)) { until = t; break; }
  }
  const { reacting: _r, ...next } = at(until);
  const { reacting, ...frame } = current;
  const asleep = frame.state === 'sleeping' || (reacting && frame.caption === 'lifeStir');
  return { ...frame, until, next, reacting, canFeed: !asleep, canPlay: !asleep };
}

/** The three legacy native poses (happy / playful / sleepy) for older builds' Live Activity. */
export function legacyPose(mood: PetLifeMood, state: PetLifeState): PetMood {
  if (mood === 'sleepy' || state === 'sleeping') return 'sleepy';
  if (mood === 'playful' || state === 'playing' || state === 'wandering') return 'playful';
  return 'happy';
}

/** Content state sent to the Live Activity (ActivityKit ContentState, all optional on the Swift side). */
export type PetActivityState = {
  state: PetLifeState;
  mood: PetMood;
  lifeMood: PetLifeMood;
  spot: number;
  /** Epoch ms; the staleDate. */
  until: number;
  nextState: PetLifeState;
  nextMood: PetLifeMood;
  nextSpot: number;
};
export function activityStateFor(life: PetLife): PetActivityState {
  return {
    state: life.reacting && life.caption === 'lifeStir' ? 'sleeping' : life.state,
    mood: legacyPose(life.mood, life.state),
    lifeMood: life.mood,
    spot: life.spot,
    until: life.until,
    nextState: life.next.state,
    nextMood: life.next.mood,
    nextSpot: life.next.spot,
  };
}

/** True when the Live Activity needs a new content state (only state / mood / spot changes count). */
export function activityChanged(prev: PetActivityState | null, next: PetActivityState): boolean {
  if (!prev) return true;
  return prev.state !== next.state || prev.lifeMood !== next.lifeMood || prev.spot !== next.spot ||
    prev.nextState !== next.nextState || prev.nextSpot !== next.nextSpot || prev.until !== next.until;
}

// ---- Settings (stored by src/store/pets.ts; pure parsing here) ----

export const PET_NAME_MAX = 16;
export const PET_SETTINGS_KEY = 'glaze.pets.v1';
/** Last interactions with one pet (epoch ms). */
export type PetCare = { fedAt: number | null; playAt: number | null; tapAt: number | null };
export type PetSettings = {
  /** The companion shown on the Island. */
  pet: PetId;
  /** Keep the Live Activity running (full iPhone build only). */
  island: boolean;
  quietStart: number;
  quietEnd: number;
  names: Partial<Record<PetId, string>>;
  care: Partial<Record<PetId, PetCare>>;
};
export const DEFAULT_PET_SETTINGS: PetSettings = {
  pet: 'cat', island: false, quietStart: DEFAULT_QUIET.start, quietEnd: DEFAULT_QUIET.end, names: {}, care: {},
};

export function cleanPetName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return [...raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()].slice(0, PET_NAME_MAX).join('');
}

export const PET_IDS: readonly PetId[] = ['cat', 'fox', 'bunny'];
const stamp = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

export function parsePetSettings(raw: unknown): PetSettings {
  let r: Record<string, unknown> = {};
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (v && typeof v === 'object' && !Array.isArray(v)) r = v as Record<string, unknown>;
  } catch { /* defaults */ }
  const names: Partial<Record<PetId, string>> = {};
  const care: Partial<Record<PetId, PetCare>> = {};
  const rn = r.names && typeof r.names === 'object' ? (r.names as Record<string, unknown>) : {};
  const rc = r.care && typeof r.care === 'object' ? (r.care as Record<string, unknown>) : {};
  for (const id of PET_IDS) {
    const n = cleanPetName(rn[id]);
    if (n) names[id] = n;
    const c = rc[id];
    if (c && typeof c === 'object') {
      const o = c as Record<string, unknown>;
      care[id] = { fedAt: stamp(o.fedAt), playAt: stamp(o.playAt), tapAt: stamp(o.tapAt) };
    }
  }
  const minutes = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? snapMinutes(v) : d);
  return {
    pet: PET_IDS.includes(r.pet as PetId) ? (r.pet as PetId) : DEFAULT_PET_SETTINGS.pet,
    island: r.island === true,
    quietStart: minutes(r.quietStart, DEFAULT_QUIET.start),
    quietEnd: minutes(r.quietEnd, DEFAULT_QUIET.end),
    names,
    care,
  };
}

/** Records a feed / play / tap at `now` for one pet. */
export function withCare(settings: PetSettings, pet: PetId, kind: keyof PetCare, now: number): PetSettings {
  const prev = settings.care[pet] ?? { fedAt: null, playAt: null, tapAt: null };
  return { ...settings, care: { ...settings.care, [pet]: { ...prev, [kind]: now } } };
}

/** The petLife input for one pet under these settings. */
export function lifeInputFor(settings: PetSettings, pet: PetId, now: number, offsetMin: number): PetLifeInput {
  const c = settings.care[pet];
  return {
    pet, now, offsetMin, quietStart: settings.quietStart, quietEnd: settings.quietEnd,
    lastFedAt: c?.fedAt ?? null, lastPlayAt: c?.playAt ?? null, lastTapAt: c?.tapAt ?? null,
  };
}

/** Moves a quiet-hours edge by `deltaMin`, keeping at least 4 h awake and 4 h asleep. */
export function shiftQuiet(settings: PetSettings, edge: 'quietStart' | 'quietEnd', deltaMin: number): PetSettings {
  const next = { ...settings, [edge]: snapMinutes(settings[edge] + deltaMin) };
  const len = mod(next.quietEnd - next.quietStart, DAY_MIN);
  if (len < 4 * 60 || len > 20 * 60) return settings;
  return next;
}

/** The pet's display name: the owner's rename, else its default. */
export function petDisplayName(settings: Pick<PetSettings, 'names'>, pet: PetId, fallback: string): string {
  return settings.names[pet] || fallback;
}

/** "HH:MM" for a minute of the day (24 h, used by tests and as an accessibility value). */
export function clockLabel(m: number): string {
  const s = snapMinutes(m);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
