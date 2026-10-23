import type { Reconnector } from './reconnect';
import type { KeyHold } from './session';

/** What the link needs from the session (RemoteSession implements it). */
export interface KeyHoldTarget {
  holdKeys(mode: Exclude<KeyHold, 'none'>): void;
  releaseKeys(ok: boolean): Promise<void>;
  reportError(message: string): void;
}

/**
 * T70 glue between the Reconnector and the session, pure so it is tested without React:
 * - a run in progress (waiting / connecting) -> session holds keys and shows "Reconnecting…";
 * - a silent foreground probe -> keys are held, nothing is shown;
 * - back to connected -> held keys (at most 2 s old) are sent in order;
 * - anything else (gave up, TV off, background, TV switched) -> held keys are dropped;
 * - giving up shows exactly one message (the reconnector's friendly text), never one per attempt.
 * Returns an unsubscribe function.
 */
export function linkReconnectToSession(reconnector: Reconnector, session: KeyHoldTarget): () => void {
  let mode: KeyHold = 'none';
  let lastPhase = reconnector.getStatus().phase;
  const sync = () => {
    const st = reconnector.getStatus();
    const next: KeyHold =
      st.phase === 'waiting' || st.phase === 'connecting' ? 'reconnecting' : reconnector.isProbing() ? 'probing' : 'none';
    if (next !== 'none') {
      if (next !== mode) session.holdKeys(next);
    } else if (mode !== 'none') {
      // A run ends well only in 'connected'; a probe ends well when it answered ('ok').
      const ok = mode === 'probing' ? reconnector.probeOutcome() === 'ok' : st.phase === 'connected';
      void session.releaseKeys(ok);
    }
    if (st.phase === 'gave_up' && lastPhase !== 'gave_up' && st.message) session.reportError(st.message);
    mode = next;
    lastPhase = st.phase;
  };
  const unsub = reconnector.subscribe(sync);
  sync();
  return unsub;
}
