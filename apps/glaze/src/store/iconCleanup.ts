// T194: the Shortcuts icons Glaze last walked the person through (theme + app names), so the
// install screen can list the old ones to remove when a different theme's icons are started.
// Logic and parsing live in src/core/iconCleanup.ts (tested).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emptyCleanupRecord,
  parseCleanupRecord,
  serializeCleanupRecord,
  type IconCleanupRecord,
} from '../core/iconCleanup';

export type { IconCleanupRecord };

const KEY = 'glaze.iconCleanup.v1';

export async function loadCleanupRecord(): Promise<IconCleanupRecord> {
  try {
    return parseCleanupRecord(await AsyncStorage.getItem(KEY));
  } catch {
    return emptyCleanupRecord();
  }
}

export async function saveCleanupRecord(r: IconCleanupRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, serializeCleanupRecord(r));
  } catch {
    // Storage unavailable: the note just isn't shown next time.
  }
}

/** The record plus `update`, which applies a pure change and persists it. */
export function useIconCleanupRecord(): {
  record: IconCleanupRecord;
  loaded: boolean;
  update: (fn: (r: IconCleanupRecord) => IconCleanupRecord) => void;
} {
  const [record, setRecord] = useState<IconCleanupRecord>(emptyCleanupRecord);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<IconCleanupRecord>(record);

  useEffect(() => {
    let alive = true;
    loadCleanupRecord().then((r) => {
      if (!alive) return;
      ref.current = r;
      setRecord(r);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((fn: (r: IconCleanupRecord) => IconCleanupRecord) => {
    const next = fn(ref.current);
    if (next === ref.current) return;
    ref.current = next;
    setRecord(next);
    saveCleanupRecord(next);
  }, []);

  return { record, loaded, update };
}
