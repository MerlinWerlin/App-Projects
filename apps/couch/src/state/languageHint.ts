/**
 * React binding for the first-launch language line (src/core/languageHint.ts). One instance per app run, so
 * the remote screen remounting never re-decides. Persisted through the existing kv store (src/native/kv.ts,
 * in-memory fallback).
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { LanguageHint } from '../core/languageHint';
import { MemoryKv } from '../core/store';
import { loadPersistentKv } from '../native/kv';

let hint: LanguageHint | null = null;

function languageHint(): LanguageHint {
  if (!hint) hint = new LanguageHint(loadPersistentKv() ?? new MemoryKv());
  return hint;
}

export function useLanguageHint(): { visible: boolean; dismiss: () => void } {
  const h = languageHint();
  useEffect(() => {
    void h.start();
  }, [h]);
  const subscribe = useCallback((cb: () => void) => h.subscribe(cb), [h]);
  const getSnapshot = useCallback(() => h.visible(), [h]);
  const visible = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const dismiss = useCallback(() => {
    void h.dismiss();
  }, [h]);
  return { visible, dismiss };
}
