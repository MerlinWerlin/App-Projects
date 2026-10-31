// Satchel's data model. Pure types + small constructors; no React Native imports.
// Times are stored as a wall-clock local time plus an IANA zone (what the ticket says), never as a bare UTC
// instant, so "Depart 21:00 Tokyo" stays 21:00 Tokyo whatever zone the phone is in.

import type { Idea } from './ideas.ts';
import type { JournalEntry } from './journal.ts';
import type { Todo } from './todos.ts';
import type { AirportInfo } from './leaveby.ts';

/** Wall-clock local time, minute precision: 'YYYY-MM-DDTHH:mm'. */
export type LocalDateTime = string;
/** Calendar date: 'YYYY-MM-DD'. */
export type LocalDate = string;

export type Stamp = { local: LocalDateTime; tz: string };

export const ITEM_KINDS = ['flight', 'train', 'ferry', 'bus', 'hotel', 'car', 'activity', 'note'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
/** Kinds that move you from one place to another (shown with from → to). */
export const TRANSPORT_KINDS: readonly ItemKind[] = ['flight', 'train', 'ferry', 'bus'];

export type Place = {
  id: string;
  name: string;
  address?: string;
  /** The address in the local language and script, for the taxi-driver card. */
  localAddress?: string;
  lat?: number;
  lon?: number;
  phone?: string;
};

/**
 * A place the user kept with a trip from the map (FLOWS §11.2). Coordinates are required. `category` is the map
 * category id it was saved from (absent for a dropped pin); `sample` marks a bundled demo point, so it stays labelled.
 */
export type SavedPlace = Place & { lat: number; lon: number; category?: string; sample?: boolean; savedAt: string };

export type Attachment = {
  id: string;
  /** File in the app's documents directory. */
  uri: string;
  name: string;
  mime: string;
  role: 'ticket' | 'booking' | 'other';
  /** Saved crop of the QR / barcode, for the full-brightness ticket view. */
  qrCropUri?: string;
};

export type Item = {
  id: string;
  tripId: string;
  kind: ItemKind;
  title: string;
  start: Stamp;
  /** Arrival / check-out / drop-off. Absent for point-in-time items such as notes. */
  end?: Stamp;
  from?: Place;
  to?: Place;
  /** Hotel, activity or car-hire location. */
  place?: Place;
  /** Booking reference / PNR. */
  ref?: string;
  seat?: string;
  carrier?: string;
  number?: string;
  notes?: string;
  /** T74 flights only: terminal, gate, boarding and bag-drop times (departure airport's clock), airport buffer and travel time. Read defensively in src/core/leaveby.ts. */
  airport?: AirportInfo;
  attachments: Attachment[];
};

export type Trip = {
  id: string;
  name: string;
  startDate: LocalDate;
  endDate: LocalDate;
  /** The traveller's home zone, used for "back home" and for the trip header. */
  homeTz: string;
  items: Item[];
  /** Places saved from the map (FLOWS §11.2). Absent on older trips. */
  places?: SavedPlace[];
  demo?: boolean;
  createdAt: string;
  /** T54 spending, all optional (absent on older trips). Home currency and an optional limit in its minor units. */
  budget?: Budget;
  /** Manual exchange rates: 1 unit of the keyed currency (ISO 4217) = this many home units. */
  rates?: Record<string, number>;
  /** T61: the day each rate was last typed in the converter, with the rate it stamped (a rate changed elsewhere no longer matches, so its old day is never shown). Read defensively in src/core/convert.ts. */
  ratesUpdated?: Record<string, { day: LocalDate; rate: number }>;
  expenses?: Expense[];
  /** T64 trip journal: per-day pages (absent on older trips). Read defensively in src/core/journal.ts. */
  journal?: JournalEntry[];
  /** T81 places to go: per-trip ideas (absent on older trips). Read defensively in src/core/ideas.ts. */
  ideas?: Idea[];
  /** T82 travelling together: the people sharing costs besides "You" (names only, on this phone). Read defensively in src/core/together.ts. */
  companions?: Companion[];
  /** T82: settle-up payments marked as done ("Sam paid You A$20"). Read defensively in src/core/together.ts. */
  settlements?: Settlement[];
  /** T83: the cover scene the user picked (src/core/covers.ts COVER_SCENES); absent = automatic. An unknown id is ignored. */
  cover?: string;
  /** T93 trip to-dos: own to-dos and ticked / hidden suggestions (absent on older trips). Read defensively in src/core/todos.ts. */
  todos?: Todo[];
};

export const EXPENSE_CATEGORIES = ['food', 'transport', 'stay', 'activities', 'shopping', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
/** Money is integer minor units of its own currency (cents, yen, fils); see src/core/spending.ts. */
export type Expense = {
  id: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  day: LocalDate;
  note?: string;
  createdAt?: string;
  /** T82: who paid ('me' or a companion id). Absent: You. */
  paidBy?: string;
  /** T82: who shares the cost and how. Absent: nobody else (You carry it all, as before). */
  split?: ExpenseSplit;
};
/** T82: 'me' is the phone's owner ("You"); companions have their own ids. */
export type Companion = { id: string; name: string };
export type SplitMode = 'equal' | 'shares' | 'exact';
/** value: ignored for equal, a whole-number weight for shares, minor units of the expense's currency for exact. */
export type SplitPart = { person: string; value: number };
export type ExpenseSplit = { mode: SplitMode; parts: SplitPart[] };
/** `from` paid `to` this amount (minor units of `currency`) to settle up. */
export type Settlement = { id: string; from: string; to: string; amount: number; currency: string; day?: LocalDate; createdAt?: string };
/** The trip's home currency (ISO 4217) and, when set, its spending limit in that currency's minor units. */
export type Budget = { currency: string; amount?: number };

export type DocKind = 'passport' | 'visa' | 'licence' | 'insurance' | 'other';
export type TravelDoc = { id: string; kind: DocKind; label: string; expires?: LocalDate; attachments: Attachment[] };

export type EmergencyContact = { id: string; name: string; phone: string; relation?: string };
export type EmergencyCard = {
  insurer?: string;
  policy?: string;
  insurerPhone?: string;
  contacts: EmergencyContact[];
  /** Private, local-only. Never leaves the device unless iCloud sync is turned on. */
  medicalNotes?: string;
};

export type PackingItem = { id: string; label: string; done: boolean };
export type PackingList = { tripId: string; template?: string; items: PackingItem[] };

let seq = 0;
/** Local id, unique on this device (time + counter + random). */
export function newId(prefix = 'id'): string {
  seq = (seq + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const isTransport = (k: ItemKind) => TRANSPORT_KINDS.includes(k);
