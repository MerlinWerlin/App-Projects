/**
 * ir-blaster: Android ConsumerIrManager for phones with an infrared emitter (many Xiaomi, Redmi and
 * POCO phones). There is no iOS implementation: iPhones have no IR emitter, so the module is null
 * there and hasIrEmitter() is false.
 *
 * UNVERIFIED: not compiled yet (needs a dev build) and never run on an IR phone. See README.md.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface IrCarrierRange {
  min: number;
  max: number;
}

export interface IrBlasterNativeModule {
  /** True when the phone has an IR emitter. */
  hasIrEmitter(): boolean;
  /** Carrier ranges the emitter supports (Hz); empty when unknown or no emitter. */
  getCarrierFrequencies(): IrCarrierRange[];
  /**
   * Transmits `pattern` (alternating on/off microseconds, starting with on) on a `frequency` Hz
   * carrier. Rejects when there is no emitter or the pattern is invalid (Android limits it to 2 s).
   */
  transmit(frequency: number, pattern: number[]): Promise<void>;
}

/** The native module, or null in Expo Go / iOS / web / tests where it is not compiled in. */
const IrBlaster = requireOptionalNativeModule<IrBlasterNativeModule>('IrBlaster');

export default IrBlaster;

export function hasIrEmitter(): boolean {
  try {
    return IrBlaster?.hasIrEmitter() === true;
  } catch {
    return false;
  }
}
