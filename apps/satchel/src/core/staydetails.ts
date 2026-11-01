// T109 Stay details: room number, door / key-box / gate codes, Wi-Fi (with a "Join this Wi-Fi" QR payload for the
// offline encoder in qr.ts), reception phone and house notes for a stay booking. Pure TypeScript, no RN imports.
// Stored on this phone only, one AsyncStorage key per booking (stayKey), and never part of a .satchel trip file:
// the Item model has no stay fields and tripfile.ts never reads these keys (guard test in staydetails.test.ts).
import type { Item, Trip } from './model.ts';
import { encodeQr } from './qr.ts';
import { span, zonesReadable } from './timeline.ts';

const STAY_PREFIX = 'satchel.stay.v1.';

/** The phone-only storage key for one booking's stay details. */
export const stayKey = (itemId: string): string => `${STAY_PREFIX}${itemId}`;
/** True for a key written by this module (so tests and clean-up can recognise it). */
export const isStayKey = (key: string): boolean => key.startsWith(STAY_PREFIX) && key.length > STAY_PREFIX.length;

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';
export const WIFI_SECURITIES: readonly WifiSecurity[] = ['WPA', 'WEP', 'nopass'];

export type CodeField = 'doorCode' | 'keyboxCode' | 'gateCode';
export const CODE_FIELDS: readonly CodeField[] = ['doorCode', 'keyboxCode', 'gateCode'];

export type NoteField = 'rules' | 'quietHours' | 'bins' | 'parking';
export const NOTE_FIELDS: readonly NoteField[] = ['rules', 'quietHours', 'bins', 'parking'];

export type StayDetails = {
  room: string;
  doorCode: string;
  keyboxCode: string;
  gateCode: string;
  wifiName: string;
  wifiPassword: string;
  wifiSecurity: WifiSecurity;
  wifiHidden: boolean;
  /** Reception or host phone. */
  phone: string;
  rules: string;
  quietHours: string;
  bins: string;
  parking: string;
  /** Ask for Face ID / passcode before a code is shown (when the phone can lock). */
  lockCodes: boolean;
};

export const LIMITS = { room: 40, code: 40, wifiName: 32, wifiPassword: 63, phone: 40, note: 600 } as const;

export const EMPTY_STAY: StayDetails = {
  room: '',
  doorCode: '',
  keyboxCode: '',
  gateCode: '',
  wifiName: '',
  wifiPassword: '',
  wifiSecurity: 'WPA',
  wifiHidden: false,
  phone: '',
  rules: '',
  quietHours: '',
  bins: '',
  parking: '',
  lockCodes: false,
};

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Stored value -> StayDetails. Anything missing, damaged or too long is dropped or cut, never thrown on. */
export function cleanStay(raw: unknown): StayDetails {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_STAY };
  const r = raw as Record<string, unknown>;
  const security = WIFI_SECURITIES.includes(r.wifiSecurity as WifiSecurity) ? (r.wifiSecurity as WifiSecurity) : 'WPA';
  return {
    room: str(r.room, LIMITS.room),
    doorCode: str(r.doorCode, LIMITS.code),
    keyboxCode: str(r.keyboxCode, LIMITS.code),
    gateCode: str(r.gateCode, LIMITS.code),
    // Wi-Fi names may legitimately start or end with spaces, but a typed trailing space is far more likely a slip.
    wifiName: str(r.wifiName, LIMITS.wifiName),
    wifiPassword: typeof r.wifiPassword === 'string' ? r.wifiPassword.slice(0, LIMITS.wifiPassword) : '',
    wifiSecurity: security,
    wifiHidden: r.wifiHidden === true,
    phone: str(r.phone, LIMITS.phone),
    rules: str(r.rules, LIMITS.note),
    quietHours: str(r.quietHours, LIMITS.note),
    bins: str(r.bins, LIMITS.note),
    parking: str(r.parking, LIMITS.note),
    lockCodes: r.lockCodes === true,
  };
}

/** True when nothing has been saved yet (the lock switch alone doesn't count). */
export function isEmptyStay(s: StayDetails): boolean {
  return !s.room && !hasCodes(s) && !s.wifiName && !s.wifiPassword && !s.phone && NOTE_FIELDS.every((f) => !s[f]);
}

export const hasCodes = (s: Pick<StayDetails, CodeField>): boolean => CODE_FIELDS.some((f) => !!s[f]);
export const savedCodes = (s: Pick<StayDetails, CodeField>): CodeField[] => CODE_FIELDS.filter((f) => !!s[f]);

/** A stay booking: only hotels / rentals carry stay details. */
export const isStay = (item: Pick<Item, 'kind'>): boolean => item.kind === 'hotel';

// ------------------------------------------------------------------------------------------------- masking

export const MASK = '••••••';

/** What a hidden code shows: always the same six dots, so the length isn't given away. Empty stays empty. */
export const maskCode = (code: string): string => (code ? MASK : '');

/** What a code row shows: the code when revealed, otherwise the mask. */
export const shownCode = (code: string, revealed: boolean): string => (revealed ? code : maskCode(code));

export type AuthOutcome = { ok: true } | { ok: false; cannotLock: boolean };

/**
 * Whether a code may be revealed after the optional Face ID check. With the lock off: always. With it on: only
 * after a successful check, or when this phone can't lock at all (no passcode set / no hardware / Expo Go), so a
 * traveller is never locked out of their own door code.
 */
export function mayReveal(lockCodes: boolean, auth: AuthOutcome | null): boolean {
  if (!lockCodes) return true;
  if (!auth) return false;
  return auth.ok || auth.cannotLock;
}

// ------------------------------------------------------------------------------------------------- Wi-Fi QR

/** Backslash-escapes the characters the Wi-Fi QR format reserves: \ ; , : and ". */
export function escapeWifi(s: string): string {
  return s.replace(/[\\;,:"]/g, (c) => `\\${c}`);
}

/**
 * The "Join this Wi-Fi" QR text (the de-facto WIFI: URI scheme phone cameras read), e.g.
 * WIFI:T:WPA;S:Hotel Guest;P:sea\;breeze;; . Open networks use T:nopass and no password; hidden networks add H:true.
 * Null when there is no network name, or a secured network has no password (nothing a camera could join).
 */
export function wifiPayload(s: Pick<StayDetails, 'wifiName' | 'wifiPassword' | 'wifiSecurity' | 'wifiHidden'>): string | null {
  if (!s.wifiName) return null;
  const open = s.wifiSecurity === 'nopass';
  if (!open && !s.wifiPassword) return null;
  let out = `WIFI:T:${s.wifiSecurity};S:${escapeWifi(s.wifiName)};`;
  if (!open) out += `P:${escapeWifi(s.wifiPassword)};`;
  if (s.wifiHidden) out += 'H:true;';
  return `${out};`;
}

/** The payload, and whether the offline encoder can draw it (a heavily escaped long name + password may not: the screen then shows the text). */
export function wifiQr(s: StayDetails): { payload: string; drawable: boolean } | null {
  const payload = wifiPayload(s);
  if (!payload) return null;
  return { payload, drawable: encodeQr(payload) != null };
}

// ------------------------------------------------------------------------------------------------- links

/** Apple Maps link to the stay's address (by text: works without coordinates). Null with no address. */
export function appleMapsAddressUrl(place: Item['place']): string | null {
  const address = place?.address?.trim() || place?.localAddress?.trim();
  if (!address) return null;
  const name = place?.name?.trim();
  let url = `https://maps.apple.com/?address=${encodeURIComponent(address)}`;
  if (name) url += `&q=${encodeURIComponent(name)}`;
  return url;
}

/** Digits and a leading + only, for tel: links. Null when fewer than 3 digits remain. */
export function dialable(phone: string): string | null {
  const t = phone.trim();
  const digits = t.replace(/\D/g, '');
  if (digits.length < 3) return null;
  return (t.startsWith('+') ? '+' : '') + digits;
}

// ------------------------------------------------------------------------------------------------- current stay

export type CurrentStay = { item: Item; tripId: string };

/**
 * The stay you're in at `now` (a UTC instant), across zones: check-in passed and check-out not yet, by each stamp's
 * own zone. Overlapping stays (a late check-out and the next check-in): the most recent check-in wins. A stay with
 * no check-out or an unreadable zone has no known span and is skipped.
 */
export function currentStay(trips: readonly Pick<Trip, 'id' | 'items'>[], now: number): CurrentStay | null {
  let best: CurrentStay | null = null;
  let bestStart = -Infinity;
  for (const trip of trips) {
    for (const item of trip.items) {
      if (!isStay(item) || !item.end || !zonesReadable(item)) continue;
      const s = span(item);
      if (s.start <= now && now < s.end && s.start > bestStart) {
        best = { item, tripId: trip.id };
        bestStart = s.start;
      }
    }
  }
  return best;
}

// ------------------------------------------------------------------------------------------------- summaries

export type StaySummary = { room: string | null; codes: number; wifi: boolean; phone: boolean; notes: number };

/** What the entry-point cards say is saved (never the codes themselves). */
export function staySummary(s: StayDetails): StaySummary {
  return {
    room: s.room || null,
    codes: savedCodes(s).length,
    wifi: !!s.wifiName,
    phone: !!s.phone,
    notes: NOTE_FIELDS.filter((f) => !!s[f]).length,
  };
}

/** Low-battery essentials rows: the room and Wi-Fi name in plain text, every code and the Wi-Fi password masked. */
export function essentialsRows(s: StayDetails): { field: 'room' | CodeField | 'wifiName' | 'wifiPassword'; value: string }[] {
  const rows: { field: 'room' | CodeField | 'wifiName' | 'wifiPassword'; value: string }[] = [];
  if (s.room) rows.push({ field: 'room', value: s.room });
  for (const f of savedCodes(s)) rows.push({ field: f, value: maskCode(s[f]) });
  if (s.wifiName) rows.push({ field: 'wifiName', value: s.wifiName });
  if (s.wifiPassword) rows.push({ field: 'wifiPassword', value: maskCode(s.wifiPassword) });
  return rows;
}
