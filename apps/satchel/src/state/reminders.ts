// Trip reminders, app side (docs/REMINDERS.md).
// useTripReminders: mounted once in app/_layout.tsx's Shell. Re-plans (debounced) whenever the trips or the
// reminders setting change and each time Satchel comes back to the front, and opens the plan a tapped reminder is about.
// useReminderSetting: the Settings toggle and the Itinerary card. Turning reminders on asks for permission then (and
// only then); the setting keeps the traveller's choice even if notifications are refused, so allowing them later in
// the phone's Settings starts the reminders on the next return to Satchel, with no second trip to this toggle.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { planReminders } from '../core/reminders.ts';
import { CAPTURE, clearReminders, getReminderPermission, installForegroundHandler, requestReminderPermission, subscribeReminderTaps, syncReminders, type ReminderPermission } from '../native/notifications.ts';
import { useApp } from './app.tsx';
import { findItem, useTrips } from './trips.tsx';

const DEBOUNCE_MS = 1200;

// A permission answer re-plans at once (the dialog can outlast the debounce, and Android has no foreground event for it).
const permissionListeners = new Set<() => void>();
function usePermissionTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    permissionListeners.add(l);
    return () => {
      permissionListeners.delete(l);
    };
  }, []);
  return tick;
}

/** A counter that ticks each time the app returns to the foreground. */
function useForegroundTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let last = AppState.currentState;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && last !== 'active') setTick((n) => n + 1);
      last = s;
    });
    return () => sub.remove();
  }, []);
  return tick;
}

/** `ready`: the first screen is up (fonts, prefs and trips loaded), so a tap can navigate. */
export function useTripReminders(ready: boolean): void {
  const { prefs, t } = useApp();
  const { trips, loaded } = useTrips();
  const router = useRouter();
  const foreground = useForegroundTick();
  const answered = usePermissionTick();
  const on = prefs.reminders;
  const tripsRef = useRef(trips);
  tripsRef.current = trips;

  useEffect(() => {
    installForegroundHandler();
  }, []);

  useEffect(() => {
    if (!ready || !loaded) return;
    const id = setTimeout(() => {
      if (on) syncReminders(planReminders(trips, Date.now()), t);
      else clearReminders();
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [ready, loaded, on, trips, t, foreground, answered]);

  // Tapping a reminder opens that plan (a plan deleted since is ignored).
  useEffect(() => {
    if (!ready || !loaded) return;
    return subscribeReminderTaps((itemId) => {
      if (findItem(tripsRef.current, itemId)) router.push(`/item/${itemId}`);
    });
  }, [ready, loaded, router]);
}

export type ReminderSetting = {
  on: boolean;
  /** null until read. */
  permission: ReminderPermission | null;
  /** Turning on asks for permission first (never in screenshot builds). */
  setOn: (v: boolean) => Promise<void>;
};

export function useReminderSetting(): ReminderSetting {
  const { prefs, setPrefs } = useApp();
  const [permission, setPermission] = useState<ReminderPermission | null>(null);
  const foreground = useForegroundTick();

  useEffect(() => {
    let alive = true;
    getReminderPermission().then((p) => alive && setPermission(p));
    return () => {
      alive = false;
    };
  }, [foreground]);

  const setOn = useCallback(
    async (v: boolean) => {
      if (!v) {
        setPrefs({ reminders: false });
        return;
      }
      setPrefs({ reminders: true });
      if (CAPTURE) return;
      setPermission(await requestReminderPermission());
      permissionListeners.forEach((l) => l());
    },
    [setPrefs],
  );

  return { on: prefs.reminders, permission, setOn };
}
