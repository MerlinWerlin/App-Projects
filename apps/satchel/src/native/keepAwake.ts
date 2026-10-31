// T56: keep the screen awake while a phrase card is shown to someone. Same guarded expo-keep-awake calls as the
// ticket view (src/native/brightness.ts), under its own tag; if keep-awake is unavailable the card still works.
import * as KeepAwake from 'expo-keep-awake';
import { useEffect } from 'react';

function set(tag: string, on: boolean) {
  try {
    const p = on ? KeepAwake.activateKeepAwakeAsync(tag) : KeepAwake.deactivateKeepAwake(tag);
    p.catch(() => {});
  } catch {
    // keep-awake unavailable: nothing to do
  }
}

/** Keeps the screen on while mounted (and `on`). */
export function useScreenAwake(tag: string, on = true): void {
  useEffect(() => {
    if (!on) return;
    set(tag, true);
    return () => set(tag, false);
  }, [tag, on]);
}
