/** Core domain types. Pure TypeScript: no React Native imports anywhere under src/core. */

import { withCopy } from '../i18n/lazyCopy';

export type Platform =
  | 'roku'
  | 'samsung'
  | 'webos'
  | 'androidtv'
  | 'firetv'
  | 'vizio'
  | 'sony'
  | 'philips'
  | 'ir'
  | 'mock';

/**
 * Human label for a platform (protocol code may name platforms; app name/icon never do). Brand names
 * are data; the generic words ('IR', 'Demo') translate on read.
 */
export const PLATFORM_LABEL: Record<Platform, string> = withCopy(
  {
    roku: 'Roku',
    samsung: 'Samsung',
    webos: 'LG',
    androidtv: 'Google TV',
    firetv: 'Fire TV',
    vizio: 'Vizio',
    sony: 'Sony',
    philips: 'Philips',
    ir: '',
    mock: '',
  } as Record<Platform, string>,
  { ir: 'core.platform.ir', mock: 'core.platform.demo' },
);

/** Platforms shown with a "beta" chip. */
export const BETA_PLATFORMS: ReadonlySet<Platform> = new Set<Platform>(['firetv']);

export type Capability =
  | 'keys'
  | 'text'
  | 'apps'
  | 'launch'
  | 'volume'
  | 'powerOn'
  | 'touchpad'
  | 'inputs' // listInputs/setInput available (source picker); without it SOURCE cycles
  | 'numbers' // NUM_0-9 keys reach the TV (123 number pad)
  | 'colorKeys' // RED/GREEN/YELLOW/BLUE reach the TV
  | 'voice' // beginVoice: native voice over the TV protocol
  | 'appIcons'; // appIcon() returns the TV-supplied icon for an app

export type PairState =
  | { kind: 'none' } // no pairing needed (Roku)
  | { kind: 'prompt' } // user presses Allow on the TV (Samsung, LG)
  | { kind: 'code'; length: number } // code shown on TV (Google TV 6 hex, Fire TV 4)
  | { kind: 'paired'; token: string };

export interface Tv {
  id: string;
  name: string;
  room?: string;
  model: string;
  platform: Platform;
  host: string;
  mac?: string;
  token?: string;
  lastSeen?: number;
  /** Infrared TVs (platform 'ir'): the code set chosen in setup, as (brand, 1-based set) for codeSetFor(). */
  irBrand?: string;
  irSet?: number;
  /**
   * Saved for casting only ("Use for casting photos and videos", Google TV): no remote driver is
   * connected for it (src/core/drivers/castOnly.ts); it is listed in TVs and offered as a Cast target.
   */
  castOnly?: boolean;
}

/** A TV input (HDMI 1, TV tuner, AV ...) as the TV reports it. */
export interface TvInput {
  id: string;
  name: string;
  current?: boolean;
}

export interface TvApp {
  id: string;
  name: string;
  pinned?: boolean;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'off' | 'error';

export class DriverError extends Error {
  constructor(
    public readonly code:
      | 'not_connected'
      | 'tv_off'
      | 'unsupported'
      | 'pair_required'
      | 'forbidden'
      | 'timeout'
      | 'network',
    message: string,
  ) {
    super(message);
    this.name = 'DriverError';
  }
}
