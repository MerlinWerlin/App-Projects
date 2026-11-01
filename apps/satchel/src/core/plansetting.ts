// T140 indoor / outdoor mark for plans (rainy-day plan B). An activity booking (Item.setting) and a Places-to-go idea
// (Idea.setting) can carry the traveller's own mark; without one, a guess from the name (a tested word list: "park",
// "hike", "beach" read as outdoor; "museum", "gallery", "spa" as indoor) and, for ideas, the category (eat / shop read
// as indoor). A guess is always labelled as one in the UI and never stored. Kept in its own small module so ideas.ts,
// tripfile.ts and rainplan.ts can all use it without import cycles. Pure TS, no React Native imports.

export const PLAN_SETTINGS = ['indoor', 'outdoor'] as const;
export type PlanSetting = (typeof PLAN_SETTINGS)[number];

export const isPlanSetting = (x: unknown): x is PlanSetting => x === 'indoor' || x === 'outdoor';

/** A stored mark, or undefined for anything else (absent, damaged, a later build's value). */
export const readPlanSetting = (x: unknown): PlanSetting | undefined => (isPlanSetting(x) ? x : undefined);

/** The mark in use and whether it is only a guess (null: unknown, treated as neither). */
export type PlanMark = { setting: PlanSetting | null; guessed: boolean };

// Whole words (after folding accents and case). Multi-word phrases are matched on the folded text with word edges.
export const OUTDOOR_WORDS: readonly string[] = [
  'outdoor', 'outdoors', 'open air', 'open-air', 'park', 'parks', 'parc', 'parque', 'garden', 'gardens', 'jardin', 'jardim', 'botanic', 'botanical', 'beach', 'beaches', 'plage', 'playa', 'praia',
  'hike', 'hiking', 'trek', 'trekking', 'trail', 'trails', 'walk', 'walking', 'walking tour', 'picnic', 'zoo', 'safari',
  'kayak', 'kayaking', 'canoe', 'boat', 'boat trip', 'cruise', 'sail', 'sailing', 'snorkel', 'snorkelling', 'snorkeling', 'surf',
  'surfing', 'swim', 'bike', 'bikes', 'cycling', 'cycle', 'viewpoint', 'lookout', 'summit', 'mountain', 'volcano', 'waterfall', 'falls',
  'lake', 'river', 'island', 'vineyard', 'golf', 'climb', 'climbing', 'ski', 'skiing', 'stadium', 'fireworks', 'campsite', 'camping',
];
export const INDOOR_WORDS: readonly string[] = [
  'indoor', 'indoors', 'museum', 'museums', 'gallery', 'galleries', 'aquarium', 'cinema', 'theatre', 'theater', 'spa', 'onsen',
  'sauna', 'bathhouse', 'mall', 'shopping centre', 'shopping center', 'cooking class', 'class', 'workshop', 'library', 'concert hall',
  'arcade', 'bowling', 'escape room', 'planetarium', 'restaurant', 'cafe', 'bar', 'pub', 'teahouse', 'tea house', 'exhibition',
];

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim();

const hasWord = (text: string, w: string) => (` ${text} `).includes(` ${w} `);

/**
 * A guess from the words in a name: an explicit "indoor" / "outdoor" wins, else whichever list matches; null when
 * neither or both match ("Botanic garden glasshouse museum"), so an unclear name is never flagged by mistake.
 */
export function guessSetting(...texts: (string | undefined)[]): PlanSetting | null {
  const text = fold(texts.filter((x): x is string => typeof x === 'string').join(' '));
  if (!text) return null;
  const inExplicit = hasWord(text, 'indoor') || hasWord(text, 'indoors');
  const outExplicit = hasWord(text, 'outdoor') || hasWord(text, 'outdoors') || hasWord(text, 'open air') || hasWord(text, 'open-air');
  if (inExplicit !== outExplicit) return inExplicit ? 'indoor' : 'outdoor';
  const out = OUTDOOR_WORDS.some((w) => hasWord(text, w));
  const inn = INDOOR_WORDS.some((w) => hasWord(text, w));
  if (out === inn) return null;
  return out ? 'outdoor' : 'indoor';
}

/** The traveller's own mark when set, else a guess (labelled as one). */
export function markOf(own: unknown, guess: PlanSetting | null): PlanMark {
  const s = readPlanSetting(own);
  return s ? { setting: s, guessed: false } : { setting: guess, guessed: guess !== null };
}
