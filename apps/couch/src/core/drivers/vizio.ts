/**
 * Vizio SmartCast driver: JSON over HTTPS on :7345 (firmware 4.0+; older sets use :9000).
 *
 * TRANSPORT: SmartCast serves a self-signed certificate. React Native's fetch rejects it, so this
 * driver needs an injected FetchLike that trusts self-signed certificates on LAN addresses (a
 * native module in a dev build). Pass that fetch; the stock RN fetch will fail with 'network'.
 *
 * Pairing: PUT /pairing/start {DEVICE_ID, DEVICE_NAME} -> TV shows a 4-digit PIN and we get a
 * PAIRING_REQ_TOKEN; PUT /pairing/pair {DEVICE_ID, CHALLENGE_TYPE, RESPONSE_VALUE: pin,
 * PAIRING_REQ_TOKEN} -> AUTH_TOKEN. Every later request carries the header `AUTH: <token>`.
 *
 * Ported from public knowledge of the SmartCast API (pyvizio behaviour and community API notes) —
 * described, not copied. Tested only against fixtures reconstructed from those descriptions
 * (src/core/drivers/__fixtures__/vizio/). Every protocol detail is UNVERIFIED on hardware: paths,
 * key CODESET/CODE pairs (the digit codes especially), result strings and app launch payloads.
 */
import { Emitter, type DriverEvent, type FetchLike, type TvDriver } from '../driver';
import type { Key } from '../keys';
import { DriverError, type Capability, type TvApp, type TvInput } from '../types';
import { driverError, asDriverError } from './errors';

export const VIZIO_PORT = 7345;
export const VIZIO_LEGACY_PORT = 9000;
export const VIZIO_DEFAULT_DEVICE_ID = 'couch-remote';
export const VIZIO_DEFAULT_DEVICE_NAME = 'Couch Remote';

export const VIZIO_PATHS = {
  pairStart: '/pairing/start',
  pairFinish: '/pairing/pair',
  pairCancel: '/pairing/cancel',
  keyCommand: '/key_command/',
  powerMode: '/state/device/power_mode',
  inputs: '/menu_native/dynamic/tv_settings/devices/name_input',
  currentInput: '/menu_native/dynamic/tv_settings/devices/current_input',
  volume: '/menu_native/dynamic/tv_settings/audio/volume',
  appLaunch: '/app/launch',
} as const;

/** [CODESET, CODE] pairs. UNVERIFIED. */
export type VizioCode = readonly [number, number];

export const VIZIO_KEYS: Partial<Record<Key, VizioCode>> = {
  UP: [3, 8],
  DOWN: [3, 0],
  LEFT: [3, 1],
  RIGHT: [3, 7],
  OK: [3, 2],
  BACK: [4, 0],
  HOME: [4, 15],
  MENU: [4, 8],
  SETTINGS: [4, 8],
  INPUT: [7, 1],
  SOURCE: [7, 1],
  VOL_DOWN: [5, 0],
  VOL_UP: [5, 1],
  MUTE: [5, 4],
  CH_DOWN: [8, 0],
  CH_UP: [8, 1],
  FF: [2, 0],
  REW: [2, 1],
  POWER: [11, 2],
  // Digits: CODESET 0 with the ASCII code. From community notes only; least certain mapping here.
  NUM_0: [0, 48],
  NUM_1: [0, 49],
  NUM_2: [0, 50],
  NUM_3: [0, 51],
  NUM_4: [0, 52],
  NUM_5: [0, 53],
  NUM_6: [0, 54],
  NUM_7: [0, 55],
  NUM_8: [0, 56],
  NUM_9: [0, 57],
  // No colour keys: SmartCast has no documented CODESET for them.
};

export const VIZIO_PLAY: VizioCode = [2, 3];
export const VIZIO_PAUSE: VizioCode = [2, 2];
export const VIZIO_POWER_ON: VizioCode = [11, 1];

export interface VizioAppConfig {
  NAME_SPACE: number;
  APP_ID: string;
  MESSAGE: string | null;
}

/**
 * Launch payloads for a few common apps. SmartCast does not list installed apps locally (pyvizio
 * fetches a catalogue from a Vizio cloud URL, which we must not call), so this is a static table.
 * UNVERIFIED payloads; they also change between firmware releases.
 */
export const VIZIO_APPS: ReadonlyArray<TvApp & { config: VizioAppConfig }> = [
  { id: 'netflix', name: 'Netflix', config: { NAME_SPACE: 3, APP_ID: '1', MESSAGE: null } },
  { id: 'youtube', name: 'YouTube', config: { NAME_SPACE: 5, APP_ID: '1', MESSAGE: null } },
  { id: 'primevideo', name: 'Prime Video', config: { NAME_SPACE: 3, APP_ID: '4', MESSAGE: null } },
  { id: 'hulu', name: 'Hulu', config: { NAME_SPACE: 2, APP_ID: '3', MESSAGE: null } },
];

/** The /key_command/ payload. */
export function keyCommandPayload(code: VizioCode, action: 'KEYPRESS' | 'KEYDOWN' | 'KEYUP' = 'KEYPRESS') {
  return { KEYLIST: [{ CODESET: code[0], CODE: code[1], ACTION: action }] };
}

/** App id -> launch config: a VIZIO_APPS id, or a raw "<NAME_SPACE>:<APP_ID>[:<MESSAGE>]". */
export function vizioAppConfig(appId: string): VizioAppConfig | undefined {
  const known = VIZIO_APPS.find((a) => a.id === appId);
  if (known) return known.config;
  const m = /^(\d+):([^:]+)(?::(.*))?$/.exec(appId);
  if (!m) return undefined;
  return { NAME_SPACE: Number(m[1]), APP_ID: m[2] ?? '', MESSAGE: m[3] ?? null };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

export interface VizioReply {
  result: string;
  detail?: string;
  item?: Obj;
  items: Obj[];
  raw: Obj;
}

/** Parse the common {STATUS:{RESULT,DETAIL}, ITEM?, ITEMS?} envelope. */
export function parseVizioReply(text: string): VizioReply {
  let raw: Obj = {};
  try {
    const v = JSON.parse(text) as unknown;
    if (isObj(v)) raw = v;
  } catch {
    /* empty */
  }
  const status = isObj(raw.STATUS) ? raw.STATUS : {};
  return {
    result: (str(status.RESULT) ?? '').toUpperCase(),
    detail: str(status.DETAIL),
    item: isObj(raw.ITEM) ? raw.ITEM : undefined,
    items: Array.isArray(raw.ITEMS) ? raw.ITEMS.filter(isObj) : [],
    raw,
  };
}

const asReply = (src: string | VizioReply): VizioReply => (typeof src === 'string' ? parseVizioReply(src) : src);

/** name_input ITEMS: {NAME: "HDMI-1", CNAME, VALUE: {NAME: user label, METADATA}, HASHVAL}. */
export function parseVizioInputs(src: string | VizioReply, current?: string): TvInput[] {
  const out: TvInput[] = [];
  for (const it of asReply(src).items) {
    const id = str(it.NAME);
    if (!id) continue;
    const label = isObj(it.VALUE) ? str(it.VALUE.NAME) : str(it.VALUE);
    const input: TvInput = { id, name: label && label !== id ? `${id} (${label})` : id };
    if (current !== undefined) input.current = id === current;
    out.push(input);
  }
  return out;
}

/** current_input ITEMS[0]: {VALUE: "HDMI-1", HASHVAL}. */
export function parseVizioCurrentInput(src: string | VizioReply): { value?: string; hashval?: number } {
  const it = asReply(src).items[0];
  if (!it) return {};
  return { value: str(it.VALUE), hashval: typeof it.HASHVAL === 'number' ? it.HASHVAL : undefined };
}

/** ITEMS[0].VALUE as a number (power_mode 0/1, volume 0..100). */
export function parseVizioNumber(src: string | VizioReply): number | undefined {
  const v = asReply(src).items[0]?.VALUE;
  return typeof v === 'number' ? v : undefined;
}

export interface VizioDriverOptions {
  host: string;
  /** Must trust the TV's self-signed certificate (LAN-trusting native fetch). */
  fetch: FetchLike;
  /** 7345 (default) or 9000 for older firmware. */
  port?: number;
  /** AUTH token from an earlier pairing. */
  token?: string;
  onToken?: (token: string) => void;
  /** Stable id for this phone, sent as DEVICE_ID while pairing. */
  deviceId?: string;
  deviceName?: string;
  mac?: string;
  wol?: (mac: string) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
}

function isTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === 'AbortError' || e.name === 'TimeoutError' || /time(d)?\s?out/i.test(e.message);
}

const UNAUTH = new Set(['UNAUTHORIZED', 'BLOCKED', 'REQUIRES_PAIRING']);

export class VizioDriver implements TvDriver {
  readonly platform = 'vizio' as const;
  readonly capabilities: ReadonlySet<Capability> = new Set<Capability>(['keys', 'apps', 'launch', 'volume', 'powerOn', 'inputs', 'numbers']);

  token: string | undefined;
  readonly base: string;
  /** Power mode from the last check: true on, false standby. */
  poweredOn: boolean | undefined;

  private readonly opts: VizioDriverOptions;
  private readonly events = new Emitter();
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private connected = false;
  private playing = true;
  private pairing: { token: number | string; challengeType: number } | null = null;

  constructor(opts: VizioDriverOptions) {
    this.opts = opts;
    this.token = opts.token;
    this.base = `https://${opts.host}:${opts.port ?? VIZIO_PORT}`;
    this.now = opts.now ?? Date.now;
    this.timeoutMs = opts.timeoutMs ?? 4000;
  }

  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }

  private get deviceId(): string {
    return this.opts.deviceId ?? VIZIO_DEFAULT_DEVICE_ID;
  }

  private async request(method: 'GET' | 'PUT', path: string, body?: unknown): Promise<{ reply: VizioReply; ms: number }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers.AUTH = this.token;
    const start = this.now();
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.opts.fetch(this.base + path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        timeoutMs: this.timeoutMs,
      });
    } catch (e) {
      if (isTimeoutError(e)) throw driverError('timeout', 'core.driver.common.deviceTimeout', { device: 'Vizio TV' });
      throw driverError('network', 'core.driver.common.deviceUnreachableSecure', { device: 'Vizio TV' });
    }
    const ms = Math.max(0, Math.round(this.now() - start));
    if (res.status === 401 || res.status === 403) throw driverError('pair_required', 'core.driver.common.pairFirst', { device: 'Vizio TV' });
    if (!res.ok) throw driverError('network', 'core.driver.common.deviceHttp', { device: 'Vizio TV', status: String(res.status) });
    return { reply: parseVizioReply(await res.text()), ms };
  }

  /** request + STATUS.RESULT check (outside pairing). */
  private async call(method: 'GET' | 'PUT', path: string, body?: unknown): Promise<{ reply: VizioReply; ms: number }> {
    const r = await this.request(method, path, body);
    const result = r.reply.result;
    if (result === 'SUCCESS' || result === '') return r;
    if (UNAUTH.has(result)) throw driverError('pair_required', 'core.driver.common.pairAgain', { device: 'Vizio TV' });
    if (result === 'INVALID_PARAMETER' || result === 'URI_NOT_FOUND')
      throw driverError('unsupported', 'core.driver.common.deviceUnsupportedCommand', { device: 'Vizio TV' });
    throw driverError('network', 'core.driver.vizio.tvError', { device: 'Vizio TV', detail: String(r.reply.detail ?? result) });
  }

  private ensureConnected(): void {
    if (!this.connected) throw driverError('not_connected', 'core.driver.common.notConnected');
  }

  private fail(e: unknown): never {
    const err = asDriverError(e);
    this.events.emit({ type: 'error', message: err.message });
    throw err;
  }

  /** Step 1: ask the TV to show a PIN. */
  async startPairing(): Promise<void> {
    try {
      const { reply } = await this.request('PUT', VIZIO_PATHS.pairStart, {
        DEVICE_ID: this.deviceId,
        DEVICE_NAME: this.opts.deviceName ?? VIZIO_DEFAULT_DEVICE_NAME,
      });
      if (reply.result === 'BLOCKED')
        throw driverError('forbidden', 'core.driver.vizio.busy', { device: 'Vizio TV' });
      if (reply.result !== 'SUCCESS') throw driverError('network', 'core.driver.common.pairingFailed', { device: 'Vizio', detail: String(reply.detail ?? reply.result) });
      const t = reply.item?.PAIRING_REQ_TOKEN;
      if (typeof t !== 'number' && typeof t !== 'string') throw driverError('network', 'core.driver.vizio.notStarted', { device: 'Vizio TV' });
      const ct = reply.item?.CHALLENGE_TYPE;
      this.pairing = { token: t, challengeType: typeof ct === 'number' ? ct : 1 };
    } catch (e) {
      this.fail(e);
    }
  }

  /** Step 2: send the PIN; stores and returns the AUTH token. */
  async finishPairing(pin: string): Promise<string> {
    try {
      if (!this.pairing) throw driverError('pair_required', 'core.driver.common.startPairingFirst');
      const { reply } = await this.request('PUT', VIZIO_PATHS.pairFinish, {
        DEVICE_ID: this.deviceId,
        CHALLENGE_TYPE: this.pairing.challengeType,
        RESPONSE_VALUE: pin,
        PAIRING_REQ_TOKEN: this.pairing.token,
      });
      if (reply.result === 'CHALLENGE_INCORRECT') throw driverError('forbidden', 'core.driver.common.pinMismatch');
      if (reply.result === 'PAIRING_DENIED') throw driverError('forbidden', 'core.driver.vizio.denied', { device: 'Vizio TV' });
      const token = str(reply.item?.AUTH_TOKEN);
      if (reply.result !== 'SUCCESS' || !token) throw driverError('network', 'core.driver.common.pairingFailed', { device: 'Vizio', detail: String(reply.detail ?? reply.result) });
      this.pairing = null;
      this.token = token;
      this.opts.onToken?.(token);
      return token;
    } catch (e) {
      return this.fail(e);
    }
  }

  /** Dismiss the PIN on the TV. Best effort. */
  async cancelPairing(): Promise<void> {
    const p = this.pairing;
    this.pairing = null;
    try {
      await this.request('PUT', VIZIO_PATHS.pairCancel, {
        DEVICE_ID: this.deviceId,
        CHALLENGE_TYPE: p?.challengeType ?? 1,
        RESPONSE_VALUE: '1111',
        PAIRING_REQ_TOKEN: p?.token ?? 0,
      });
    } catch {
      /* best effort */
    }
  }

  async connect(): Promise<void> {
    this.events.emit({ type: 'state', state: 'connecting' });
    try {
      if (!this.token) throw driverError('pair_required', 'core.driver.common.pairFirst', { device: 'Vizio TV' });
      const { reply } = await this.call('GET', VIZIO_PATHS.powerMode);
      const v = reply.items[0]?.VALUE;
      this.poweredOn = typeof v === 'number' ? v === 1 : undefined;
    } catch (e) {
      this.connected = false;
      this.events.emit({ type: 'state', state: 'error' });
      this.fail(e);
    }
    this.connected = true;
    this.events.emit({ type: 'state', state: this.poweredOn === false ? 'off' : 'connected' });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.events.emit({ type: 'state', state: 'disconnected' });
  }

  codeFor(key: Key): VizioCode {
    if (key === 'PLAY_PAUSE') return this.playing ? VIZIO_PAUSE : VIZIO_PLAY;
    const c = VIZIO_KEYS[key];
    if (!c) throw driverError('unsupported', 'core.driver.common.deviceKeyUnavailable', { key, device: 'Vizio' });
    return c;
  }

  private async press(code: VizioCode, what: string): Promise<void> {
    const { ms } = await this.call('PUT', VIZIO_PATHS.keyCommand, keyCommandPayload(code));
    this.events.emit({ type: 'sent', what, ms });
  }

  async sendKey(key: Key): Promise<void> {
    try {
      this.ensureConnected();
      await this.press(this.codeFor(key), key);
      if (key === 'PLAY_PAUSE') this.playing = !this.playing;
      if (key === 'POWER' && this.poweredOn !== undefined) {
        this.poweredOn = !this.poweredOn;
        this.events.emit({ type: 'state', state: this.poweredOn ? 'connected' : 'off' });
      }
    } catch (e) {
      this.fail(e);
    }
  }

  /** SmartCast has no text-entry endpoint we know of. */
  async sendText(_text: string): Promise<void> {
    this.fail(driverError('unsupported', 'core.driver.common.deviceNoTyping', { device: 'Vizio' }));
  }

  /** Static table (see VIZIO_APPS): SmartCast does not list installed apps on the LAN. */
  async listApps(): Promise<TvApp[]> {
    return VIZIO_APPS.map(({ id, name }) => ({ id, name }));
  }

  async launchApp(appId: string): Promise<void> {
    try {
      this.ensureConnected();
      const config = vizioAppConfig(appId);
      if (!config) throw driverError('unsupported', 'core.driver.vizio.cantOpenApp', { app: appId, device: 'Vizio' });
      const { ms } = await this.call('PUT', VIZIO_PATHS.appLaunch, { VALUE: config });
      this.events.emit({ type: 'sent', what: `LAUNCH ${appId}`, ms });
    } catch (e) {
      this.fail(e);
    }
  }

  async listInputs(): Promise<TvInput[]> {
    try {
      this.ensureConnected();
      const cur = parseVizioCurrentInput((await this.call('GET', VIZIO_PATHS.currentInput)).reply);
      const { reply } = await this.call('GET', VIZIO_PATHS.inputs);
      return parseVizioInputs(reply, cur.value);
    } catch (e) {
      return this.fail(e);
    }
  }

  /** PUT current_input {REQUEST: MODIFY, VALUE, HASHVAL}; HASHVAL comes from a fresh GET. */
  async setInput(inputId: string): Promise<void> {
    try {
      this.ensureConnected();
      const cur = parseVizioCurrentInput((await this.call('GET', VIZIO_PATHS.currentInput)).reply);
      if (cur.hashval === undefined) throw driverError('unsupported', 'core.driver.vizio.noInput', { device: 'Vizio TV' });
      const { ms } = await this.call('PUT', VIZIO_PATHS.currentInput, { REQUEST: 'MODIFY', VALUE: inputId, HASHVAL: cur.hashval });
      this.events.emit({ type: 'sent', what: `INPUT ${inputId}`, ms });
    } catch (e) {
      this.fail(e);
    }
  }

  async volume(): Promise<number> {
    try {
      this.ensureConnected();
      const v = parseVizioNumber((await this.call('GET', VIZIO_PATHS.volume)).reply);
      if (v === undefined) throw driverError('unsupported', 'core.driver.common.deviceNoVolume', { device: 'Vizio TV' });
      return v;
    } catch (e) {
      return this.fail(e);
    }
  }

  /** POW_ON key (works in standby with Quick Start on); falls back to Wake-on-LAN. Needs a token. */
  async powerOn(): Promise<void> {
    try {
      await this.press(VIZIO_POWER_ON, 'POWER_ON');
      this.poweredOn = true;
      if (this.connected) this.events.emit({ type: 'state', state: 'connected' });
    } catch (e) {
      if (this.opts.mac && this.opts.wol) {
        await this.opts.wol(this.opts.mac);
        this.events.emit({ type: 'sent', what: 'WOL', ms: 0 });
        return;
      }
      this.fail(e);
    }
  }
}
