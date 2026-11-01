// Step counting through the phone's motion chip (expo-sensors Pedometer).
// iOS can read today's total since midnight. Android can't read history, so there we
// count live steps while the app is open and keep a running total for the day.
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

export type StepsStatus = 'ok' | 'denied' | 'unavailable';

export async function stepsPermission(): Promise<StepsStatus> {
  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) return 'unavailable';
    const perm = await Pedometer.getPermissionsAsync();
    if (perm.granted) return 'ok';
    if (perm.canAskAgain) {
      const asked = await Pedometer.requestPermissionsAsync();
      return asked.granted ? 'ok' : 'denied';
    }
    return 'denied';
  } catch {
    return 'unavailable';
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Today's steps since midnight (iOS). Null where the platform can't tell us. */
export async function stepsToday(): Promise<number | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const r = await Pedometer.getStepCountAsync(startOfToday(), new Date());
    return typeof r?.steps === 'number' ? r.steps : null;
  } catch {
    return null;
  }
}

/** Live step updates while the app is open. Returns an unsubscribe function. */
export function watchSteps(onSteps: (stepsSinceStart: number) => void): () => void {
  try {
    const sub = Pedometer.watchStepCount((r) => onSteps(r.steps));
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
