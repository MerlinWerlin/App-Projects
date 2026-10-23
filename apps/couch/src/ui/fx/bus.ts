/**
 * Tiny visual-effects bus (premium polish). Controls emit, decorations listen:
 * - 'press': a key was pressed; `dir` is where it sits relative to the remote's centre
 *   (x, y in -1..1, x right, y down) so the cinema glow can pulse from that side.
 * - 'power': power key pressed -> slow warm swell.
 * - 'connected': the TV connected -> marquee ripple.
 * - 'volume': volume stepped -> volume HUD (level 0..100 when the driver knows it).
 * Pure TS, no React; listeners are called synchronously and errors are swallowed.
 */
export type FxEvent =
  | { type: 'press'; dir: { x: number; y: number } }
  | { type: 'power' }
  | { type: 'connected' }
  | { type: 'volume'; step: 'up' | 'down' | 'mute'; level?: number };

type Listener = (e: FxEvent) => void;

const listeners = new Set<Listener>();

export function onFx(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitFx(e: FxEvent): void {
  for (const fn of [...listeners]) {
    try {
      fn(e);
    } catch {
      // A broken decoration never breaks a key press.
    }
  }
}

/** Clamp a direction to -1..1 on both axes (NaN -> 0). */
export function clampDir(x: number, y: number): { x: number; y: number } {
  const c = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
  return { x: c(x), y: c(y) };
}

/** Test helper: number of live listeners. */
export function fxListenerCount(): number {
  return listeners.size;
}
