// T231: which kind of app a name is, so an app Glaze has no icon for still gets a themed symbol
// instead of letters. Each "family" (Finance, Food, Travel, ...) has one Feather glyph that the
// active theme draws exactly like a catalogue icon.
//   - categorizeAppName   on-device keyword rules on the name ("Bendigo Bank" -> Finance)
//   - familyFromGenre     an App Store primaryGenreName ("Food & Drink" -> Food), used by the
//                         optional online refinement (src/core/appCategoryOnline.ts)
//   - familyGlyph         the family's Feather glyph (all in FEATHER_GLYPHS, no brand logos)
// Pure TypeScript (no React Native / Expo) so Node runs the tests.

export const APP_FAMILIES = [
  'Finance',
  'Food',
  'Travel',
  'Social',
  'Health',
  'Games',
  'Music',
  'Shopping',
  'Utilities',
  'Photo',
  'News',
  'Education',
  'Productivity',
  'Kids',
  'Weather',
  'Sports',
  'Entertainment',
  'Business',
  'Other',
] as const;

export type AppFamily = (typeof APP_FAMILIES)[number];

/** The generic fallback when nothing points at a family. */
export const OTHER_FAMILY: AppFamily = 'Other';

/** One distinct Feather glyph per family (checked against FEATHER_GLYPHS in the tests). */
export const FAMILY_GLYPHS: Readonly<Record<AppFamily, string>> = Object.freeze({
  Finance: 'credit-card',
  Food: 'coffee',
  Travel: 'map',
  Social: 'users',
  Health: 'heart',
  Games: 'play',
  Music: 'music',
  Shopping: 'shopping-bag',
  Utilities: 'tool',
  Photo: 'camera',
  News: 'rss',
  Education: 'book-open',
  Productivity: 'check-square',
  Kids: 'smile',
  Weather: 'cloud',
  Sports: 'award',
  Entertainment: 'film',
  Business: 'briefcase',
  Other: 'grid',
});

export function isAppFamily(x: unknown): x is AppFamily {
  return typeof x === 'string' && (APP_FAMILIES as readonly string[]).includes(x);
}

export function familyGlyph(family: AppFamily | null | undefined): string {
  return FAMILY_GLYPHS[isAppFamily(family) ? family : OTHER_FAMILY];
}

// ---------------------------------------------------------------- App Store genres

/**
 * App Store primaryGenreName -> family. Genres too broad to say anything ('Lifestyle') map to null,
 * so the keyword result stands.
 */
export const GENRE_FAMILIES: Readonly<Record<string, AppFamily | null>> = Object.freeze({
  Finance: 'Finance',
  'Food & Drink': 'Food',
  Travel: 'Travel',
  Navigation: 'Travel',
  'Social Networking': 'Social',
  'Health & Fitness': 'Health',
  Medical: 'Health',
  Games: 'Games',
  Music: 'Music',
  Shopping: 'Shopping',
  Utilities: 'Utilities',
  'Developer Tools': 'Utilities',
  'Photo & Video': 'Photo',
  'Graphics & Design': 'Photo',
  News: 'News',
  'Magazines & Newspapers': 'News',
  Education: 'Education',
  Book: 'Education',
  Books: 'Education',
  Reference: 'Education',
  Productivity: 'Productivity',
  Kids: 'Kids',
  Weather: 'Weather',
  Sports: 'Sports',
  Entertainment: 'Entertainment',
  Business: 'Business',
  Lifestyle: null,
});

/** Family for an App Store genre name, or null when unknown / too broad. */
export function familyFromGenre(genre: unknown): AppFamily | null {
  if (typeof genre !== 'string') return null;
  const g = genre.trim();
  if (Object.prototype.hasOwnProperty.call(GENRE_FAMILIES, g)) return GENRE_FAMILIES[g];
  const lower = g.toLowerCase();
  for (const [k, v] of Object.entries(GENRE_FAMILIES)) if (k.toLowerCase() === lower) return v;
  if (/\bgames?\b/.test(lower)) return 'Games'; // game subgenres ("Puzzle Games")
  return null;
}

// ---------------------------------------------------------------- keyword rules (on device)

/**
 * Keywords per family. A keyword matches a whole word of the name; keywords of 5+ letters also match
 * inside a compound word ("Bankwest", "SuperCalculator"). Earlier families win ties.
 */
const KEYWORDS: readonly [AppFamily, readonly string[]][] = [
  ['Kids', ['kids', 'kid', 'children', 'child', 'baby', 'toddler', 'preschool', 'junior', 'jr', 'nursery']],
  ['Weather', ['weather', 'forecast', 'radar', 'rain', 'storm', 'climate', 'wind', 'temperature', 'bom']],
  ['Games', ['game', 'games', 'puzzle', 'chess', 'solitaire', 'sudoku', 'crossword', 'poker', 'casino', 'slots', 'arcade', 'quest', 'saga', 'legends', 'clash', 'craft', 'mahjong', 'bingo', 'trivia', 'wordle', 'tetris', 'dungeon', 'royale', 'heroes', 'zombie']],
  ['Food', ['food', 'foods', 'eats', 'eat', 'pizza', 'burger', 'burgers', 'coffee', 'cafe', 'restaurant', 'restaurants', 'recipe', 'recipes', 'kitchen', 'cook', 'cooking', 'menu', 'delivery', 'sushi', 'taco', 'chicken', 'donut', 'donuts', 'bakery', 'deli', 'drinks', 'grill', 'dining', 'meal', 'meals', 'takeaway']],
  ['Finance', ['bank', 'banking', 'pay', 'wallet', 'money', 'finance', 'financial', 'invest', 'investing', 'trading', 'trade', 'crypto', 'bitcoin', 'credit', 'loan', 'loans', 'budget', 'tax', 'cash', 'savings', 'stocks', 'broker', 'shares', 'mortgage', 'insurance', 'insure', 'superannuation', 'pension', 'accounting', 'payments', 'cba', 'atm']],
  ['Travel', ['travel', 'trip', 'trips', 'flight', 'flights', 'airline', 'airlines', 'airways', 'airport', 'hotel', 'hotels', 'booking', 'map', 'maps', 'transit', 'train', 'trains', 'rail', 'bus', 'taxi', 'ride', 'rides', 'cab', 'parking', 'fuel', 'petrol', 'gps', 'navigation', 'navigator', 'tour', 'tours', 'vacation', 'holiday', 'holidays', 'cruise', 'rental', 'metro', 'ferry']],
  ['Health', ['health', 'healthy', 'fitness', 'gym', 'workout', 'workouts', 'run', 'running', 'runner', 'yoga', 'pilates', 'meditation', 'meditate', 'sleep', 'diet', 'calorie', 'calories', 'doctor', 'doctors', 'medical', 'medicare', 'clinic', 'pharmacy', 'chemist', 'steps', 'mindful', 'calm', 'therapy', 'dental', 'hospital', 'period', 'pregnancy', 'nutrition', 'weight', 'telehealth', 'vaccine']],
  ['Sports', ['sport', 'sports', 'football', 'soccer', 'nba', 'nfl', 'afl', 'nrl', 'mlb', 'nhl', 'cricket', 'tennis', 'golf', 'rugby', 'basketball', 'baseball', 'hockey', 'score', 'scores', 'livescore', 'league', 'betting', 'bet', 'racing', 'ufc', 'cycling', 'ski', 'surf', 'fishing', 'olympics', 'f1']],
  ['Music', ['music', 'radio', 'fm', 'podcast', 'podcasts', 'songs', 'song', 'tunes', 'audio', 'beats', 'piano', 'guitar', 'karaoke', 'dj', 'lyrics', 'playlist', 'concert', 'concerts', 'tuner', 'metronome']],
  ['Photo', ['photo', 'photos', 'camera', 'cam', 'picture', 'pictures', 'pics', 'collage', 'selfie', 'gallery', 'lens', 'filters', 'retouch', 'snapshot', 'darkroom', 'design', 'draw', 'drawing', 'sketch', 'paint']],
  ['News', ['news', 'times', 'herald', 'journal', 'tribune', 'gazette', 'headlines', 'magazine', 'magazines', 'newspaper', 'press', 'weekly', 'chronicle', 'guardian', 'reader', 'telegraph', 'courier', 'abc']],
  ['Education', ['learn', 'learning', 'school', 'schools', 'study', 'class', 'classroom', 'education', 'edu', 'course', 'courses', 'tutor', 'academy', 'university', 'uni', 'college', 'language', 'languages', 'dictionary', 'flashcards', 'quiz', 'math', 'maths', 'homework', 'teacher', 'student', 'books', 'book', 'library', 'bible', 'audiobooks']],
  ['Shopping', ['shop', 'shopping', 'store', 'mart', 'market', 'marketplace', 'deals', 'buy', 'sale', 'sales', 'outlet', 'fashion', 'retail', 'coupon', 'coupons', 'grocery', 'groceries', 'supermarket', 'catalogue', 'auction', 'rewards', 'loyalty']],
  ['Social', ['social', 'chat', 'messenger', 'messages', 'friends', 'dating', 'date', 'meet', 'community', 'forum', 'talk', 'connect', 'family', 'neighbours', 'neighbors', 'groups']],
  ['Entertainment', ['tv', 'movies', 'movie', 'cinema', 'cinemas', 'film', 'films', 'stream', 'streaming', 'watch', 'shows', 'anime', 'comics', 'comic', 'tickets', 'theatre', 'theater', 'video', 'videos', 'iview']],
  ['Business', ['business', 'work', 'jobs', 'job', 'hr', 'crm', 'meeting', 'meetings', 'teams', 'invoice', 'invoices', 'payroll', 'employer', 'recruit', 'careers', 'admin', 'enterprise', 'pos', 'workplace', 'shifts', 'roster', 'timesheet']],
  ['Productivity', ['notes', 'note', 'todo', 'todos', 'tasks', 'task', 'calendar', 'planner', 'docs', 'document', 'documents', 'sheets', 'office', 'word', 'excel', 'slides', 'mail', 'email', 'inbox', 'drive', 'reminder', 'reminders', 'focus', 'habit', 'habits', 'organizer', 'organiser', 'pdf', 'sign', 'lists', 'list', 'whiteboard', 'mindmap']],
  ['Utilities', ['calculator', 'scanner', 'scan', 'vpn', 'wifi', 'battery', 'cleaner', 'clock', 'timer', 'alarm', 'flashlight', 'torch', 'qr', 'barcode', 'password', 'passwords', 'authenticator', 'translate', 'translator', 'keyboard', 'remote', 'files', 'file', 'storage', 'backup', 'measure', 'compass', 'converter', 'utility', 'utilities', 'tools', 'tool', 'settings', 'printer', 'print', 'widget', 'widgets', 'speedtest', 'stopwatch', 'security', 'antivirus', 'home', 'smart']],
];

function normalise(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export type CategoryGuess = { family: AppFamily; /** the keyword that decided it, or null for the fallback */ keyword: string | null };

/** On-device guess from the name alone; OTHER_FAMILY when no rule fits. Never throws. */
export function categorizeAppName(name: string): CategoryGuess {
  const n = normalise(name);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return { family: OTHER_FAMILY, keyword: null };
  let best: { family: AppFamily; keyword: string; score: number } | null = null;
  for (const [family, keys] of KEYWORDS) {
    // Each word scores once: 2 for a whole keyword, 1 for a keyword inside it (5+ letters) or
    // starting it (4+ letters: "Bankwest").
    let score = 0;
    let first: string | null = null;
    for (const w of words) {
      const whole = keys.includes(w) ? w : null;
      const part = whole ? null : keys.find((k) => (k.length >= 5 && w.includes(k)) || (k.length >= 4 && w.startsWith(k)));
      const k = whole ?? part;
      if (!k) continue;
      score += whole ? 2 : 1;
      first ??= k;
    }
    if (first && (!best || score > best.score)) best = { family, keyword: first, score };
  }
  return best ? { family: best.family, keyword: best.keyword } : { family: OTHER_FAMILY, keyword: null };
}
