import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_VISIBILITY, VisibilityRepo, sameVisibility, type AppVisibility } from '../core/appVisibility';
import { MemoryKv } from '../core/store';
import { loadPersistentKv } from '../native/kv';

/**
 * App visibility for the active TV (owner-1022: "Choose apps" and "Favourites only"), persisted per
 * TV in AsyncStorage (in memory where storage is unavailable). Shared between the Apps tab and the
 * Choose apps screen: a change on one shows on the other at once.
 */
export const visibilityRepo = new VisibilityRepo(loadPersistentKv() ?? new MemoryKv());

const listeners = new Set<(tvId: string, v: AppVisibility) => void>();

export function useAppVisibility(tvId: string | null): {
  visibility: AppVisibility;
  ready: boolean;
  update: (fn: (v: AppVisibility) => AppVisibility) => void;
} {
  const [state, setState] = useState<{ tvId: string | null; v: AppVisibility; ready: boolean }>(() => {
    const known = tvId ? visibilityRepo.peek(tvId) : undefined;
    return { tvId, v: known ?? DEFAULT_VISIBILITY, ready: known !== undefined };
  });

  useEffect(() => {
    if (!tvId) return;
    let cancelled = false;
    void visibilityRepo.load(tvId).then((v) => {
      if (!cancelled) setState({ tvId, v, ready: true });
    });
    const on = (id: string, v: AppVisibility) => {
      if (id === tvId) setState({ tvId, v, ready: true });
    };
    listeners.add(on);
    return () => {
      cancelled = true;
      listeners.delete(on);
    };
  }, [tvId]);

  const current = state.tvId === tvId ? state.v : DEFAULT_VISIBILITY;

  const update = useCallback(
    (fn: (v: AppVisibility) => AppVisibility) => {
      if (!tvId) return;
      const next = fn(current);
      if (sameVisibility(next, current)) return;
      void visibilityRepo.save(tvId, next);
      for (const l of listeners) l(tvId, next);
    },
    [tvId, current],
  );

  return { visibility: current, ready: state.tvId === tvId && state.ready, update };
}
