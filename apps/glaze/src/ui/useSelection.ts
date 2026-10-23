// T107: React bindings for core/categorySwitch's selection store. A bubble subscribes to its own
// key only (useSyncExternalStore), so a press re-renders the old and the new bubble and nothing else.
import { useCallback, useSyncExternalStore } from 'react';
import type { SelectionStore } from '../core/categorySwitch';

/** Whether `key` is the selected one; re-renders only when that answer changes. */
export function useIsSelected<K extends string>(store: SelectionStore<K>, key: K): boolean {
  const subscribe = useCallback((cb: () => void) => store.subscribeKey(key, cb), [store, key]);
  const get = useCallback(() => store.get() === key, [store, key]);
  return useSyncExternalStore(subscribe, get, get);
}
