// Holds the reading the person tapped "Save to a job" on, while the Save sheet is open.
import type { SavedReading } from '../core/jobs.ts';

let pending: Omit<SavedReading, 'id' | 'at'> | null = null;
export function stashReading(r: Omit<SavedReading, 'id' | 'at'>) {
  pending = r;
}
export function takeStash() {
  return pending;
}
export function clearStash() {
  pending = null;
}
