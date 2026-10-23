/**
 * Roku External Control Protocol (ECP) driver: plain HTTP on port 8060, no pairing.
 *
 * Implemented from the public ECP documentation and tested against fixtures
 * reconstructed from those docs (src/core/drivers/__fixtures__/roku/); not yet
 * verified on hardware.
 */
import { Emitter, type DriverEvent, type FetchLike, type TvDriver } from '../driver';
import type { Key, KeyMap } from '../keys';
import { DriverError, type Capability, type TvApp, type TvInput } from '../types';
import type { MessageKey } from '../../i18n/core';
import { driverError, asDriverError } from './errors';

export const ROKU_ECP_PORT = 8060;

/** Catalogue key of the help shown when the Roku answers 403 (control by mobile apps is off/limited). */
export const ROKU_MOBILE_CONTROL_HELP = 'core.driver.roku.blocked' as const satisfies MessageKey;

/** True when an error is the Roku refusing control (HTTP 403): show the settings help screen. */
export function isRokuForbidden(e: unknown): e is DriverError {
  return e instanceof DriverError && e.code === 'forbidden';
}

/** Canonical key -> ECP key name. POWER and INPUT are handled specially. */
export const ROKU_KEYS: KeyMap = {
  UP: 'Up',
  DOWN: 'Down',
  LEFT: 'Left',
  RIGHT: 'Right',
  OK: 'Select',
  BACK: 'Back',
  HOME: 'Home',
  MENU: 'Info',
  VOL_UP: 'VolumeUp',
  VOL_DOWN: 'VolumeDown',
  MUTE: 'VolumeMute',
  CH_UP: 'ChannelUp',
  CH_DOWN: 'ChannelDown',
  REW: 'Rev',
  PLAY_PAUSE: 'Play',
  FF: 'Fwd',
  BACKSPACE: 'Backspace',
  ENTER: 'Enter',
  SEARCH: 'Search',
};

/**
 * Inputs on Roku TVs, as documented ECP keypress names (InputTuner, InputHDMI1..4, InputAV1).
 * The id is the ECP key name. Static: ECP does not report which inputs a model has, their
 * user-given names, or the current input. UNVERIFIED on hardware: a model with fewer HDMI ports
 * may ignore the missing ones. (Roku TVs also list inputs as type="tvin" apps in /query/apps,
 * e.g. tvinput.hdmi1, launchable via /launch; a later pass could use those for real names.)
 */
export const ROKU_TV_INPUTS: readonly TvInput[] = [
  { id: 'InputTuner', name: 'TV' },
  { id: 'InputHDMI1', name: 'HDMI 1' },
  { id: 'InputHDMI2', name: 'HDMI 2' },
  { id: 'InputHDMI3', name: 'HDMI 3' },
  { id: 'InputHDMI4', name: 'HDMI 4' },
  { id: 'InputAV1', name: 'AV' },
];

const BASE_CAPS: readonly Capability[] = ['keys', 'text', 'apps', 'launch', 'powerOn', 'appIcons'];
const PLAYER_CAPS: ReadonlySet<Capability> = new Set<Capability>(BASE_CAPS);
const TV_CAPS: ReadonlySet<Capability> = new Set<Capability>([...BASE_CAPS, 'inputs']);

export interface RokuDeviceInfo {
  name: string;
  model: string;
  modelNumber?: string;
  serial?: string;
  deviceId?: string;
  wifiMac?: string;
  ethernetMac?: string;
  /** Preferred MAC for Wake-on-LAN: the one for the active network type, else any. */
  mac?: string;
  powerMode?: string;
  isTv: boolean;
  supportsWakeOnWlan: boolean;
  supportsSuspend: boolean;
  softwareVersion?: string;
  networkType?: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, ent: string) => {
    if (ent.startsWith('#x')) return String.fromCodePoint(parseInt(ent.slice(2), 16));
    if (ent.startsWith('#')) return String.fromCodePoint(parseInt(ent.slice(1), 10));
    return ENTITIES[ent] ?? m;
  });
}

function tag(xml: string, name: string): string | undefined {
  const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml);
  if (!m || m[1] === undefined) return undefined;
  const v = decodeXml(m[1]).trim();
  return v === '' ? undefined : v;
}

function bool(xml: string, name: string): boolean {
  return tag(xml, name) === 'true';
}

/** Parse GET /query/device-info. */
export function parseDeviceInfo(xml: string): RokuDeviceInfo {
  const wifiMac = tag(xml, 'wifi-mac');
  const ethernetMac = tag(xml, 'ethernet-mac');
  const networkType = tag(xml, 'network-type');
  const model = tag(xml, 'friendly-model-name') ?? tag(xml, 'model-name') ?? 'Roku';
  const name =
    tag(xml, 'user-device-name') ?? tag(xml, 'friendly-device-name') ?? tag(xml, 'default-device-name') ?? model;
  return {
    name,
    model,
    modelNumber: tag(xml, 'model-number'),
    serial: tag(xml, 'serial-number'),
    deviceId: tag(xml, 'device-id'),
    wifiMac,
    ethernetMac,
    mac: networkType === 'ethernet' ? (ethernetMac ?? wifiMac) : (wifiMac ?? ethernetMac),
    powerMode: tag(xml, 'power-mode'),
    isTv: bool(xml, 'is-tv'),
    supportsWakeOnWlan: bool(xml, 'supports-wake-on-wlan'),
    supportsSuspend: bool(xml, 'supports-suspend'),
    softwareVersion: tag(xml, 'software-version'),
    networkType,
  };
}

/** Parse GET /query/apps: <app id="12" type="appl" version="...">Netflix</app>. */
export function parseApps(xml: string): TvApp[] {
  const out: TvApp[] = [];
  const re = /<app\b([^>]*)>([^<]*)<\/app>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const id = /\bid="([^"]*)"/.exec(m[1] ?? '')?.[1];
    if (!id) continue;
    out.push({ id: decodeXml(id), name: decodeXml(m[2] ?? '').trim() });
  }
  return out;
}

/** ECP literal: Lit_ + URL-encoded character (UTF-8). */
export function rokuLiteral(ch: string): string {
  return `Lit_${encodeURIComponent(ch)}`;
}

export interface RokuDriverOptions {
  host: string;
  fetch: FetchLike;
  /** Clock used to measure round-trip ms; inject for deterministic tests. */
  now?: () => number;
  timeoutMs?: number;
}

function isTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === 'AbortError' || e.name === 'TimeoutError' || /time(d)?\s?out/i.test(e.message);
}

export class RokuDriver implements TvDriver {
  readonly platform = 'roku' as const;
  /** Dynamic: Roku TVs (device-info is-tv) add 'inputs' once connected; streaming players never do. */
  get capabilities(): ReadonlySet<Capability> {
    return this.info?.isTv ? TV_CAPS : PLAYER_CAPS;
  }

  info: RokuDeviceInfo | null = null;
  readonly base: string;

  private readonly events = new Emitter();
  private readonly fetch: FetchLike;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private connected = false;

  constructor(opts: RokuDriverOptions) {
    this.base = `http://${opts.host}:${ROKU_ECP_PORT}`;
    this.fetch = opts.fetch;
    this.now = opts.now ?? Date.now;
    this.timeoutMs = opts.timeoutMs ?? 3000;
  }

  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }

  private async request(method: 'GET' | 'POST', path: string): Promise<{ text: string; ms: number }> {
    const start = this.now();
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetch(this.base + path, method === 'POST' ? { method, body: '', timeoutMs: this.timeoutMs } : { method, timeoutMs: this.timeoutMs });
    } catch (e) {
      if (isTimeoutError(e)) throw driverError('timeout', 'core.driver.common.deviceTimeout', { device: 'Roku' });
      throw driverError('network', 'core.driver.common.deviceUnreachable', { device: 'Roku' });
    }
    const ms = Math.max(0, Math.round(this.now() - start));
    if (res.status === 403) throw driverError('forbidden', ROKU_MOBILE_CONTROL_HELP);
    if (res.status === 404 && path.startsWith('/launch/'))
      throw driverError('unsupported', 'core.driver.roku.appNotInstalled', { device: 'Roku' });
    if (!res.ok) throw driverError('network', 'core.driver.common.deviceHttp', { device: 'Roku', status: String(res.status) });
    const text = await res.text();
    return { text, ms };
  }

  private async post(path: string, what: string): Promise<void> {
    const { ms } = await this.request('POST', path);
    this.events.emit({ type: 'sent', what, ms });
  }

  private ensureConnected(): void {
    if (!this.connected) throw driverError('not_connected', 'core.driver.common.notConnected');
  }

  private fail(e: unknown): never {
    const err = asDriverError(e);
    this.events.emit({ type: 'error', message: err.message });
    throw err;
  }

  async connect(): Promise<void> {
    this.events.emit({ type: 'state', state: 'connecting' });
    try {
      this.info = parseDeviceInfo((await this.request('GET', '/query/device-info')).text);
    } catch (e) {
      this.connected = false;
      this.events.emit({ type: 'state', state: 'error' });
      this.fail(e);
    }
    this.connected = true;
    this.events.emit({ type: 'state', state: this.isOff() ? 'off' : 'connected' });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.events.emit({ type: 'state', state: 'disconnected' });
  }

  /** Roku TVs report power-mode; streaming players are always "on" while reachable. */
  private isOff(): boolean {
    const pm = this.info?.powerMode;
    return pm !== undefined && pm !== 'PowerOn';
  }

  private ecpName(key: Key): string {
    if (key === 'POWER') {
      // Roku TVs: explicit PowerOff/PowerOn from the known power mode (Power toggle is TV-only too,
      // but explicit keys keep our local state right). Players: Power toggles standby where supported.
      if (this.info?.isTv) return this.isOff() ? 'PowerOn' : 'PowerOff';
      return 'Power';
    }
    const name = ROKU_KEYS[key];
    if (!name) throw driverError('unsupported', 'core.driver.common.deviceKeyUnavailable', { key, device: 'Roku' });
    return name;
  }

  async sendKey(key: Key): Promise<void> {
    try {
      this.ensureConnected();
      const name = this.ecpName(key);
      await this.post(`/keypress/${name}`, key);
      if (key === 'POWER' && this.info?.isTv) {
        this.info = { ...this.info, powerMode: name === 'PowerOn' ? 'PowerOn' : 'DisplayOff' };
        this.events.emit({ type: 'state', state: this.isOff() ? 'off' : 'connected' });
      }
    } catch (e) {
      this.fail(e);
    }
  }

  /** Press and hold (for d-pad repeat / scrubbing); pair with keyUp. */
  async keyDown(key: Key): Promise<void> {
    try {
      this.ensureConnected();
      await this.post(`/keydown/${this.ecpName(key)}`, `${key} down`);
    } catch (e) {
      this.fail(e);
    }
  }

  async keyUp(key: Key): Promise<void> {
    try {
      this.ensureConnected();
      await this.post(`/keyup/${this.ecpName(key)}`, `${key} up`);
    } catch (e) {
      this.fail(e);
    }
  }

  /** Types text one character at a time, in order, as Lit_ keypresses. */
  async sendText(text: string): Promise<void> {
    try {
      this.ensureConnected();
      for (const ch of Array.from(text)) {
        await this.post(`/keypress/${rokuLiteral(ch)}`, `TEXT ${JSON.stringify(ch)}`);
      }
    } catch (e) {
      this.fail(e);
    }
  }

  async listApps(): Promise<TvApp[]> {
    try {
      this.ensureConnected();
      return parseApps((await this.request('GET', '/query/apps')).text);
    } catch (e) {
      return this.fail(e);
    }
  }

  /**
   * GET /query/icon/<appId> (documented ECP endpoint) serves the app's icon image as the Roku
   * supplies it. We return the URL and let the Image component load it; no request is made here,
   * so this never throws. Its availability for every app is not verified on hardware.
   */
  async appIcon(app: TvApp): Promise<string | null> {
    if (!app.id) return null;
    return `${this.base}/query/icon/${encodeURIComponent(app.id)}`;
  }

  async launchApp(appId: string): Promise<void> {
    try {
      this.ensureConnected();
      await this.post(`/launch/${encodeURIComponent(appId)}`, `LAUNCH ${appId}`);
    } catch (e) {
      this.fail(e);
    }
  }

  /** Static input list on Roku TVs (no current flag: ECP does not report it); [] on players. */
  async listInputs(): Promise<TvInput[]> {
    try {
      this.ensureConnected();
      return this.info?.isTv ? ROKU_TV_INPUTS.map((i) => ({ ...i })) : [];
    } catch (e) {
      return this.fail(e);
    }
  }

  /** POST /keypress/InputHDMI1 etc. Roku TVs only. */
  async setInput(inputId: string): Promise<void> {
    try {
      this.ensureConnected();
      if (!this.info?.isTv) throw driverError('unsupported', 'core.driver.roku.noInputs', { device: 'Roku' });
      const input = ROKU_TV_INPUTS.find((i) => i.id === inputId);
      if (!input) throw driverError('unsupported', 'core.driver.roku.notAnInput', { input: inputId, device: 'Roku TV' });
      await this.post(`/keypress/${input.id}`, `INPUT ${input.name}`);
    } catch (e) {
      this.fail(e);
    }
  }

  /** ECP PowerOn keypress (works while a Roku TV is in fast-start standby). No connect needed. */
  async powerOn(): Promise<void> {
    try {
      await this.post('/keypress/PowerOn', 'POWER_ON');
      if (this.info) this.info = { ...this.info, powerMode: 'PowerOn' };
      if (this.connected) this.events.emit({ type: 'state', state: 'connected' });
    } catch (e) {
      this.fail(e);
    }
  }
}
