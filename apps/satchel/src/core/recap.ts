// T86 Trip recap (owner: "less bland, each tab deeper"): one trip looked back on, worked out on the phone.
//   days       the trip's calendar span (bookings in their own zones widen it, as Your travels does); for a trip
//              still on, also the days so far
//   places     cities and countries from Your travels' rules (travelstats.ts), for this one trip, home country out
//   distance   great-circle km of every journey leg (flight, train, ferry, bus) whose from / to carry coordinates and
//              that has started by today; legs without coordinates are counted, never guessed. Flown km is the
//              flights' part of it.
//   spending   every expense in full (whoever paid), per category in the trip's home currency with its own typed
//              rates (spending.ts totals); currencies with no rate stay out of the home figures and are listed apart
//   journal    pages, photos, a count per mood, a photo strip in page order
//   ideas      Places to go ticked "Been there"
//   best day   the day whose pages score highest on mood (MOOD_POINTS summed per day); ties: more photos, then
//              more pages, then the earlier day. Needs a score above zero, so tired / meh pages alone never pick one.
// recapText() is the clean share text: no booking codes, notes, seats, documents, emergency card, medical notes,
// journal notes or photos; spending only when asked. Pure TypeScript; wording comes in through RecapWords.
import { formatMoney, readSpending, total, totalsByCategory, type Money } from './spending.ts';
import { readIdeas, type IdeaCategory } from './ideas.ts';
import { JOURNAL_MOODS, readJournal, type JournalMood, type JournalPhoto } from './journal.ts';
import { isTransport, type ExpenseCategory, type LocalDate, type Place, type Trip } from './model.ts';
import { haversineMeters, validLatLon } from './poi.ts';
import { isDemoTrip, travelStats, tripSpan } from './travelstats.ts';
import { daysBetween, localDate } from './tz.ts';

/** Points per mood for the best day. Happy moods count most; tired and meh add nothing. */
export const MOOD_POINTS: Record<JournalMood, number> = { joyful: 3, adventurous: 3, grateful: 2, relaxed: 2, tired: 0, meh: 0 };
/** Photos the strip shows at most. */
export const MAX_STRIP = 30;

export type RecapPhase = 'upcoming' | 'active' | 'past';

export type RecapCategory = {
  category: ExpenseCategory;
  /** Home minor units of what could be converted; null when nothing in it could be (or no home currency). */
  home: number | null;
  /** Share of the converted home total (0..1), for the bar. */
  fraction: number;
  /** Some of this category is in a currency with no rate (so `home` is a floor, or null). */
  partial: boolean;
  count: number;
};

export type RecapSpending = {
  /** The trip's home currency, or null when none is set (then everything sits in `unrated`). */
  home: string | null;
  /** Everything converted, in home minor units; null with no home currency. */
  totalHome: number | null;
  categories: RecapCategory[];
  /** Per-currency sums that could not be converted (no rate, or no home currency), alphabetical. */
  unrated: Money[];
  count: number;
};

export type RecapDistance = {
  /** Journey legs (flight, train, ferry, bus) that have started by today. */
  legs: number;
  measured: number;
  unmeasured: number;
  km: number;
  flights: number;
  flownKm: number;
};

export type MoodCount = { mood: JournalMood; count: number };
export type StripPhoto = JournalPhoto & { day: LocalDate };

export type BestDay = {
  day: LocalDate;
  /** 1-based day of the trip, or null when the page sits outside the trip's dates. */
  dayNumber: number | null;
  score: number;
  /** The day's happiest mood (most points, then most pages, then list order). */
  mood: JournalMood;
  pages: number;
  photos: number;
};

export type Recap = {
  tripId: string;
  name: string;
  demo: boolean;
  phase: RecapPhase;
  /** True once the trip has started (a recap of an upcoming trip has nothing to look back on). */
  available: boolean;
  start: LocalDate;
  end: LocalDate;
  days: number;
  /** Days so far for a trip still on (equal to `days` once it's over, 0 before it starts). */
  daysSoFar: number;
  cities: string[];
  /** ISO 3166 alpha-2, A–Z, the trip's home country left out. */
  countries: string[];
  distance: RecapDistance;
  spending: RecapSpending;
  journal: { pages: number; days: number; photos: number; moods: MoodCount[] };
  strip: StripPhoto[];
  ideas: { total: number; done: number; been: { id: string; name: string; category: IdeaCategory }[] };
  bestDay: BestDay | null;
};

export type RecapOptions = { countryName?: (iso2: string) => string | null | undefined };

const hasCoords = (p: Place | undefined): p is Place & { lat: number; lon: number } => !!p && validLatLon(p.lat, p.lon);

export function recapPhase(trip: Trip, today: LocalDate): RecapPhase {
  const s = tripSpan(trip);
  if (today < s.start) return 'upcoming';
  if (today > s.end) return 'past';
  return 'active';
}

/** Distance of the journey legs that have started by `today`. */
export function recapDistance(trip: Trip, today: LocalDate): RecapDistance {
  const out: RecapDistance = { legs: 0, measured: 0, unmeasured: 0, km: 0, flights: 0, flownKm: 0 };
  let m = 0;
  let flown = 0;
  for (const i of trip.items ?? []) {
    if (!isTransport(i.kind) || localDate(i.start.local) > today) continue;
    out.legs++;
    if (i.kind === 'flight') out.flights++;
    if (hasCoords(i.from) && hasCoords(i.to)) {
      out.measured++;
      const d = haversineMeters(i.from, i.to);
      m += d;
      if (i.kind === 'flight') flown += d;
    } else out.unmeasured++;
  }
  out.km = Math.round(m / 1000);
  out.flownKm = Math.round(flown / 1000);
  return out;
}

/** Spending per category in the home currency, with unconvertible currencies kept apart (never guessed). */
export function recapSpending(trip: Trip): RecapSpending {
  const s = readSpending(trip);
  const home = s.budget?.currency ?? null;
  const all = total(s.expenses, home, s.rates);
  const missing = new Set(home == null ? all.perCurrency.map((p) => p.currency) : all.missing);
  const unrated = all.perCurrency.filter((p) => missing.has(p.currency)).sort((a, b) => (a.currency < b.currency ? -1 : 1));
  const totalHome = all.home;
  const categories = totalsByCategory(s.expenses, home, s.rates).map((c): RecapCategory => {
    const anyConverted = home != null && c.perCurrency.some((p) => !missing.has(p.currency));
    const h = anyConverted ? c.home : null;
    return {
      category: c.category,
      home: h,
      fraction: h != null && totalHome ? h / totalHome : 0,
      partial: c.perCurrency.some((p) => missing.has(p.currency)),
      count: c.count,
    };
  });
  // largest converted first; categories with nothing converted after them, in the fixed order
  categories.sort((a, b) => (b.home ?? -1) - (a.home ?? -1));
  return { home, totalHome, categories, unrated, count: s.expenses.length };
}

/** Pages per mood, most first (ties in the mood list's order); moods with no page are left out. */
export function moodCounts(trip: Pick<Trip, 'journal'>): MoodCount[] {
  const n = new Map<JournalMood, number>();
  for (const e of readJournal(trip)) if (e.mood && MOOD_POINTS[e.mood] !== undefined) n.set(e.mood, (n.get(e.mood) ?? 0) + 1);
  return JOURNAL_MOODS.filter((m) => n.has(m))
    .map((mood) => ({ mood, count: n.get(mood) as number }))
    .sort((a, b) => b.count - a.count || JOURNAL_MOODS.indexOf(a.mood) - JOURNAL_MOODS.indexOf(b.mood));
}

const byWritten = <E extends { day: string; createdAt: string; id: string }>(a: E, b: E) =>
  a.day !== b.day ? (a.day < b.day ? -1 : 1) : a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Journal photos in page order (day, then when written), with their day; photos with no file are skipped. */
export function photoStrip(trip: Pick<Trip, 'journal'>, max = MAX_STRIP): StripPhoto[] {
  const out: StripPhoto[] = [];
  for (const e of [...readJournal(trip)].sort(byWritten))
    for (const p of e.photos) {
      if (out.length >= max) return out;
      if (p && typeof p.uri === 'string' && p.uri) out.push({ ...p, day: e.day });
    }
  return out;
}

/** The best day by the rule in the file header, or null when no page has a mood worth points. */
export function bestDay(trip: Trip): BestDay | null {
  const days = new Map<LocalDate, { score: number; pages: number; photos: number; moods: Map<JournalMood, number> }>();
  for (const e of readJournal(trip)) {
    const d = days.get(e.day) ?? { score: 0, pages: 0, photos: 0, moods: new Map() };
    d.pages++;
    d.photos += e.photos.length;
    if (e.mood && MOOD_POINTS[e.mood] !== undefined) {
      d.score += MOOD_POINTS[e.mood];
      d.moods.set(e.mood, (d.moods.get(e.mood) ?? 0) + 1);
    }
    days.set(e.day, d);
  }
  let best: (BestDay & { moodsSeen: number }) | null = null;
  for (const day of [...days.keys()].sort()) {
    const d = days.get(day)!;
    if (d.score <= 0) continue;
    const better = !best || d.score > best.score || (d.score === best.score && (d.photos > best.photos || (d.photos === best.photos && d.pages > best.pages)));
    if (!better) continue;
    let mood: JournalMood | null = null;
    for (const m of JOURNAL_MOODS) {
      const c = d.moods.get(m);
      if (!c) continue;
      if (!mood || MOOD_POINTS[m] > MOOD_POINTS[mood] || (MOOD_POINTS[m] === MOOD_POINTS[mood] && c > (d.moods.get(mood) ?? 0))) mood = m;
    }
    const inTrip = day >= trip.startDate && day <= trip.endDate;
    best = { day, dayNumber: inTrip ? daysBetween(trip.startDate, day) + 1 : null, score: d.score, mood: mood as JournalMood, pages: d.pages, photos: d.photos, moodsSeen: d.moods.size };
  }
  if (!best) return null;
  const { moodsSeen: _m, ...out } = best;
  return out;
}

export function tripRecap(trip: Trip, today: LocalDate, opts: RecapOptions = {}): Recap {
  const span = tripSpan(trip);
  const phase = recapPhase(trip, today);
  const available = phase !== 'upcoming';
  const days = daysBetween(span.start, span.end) + 1;
  const daysSoFar = phase === 'past' ? days : phase === 'active' ? daysBetween(span.start, today) + 1 : 0;
  // Your travels' rules for one trip: demo included (this is the trip the traveller opened), home country out.
  const stats = available ? travelStats([trip], today, { includeDemo: true, countryName: opts.countryName }) : null;
  const list = readJournal(trip);
  const ideas = readIdeas(trip);
  const been = ideas.filter((i) => i.done).map((i) => ({ id: i.id, name: i.name, category: i.category }));
  return {
    tripId: trip.id,
    name: trip.name,
    demo: isDemoTrip(trip),
    phase,
    available,
    start: span.start,
    end: span.end,
    days,
    daysSoFar,
    cities: stats?.cities ?? [],
    countries: stats?.countries ?? [],
    distance: available ? recapDistance(trip, today) : { legs: 0, measured: 0, unmeasured: 0, km: 0, flights: 0, flownKm: 0 },
    spending: recapSpending(trip),
    journal: { pages: list.length, days: new Set(list.map((e) => e.day)).size, photos: list.reduce((s, e) => s + e.photos.length, 0), moods: moodCounts(trip) },
    strip: photoStrip(trip),
    ideas: { total: ideas.length, done: been.length, been },
    bestDay: bestDay(trip),
  };
}

/** Trips that have a recap (started by today), newest start first; demo trips only when asked. */
export function recapTrips(trips: readonly Trip[], today: LocalDate, includeDemo = false): Trip[] {
  return trips
    .filter((t) => (includeDemo || !isDemoTrip(t)) && tripSpan(t).start <= today)
    .sort((a, b) => {
      const sa = tripSpan(a).start;
      const sb = tripSpan(b).start;
      return sa !== sb ? (sa < sb ? 1 : -1) : a.id < b.id ? -1 : 1;
    });
}

// ---- the share text ----

/** Every word the share text uses, filled from the catalogue by the screen (tests pass English). */
export type RecapWords = {
  /** "Trip recap: Tokyo & Kyoto" */
  heading: (name: string) => string;
  /** "3 Nov – 11 Nov · 9 days" */
  dates: (range: string, days: number) => string;
  /** "Day 4 of 9 so far" (trip still on) */
  soFar: (n: number, days: number) => string;
  cities: (list: string) => string;
  countries: (list: string) => string;
  /** "16,000 km travelled (15,600 km flown)" */
  distance: (km: string, flown: string) => string;
  /** "Spent: A$812.40" */
  spent: (amount: string) => string;
  /** "Food & drink A$120.00" */
  category: (c: ExpenseCategory, amount: string) => string;
  /** "Not converted (no rate): ¥12,000" */
  unrated: (list: string) => string;
  /** "Moods: Joyful 3, Relaxed 2" */
  moods: (list: string) => string;
  mood: (m: JournalMood) => string;
  /** "Best day: Day 3, Tue 5 Nov (Joyful)" */
  best: (day: string, mood: string) => string;
  bestOutside: (date: string, mood: string) => string;
  dayLabel: (n: number) => string;
  /** "Been there: Fushimi Inari, Ramen alley" */
  been: (list: string) => string;
  /** Line at the end, e.g. "Made with Satchel" */
  footer: string;
};

export type RecapTextOptions = { lang?: string; includeSpending?: boolean; formatRange: (a: LocalDate, b: LocalDate) => string; formatDay: (d: LocalDate) => string; formatInt?: (n: number) => string; countryName?: (iso2: string) => string };

/** One line per name, no line breaks smuggled in through a name. */
const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * The recap as plain text for the share sheet. Only the recap's own figures and names go in: never booking codes,
 * seats, notes, attachments, documents, the emergency card, medical notes, journal notes or photos.
 */
export function recapText(r: Recap, w: RecapWords, o: RecapTextOptions): string {
  const lang = o.lang ?? 'en';
  const int = o.formatInt ?? ((n: number) => String(n));
  const lines: string[] = [w.heading(flat(r.name)), w.dates(o.formatRange(r.start, r.end), r.days)];
  if (r.phase === 'active') lines.push(w.soFar(r.daysSoFar, r.days));
  if (r.cities.length) lines.push(w.cities(r.cities.map(flat).join(', ')));
  if (r.countries.length) lines.push(w.countries(r.countries.map((c) => flat(o.countryName?.(c) ?? c)).join(', ')));
  if (r.distance.km > 0) lines.push(w.distance(int(r.distance.km), int(r.distance.flownKm)));
  if (o.includeSpending && r.spending.count) {
    const s = r.spending;
    if (s.home != null && s.totalHome != null && s.categories.some((c) => c.home != null)) {
      lines.push(w.spent(formatMoney(s.totalHome, s.home, lang)));
      for (const c of s.categories) if (c.home != null) lines.push(`  ${w.category(c.category, formatMoney(c.home, s.home, lang))}`);
    }
    if (s.unrated.length) lines.push(w.unrated(s.unrated.map((m) => formatMoney(m.amount, m.currency, lang)).join(', ')));
  }
  if (r.journal.moods.length) lines.push(w.moods(r.journal.moods.map((m) => `${w.mood(m.mood)} ${m.count}`).join(', ')));
  if (r.bestDay) {
    const b = r.bestDay;
    const date = o.formatDay(b.day);
    lines.push(b.dayNumber != null ? w.best(`${w.dayLabel(b.dayNumber)}, ${date}`, w.mood(b.mood)) : w.bestOutside(date, w.mood(b.mood)));
  }
  if (r.ideas.been.length) lines.push(w.been(r.ideas.been.map((i) => flat(i.name)).join(', ')));
  lines.push('', w.footer);
  return lines.join('\n');
}
