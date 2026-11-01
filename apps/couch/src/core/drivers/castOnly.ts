/**
 * Cast-only TV: a saved TV Couch can cast photos and videos to (Google Cast, src/core/cast) but not
 * control. Used for Google TVs when the remote protocol is not available in this build (Expo Go,
 * builds without the Android TV Remote native socket), and for Google TVs the user saved with "Use
 * for casting photos and videos".
 *
 * It keeps the session simple: the TV has a driver like every other TV, so it is listed in the TVs
 * tab and offered as a Cast target, but the driver has no capabilities, connect() is a quiet no-op
 * (no state events, so the reconnector never starts an endless run; reconnect.ts also skips it),
 * and every control rejects with one translated 'unsupported' message.
 */
import { Emitter, type DriverEvent, type TvDriver } from '../driver';
import type { Key } from '../keys';
import { t } from '../../i18n/core';
import { DriverError, type Capability, type Platform } from '../types';

export interface CastOnlyOptions {
  platform?: Platform;
  /**
   * The remote protocol IS available in this build (the TV was saved for casting only, or on an
   * older build): the message then says to add the TV again to pair it as a remote.
   */
  remoteAvailable?: boolean;
}

/** What the remote screen and failed controls say for a cast-only TV. In the active language. */
export function castOnlyMessage(remoteAvailable = false): string {
  return t(remoteAvailable ? 'core.driver.castOnly.addAgain' : 'core.driver.castOnly.comingSoon');
}

export class CastOnlyDriver implements TvDriver {
  readonly platform: Platform;
  readonly capabilities: ReadonlySet<Capability> = new Set<Capability>();
  /** Marker read by isCastOnlyDriver() (reconnector, remote screen). */
  readonly castOnly = true as const;
  readonly remoteAvailable: boolean;
  private readonly events = new Emitter();

  constructor(opts: CastOnlyOptions = {}) {
    this.platform = opts.platform ?? 'androidtv';
    this.remoteAvailable = opts.remoteAvailable === true;
  }

  message(): string {
    return castOnlyMessage(this.remoteAvailable);
  }

  private refuse(): Promise<never> {
    return Promise.reject(new DriverError('unsupported', this.message()));
  }

  /** Nothing to connect: casting opens its own connection per cast. */
  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  sendKey(_key: Key): Promise<void> {
    return this.refuse();
  }

  sendText(_text: string): Promise<void> {
    return this.refuse();
  }

  launchApp(_appId: string): Promise<void> {
    return this.refuse();
  }

  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }
}

export function isCastOnlyDriver(d: TvDriver | null | undefined): d is CastOnlyDriver {
  return !!d && (d as Partial<CastOnlyDriver>).castOnly === true;
}
