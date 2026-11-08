// T17 this phone's backup record (last backup date, the "Include documents" switch, dismissed reminders) under
// BACKUP_STATE_KEY. Never itself in a backup (src/core/backup.ts TRANSIENT_KEYS). Cleaned on every read.
import { useMemo } from 'react';
import { BACKUP_STATE_KEY, normaliseBackupState, type BackupState } from '../core/backup.ts';
import { usePersisted } from './persisted.ts';

const EMPTY: unknown = null;

export function useBackupState(): [BackupState, (fn: (old: BackupState) => BackupState) => void, boolean] {
  const [raw, setRaw, loaded] = usePersisted<unknown>(BACKUP_STATE_KEY, EMPTY);
  const state = useMemo(() => normaliseBackupState(raw), [raw]);
  const update = (fn: (old: BackupState) => BackupState) => setRaw((old: unknown) => fn(normaliseBackupState(old)));
  return [state, update, loaded];
}
