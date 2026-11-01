// Trips store: everything lives on the phone (AsyncStorage). The demo trip is seeded once, on first run, starting
// three days from today so "Next up" has something to show, with its sample ticket, vault passport and emergency
// details (src/state/demoSeed.ts); deleting the demo trip takes those extras away again. Attachment paths are rebased onto this install's
// documents folder on load (iOS moves the app's container on update). Deleting a trip also drops its packing list
// and its attachment files; deleting one booking drops that booking's files (best effort, never throws). T112: and
// the phone-only stay details of each deleted booking (src/state/stay.ts forgetStays).
// Every change is written to storage first and only then shown, so the save functions can say whether it worked:
// they resolve to true when saved, false when the phone couldn't write it (forms then show error.item.save /
// error.trips.save and stay open with what was typed). Writes run one at a time, each on the latest list.
// If the saved list couldn't be read at start-up it is copied aside to `satchel.trips.v1.unreadable`; while that
// copy exists `loadError` is true (Trips home shows error.trips.load) and `retryLoad` tries to read it again.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { demoTrip } from '../core/demo.ts';
import { withSampleIdeas, withSampleSpending } from '../core/demoExtras.ts';
import { deviceZone, todayIn } from '../core/format.ts';
import { DEMO_JOURNAL_KEY, seedSampleJournal, withSampleJournal } from '../core/followups91.ts';
import type { Item, Trip } from '../core/model.ts';
import { dropList, EMPTY_STORE, PACKING_KEY, type PackStore } from '../core/packing.ts';
import { itemFiles, rebaseTrips, tripFiles } from '../core/tickets.ts';
import { mergeRecovered, parseStoredTrips, removeItem, removeTrip, upsertItem, upsertTrip } from '../core/trips.ts';
import { addDays } from '../core/tz.ts';
import { documentDir, removeAppFiles } from '../native/files.ts';
import { stayKeysToDrop } from '../core/followups97.ts';
import { rentalKeysToDrop } from '../core/driving.ts';
import { demoWithTicket, removeDemoExtras, seedDemoExtras } from './demoSeed.ts';
import { readPersisted, setPersisted } from './persisted.ts';
import { forgetStays } from './stay.ts';
import { forgetRentals } from './rental.ts';

const KEY = 'satchel.trips.v1';
const UNREADABLE = `${KEY}.unreadable`;
const SEEDED = 'satchel.seeded.v1';

type TripsState = {
  loaded: boolean;
  trips: Trip[];
  /** The saved trips couldn't be read at start-up (a copy is kept aside). */
  loadError: boolean;
  /** Reads the kept copy again; true when its trips are back (and the copy is cleared). */
  retryLoad: () => Promise<boolean>;
  /** Each resolves true once the change is stored on the phone, false if it couldn't be (nothing changes then). */
  saveTrip: (t: Trip) => Promise<boolean>;
  deleteTrip: (id: string) => Promise<boolean>;
  saveItem: (i: Item) => Promise<boolean>;
  deleteItem: (tripId: string, itemId: string) => Promise<boolean>;
  addDemo: () => Promise<boolean>;
};

const Ctx = createContext<TripsState | null>(null);

// T58: fresh demo seeds carry sample spending; a demo trip already saved on a phone is left as it is.
// T88: and sample journal pages; a demo trip already on a phone gets those once (DEMO_JOURNAL_KEY), below.
const freshDemo = () => withSampleIdeas(withSampleSpending(withSampleJournal(demoTrip(addDays(todayIn(deviceZone()), 3)))));

export function TripsProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const latest = useRef<Trip[]>(trips);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let alive = true;
    (async () => {
      let list: Trip[] = [];
      let unreadable = false;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = parseStoredTrips(raw);
        // Unreadable saved data is copied aside before anything can save over it (EDGE_CASES 'App state').
        if (parsed === null && raw) await AsyncStorage.setItem(UNREADABLE, raw);
        unreadable = (await AsyncStorage.getItem(UNREADABLE)) != null;
        list = parsed ?? [];
        const rebased = rebaseTrips(list, documentDir());
        if (rebased !== list) {
          list = rebased;
          await AsyncStorage.setItem(KEY, JSON.stringify(list));
        }
        if (!(await AsyncStorage.getItem(SEEDED))) {
          list = upsertTrip(list, await demoWithTicket(freshDemo()));
          await AsyncStorage.setItem(SEEDED, '1');
          await AsyncStorage.setItem(KEY, JSON.stringify(list));
          await seedDemoExtras();
        }
        // T88: one pass, ever, for a demo trip saved before sample pages existed (only while its journal is empty).
        if (!unreadable && !(await AsyncStorage.getItem(DEMO_JOURNAL_KEY))) {
          const next = seedSampleJournal(list);
          if (next !== list) await AsyncStorage.setItem(KEY, JSON.stringify(next));
          list = next;
          await AsyncStorage.setItem(DEMO_JOURNAL_KEY, '1');
        }
      } catch {
        // storage unavailable: show what we have; saves will report that they failed
      }
      if (alive) {
        latest.current = list;
        setTrips(list);
        setLoadError(unreadable);
        setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Writes fn(latest list) and shows it only once stored. Resolves true when saved. One write at a time. */
  const commit = useCallback((fn: (t: Trip[]) => Trip[]): Promise<boolean> => {
    const run = queue.current.then(async () => {
      const next = fn(latest.current);
      if (next === latest.current) return true;
      try {
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        return false;
      }
      latest.current = next;
      setTrips(next);
      return true;
    });
    const settled = run.catch(() => false);
    queue.current = settled;
    return settled;
  }, []);

  const retryLoad = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(UNREADABLE);
      if (raw == null) {
        setLoadError(false);
        return true;
      }
      const recovered = parseStoredTrips(raw);
      if (recovered === null) return false;
      const ok = await commit((l) => rebaseTrips(mergeRecovered(l, recovered), documentDir()));
      if (!ok) return false;
      await AsyncStorage.removeItem(UNREADABLE);
      setLoadError(false);
      return true;
    } catch {
      return false;
    }
  }, [commit]);

  const value = useMemo<TripsState>(
    () => ({
      loaded,
      trips,
      loadError,
      retryLoad,
      saveTrip: (t) => commit((l) => upsertTrip(l, t)),
      deleteTrip: async (id) => {
        const gone = latest.current.find((x) => x.id === id);
        const ok = await commit((l) => removeTrip(l, id));
        if (ok) cleanUpTrip(id, gone, latest.current);
        // An imported copy of the demo is also marked demo: the sample extras go only when no demo trip is left.
        if (ok && gone?.demo && !latest.current.some((x) => x.demo)) removeDemoExtras().catch(() => {});
        return ok;
      },
      saveItem: (i) => commit((l) => upsertItem(l, i)),
      deleteItem: async (tripId, itemId) => {
        const gone = latest.current.find((x) => x.id === tripId)?.items.find((i) => i.id === itemId);
        const ok = await commit((l) => removeItem(l, tripId, itemId));
        if (ok && gone) cleanUpItem(gone, latest.current);
        return ok;
      },
      addDemo: async () => {
        const demo = await demoWithTicket(freshDemo());
        const ok = await commit((l) => upsertTrip(removeTrip(l, 'demo'), demo));
        if (ok) await seedDemoExtras();
        return ok;
      },
    }),
    [loaded, trips, loadError, retryLoad, commit],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The trip's packing list and attachment files go with it. Best effort: failures leave harmless leftovers. */
function cleanUpTrip(id: string, trip: Trip | undefined, remaining: Trip[]): void {
  try {
    if (trip) removeAppFiles(tripFiles(trip)).catch(() => {});
    // T112: each booking's phone-only stay details go with the trip.
    if (trip) forgetStays(stayKeysToDrop(trip.items, remaining));
    // T122: each car booking's phone-only rental checklist (and its pick-up photos) goes with the trip.
    if (trip) forgetRentals(rentalKeysToDrop(trip.items, remaining));
    // Load the stored lists first so dropping one never overwrites the others with an empty store.
    readPersisted<PackStore>(PACKING_KEY, EMPTY_STORE)
      .then(() => setPersisted<PackStore>(PACKING_KEY, (s) => (s && typeof s === 'object' && !Array.isArray(s) ? dropList(s, id) : s), EMPTY_STORE))
      .catch(() => {});
  } catch {
    // never let clean-up break a delete
  }
}

/** A deleted booking's own files go with it; a file some other booking still lists is kept. Best effort. */
function cleanUpItem(item: Item, remaining: Trip[]): void {
  try {
    const still = new Set(remaining.flatMap(tripFiles));
    removeAppFiles(itemFiles(item).filter((u) => !still.has(u))).catch(() => {});
    // T112: the booking's phone-only stay details (room, codes, Wi-Fi) go with it.
    forgetStays(stayKeysToDrop([item], remaining));
    // T122: a car booking's rental checklist and pick-up photos go with it.
    forgetRentals(rentalKeysToDrop([item], remaining));
  } catch {
    // never let clean-up break a delete
  }
}

export function useTrips(): TripsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTrips outside TripsProvider');
  return v;
}

export const findItem = (trips: Trip[], itemId: string): { trip: Trip; item: Item } | null => {
  for (const trip of trips) {
    const item = trip.items.find((i) => i.id === itemId);
    if (item) return { trip, item };
  }
  return null;
};
