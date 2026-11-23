import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useApp } from '../state/AppState.tsx';
import { setPending, type PendingCalc } from '../state/pending.ts';

/** Returns a function that opens "Save to a job" for a result (or the unlock screen when locked). */
export function useSave() {
  const router = useRouter();
  const { can } = useApp();
  return useCallback((calc: PendingCalc) => {
    if (!can('jobs')) { router.push('/unlock'); return; }
    setPending(calc);
    router.push('/save');
  }, [router, can]);
}
