import type { ConnectionState } from '../../core/types';
import { t } from '../../i18n/core';

/**
 * Connection status pill logic (premium polish P3). Pure TS, no React Native: the TV header's
 * StatusPill turns these into colours and Animated loops.
 *
 * Driver states (src/core/types.ts ConnectionState) plus the session's `null` ("no state reported
 * yet, e.g. right after switching TV") map to what the pill shows:
 * - searching: first 'connecting' for this TV -> soft shimmer.
 * - connected: 'connected' -> green, the dot pops once (+ success haptic, 'connected' fx) on the transition.
 * - ready: no state yet on a real TV -> green, static, no pop (nothing has actually connected).
 * - reconnecting: 'connecting' or 'disconnected' after this TV was connected (the reconnector retries) -> amber pulse.
 * - offline: 'disconnected' before ever connecting -> static muted.
 * - off: TV reported off -> static muted.
 * - error: driver error -> static amber.
 * - none: no TV selected.
 */
export type PillStatus = 'none' | 'ready' | 'searching' | 'connected' | 'reconnecting' | 'offline' | 'off' | 'error';

export function pillStatus(
  state: ConnectionState | null,
  hasTv: boolean,
  everConnected: boolean,
  /** Demo (mock) drivers are connected before the session loads and never report it: treat null as connected. */
  assumeConnected = false,
): PillStatus {
  if (!hasTv) return 'none';
  switch (state) {
    case null:
      return assumeConnected ? 'connected' : 'ready';
    case 'connecting':
      return everConnected ? 'reconnecting' : 'searching';
    case 'connected':
      return 'connected';
    case 'disconnected':
      return everConnected ? 'reconnecting' : 'offline';
    case 'off':
      return 'off';
    case 'error':
      return 'error';
  }
}

export type PillColor = 'ok' | 'warn' | 'muted' | 'accent';
export type PillAnim = 'shimmer' | 'pulse' | 'none';

export interface PillVisual {
  /** Palette key for the dot. */
  color: PillColor;
  /** Idle loop while in this status (paused when the screen is inactive; none with Reduce Motion). */
  anim: PillAnim;
  /** Status word shown after the model in the header, translated when pillVisual() is called. */
  label: string;
  /** Latency is meaningful only while the link is up. */
  live: boolean;
}

export function pillVisual(status: PillStatus): PillVisual {
  switch (status) {
    case 'none':
      return { color: 'muted', anim: 'none', label: '', live: false };
    case 'ready':
      return { color: 'ok', anim: 'none', label: t('ui.status.connected'), live: true };
    case 'searching':
      return { color: 'accent', anim: 'shimmer', label: t('ui.status.connecting'), live: false };
    case 'connected':
      return { color: 'ok', anim: 'none', label: t('ui.status.connected'), live: true };
    case 'reconnecting':
      return { color: 'warn', anim: 'pulse', label: t('ui.status.reconnecting'), live: false };
    case 'offline':
      return { color: 'muted', anim: 'none', label: t('ui.status.offline'), live: false };
    case 'off':
      return { color: 'muted', anim: 'none', label: t('ui.status.off'), live: false };
    case 'error':
      return { color: 'warn', anim: 'none', label: t('ui.status.error'), live: false };
  }
}

/** What the header remembers between renders. */
export interface PillTrack {
  tvId: string | null;
  status: PillStatus;
  /** This TV reached 'connected' since it became active (and was not turned off since). */
  everConnected: boolean;
}

export const initialTrack: PillTrack = { tvId: null, status: 'none', everConnected: false };

export interface PillFx {
  /** Pop the dot (scale 1 -> 1.5 -> 1). */
  pop: boolean;
  /** Play the success haptic. */
  haptic: boolean;
  /** emitFx({ type: 'connected' }) for the cinema glow marquee. */
  emit: boolean;
}

/** Effects for a status change: only on a transition INTO connected (or into connected on another TV). */
export function transition(prev: PillTrack, next: PillTrack): PillFx {
  const into = next.status === 'connected' && (prev.status !== 'connected' || prev.tvId !== next.tvId);
  return { pop: into, haptic: into, emit: into };
}

/** Advance the track with the session's current TV and state; returns the new track and its effects. */
export function step(
  prev: PillTrack,
  tvId: string | null,
  state: ConnectionState | null,
  assumeConnected = false,
): { next: PillTrack; fx: PillFx } {
  const sameTv = prev.tvId === tvId;
  let ever = sameTv ? prev.everConnected : false;
  if (state === 'off') ever = false;
  const status = pillStatus(state, tvId !== null, ever, assumeConnected);
  if (status === 'connected') ever = true;
  const next: PillTrack = { tvId, status, everConnected: ever };
  return { next, fx: transition(prev, next) };
}
