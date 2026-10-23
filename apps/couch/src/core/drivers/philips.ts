/**
 * Philips JointSpace API v6 driver (Android-based Philips TVs, 2016+): JSON over HTTPS on :1926
 * with HTTP Digest auth.
 *
 * TRANSPORT: the TV serves a self-signed certificate, which React Native's fetch rejects. Inject a
 * FetchLike that trusts self-signed certificates on LAN addresses (native module, dev build).
 * Digest auth also needs the 401 reply's `WWW-Authenticate` header: the injected fetch's response
 * must expose `headers.get(name)` (as WHATWG fetch does) or a plain `headers` record. FetchLike's
 * type does not promise headers, so we read them defensively and fail with a clear 'unsupported'
 * error if they are missing. A native fetch that does digest itself also works: we then never see
 * a 401.
 *
 * Pairing: POST /6/pair/request {scope, device} -> TV shows a 4-digit PIN, reply carries auth_key
 * and timestamp. POST /6/pair/grant {auth: {auth_AppId, pin, auth_timestamp, auth_signature},
 * device} with Digest credentials (device id / auth_key). auth_signature is an HMAC-SHA1 over
 * timestamp+pin keyed with a fixed secret published by the open-source JointSpace clients.
 * The credentials (device id + auth_key) are then the Digest username/password for everything.
 *
 * Ported from public knowledge of JointSpace v6 (ha-philipsjs and pylips behaviour, the
 * jointspace community docs) — described, not copied. Tested only against fixtures reconstructed
 * from those descriptions (src/core/drivers/__fixtures__/philips/). Every protocol detail is
 * UNVERIFIED on hardware: the secret, signature encoding, key names, paths and body shapes.
 *
 * No 'appIcons': icons live at /6/applications/<id>/icon behind Digest auth as binary, which an
 * Image component cannot load and FetchLike (text only) cannot turn into a data: URI.
 * No 'text': no known v6 text-entry endpoint.
 */
import { Emitter, type DriverEvent, type FetchLike, type TvDriver } from '../driver';
import { COUCH_APP_PACKAGE } from '../appIdentity';
import { fromBase64, toBase64, utf8 } from '../crypto/bytes';
import { digestAuthorization, parseDigestChallenge, type DigestChallenge } from '../crypto/digest';
import { hmacSha1Hex } from '../crypto/sha1';
import type { Key, KeyMap } from '../keys';
import { DriverError, type Capability, type TvApp, type TvInput } from '../types';
import { driverError, asDriverError } from './errors';

export const PHILIPS_PORT = 1926;
export const PHILIPS_API = 6;
/** Product name for user messages ({device}); a brand, so data, not translated. */
const PHILIPS_DEVICE = 'Philips TV';

function philipsPairingFailed(errorId: string | undefined): DriverError {
  return errorId
    ? driverError('network', 'core.driver.common.pairingFailed', { device: 'Philips', detail: errorId })
    : driverError('network', 'core.driver.common.pairingNoReply', { device: 'Philips' });
}

/**
 * Pairing secret used by the open-source JointSpace clients (base64). UNVERIFIED: if pairing
 * fails with a valid PIN, this or the signature encoding below is the first suspect.
 */
export const PHILIPS_PAIR_SECRET_B64 = 'ZmVay1EQVFOaZhwQ4Kv81ypLAZNczV9sG4KkseXWn1NEk6cXmPKO/MCa9sryslvLCFMnNe4Z4CPXzToowvhHvA==';

/**
 * auth_signature = base64( hex( HMAC-SHA1(secret, timestamp + pin) ) ) — base64 of the hex
 * digest's ASCII, as the reference clients do. UNVERIFIED.
 */
export function philipsSignature(secret: Uint8Array, timestamp: string | number, pin: string): string {
  return toBase64(utf8(hmacSha1Hex(secret, `${timestamp}${pin}`)));
}

/** Canonical key -> JointSpace /input/key name. UNVERIFIED names. */
export const PHILIPS_KEYS: KeyMap = {
  POWER: 'Standby',
  UP: 'CursorUp',
  DOWN: 'CursorDown',
  LEFT: 'CursorLeft',
  RIGHT: 'CursorRight',
  OK: 'Confirm',
  BACK: 'Back',
  HOME: 'Home',
  MENU: 'Options',
  SETTINGS: 'Adjust',
  INPUT: 'Source',
  SOURCE: 'Source',
  VOL_UP: 'VolumeUp',
  VOL_DOWN: 'VolumeDown',
  MUTE: 'Mute',
  CH_UP: 'ChannelStepUp',
  CH_DOWN: 'ChannelStepDown',
  REW: 'Rewind',
  PLAY_PAUSE: 'PlayPause',
  FF: 'FastForward',
  ENTER: 'Confirm',
  SEARCH: 'Find',
  NUM_0: 'Digit0',
  NUM_1: 'Digit1',
  NUM_2: 'Digit2',
  NUM_3: 'Digit3',
  NUM_4: 'Digit4',
  NUM_5: 'Digit5',
  NUM_6: 'Digit6',
  NUM_7: 'Digit7',
  NUM_8: 'Digit8',
  NUM_9: 'Digit9',
  NUM_DASH: 'Dot',
  RED: 'RedColour',
  GREEN: 'GreenColour',
  YELLOW: 'YellowColour',
  BLUE: 'BlueColour',
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

function json(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export interface PhilipsApp extends TvApp {
  intent: Obj;
}

/** GET /6/applications: {applications: [{id, label, intent: {component, action}, order, type}]}. */
export function parsePhilipsApps(text: string): PhilipsApp[] {
  const v = json(text);
  const list = isObj(v) && Array.isArray(v.applications) ? v.applications : [];
  const out: PhilipsApp[] = [];
  for (const a of list) {
    if (!isObj(a) || !isObj(a.intent)) continue;
    const id = str(a.id);
    if (!id) continue;
    out.push({ id, name: str(a.label) ?? id, intent: a.intent });
  }
  return out;
}

/**
 * GET /6/sources. Older JointSpace returns a map {id: {name}}, some firmware an array
 * [{id, name}]. Android sets often answer 404: then the UI cycles with the Source key.
 */
export function parsePhilipsSources(text: string, current?: string): TvInput[] {
  const v = json(text);
  const entries: Array<[string, unknown]> = Array.isArray(v)
    ? v.filter(isObj).map((s) => [str(s.id) ?? '', s.name])
    : isObj(v)
      ? Object.entries(v).map(([id, s]) => [id, isObj(s) ? s.name : undefined])
      : [];
  return entries
    .filter(([id]) => id !== '')
    .map(([id, name]) => {
      const input: TvInput = { id, name: str(name) ?? id };
      if (current !== undefined) input.current = id === current;
      return input;
    });
}

/** GET /6/audio/volume: {muted, current, min, max}. */
export function parsePhilipsVolume(text: string): { current: number; min: number; max: number; muted: boolean } | undefined {
  const v = json(text);
  if (!isObj(v) || typeof v.current !== 'number') return undefined;
  return {
    current: v.current,
    min: typeof v.min === 'number' ? v.min : 0,
    max: typeof v.max === 'number' ? v.max : 60,
    muted: v.muted === true,
  };
}

/** GET /6/powerstate: {powerstate: "On" | "Standby" | "StandbyKeep" ...}. */
export function parsePhilipsPower(text: string): string | undefined {
  const v = json(text);
  return isObj(v) ? str(v.powerstate) : undefined;
}

export interface PhilipsSystem {
  name?: string;
  model?: string;
  apiMajor?: number;
}

/** GET /6/system (no auth). */
export function parsePhilipsSystem(text: string): PhilipsSystem {
  const v = json(text);
  if (!isObj(v)) return {};
  const api = isObj(v.api_version) ? v.api_version : {};
  return {
    name: str(v.name),
    model: str(v.model),
    apiMajor: typeof api.Major === 'number' ? api.Major : undefined,
  };
}

/** Persisted pairing as one token string: "<deviceId>:<authKey>". */
export function encodePhilipsToken(deviceId: string, authKey: string): string {
  return `${deviceId}:${authKey}`;
}

export function decodePhilipsToken(token: string): { deviceId: string; authKey: string } | undefined {
  const i = token.indexOf(':');
  if (i <= 0 || i === token.length - 1) return undefined;
  return { deviceId: token.slice(0, i), authKey: token.slice(i + 1) };
}

export interface PhilipsDriverOptions {
  host: string;
  /** Must trust the TV's self-signed cert and expose response headers (see file comment). */
  fetch: FetchLike;
  port?: number;
  /** "<deviceId>:<authKey>" from an earlier pairing. */
  token?: string;
  onToken?: (token: string) => void;
  /** Device id to pair as; random when omitted. */
  deviceId?: string;
  deviceName?: string;
  mac?: string;
  wol?: (mac: string) => Promise<void>;
  /** Random hex/alnum source (cnonce, device id); inject for deterministic tests. */
  random?: () => string;
  now?: () => number;
  timeoutMs?: number;
}

type Res = Awaited<ReturnType<FetchLike>>;

/** Read a response header if the injected fetch exposes any. */
export function responseHeader(res: Res, name: string): string | null {
  const h = (res as { headers?: unknown }).headers;
  if (!h || typeof h !== 'object') return null;
  const get = (h as { get?: unknown }).get;
  if (typeof get === 'function') {
    const v = (get as (n: string) => unknown).call(h, name);
    return typeof v === 'string' ? v : null;
  }
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(h as Obj)) if (k.toLowerCase() === lower && typeof v === 'string') return v;
  return null;
}

function isTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === 'AbortError' || e.name === 'TimeoutError' || /time(d)?\s?out/i.test(e.message);
}

function defaultRandom(): string {
  let s = '';
  for (let i = 0; i < 16; i++) s += Math.floor(Math.random() * 36).toString(36);
  return s;
}

const BASE_CAPS: readonly Capability[] = ['keys', 'apps', 'launch', 'volume', 'powerOn', 'numbers', 'colorKeys'];

export class PhilipsDriver implements TvDriver {
  readonly platform = 'philips' as const;
  get capabilities(): ReadonlySet<Capability> {
    return new Set<Capability>(this.hasSources ? [...BASE_CAPS, 'inputs'] : BASE_CAPS);
  }

  info: PhilipsSystem | null = null;
  powerstate: string | undefined;
  readonly base: string;

  private readonly opts: PhilipsDriverOptions;
  private readonly events = new Emitter();
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly random: () => string;
  private creds: { deviceId: string; authKey: string } | undefined;
  private challenge: DigestChallenge | null = null;
  private nc = 0;
  private connected = false;
  private hasSources = false;
  private apps = new Map<string, PhilipsApp>();
  private pairing: { deviceId: string; authKey: string; timestamp: string | number } | null = null;

  constructor(opts: PhilipsDriverOptions) {
    this.opts = opts;
    this.base = `https://${opts.host}:${opts.port ?? PHILIPS_PORT}/${PHILIPS_API}`;
    this.creds = opts.token ? decodePhilipsToken(opts.token) : undefined;
    this.now = opts.now ?? Date.now;
    this.timeoutMs = opts.timeoutMs ?? 4000;
    this.random = opts.random ?? defaultRandom;
  }

  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }

  get token(): string | undefined {
    return this.creds ? encodePhilipsToken(this.creds.deviceId, this.creds.authKey) : undefined;
  }

  private async raw(method: 'GET' | 'POST', path: string, body: unknown, headers: Record<string, string>): Promise<Res> {
    try {
      return await this.opts.fetch(this.base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        timeoutMs: this.timeoutMs,
      });
    } catch (e) {
      if (isTimeoutError(e)) throw driverError('timeout', 'core.driver.common.deviceTimeout', { device: PHILIPS_DEVICE });
      throw driverError('network', 'core.driver.common.deviceUnreachableSecure', { device: PHILIPS_DEVICE });
    }
  }

  private authHeader(method: string, path: string, creds: { deviceId: string; authKey: string }): Record<string, string> {
    if (!this.challenge) return {};
    this.nc += 1;
    return {
      Authorization: digestAuthorization({
        username: creds.deviceId,
        password: creds.authKey,
        method,
        uri: `/${PHILIPS_API}${path}`,
        challenge: this.challenge,
        nc: this.nc,
        cnonce: this.random(),
      }),
    };
  }

  /** Digest-authenticated request: pre-emptive with the cached challenge, one retry on a fresh 401. */
  private async authed(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    creds = this.creds,
  ): Promise<{ text: string; ms: number; status: number }> {
    if (!creds) throw driverError('pair_required', 'core.driver.common.pairFirst', { device: PHILIPS_DEVICE });
    const start = this.now();
    let sentAuth = this.challenge !== null;
    let res = await this.raw(method, path, body, this.authHeader(method, path, creds));
    if (res.status === 401) {
      const header = responseHeader(res, 'WWW-Authenticate');
      const ch = parseDigestChallenge(header);
      if (!ch) {
        if (header === null)
          throw driverError('unsupported', 'core.driver.philips.digestUnsupported', { device: PHILIPS_DEVICE });
        throw driverError('pair_required', 'core.driver.common.pairAgain', { device: PHILIPS_DEVICE });
      }
      const stale = /stale\s*=\s*"?true/i.test(header ?? '');
      const sameNonce = this.challenge?.nonce === ch.nonce;
      if (sentAuth && sameNonce && !stale) throw driverError('pair_required', 'core.driver.common.pairAgain', { device: PHILIPS_DEVICE });
      this.challenge = ch;
      this.nc = 0;
      sentAuth = true;
      res = await this.raw(method, path, body, this.authHeader(method, path, creds));
      if (res.status === 401) throw driverError('pair_required', 'core.driver.common.pairAgain', { device: PHILIPS_DEVICE });
    }
    const ms = Math.max(0, Math.round(this.now() - start));
    if (res.status === 403) throw driverError('forbidden', 'core.driver.philips.refusedApp', { device: PHILIPS_DEVICE });
    if (res.status === 404) throw driverError('unsupported', 'core.driver.common.deviceNoControl', { device: PHILIPS_DEVICE });
    if (!res.ok) throw driverError('network', 'core.driver.common.deviceHttp', { device: PHILIPS_DEVICE, status: String(res.status) });
    return { text: await res.text(), ms, status: res.status };
  }

  private ensureConnected(): void {
    if (!this.connected) throw driverError('not_connected', 'core.driver.common.notConnected');
  }

  private fail(e: unknown): never {
    const err = asDriverError(e);
    this.events.emit({ type: 'error', message: err.message });
    throw err;
  }

  private deviceSpec(deviceId: string): Obj {
    return {
      device_name: this.opts.deviceName ?? 'Couch Remote',
      device_os: 'Android',
      app_name: 'Couch',
      app_id: COUCH_APP_PACKAGE,
      type: 'native',
      id: deviceId,
    };
  }

  /** Step 1: TV shows a PIN. */
  async startPairing(): Promise<void> {
    try {
      const deviceId = this.opts.deviceId ?? this.random();
      const res = await this.raw('POST', '/pair/request', { scope: ['read', 'write', 'control'], device: this.deviceSpec(deviceId) }, {});
      if (!res.ok) throw driverError('network', 'core.driver.common.deviceHttp', { device: PHILIPS_DEVICE, status: String(res.status) });
      const v = json(await res.text());
      const errorId = isObj(v) ? str(v.error_id) : undefined;
      if (errorId === 'CONCURRENT_PAIRING')
        throw driverError('forbidden', 'core.driver.common.devicePairingBusy', { device: PHILIPS_DEVICE });
      const authKey = isObj(v) ? str(v.auth_key) : undefined;
      const ts = isObj(v) ? v.timestamp : undefined;
      if (errorId !== 'SUCCESS' || !authKey || (typeof ts !== 'number' && typeof ts !== 'string'))
        throw philipsPairingFailed(errorId);
      this.pairing = { deviceId, authKey, timestamp: ts };
      this.challenge = null;
    } catch (e) {
      this.fail(e);
    }
  }

  /** Step 2: send the PIN with the HMAC signature; stores and returns the token. */
  async finishPairing(pin: string): Promise<string> {
    try {
      const p = this.pairing;
      if (!p) throw driverError('pair_required', 'core.driver.common.startPairingFirst');
      const signature = philipsSignature(fromBase64(PHILIPS_PAIR_SECRET_B64), p.timestamp, pin);
      const body = {
        auth: { auth_AppId: '1', pin, auth_timestamp: p.timestamp, auth_signature: signature },
        device: this.deviceSpec(p.deviceId),
      };
      const { text } = await this.authed('POST', '/pair/grant', body, { deviceId: p.deviceId, authKey: p.authKey });
      const v = json(text);
      const errorId = isObj(v) ? str(v.error_id) : undefined;
      if (errorId === 'INVALID_PIN') throw driverError('forbidden', 'core.driver.common.pinMismatch');
      if (errorId !== 'SUCCESS') throw philipsPairingFailed(errorId);
      this.pairing = null;
      this.creds = { deviceId: p.deviceId, authKey: p.authKey };
      const token = encodePhilipsToken(p.deviceId, p.authKey);
      this.opts.onToken?.(token);
      return token;
    } catch (e) {
      return this.fail(e);
    }
  }

  async connect(): Promise<void> {
    this.events.emit({ type: 'state', state: 'connecting' });
    try {
      const sys = await this.raw('GET', '/system', undefined, {});
      if (!sys.ok) throw driverError('network', 'core.driver.common.deviceHttp', { device: PHILIPS_DEVICE, status: String(sys.status) });
      this.info = parsePhilipsSystem(await sys.text());
      if (!this.creds) throw driverError('pair_required', 'core.driver.common.pairFirst', { device: PHILIPS_DEVICE });
      this.powerstate = parsePhilipsPower((await this.authed('GET', '/powerstate')).text);
      try {
        this.hasSources = parsePhilipsSources((await this.authed('GET', '/sources')).text).length > 0;
      } catch (e) {
        if (e instanceof DriverError && e.code === 'pair_required') throw e;
        this.hasSources = false;
      }
    } catch (e) {
      this.connected = false;
      this.events.emit({ type: 'state', state: 'error' });
      this.fail(e);
    }
    this.connected = true;
    this.events.emit({ type: 'state', state: this.isOff() ? 'off' : 'connected' });
  }

  private isOff(): boolean {
    return this.powerstate !== undefined && this.powerstate !== 'On';
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.events.emit({ type: 'state', state: 'disconnected' });
  }

  async sendKey(key: Key): Promise<void> {
    try {
      this.ensureConnected();
      const name = PHILIPS_KEYS[key];
      if (!name) throw driverError('unsupported', 'core.driver.common.deviceKeyUnavailable', { key, device: 'Philips' });
      const { ms } = await this.authed('POST', '/input/key', { key: name });
      this.events.emit({ type: 'sent', what: key, ms });
      if (key === 'POWER' && this.powerstate !== undefined) {
        this.powerstate = this.isOff() ? 'On' : 'Standby';
        this.events.emit({ type: 'state', state: this.isOff() ? 'off' : 'connected' });
      }
    } catch (e) {
      this.fail(e);
    }
  }

  async sendText(_text: string): Promise<void> {
    this.fail(driverError('unsupported', 'core.driver.common.deviceNoTyping', { device: 'Philips' }));
  }

  async listApps(): Promise<TvApp[]> {
    try {
      this.ensureConnected();
      const apps = parsePhilipsApps((await this.authed('GET', '/applications')).text);
      this.apps = new Map(apps.map((a) => [a.id, a]));
      return apps.map(({ id, name }) => ({ id, name }));
    } catch (e) {
      return this.fail(e);
    }
  }

  /** POST /6/activities/launch {intent} with the intent from listApps. */
  async launchApp(appId: string): Promise<void> {
    try {
      this.ensureConnected();
      if (this.apps.size === 0) await this.listApps();
      const app = this.apps.get(appId);
      if (!app) throw driverError('unsupported', 'core.driver.philips.appNotInstalled', { app: appId, device: PHILIPS_DEVICE });
      const { ms } = await this.authed('POST', '/activities/launch', { intent: app.intent });
      this.events.emit({ type: 'sent', what: `LAUNCH ${appId}`, ms });
    } catch (e) {
      this.fail(e);
    }
  }

  async listInputs(): Promise<TvInput[]> {
    try {
      this.ensureConnected();
      let current: string | undefined;
      try {
        const v = json((await this.authed('GET', '/sources/current')).text);
        current = isObj(v) ? str(v.id) : undefined;
      } catch {
        current = undefined;
      }
      return parsePhilipsSources((await this.authed('GET', '/sources')).text, current);
    } catch (e) {
      return this.fail(e);
    }
  }

  async setInput(inputId: string): Promise<void> {
    try {
      this.ensureConnected();
      const { ms } = await this.authed('POST', '/sources/current', { id: inputId });
      this.events.emit({ type: 'sent', what: `INPUT ${inputId}`, ms });
    } catch (e) {
      this.fail(e);
    }
  }

  /** Current volume in the TV's own range (typically 0..60). */
  async volume(): Promise<number> {
    try {
      this.ensureConnected();
      const v = parsePhilipsVolume((await this.authed('GET', '/audio/volume')).text);
      if (!v) throw driverError('unsupported', 'core.driver.common.deviceNoVolume', { device: PHILIPS_DEVICE });
      return v.current;
    } catch (e) {
      return this.fail(e);
    }
  }

  async setVolume(current: number, muted = false): Promise<void> {
    try {
      this.ensureConnected();
      const { ms } = await this.authed('POST', '/audio/volume', { muted, current });
      this.events.emit({ type: 'sent', what: `VOLUME ${current}`, ms });
    } catch (e) {
      this.fail(e);
    }
  }

  /**
   * POST /6/powerstate {powerstate: "On"} (works from standby when the TV keeps its network up,
   * e.g. "Switch on with Wi-Fi"); falls back to Wake-on-LAN. Needs pairing, not connect.
   */
  async powerOn(): Promise<void> {
    try {
      const { ms } = await this.authed('POST', '/powerstate', { powerstate: 'On' });
      this.powerstate = 'On';
      this.events.emit({ type: 'sent', what: 'POWER_ON', ms });
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
