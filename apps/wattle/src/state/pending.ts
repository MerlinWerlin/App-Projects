/** Hand-off for "Save to a job": the calculator puts its result here and opens the save sheet. */
import type { SavedCalc } from '../core/jobs.ts';

export type PendingCalc = Omit<SavedCalc, 'id' | 'at'>;
let pending: PendingCalc | null = null;

export function setPending(c: PendingCalc): void { pending = c; }
export function takePending(): PendingCalc | null { return pending; }
export function clearPending(): void { pending = null; }
