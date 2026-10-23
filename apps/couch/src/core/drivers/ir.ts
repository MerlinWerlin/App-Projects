/**
 * Infrared driver (platform 'ir'): turns keys into ConsumerIrManager patterns from the code set
 * chosen in the setup flow and hands them to an injected transmitter. One-way: no state, no apps,
 * no typing. UNVERIFIED on real TVs (no IR phone available to workers).
 */
import { Emitter, type DriverEvent, type TvDriver } from '../driver';
import { NUM_KEYS, type Key } from '../keys';
import { codeFor, type IrCodeSet } from '../ir/codes';
import { encode, type IrCode } from '../ir/protocols';
import type { IrTransmitter } from '../ir/transmitter';
import { DriverError, type Capability } from '../types';
import { driverError } from './errors';

/** Keys that mean the same thing on an IR remote, tried when the set lacks the key itself. */
const ALIASES: Partial<Record<Key, Key[]>> = {
  INPUT: ['SOURCE'],
  SOURCE: ['INPUT'],
  ENTER: ['OK'],
  MENU: ['SETTINGS'],
  SETTINGS: ['MENU'],
};

export interface IrDriverOptions {
  now?: () => number;
}

export class IrDriver implements TvDriver {
  readonly platform = 'ir' as const;
  readonly capabilities: ReadonlySet<Capability>;
  private readonly events = new Emitter();
  private readonly now: () => number;
  private rc5Toggle: 0 | 1 = 0;

  constructor(
    readonly codeSet: IrCodeSet,
    private readonly transmitter: IrTransmitter,
    opts: IrDriverOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    const caps = new Set<Capability>(['keys']);
    if (NUM_KEYS.every((k) => codeSet.keys[k] !== undefined)) caps.add('numbers');
    this.capabilities = caps;
  }

  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }

  /** Nothing to connect to: IR is one-way, so the TV always counts as reachable. */
  async connect(): Promise<void> {
    this.events.emit({ type: 'state', state: 'connected' });
  }

  async disconnect(): Promise<void> {
    this.events.emit({ type: 'state', state: 'disconnected' });
  }

  /** The IrCode a key would send, or undefined when this code set has no such button. */
  codeForKey(key: Key): IrCode | undefined {
    const direct = codeFor(this.codeSet, key);
    if (direct) return direct;
    for (const alt of ALIASES[key] ?? []) {
      const c = codeFor(this.codeSet, alt);
      if (c) return c;
    }
    return undefined;
  }

  async sendKey(key: Key): Promise<void> {
    const code = this.codeForKey(key);
    if (!code) throw driverError('unsupported', 'core.driver.ir.noButton');
    // RC5 TVs ignore a repeated frame with the same toggle bit, so flip it on every press.
    const frame = encode(code, { toggle: this.rc5Toggle });
    if (code.protocol === 'rc5') this.rc5Toggle = this.rc5Toggle === 0 ? 1 : 0;
    const t0 = this.now();
    await this.transmitter.transmit(frame.frequency, frame.pattern);
    this.events.emit({ type: 'sent', what: key, ms: Math.max(0, Math.round(this.now() - t0)) });
  }

  async sendText(_text: string): Promise<void> {
    throw driverError('unsupported', 'core.driver.ir.noTyping');
  }

  async launchApp(_appId: string): Promise<void> {
    throw driverError('unsupported', 'core.driver.ir.noApps');
  }
}
