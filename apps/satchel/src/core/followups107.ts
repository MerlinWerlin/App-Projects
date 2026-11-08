// T151 run-107 follow-ups (pure TypeScript, no React Native imports, runnable by Node):
//  (1) Postcards on Your day: "A free afternoon: 3 postcards to write" when today's afternoon (12:00-18:00 on the
//      clock of the zone you're in, the brief's zone) has no timed booking keeping you busy and someone on the trip's
//      postcard list has no sent tick yet. Shown until 18:00 that day. Stays and hire cars never count as busy (you
//      can write a card in the hotel), notes and date-only bookings neither; a journey or activity counts from its
//      start to its end (an hour when it has no end), on real instants, so an overnight flight or a booking in
//      another zone is judged as the clocks really run.
//  (2) Plan this trip again: what comes along, as one summary line (bookings, lists... and Postcards / Children).
//  (3) Plan this trip again copies the children list (phone-only store, src/core/kids.ts): first names and age bands
//      with new ids, the lost-card parent name and phone, and the "names in trip files" switch as it was. The
//      kid-friendly marks never come (they point at the old trip's idea ids, which the copy renews).
//  (4) Check-out Calendar reminder: a one-event .ics through src/core/checkin.ts reminderIcs (the existing ics
//      path), alerting CHECKOUT_REMIND_MIN before the check-out time on the hotel's own clock.
//  (5) Numbers trainer: casual spoken forms as an optional second line (Chinese 块 / 塊 and 毛, Thai ร้อย without
//      หนึ่ง, Vietnamese ngàn and prices without đồng). Model-written, needsCheck like every reading.
import type { Item, LocalDate, Trip } from './model.ts';
import { cleanKids, type KidsData } from './kids.ts';
import type { PostcardBook } from './postcards.ts';
import { reminderIcs, windowsFor, isOut, type CheckinWindow, type ReminderWords } from './checkin.ts';
import { spellNumber, speakPrice, type NumberReading } from './numbers.ts';
import type { PhraseLang } from './phrases.ts';
import { fromUtc, isLocalDateTime, isValidZone, toUtc } from './tz.ts';

const MIN = 60_000;

// ------------------------------------------------------------------------------------------- (1) postcards

export const AFTERNOON_FROM = '12:00';
export const AFTERNOON_TO = '18:00';
/** A booking with a start and no end keeps you busy this long. */
export const NO_END_MIN = 60;
/** Kinds that never make an afternoon busy. */
export const NEVER_BUSY: readonly Item['kind'][] = ['hotel', 'car', 'note'];

const instant = (local: string, tz: string): number | null => {
  if (!isLocalDateTime(local) || !isValidZone(tz)) return null;
  try {
    return toUtc({ local, tz });
  } catch {
    return null;
  }
};

/** The real-time span a booking keeps you busy, or null (never busy, date only, unreadable). */
export function busySpan(i: Item): { from: number; to: number } | null {
  if (NEVER_BUSY.includes(i.kind)) return null;
  const from = instant(i.start.local, i.start.tz);
  if (from === null) return null;
  const end = i.end ? instant(i.end.local, i.end.tz) : null;
  return { from, to: end !== null && end > from ? end : from + NO_END_MIN * MIN };
}

/** Today's afternoon [12:00, 18:00) on the zone's clock, as instants. */
export function afternoon(today: LocalDate, zone: string): { from: number; to: number } | null {
  const from = instant(`${today}T${AFTERNOON_FROM}`, zone);
  const to = instant(`${today}T${AFTERNOON_TO}`, zone);
  return from === null || to === null || to <= from ? null : { from, to };
}

/** True when nothing timed keeps you busy this afternoon. */
export function isFreeAfternoon(trip: Pick<Trip, 'items'>, today: LocalDate, zone: string): boolean {
  const a = afternoon(today, zone);
  if (!a) return false;
  return !(trip.items ?? []).some((i) => {
    const s = busySpan(i);
    return !!s && s.from < a.to && s.to > a.from;
  });
}

export type PostcardsBrief = { open: number; total: number };

/** The Your day postcards row: a free afternoon still to come (until 18:00) and cards not yet sent. Else null. */
export function postcardsBrief(trip: Pick<Trip, 'items'>, book: PostcardBook, today: LocalDate, zone: string, now: number): PostcardsBrief | null {
  const total = book.people.length;
  const open = book.people.filter((p) => !p.sent).length;
  if (!open) return null;
  const a = afternoon(today, zone);
  if (!a || now >= a.to) return null;
  return isFreeAfternoon(trip, today, zone) ? { open, total } : null;
}

// ------------------------------------------------------------------------------------------- (2) summary

/** The order of the "Coming along" summary; the screen words each from the catalogue. */
export const SUMMARY_ORDER = ['bookings', 'packing', 'bags', 'ideas', 'todos', 'companions', 'budget', 'giftNames', 'leavingHome', 'comingHome', 'postcards', 'kids'] as const;
export type SummaryPart = (typeof SUMMARY_ORDER)[number];

/** The parts that will come along (chosen and with something to copy), in a fixed order. */
export function copySummary(chosen: Partial<Record<SummaryPart, boolean>>): SummaryPart[] {
  return SUMMARY_ORDER.filter((p) => chosen[p] === true);
}

// ------------------------------------------------------------------------------------------- (3) kids

/** Plan this trip again: the children with new ids; parent and switch kept; kid-friendly marks never. */
export function copyKids(data: KidsData, newId: (prefix: string) => string): KidsData {
  const d = cleanKids(data);
  return { children: d.children.map((c) => ({ id: newId('kid'), name: c.name, band: c.band })), parentName: d.parentName, parentPhone: d.parentPhone, exportNames: d.exportNames, kidFriendly: [] };
}

/** "Mia, Leo and 2 more" pieces: up to `max` names, then how many are left. */
export function namesShort(names: readonly string[], max = 3): { shown: string[]; more: number } {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  return { shown: clean.slice(0, max), more: Math.max(0, clean.length - max) };
}

// ------------------------------------------------------------------------------------------- (4) check-out reminder

/** General guidance: the reminder goes off this long before the check-out time. */
export const CHECKOUT_REMIND_MIN = 60;

/** A stay's check-out window (on the hotel's clock), not ticked "checked out". Null otherwise. */
export function checkoutWindow(item: Item): CheckinWindow | null {
  if (item.kind !== 'hotel' || isOut(item)) return null;
  return windowsFor(item).find((w) => w.kind === 'stayOut' && !!w.closes) ?? null;
}

/** When the check-out reminder would go off (instant and the hotel's wall clock), or null once that has passed. */
export function checkoutRemindAt(item: Item, now: number, beforeMin = CHECKOUT_REMIND_MIN): { utc: number; local: string; tz: string } | null {
  const w = checkoutWindow(item);
  if (!w?.closes) return null;
  const utc = w.closes.utc - beforeMin * MIN;
  if (utc <= now) return null;
  return { utc, local: fromUtc(utc, w.tz), tz: w.tz };
}

/** The one-event .ics (src/core/checkin.ts reminderIcs) alerting before the check-out time. Null when too late. */
export function checkoutReminderIcs(item: Item, words: ReminderWords, now: number, beforeMin = CHECKOUT_REMIND_MIN): { text: string; at: number } | null {
  const w = checkoutWindow(item);
  const at = checkoutRemindAt(item, now, beforeMin);
  if (!w || !at) return null;
  return reminderIcs({ ...w, opens: { utc: at.utc, local: at.local } }, words, now);
}

// ------------------------------------------------------------------------------------------- (5) casual numbers

/** Which casual rule made the line (the screen names it). */
export type CasualRule = 'zhKuai' | 'thOne' | 'viNgan';
export type CasualReading = { lang: PhraseLang; text: string; roman: string | null; rule: CasualRule; needsCheck: true };

/** Currencies whose Mandarin reading gets 块 / 塊 and 毛 (mainland yuan and Taiwan dollar). */
export const KUAI_CURRENCIES: readonly string[] = ['CNY', 'TWD'];
const TH_BIG = ['ร้อย', 'พัน', 'หมื่น', 'แสน'];

/** Thai: a leading หนึ่ง before ร้อย / พัน / หมื่น / แสน is usually dropped in speech (ร้อยบาท). */
function thCasual(r: Pick<NumberReading, 'text' | 'roman'>): Pick<CasualReading, 'text' | 'roman'> | null {
  if (!r.text.startsWith('หนึ่ง') || !TH_BIG.some((u) => r.text.startsWith(`หนึ่ง${u}`))) return null;
  return { text: r.text.slice('หนึ่ง'.length), roman: r.roman ? r.roman.replace(/^nueng /, '') : null };
}

/** Vietnamese: ngàn for nghìn (heard all over, the usual word in the south). */
const viNgan = (text: string) => text.replace(/nghìn/g, 'ngàn');

/** The casual second line for a bare number, or null when the language has none we offer (or it reads the same). */
export function casualNumber(lang: PhraseLang, n: number, country: string | null = null): CasualReading | null {
  const r = spellNumber(lang, n, { country });
  if (!r) return null;
  if (lang === 'th') {
    const c = thCasual(r);
    return c ? { lang, ...c, rule: 'thOne', needsCheck: true } : null;
  }
  if (lang === 'vi') {
    const text = viNgan(r.text);
    return text !== r.text ? { lang, text, roman: null, rule: 'viNgan', needsCheck: true } : null;
  }
  return null;
}

/** Chinese price words: 元 -> 块 / 塊, 角 -> 毛; a closing 毛 after 块 is dropped (十二块五), its 两 read 二. */
function zhCasual(r: NumberReading, trad: boolean, minor: number): Pick<CasualReading, 'text' | 'roman'> | null {
  const kuai = trad ? '塊' : '块';
  let text = r.text.replace(/元/g, kuai).replace(/角/g, '毛');
  let roman = r.roman ? r.roman.replace(/\byuán\b/g, 'kuài').replace(/\bjiǎo\b/g, 'máo') : null;
  const cents = Math.round(minor) % 100;
  if (r.value > 0 && cents && cents % 10 === 0 && text.endsWith('毛')) {
    text = text.slice(0, -1);
    if (text.endsWith(trad ? '兩' : '两')) text = `${text.slice(0, -1)}二`;
    if (roman) roman = roman.replace(/ máo$/, '').replace(/ liǎng$/, ' èr');
  }
  return text !== r.text ? { text, roman } : null;
}

/** The casual second line for a price read out (speakPrice), or null when we offer none for it. */
export function casualPrice(lang: PhraseLang, minor: number, currency: string, country: string | null = null): CasualReading | null {
  const r = speakPrice(lang, minor, currency, country);
  if (!r) return null;
  if ((lang === 'zh-Hans' || lang === 'zh-Hant') && KUAI_CURRENCIES.includes(currency)) {
    const c = zhCasual(r, lang === 'zh-Hant', minor);
    return c ? { lang, ...c, rule: 'zhKuai', needsCheck: true } : null;
  }
  if (lang === 'th' && currency === 'THB') {
    const c = thCasual(r);
    return c ? { lang, ...c, rule: 'thOne', needsCheck: true } : null;
  }
  if (lang === 'vi' && currency === 'VND') {
    let text = viNgan(r.text);
    // Prices from a thousand up are usually said without đồng ("năm mươi ngàn").
    if (r.value >= 1000) text = text.replace(/ đồng$/, '');
    return text !== r.text ? { lang, text, roman: null, rule: 'viNgan', needsCheck: true } : null;
  }
  return null;
}
