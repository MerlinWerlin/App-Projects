// T110 "Menu helper": an offline food-word dictionary (src/content/menu.json, passed in by the caller) for reading
// menus and asking about dishes in ten languages. Pure TypeScript, fully offline.
// - Search works both ways (English or the local word / its romanisation), ignoring case, accents and tone marks,
//   full- / half-width forms and hiragana vs katakana.
// - Each word carries flags ("usually contains pork / shellfish / nuts / alcohol..."); pork, beef and poultry imply
//   meat. The traveller's diet (chosen on the screen, kept on this phone) says which flags to watch for.
// - The language follows the trip's country like the phrase cards (src/core/phrases.ts), when we carry menu words
//   for it. T112: Traditional Chinese (Taiwan words, Hanyu Pinyin) and Indonesian added, listed in the table's
//   toNativeCheck until a native speaker has checked them.
import { hasNonLatin, isPhraseLang, languageForCountry, type PhraseTable } from './phrases.ts';

export const MENU_LANGS = ['ja', 'zh-Hans', 'zh-Hant', 'ko', 'th', 'vi', 'fr', 'it', 'es', 'de', 'pt', 'id'] as const;
export type MenuLang = (typeof MENU_LANGS)[number];
/** Languages written in a non-Latin script: every word needs a romanisation. */
export const NON_LATIN_MENU_LANGS: readonly MenuLang[] = ['ja', 'zh-Hans', 'zh-Hant', 'ko', 'th'];
export const DEFAULT_MENU_LANG: MenuLang = 'ja';

export const MENU_CATS = ['meat', 'seafood', 'eggDairy', 'nuts', 'veg', 'staple', 'cooking', 'taste', 'drink', 'diet'] as const;
export type MenuCat = (typeof MENU_CATS)[number];

export const MENU_FLAGS = ['meat', 'pork', 'beef', 'poultry', 'fish', 'shellfish', 'egg', 'dairy', 'peanut', 'treeNut', 'gluten', 'soy', 'sesame', 'alcohol', 'honey'] as const;
export type MenuFlag = (typeof MENU_FLAGS)[number];
/** Flags that imply another flag (a pork dish is a meat dish). */
const IMPLIES: Partial<Record<MenuFlag, MenuFlag[]>> = { pork: ['meat'], beef: ['meat'], poultry: ['meat'] };

export const DIET_IDS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'noPork',
  'noBeef',
  'noAlcohol',
  'halalStyle',
  'peanut',
  'treeNut',
  'shellfish',
  'fish',
  'dairy',
  'egg',
  'gluten',
  'soy',
  'sesame',
] as const;
export type DietId = (typeof DIET_IDS)[number];
/** What each diet watches for. Allergy diets watch their own flag. */
export const DIET_FLAGS: Record<DietId, readonly MenuFlag[]> = {
  vegetarian: ['meat', 'fish', 'shellfish'],
  vegan: ['meat', 'fish', 'shellfish', 'egg', 'dairy', 'honey'],
  pescatarian: ['meat'],
  noPork: ['pork'],
  noBeef: ['beef'],
  noAlcohol: ['alcohol'],
  halalStyle: ['pork', 'alcohol'],
  peanut: ['peanut'],
  treeNut: ['treeNut'],
  shellfish: ['shellfish'],
  fish: ['fish'],
  dairy: ['dairy'],
  egg: ['egg'],
  gluten: ['gluten'],
  soy: ['soy'],
  sesame: ['sesame'],
};

/** Persisted keys (src/state/persisted.ts): the diet picked on the menu screen, and the language last used there. */
export const MENU_DIET_KEY = 'satchel.menuDiet.v1';
export const MENU_LANG_KEY = 'satchel.menuLang.v1';

export type MenuLine = { text: string; roman?: string };
export type MenuEntry = { id: string; cat: string; flags: string[]; en: string; also?: string[]; words: Partial<Record<string, MenuLine>> };
/** toNativeCheck (T112): languages added since the last native-speaker check, to check first. */
export type MenuTable = { version: number; checked?: string; note?: string; toNativeCheck?: string[]; languages: string[]; entries: MenuEntry[] };

export const isMenuLang = (v: unknown): v is MenuLang => typeof v === 'string' && (MENU_LANGS as readonly string[]).includes(v);
export const isMenuFlag = (v: unknown): v is MenuFlag => typeof v === 'string' && (MENU_FLAGS as readonly string[]).includes(v);
export const isDietId = (v: unknown): v is DietId => typeof v === 'string' && (DIET_IDS as readonly string[]).includes(v);
const isMenuCat = (v: unknown): v is MenuCat => typeof v === 'string' && (MENU_CATS as readonly string[]).includes(v);

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
/** A route param (?lang=) as a menu language, or null. */
export const parseMenuLangParam = (v: unknown): MenuLang | null => {
  const s = first(v);
  return isMenuLang(s) ? s : null;
};

/** The menu language for a phrase language, or null when we carry no menu words for it. */
export const menuLangFor = (lang: unknown): MenuLang | null => (isMenuLang(lang) ? lang : null);

/** The menu language for a country (ISO 3166-1 alpha-2), via the phrase table's country list; null when none. */
export const menuLangForCountry = (phrases: PhraseTable, iso2: string | null | undefined): MenuLang | null => menuLangFor(languageForCountry(phrases, iso2));

/** Which language to open: trip country, then the last one used here, then the phone's zone country, then Japanese. */
export function pickMenuLang(
  phrases: PhraseTable,
  opts: { tripCountry?: string | null; lastUsed?: unknown; phoneCountry?: string | null },
): { lang: MenuLang; from: 'trip' | 'last' | 'phone' | 'default' } {
  const trip = menuLangForCountry(phrases, opts.tripCountry);
  if (trip) return { lang: trip, from: 'trip' };
  if (isMenuLang(opts.lastUsed)) return { lang: opts.lastUsed, from: 'last' };
  const phone = menuLangForCountry(phrases, opts.phoneCountry);
  if (phone) return { lang: phone, from: 'phone' };
  return { lang: DEFAULT_MENU_LANG, from: 'default' };
}

// ---- diet ----

/** A stored diet list as known ids, no repeats, in the fixed order. Anything else (or junk storage) -> []. */
export function normaliseDiets(raw: unknown): DietId[] {
  if (!Array.isArray(raw)) return [];
  return DIET_IDS.filter((id) => raw.includes(id));
}

/** The diet list with this one added, or removed when it was already there. */
export function toggleDiet(raw: unknown, id: DietId): DietId[] {
  const list = normaliseDiets(raw);
  return list.includes(id) ? list.filter((x) => x !== id) : normaliseDiets([...list, id]);
}

/** Every flag the picked diets watch for, in MENU_FLAGS order. */
export function watchedFlags(diets: unknown): MenuFlag[] {
  const set = new Set<MenuFlag>();
  for (const d of normaliseDiets(diets)) for (const f of DIET_FLAGS[d]) set.add(f);
  return MENU_FLAGS.filter((f) => set.has(f));
}

/** An entry's flags with the implied ones added (pork -> meat), known flags only, in MENU_FLAGS order. */
export function entryFlags(entry: Pick<MenuEntry, 'flags'>): MenuFlag[] {
  const set = new Set<MenuFlag>();
  for (const f of entry.flags) {
    if (!isMenuFlag(f)) continue;
    set.add(f);
    for (const g of IMPLIES[f] ?? []) set.add(g);
  }
  return MENU_FLAGS.filter((f) => set.has(f));
}

// ---- search ----

const HIRAGANA_START = 0x3041;
const HIRAGANA_END = 0x3096;
const KANA_SHIFT = 0x60;
const SPECIAL: Record<string, string> = { đ: 'd', ß: 'ss', œ: 'oe', æ: 'ae', ø: 'o', ł: 'l' };

/**
 * Folds text for matching: NFKC (full-width Latin and half-width katakana become ordinary forms), lower case,
 * Latin accents and tone marks dropped (é -> e, ō -> o, ǎ -> a, ư -> u, đ -> d), hiragana -> katakana, and spaces,
 * hyphens and punctuation removed. Thai and Korean are left as they are (their marks are not accents).
 */
export function foldText(s: string): string {
  let out = s.normalize('NFKC').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
  out = out.replace(/[đßœæøł]/g, (c) => SPECIAL[c] ?? c);
  let kana = '';
  for (const ch of out) {
    const code = ch.codePointAt(0) ?? 0;
    kana += code >= HIRAGANA_START && code <= HIRAGANA_END ? String.fromCodePoint(code + KANA_SHIFT) : ch;
  }
  return kana.replace(/[^\p{L}\p{N}\p{M}]/gu, '');
}

export type MenuWord = {
  id: string;
  cat: MenuCat;
  en: string;
  text: string;
  /** How to say it, for non-Latin scripts; null for Latin ones. */
  roman: string | null;
  flags: MenuFlag[];
  /** The flags the picked diet watches for (empty when nothing to watch). */
  watch: MenuFlag[];
};

/** Every word for a language in the bundled order, with flags and what the diet watches for. */
export function menuWords(table: MenuTable, lang: MenuLang, diets: unknown = []): MenuWord[] {
  const watched = new Set(watchedFlags(diets));
  const latin = !NON_LATIN_MENU_LANGS.includes(lang);
  const out: MenuWord[] = [];
  for (const e of table.entries) {
    const line = e.words[lang];
    if (!line || !line.text.trim() || !isMenuCat(e.cat)) continue;
    const flags = entryFlags(e);
    out.push({ id: e.id, cat: e.cat, en: e.en, text: line.text, roman: latin ? null : line.roman?.trim() || null, flags, watch: flags.filter((f) => watched.has(f)) });
  }
  return out;
}

/** One word by id, or null when the language doesn't carry it. */
export function menuWord(table: MenuTable, lang: MenuLang, id: string, diets: unknown = []): MenuWord | null {
  return menuWords(table, lang, diets).find((w) => w.id === id) ?? null;
}

/** Match quality (lower is better): 0 whole field, 1 field starts with it, 2 a word starts with it, 3 anywhere; null none. */
function matchScore(field: string, q: string): number | null {
  const whole = foldText(field);
  if (!whole) return null;
  if (whole === q) return 0;
  if (whole.startsWith(q)) return 1;
  const parts = field.split(/[\s,()/·・、\-]+/).map(foldText).filter(Boolean);
  if (parts.some((p) => p === q)) return 1;
  if (parts.some((p) => p.startsWith(q))) return 2;
  return whole.includes(q) ? 3 : null;
}

/**
 * Words matching the query in English (plus extra English search words) or the local language and its
 * romanisation, best matches first (bundled order breaks ties). An empty query lists everything. With onlyWatch,
 * only words the diet watches for are kept.
 */
export function searchMenu(table: MenuTable, lang: MenuLang, query: string, opts: { diets?: unknown; onlyWatch?: boolean } = {}): MenuWord[] {
  const words = menuWords(table, lang, opts.diets ?? []).filter((w) => !opts.onlyWatch || w.watch.length > 0);
  const q = foldText(query);
  if (!q) return words;
  const also = new Map(table.entries.map((e) => [e.id, e.also ?? []]));
  const scored: { w: MenuWord; s: number; i: number }[] = [];
  words.forEach((w, i) => {
    const fields = [w.en, ...(also.get(w.id) ?? []), w.text, w.roman ?? ''];
    let best: number | null = null;
    for (const f of fields) {
      const s = matchScore(f, q);
      if (s !== null && (best === null || s < best)) best = s;
    }
    if (best !== null) scored.push({ w, s: best, i });
  });
  scored.sort((a, b) => a.s - b.s || a.i - b.i);
  return scored.map((x) => x.w);
}

/** How many words a language carries. */
export const menuCount = (table: MenuTable, lang: MenuLang): number => menuWords(table, lang).length;

/** Content problems (empty list = good). */
export function menuProblems(table: MenuTable): string[] {
  const out: string[] = [];
  for (const code of MENU_LANGS) if (!table.languages.includes(code)) out.push(`language ${code}: missing`);
  for (const code of table.languages) if (!isMenuLang(code)) out.push(`language ${code}: unknown`);
  const ids = new Set<string>();
  for (const e of table.entries) {
    if (!e.id?.trim()) out.push('entry without id');
    if (ids.has(e.id)) out.push(`${e.id}: duplicate id`);
    ids.add(e.id);
    if (!e.en?.trim()) out.push(`${e.id}: empty English`);
    if (!isMenuCat(e.cat)) out.push(`${e.id}: unknown category ${e.cat}`);
    if (!Array.isArray(e.flags)) out.push(`${e.id}: no flags list`);
    else for (const f of e.flags) if (!isMenuFlag(f)) out.push(`${e.id}: unknown flag ${f}`);
    const langs = Object.keys(e.words ?? {});
    if (!langs.length) out.push(`${e.id}: no local words`);
    for (const code of langs) {
      const line = e.words[code];
      if (!isMenuLang(code)) {
        out.push(`${e.id}: unknown language ${code}`);
        continue;
      }
      if (!line || !line.text?.trim()) {
        out.push(`${e.id} ${code}: empty`);
        continue;
      }
      const nonLatin = NON_LATIN_MENU_LANGS.includes(code);
      if (nonLatin && !line.roman?.trim()) out.push(`${e.id} ${code}: no romanisation`);
      if (nonLatin && !hasNonLatin(line.text)) out.push(`${e.id} ${code}: expected local script`);
      if (!nonLatin && hasNonLatin(line.text)) out.push(`${e.id} ${code}: Latin language has other script`);
      if (!nonLatin && line.roman) out.push(`${e.id} ${code}: romanisation on a Latin language`);
      if (line.roman && hasNonLatin(line.roman)) out.push(`${e.id} ${code}: romanisation is not Latin`);
    }
  }
  return out;
}

/** True when the phrase language has a menu (for links from the phrase screens). */
export const hasMenuFor = (lang: unknown): boolean => isPhraseLang(lang) && menuLangFor(lang) !== null;
