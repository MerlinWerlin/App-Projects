// T156 step-free travel: the access needs and the toilets quick filter, on this phone only under STEPFREE_KEY
// (declared once in src/core/stepfree.ts). Never on the Trip, so a shared .satchel file cannot carry them.
import { useCallback, useMemo } from 'react';
import { readPrefs, STEPFREE_KEY, type StepFreePrefs } from '../core/stepfree.ts';
import { usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

/** [prefs (cleaned), change(fn), loaded]. */
export function useStepFree(): [StepFreePrefs, (change: (old: StepFreePrefs) => StepFreePrefs) => void, boolean] {
  const [raw, setRaw, loaded] = usePersisted<unknown>(STEPFREE_KEY, EMPTY);
  const prefs = useMemo(() => readPrefs(raw), [raw]);
  const change = useCallback((fn: (old: StepFreePrefs) => StepFreePrefs) => setRaw((old: unknown) => fn(readPrefs(old))), [setRaw]);
  return [prefs, change, loaded];
}
