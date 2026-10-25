// Satchel's data model. Pure types + small constructors; no React Native imports.
// Times are stored as a wall-clock local time plus an IANA zone (what the ticket says), never as a bare UTC
// instant, so "Depart 21:00 Tokyo" stays 21:00 Tokyo whatever zone the phone is in.

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
};

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
