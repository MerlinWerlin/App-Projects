/**
 * What the core needs from an infrared emitter. The Android implementation (src/native/ir.ts over
 * modules/ir-blaster) wraps ConsumerIrManager.transmit; tests inject a fake that records frames.
 */
export interface IrTransmitter {
  /** Sends one pattern: alternating on/off microseconds, starting with on. */
  transmit(frequencyHz: number, pattern: number[]): Promise<void>;
}
