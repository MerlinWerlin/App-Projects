/**
 * IrTransmitter over the local ir-blaster Expo module (modules/ir-blaster, Android only). The module
 * exists only in an Android dev build, so it is loaded lazily inside try/catch: in Expo Go, on iOS,
 * on web and in tests this returns null and the UI says IR is not available. Never throws.
 * Not tested on a device yet.
 */
import type { IrTransmitter } from '../core/ir/transmitter';

/** Minimal slice of modules/ir-blaster/index.ts (kept local so a missing module cannot break types). */
interface IrBlasterModule {
  hasIrEmitter(): boolean;
  transmit(frequency: number, pattern: number[]): Promise<void>;
}

declare const require: (id: string) => unknown;

function loadModule(): IrBlasterModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../modules/ir-blaster') as { default?: IrBlasterModule | null } | null;
    const m = mod?.default ?? null;
    if (!m || typeof m.transmit !== 'function' || typeof m.hasIrEmitter !== 'function') return null;
    return m.hasIrEmitter() === true ? m : null;
  } catch {
    return null;
  }
}

/** An IrTransmitter, or null when this phone or build has no IR emitter. */
export function loadIrTransmitter(): IrTransmitter | null {
  const mod = loadModule();
  if (!mod) return null;
  return {
    transmit: (frequency, pattern) => mod.transmit(frequency, pattern),
  };
}

export function hasIrBlaster(): boolean {
  return loadModule() !== null;
}
