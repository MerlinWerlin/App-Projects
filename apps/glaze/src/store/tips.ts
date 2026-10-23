// Tips: which ones the person has dismissed (AsyncStorage glaze.tips.v1 = { dismissed: [...] }).
// Content and pure state rules live in src/core/tips.ts. The T09 exports below keep working for the
// Themes tab's first-run cards; they only ever see the three first-run ids.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  FIRST_RUN_TIP_IDS,
  TIPS_KEY,
  dismiss,
  dismissMany,
  parseTips,
  restoreAll,
  restoreOne,
  serializeTips,
  type TipId as AnyTipId,
} from '../core/tips';

export type { AnyTipId };

/** T09: the first-run card ids (Themes tab). */
export type TipId = (typeof FIRST_RUN_TIP_IDS)[number];
export const TIP_IDS: readonly TipId[] = FIRST_RUN_TIP_IDS;

let cache: AnyTipId[] | null = null;
const listeners = new Set<(d: AnyTipId[]) => void>();

function firstRunOnly(d: readonly AnyTipId[]): TipId[] {
  return d.filter((x): x is TipId => (TIP_IDS as readonly string[]).includes(x));
}

/** Every dismissed tip id (first-run and contextual). */
export async function loadAllDismissed(): Promise<AnyTipId[]> {
  if (cache) return cache;
  try {
    cache = parseTips(await AsyncStorage.getItem(TIPS_KEY));
  } catch {
    cache = [];
  }
  return cache;
}

async function commit(next: AnyTipId[]): Promise<AnyTipId[]> {
  cache = next;
  for (const fn of listeners) fn(next);
  try {
    await AsyncStorage.setItem(TIPS_KEY, serializeTips(next));
  } catch {
    // Storage unavailable: the tips just show again next launch.
  }
  return next;
}

/** Called whenever any tip is dismissed or restored, from any screen. Returns an unsubscribe. */
export function onTipsChanged(fn: (dismissed: AnyTipId[]) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function setTipDismissed(id: AnyTipId, hidden: boolean): Promise<AnyTipId[]> {
  const cur = await loadAllDismissed();
  return commit(hidden ? dismiss(cur, id) : restoreOne(cur, id));
}

export async function restoreAllTips(): Promise<AnyTipId[]> {
  return commit(restoreAll(await loadAllDismissed()));
}

// ---- T09 API (first-run cards) ----

export async function loadDismissedTips(): Promise<TipId[]> {
  return firstRunOnly(await loadAllDismissed());
}

export async function dismissTip(id: TipId): Promise<TipId[]> {
  return firstRunOnly(await setTipDismissed(id, true));
}

/** Hides the three first-run cards; contextual tips keep their own state. */
export async function dismissAllTips(): Promise<TipId[]> {
  return firstRunOnly(await commit(dismissMany(await loadAllDismissed(), TIP_IDS)));
}

/** Settings › "Show tips again": brings back every tip. */
export async function resetTips(): Promise<void> {
  await restoreAllTips();
}

/** Live dismissed state for ContextTip and the Tips library. `dismissed` is null while loading. */
export function useTips() {
  const [dismissed, setDismissed] = useState<AnyTipId[] | null>(cache);

  useEffect(() => {
    let alive = true;
    loadAllDismissed().then((d) => {
      if (alive) setDismissed(d);
    });
    const off = onTipsChanged((d) => {
      if (alive) setDismissed(d);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const hide = useCallback((id: AnyTipId) => setTipDismissed(id, true), []);
  const show = useCallback((id: AnyTipId) => setTipDismissed(id, false), []);
  const showAll = useCallback(() => restoreAllTips(), []);

  return { dismissed, hide, show, showAll };
}
