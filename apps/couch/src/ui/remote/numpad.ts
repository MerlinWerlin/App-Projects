/**
 * Pure state for the 123 number pad sheet (prototype v2 numpadSheet()).
 * Each press returns the Key to send; NumpadSheet.tsx sends it via session.sendKey.
 */
import { numKey, type Key } from '../../core/keys';

/** Prototype shows the last 5 characters typed. */
export const NUMPAD_SHOW_MAX = 5;

export interface NumpadState {
  /** Digits shown in the mono display. */
  show: string;
}

export interface NumpadResult {
  state: NumpadState;
  /** Key to send to the TV, or null if the press was not a valid pad key. */
  send: Key | null;
  /** True when the sheet should close (after OK). */
  close: boolean;
}

export function initialNumpad(): NumpadState {
  return { show: '' };
}

/** A digit '0'-'9' or '-' (dash). Anything else is ignored. */
export function pressDigit(state: NumpadState, ch: string): NumpadResult {
  const k = numKey(ch);
  if (!k) return { state, send: null, close: false };
  return { state: { show: (state.show + ch).slice(-NUMPAD_SHOW_MAX) }, send: k, close: false };
}

/** OK sends ENTER and closes; the display resets for next time. */
export function pressOk(_state: NumpadState): NumpadResult {
  return { state: initialNumpad(), send: 'ENTER', close: true };
}
