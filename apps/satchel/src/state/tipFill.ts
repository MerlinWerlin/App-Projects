// T108: "Work out a tip" from an open expense form hands the tip-included total back to that form in memory. The
// form asks for a token (passed to the calculator as the `fill` route param); "Use this total" delivers the amount
// under that token and goes back; the form that holds the token takes it once and clears it. Other ways into the
// calculator have no token and keep "Add to spending".
import { useSyncExternalStore } from 'react';
import type { TipFill } from '../core/tipping.ts';

type Delivered = { token: string; fill: TipFill };

let delivered: Delivered | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** A new token for one trip from the expense form to the calculator and back. */
export function newTipFillToken(): string {
  seq += 1;
  return `${Date.now().toString(36)}-${seq}`;
}

/** The calculator's "Use this total": hands the amount to the form holding `token`. */
export function deliverTipFill(token: string, fill: TipFill): void {
  delivered = { token, fill };
  emit();
}

/** The form took it (or gave up its token): drop it so it is applied once. */
export function clearTipFill(token: string): void {
  if (delivered?.token !== token) return;
  delivered = null;
  emit();
}

/** The amount waiting for `token`, or null. */
export function useTipFill(token: string | null): TipFill | null {
  const d = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => delivered,
  );
  return token && d && d.token === token ? d.fill : null;
}
