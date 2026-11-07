/**
 * Opens the Couch Plus paywall (app/plus.tsx) when a locked control is pressed. Pure TypeScript.
 * A held key, a touchpad swipe or a slideshow can hit the gate many times a second: the paywall opens once, and not
 * again while it is on screen or within REOPEN_MS of the last open.
 */
export const REOPEN_MS = 1500;

let opener: (() => void) | null = null;
let shown = false;
let lastAt = -Infinity;

/** The root layout registers how to open the paywall (router push). */
export function setPaywallOpener(fn: (() => void) | null): void {
  opener = fn;
}

/** app/plus.tsx reports when it is on screen. */
export function setPaywallShown(on: boolean): void {
  shown = on;
}

/**
 * 'opened': the paywall was asked to open. 'skipped': it is already showing or just opened. 'failed': it could not
 * open (no navigator yet), so the caller says so another way (a toast) instead of failing silently.
 */
export type PaywallRequest = 'opened' | 'skipped' | 'failed';

export function requestPaywall(now: number = Date.now()): PaywallRequest {
  if (shown || now - lastAt < REOPEN_MS) return 'skipped';
  lastAt = now;
  if (!opener) return 'failed';
  try {
    opener();
    return 'opened';
  } catch {
    return 'failed';
  }
}

/** Tests only. */
export function resetPaywall(): void {
  opener = null;
  shown = false;
  lastAt = -Infinity;
}
