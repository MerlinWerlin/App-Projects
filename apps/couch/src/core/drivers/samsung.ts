/**
 * Samsung Tizen (2016+) driver: JSON over a WebSocket on wss://<tv>:8002 (self-signed TLS), with an
 * "Allow" prompt on the TV the first time and a token for later connects. Device info over plain
 * HTTP on :8001.
 *
 * Written from public protocol knowledge of the Tizen "samsung.remote.control" channel (logic
 * ported, no code copied from samsungtvws, which is LGPL). Tested against fixtures reconstructed
 * from that knowledge (src/core/drivers/__fixtures__/samsung/); NOT yet verified on hardware.
 * Points we are unsure about are marked "UNVERIFIED".
 */
import { Emitter, type DriverEvent, type FetchLike, type TvDriver, type WsFactory, type WsLike } from '../driver';
import type { Key, KeyMap } from '../keys';
import { DriverError, type Capability, type TvApp } from '../types';
import { driverError, asDriverError } from './errors';

export const SAMSUNG_HTTP_PORT = 8001;
export const SAMSUNG_WSS_PORT = 8002;
export const SAMSUNG_REMOTE_CHANNEL = 'samsung.remote.control';
/** Name shown in the TV's "Allow" prompt and its device list. No brand names. */
export const SAMSUNG_DEFAULT_CLIENT_NAME = 'Couch Remote';

/**
 * Canonical key -> Tizen KEY_* code. PLAY_PAUSE is resolved at send time (KEY_PLAY / KEY_PAUSE
 * toggle, see SamsungDriver.codeFor).
 *
 * UNVERIFIED / gaps:
 * - BACKSPACE and SEARCH have no well-known KEY_* code on Tizen, so they are left unmapped
 *   (sendKey throws 'unsupported'); text editing goes through SendInputString instead.
 * - ENTER maps to KEY_ENTER, the same as OK (Tizen has one select/enter key).
 * - POWER: KEY_POWER toggles on 2016+ models; very old firmware may only know KEY_POWEROFF.
 */
export const SAMSUNG_KEYS: KeyMap = {
  POWER: 'KEY_POWER',
  UP: 'KEY_UP',
  DOWN: 'KEY_DOWN',
  LEFT: 'KEY_LEFT',
  RIGHT: 'KEY_RIGHT',
  OK: 'KEY_ENTER',
  BACK: 'KEY_RETURN',
  HOME: 'KEY_HOME',
  MENU: 'KEY_MENU',
  INPUT: 'KEY_SOURCE',
  VOL_UP: 'KEY_VOLUP',
  VOL_DOWN: 'KEY_VOLDOWN',
  MUTE: 'KEY_MUTE',
  CH_UP: 'KEY_CHUP',
  CH_DOWN: 'KEY_CHDOWN',
  REW: 'KEY_REWIND',
  PLAY_PAUSE: 'KEY_PLAY',
  FF: 'KEY_FF',
  ENTER: 'KEY_ENTER',
  // Owner feedback 12 Oct 2026. Codes from public Tizen key lists; UNVERIFIED on hardware.
  SOURCE: 'KEY_SOURCE',
  SETTINGS: 'KEY_MENU',
  NUM_0: 'KEY_0',
  NUM_1: 'KEY_1',
  NUM_2: 'KEY_2',
  NUM_3: 'KEY_3',
  NUM_4: 'KEY_4',
  NUM_5: 'KEY_5',
  NUM_6: 'KEY_6',
  NUM_7: 'KEY_7',
  NUM_8: 'KEY_8',
  NUM_9: 'KEY_9',
  NUM_DASH: 'KEY_PLUS100',
  RED: 'KEY_RED',
  GREEN: 'KEY_GREEN',
  YELLOW: 'KEY_YELLOW',
  BLUE: 'KEY_CYAN',
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 (with padding) of the UTF-8 bytes of `s`. Pure TS: no btoa/Buffer needed. */
export function base64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const n = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    out += b1 === undefined ? '=' : B64[(n >> 6) & 63]!;
    out += b2 === undefined ? '=' : B64[n & 63]!;
  }
  return out;
}

/**
 * wss://host:8002/api/v2/channels/samsung.remote.control?name=<base64(name)>[&token=<token>]
 * The base64 name is percent-encoded so '+', '/' and '=' survive as query characters.
 * UNVERIFIED: some clients put the raw base64 in the URL; a standards-compliant server decodes both
 * the same way, and names without those characters produce identical URLs.
 */
export function buildSamsungWsUrl(host: string, name: string, token?: string): string {
  let url =
    `wss://${host}:${SAMSUNG_WSS_PORT}/api/v2/channels/${SAMSUNG_REMOTE_CHANNEL}` +
    `?name=${encodeURIComponent(base64Utf8(name))}`;
  if (token) url += `&token=${encodeURIComponent(token)}`;
  return url;
}

export type SamsungKeyCmd = 'Click' | 'Press' | 'Release';

/** ms.remote.control SendRemoteKey frame. */
export function buildKeyMessage(code: string, cmd: SamsungKeyCmd = 'Click'): string {
  return JSON.stringify({
    method: 'ms.remote.control',
    params: { Cmd: cmd, DataOfCmd: code, Option: 'false', TypeOfRemote: 'SendRemoteKey' },
  });
}

/**
 * Text input: SendInputString with the base64 text, then SendInputEnd. The TV only accepts it while
 * an on-screen keyboard is open (it announces that with an ms.remote.imeStart event).
 */
export function buildTextMessages(text: string): [string, string] {
  return [
    JSON.stringify({
      method: 'ms.remote.control',
      params: { Cmd: base64Utf8(text), DataOfCmd: 'base64', TypeOfRemote: 'SendInputString' },
    }),
    JSON.stringify({ method: 'ms.remote.control', params: { TypeOfRemote: 'SendInputEnd' } }),
  ];
}

export type SamsungLaunchType = 'DEEP_LINK' | 'NATIVE_LAUNCH';

/** ms.channel.emit ed.apps.launch. */
export function buildLaunchMessage(appId: string, actionType: SamsungLaunchType = 'DEEP_LINK', metaTag = ''): string {
  return JSON.stringify({
    method: 'ms.channel.emit',
    params: { event: 'ed.apps.launch', to: 'host', data: { appId, action_type: actionType, metaTag } },
  });
}

/** ms.channel.emit ed.installedApp.get (reply arrives as an event of the same name). */
export function buildInstalledAppsMessage(): string {
  return JSON.stringify({ method: 'ms.channel.emit', params: { event: 'ed.installedApp.get', to: 'host' } });
}

/**
 * ms.channel.emit ed.apps.icon with the iconPath from ed.installedApp.get. The TV answers with an
 * ed.apps.icon event carrying the image as base64.
 * UNVERIFIED: event name, request and reply shape are from public protocol knowledge, not hardware.
 */
export function buildAppIconMessage(iconPath: string): string {
  return JSON.stringify({ method: 'ms.channel.emit', params: { event: 'ed.apps.icon', to: 'host', data: { iconPath } } });
}

const B64_BODY = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Turns the data of an ed.apps.icon reply ({ iconPath, imageBase64 }, possibly nested one level in
 * `data` like ed.installedApp.get) into a data: URI. null when there is no usable image, or when the
 * reply names a different iconPath than the one asked for. The image is passed through exactly as
 * the TV sent it; only the MIME type is sniffed (JPEG signature, else PNG).
 * UNVERIFIED: reply shape and image format.
 */
export function parseAppIconReply(data: unknown, expectedPath?: string): string | null {
  let d: unknown = data;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    const inner = (d as { data?: unknown }).data;
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) d = inner;
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const r = d as Record<string, unknown>;
  if (expectedPath !== undefined && typeof r.iconPath === 'string' && r.iconPath !== expectedPath) return null;
  const raw = r.imageBase64;
  if (typeof raw !== 'string') return null;
  const b64 = raw.replace(/\s+/g, '');
  if (b64 === '' || !B64_BODY.test(b64)) return null;
  const mime = b64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${b64}`;
}

export interface SamsungFrame {
  event: string;
  data?: unknown;
}

/** Parses an incoming frame; null for anything that is not a JSON object with a string `event`. */
export function parseFrame(raw: string): SamsungFrame | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object' && typeof (v as { event?: unknown }).event === 'string') {
      return v as SamsungFrame;
    }
  } catch {
    // not JSON
  }
  return null;
}

/** Token carried by ms.channel.connect (absent on models without token auth). */
export function tokenFromConnect(frame: SamsungFrame): string | undefined {
  const d = frame.data;
  if (d && typeof d === 'object') {
    const t = (d as { token?: unknown }).token;
    if (typeof t === 'string' && t !== '') return t;
    if (typeof t === 'number') return String(t);
  }
  return undefined;
}

export interface SamsungApp extends TvApp {
  /** Raw app_type from ed.installedApp.get. UNVERIFIED: 2 = web/Tizen app (DEEP_LINK), 4 = NATIVE_LAUNCH. */
  appType?: number;
  icon?: string;
}

/** Parses the data of an ed.installedApp.get event: { data: [ { appId, name, app_type, icon } ] }. */
export function parseInstalledApps(data: unknown): SamsungApp[] {
  const inner = data && typeof data === 'object' && !Array.isArray(data) ? (data as { data?: unknown }).data : data;
  if (!Array.isArray(inner)) return [];
  const out: SamsungApp[] = [];
  for (const a of inner) {
    if (!a || typeof a !== 'object') continue;
    const r = a as Record<string, unknown>;
    const id = typeof r.appId === 'string' ? r.appId : undefined;
    if (!id) continue;
    const app: SamsungApp = { id, name: typeof r.name === 'string' ? r.name.trim() : id };
    if (typeof r.app_type === 'number') app.appType = r.app_type;
    if (typeof r.icon === 'string' && r.icon !== '') app.icon = r.icon;
    out.push(app);
  }
  return out;
}

export function launchTypeFor(app: SamsungApp | undefined): SamsungLaunchType {
  return app?.appType === 4 ? 'NATIVE_LAUNCH' : 'DEEP_LINK';
}

export interface SamsungDeviceInfo {
  name: string;
  model: string;
  modelName?: string;
  wifiMac?: string;
  /** "on" | "standby" on newer models; undefined on models that do not report it. */
  powerState?: string;
  tokenAuthSupport: boolean;
  os?: string;
  ip?: string;
  id?: string;
}

function str(o: Record<string, unknown> | undefined, k: string): string | undefined {
  const v = o?.[k];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

/** Parses GET http://host:8001/api/v2/. Throws on invalid JSON. */
export function parseSamsungDeviceInfo(json: string): SamsungDeviceInfo {
  const root = JSON.parse(json) as Record<string, unknown>;
  const dev = (root.device && typeof root.device === 'object' ? root.device : {}) as Record<string, unknown>;
  let tokenAuth = str(dev, 'TokenAuthSupport');
  if (tokenAuth === undefined) {
    // Some firmwares only list it inside the isSupport JSON string.
    const sup = str(root, 'isSupport');
    if (sup) {
      try {
        const s = JSON.parse(sup) as Record<string, unknown>;
        tokenAuth = str(s, 'TokenAuthSupport');
      } catch {
        // ignore
      }
    }
  }
  const modelName = str(dev, 'modelName');
  const name = (str(dev, 'name') ?? str(root, 'name') ?? modelName ?? 'Samsung TV').replace(/^\[TV\]\s*/, '');
  const wifi = str(dev, 'wifiMac');
  return {
    name,
    model: modelName ?? str(dev, 'model') ?? 'Samsung TV',
    modelName,
    wifiMac: wifi ? wifi.toLowerCase() : undefined,
    powerState: str(dev, 'PowerState')?.toLowerCase(),
    tokenAuthSupport: tokenAuth === 'true',
    os: str(dev, 'OS'),
    ip: str(dev, 'ip'),
    id: str(dev, 'id') ?? str(root, 'id'),
  };
}

export interface SamsungDriverOptions {
  host: string;
  ws: WsFactory;
  fetch: FetchLike;
  /** Client name shown on the TV's Allow prompt. */
  name?: string;
  /** Token from an earlier pairing. */
  token?: string;
  /** Called whenever the TV hands out a new token; persist it with the Tv record. */
  onToken?: (token: string) => void;
  /** MAC for Wake-on-LAN (else the wifiMac from device info is used). */
  mac?: string;
  /** Sends a Wake-on-LAN magic packet. */
  wol?: (mac: string) => Promise<void>;
  now?: () => number;
  /** How long to wait for ms.channel.connect (the user may need to press Allow). */
  connectTimeoutMs?: number;
  /** Timeout for HTTP and request/response frames. */
  timeoutMs?: number;
}

type Waiter = { resolve: (data: unknown) => void; reject: (e: DriverError) => void; timer: ReturnType<typeof setTimeout> };

export class SamsungDriver implements TvDriver {
  readonly platform = 'samsung' as const;
  readonly capabilities: ReadonlySet<Capability> = new Set<Capability>(['keys', 'text', 'apps', 'launch', 'powerOn', 'numbers', 'colorKeys', 'appIcons']);

  info: SamsungDeviceInfo | null = null;
  token: string | undefined;
  /** True while the TV reports an open on-screen keyboard (ms.remote.imeStart .. imeEnd). */
  imeActive = false;

  private readonly opts: SamsungDriverOptions;
  private readonly events = new Emitter();
  private readonly now: () => number;
  private readonly connectTimeoutMs: number;
  private readonly timeoutMs: number;
  private sock: WsLike | null = null;
  private connected = false;
  private off = false;
  private playing = false;
  private apps = new Map<string, SamsungApp>();
  private waiters = new Map<string, Waiter[]>();
  private iconQueue: Promise<void> = Promise.resolve();

  constructor(opts: SamsungDriverOptions) {
    this.opts = opts;
    this.token = opts.token;
    this.now = opts.now ?? Date.now;
    this.connectTimeoutMs = opts.connectTimeoutMs ?? 30000;
    this.timeoutMs = opts.timeoutMs ?? 4000;
  }

  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }

  get wsUrl(): string {
    return buildSamsungWsUrl(this.opts.host, this.opts.name ?? SAMSUNG_DEFAULT_CLIENT_NAME, this.token);
  }

  private fail(e: unknown): never {
    const err = asDriverError(e);
    this.events.emit({ type: 'error', message: err.message });
    throw err;
  }

  /** GET http://host:8001/api/v2/ */
  async fetchDeviceInfo(): Promise<SamsungDeviceInfo> {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.opts.fetch(`http://${this.opts.host}:${SAMSUNG_HTTP_PORT}/api/v2/`, {
        method: 'GET',
        timeoutMs: this.timeoutMs,
      });
    } catch {
      throw driverError('network', 'core.driver.common.unreachable');
    }
    if (!res.ok) throw driverError('network', 'core.driver.common.http', { status: String(res.status) });
    try {
      return parseSamsungDeviceInfo(await res.text());
    } catch {
      throw driverError('network', 'core.driver.samsung.badInfo');
    }
  }

  async connect(): Promise<void> {
    this.events.emit({ type: 'state', state: 'connecting' });
    try {
      this.info = await this.fetchDeviceInfo();
      if (this.info.powerState === 'standby') {
        // Network standby: the remote channel is not usable until the TV wakes (powerOn()).
        this.off = true;
        this.events.emit({ type: 'state', state: 'off' });
        return;
      }
      this.off = false;
      await this.openSocket();
    } catch (e) {
      this.connected = false;
      this.events.emit({ type: 'state', state: 'error' });
      this.fail(e);
    }
    this.events.emit({ type: 'state', state: 'connected' });
  }

  /** Opens the WSS channel and waits for the handshake (Allow prompt on first pairing). */
  private async openSocket(): Promise<void> {
    let sock: WsLike;
    try {
      sock = await this.opts.ws(this.wsUrl, { allowSelfSignedLan: true });
    } catch {
      throw driverError('network', 'core.driver.common.channelFailed', { port: '8002' });
    }
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (err?: DriverError): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) {
          try {
            sock.close();
          } catch {
            // ignore
          }
          reject(err);
        } else resolve();
      };
      const timer = setTimeout(
        () => settle(driverError('timeout', 'core.driver.common.allowTimeout')),
        this.connectTimeoutMs,
      );
      sock.onMessage((raw) => {
        const f = parseFrame(raw);
        if (!f) return;
        if (!settled) {
          if (f.event === 'ms.channel.connect') {
            const t = tokenFromConnect(f);
            if (t && t !== this.token) {
              this.token = t;
              this.opts.onToken?.(t);
            }
            this.sock = sock;
            this.connected = true;
            settle();
          } else if (f.event === 'ms.channel.unauthorized') {
            settle(driverError('pair_required', 'core.driver.samsung.refused'));
          } else if (f.event === 'ms.channel.timeOut') {
            settle(driverError('timeout', 'core.driver.samsung.allowTimedOut'));
          }
          return;
        }
        this.handleFrame(f);
      });
      sock.onClose(() => {
        if (!settled) {
          settle(driverError('network', 'core.driver.common.channelClosed'));
          return;
        }
        if (this.sock !== sock) return;
        this.sock = null;
        const was = this.connected;
        this.connected = false;
        this.rejectWaiters(driverError('not_connected', 'core.driver.common.notConnected'));
        if (was) this.events.emit({ type: 'state', state: 'disconnected' });
      });
    });
  }

  private handleFrame(f: SamsungFrame): void {
    if (f.event === 'ms.remote.imeStart') this.imeActive = true;
    else if (f.event === 'ms.remote.imeEnd') this.imeActive = false;
    const ws = this.waiters.get(f.event);
    if (ws && ws.length > 0) {
      const w = ws.shift()!;
      clearTimeout(w.timer);
      w.resolve(f.data);
    }
  }

  private rejectWaiters(e: DriverError): void {
    for (const list of this.waiters.values()) {
      for (const w of list) {
        clearTimeout(w.timer);
        w.reject(e);
      }
    }
    this.waiters.clear();
  }

  private waitFor(event: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const list = this.waiters.get(event) ?? [];
      const w: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const l = this.waiters.get(event);
          if (l) l.splice(l.indexOf(w), 1);
          reject(driverError('timeout', 'core.driver.common.timeout'));
        }, this.timeoutMs),
      };
      list.push(w);
      this.waiters.set(event, list);
    });
  }

  async disconnect(): Promise<void> {
    const s = this.sock;
    this.sock = null;
    this.connected = false;
    this.rejectWaiters(driverError('not_connected', 'core.driver.common.notConnected'));
    try {
      s?.close();
    } catch {
      // ignore
    }
    this.events.emit({ type: 'state', state: 'disconnected' });
  }

  private ensureConnected(): WsLike {
    if (this.off) throw driverError('tv_off', 'core.driver.common.standby');
    if (!this.connected || !this.sock) throw driverError('not_connected', 'core.driver.common.notConnected');
    return this.sock;
  }

  private send(frames: string[], what: string): void {
    const sock = this.ensureConnected();
    const start = this.now();
    for (const f of frames) sock.send(f);
    this.events.emit({ type: 'sent', what, ms: Math.max(0, Math.round(this.now() - start)) });
  }

  /**
   * UNVERIFIED: Tizen has separate KEY_PLAY and KEY_PAUSE; we toggle from local state (first press
   * sends KEY_PLAY). If the TV was already playing, the first press is a no-op. KEY_PLAY_BACK is
   * reported as a toggle on some newer models but is not documented widely enough to rely on.
   */
  codeFor(key: Key): string {
    if (key === 'PLAY_PAUSE') return this.playing ? 'KEY_PAUSE' : 'KEY_PLAY';
    const code = SAMSUNG_KEYS[key];
    if (!code) throw driverError('unsupported', 'core.driver.common.keyUnavailable', { key });
    return code;
  }

  async sendKey(key: Key): Promise<void> {
    try {
      if (key === 'POWER' && this.off) {
        await this.powerOn();
        return;
      }
      const code = this.codeFor(key);
      this.send([buildKeyMessage(code, 'Click')], key);
      if (key === 'PLAY_PAUSE') this.playing = !this.playing;
    } catch (e) {
      this.fail(e);
    }
  }

  /** Press and hold (d-pad repeat, volume ramp); pair with keyUp. */
  async keyDown(key: Key): Promise<void> {
    try {
      this.send([buildKeyMessage(this.codeFor(key), 'Press')], `${key} down`);
    } catch (e) {
      this.fail(e);
    }
  }

  async keyUp(key: Key): Promise<void> {
    try {
      this.send([buildKeyMessage(this.codeFor(key), 'Release')], `${key} up`);
    } catch (e) {
      this.fail(e);
    }
  }

  /** Sends text to the TV's open on-screen keyboard. Ignored by the TV when no keyboard is open. */
  async sendText(text: string): Promise<void> {
    try {
      this.send(buildTextMessages(text), `TEXT ${JSON.stringify(text)}`);
    } catch (e) {
      this.fail(e);
    }
  }

  async listApps(): Promise<TvApp[]> {
    try {
      this.ensureConnected();
      const reply = this.waitFor('ed.installedApp.get');
      this.send([buildInstalledAppsMessage()], 'APPS');
      const apps = parseInstalledApps(await reply);
      this.apps = new Map(apps.map((a) => [a.id, a]));
      return apps;
    } catch (e) {
      return this.fail(e);
    }
  }

  /**
   * Icon as the TV supplies it: asks for the iconPath that ed.installedApp.get reported (call
   * listApps first) and returns a data: URI. null when the app has no icon path, the TV is not
   * connected, the reply is empty or it times out. Never throws and never emits an error event.
   * Requests are serialised because replies carry no request id. UNVERIFIED on hardware.
   */
  appIcon(app: TvApp): Promise<string | null> {
    const run = this.iconQueue.then(() => this.fetchIcon(app));
    this.iconQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async fetchIcon(app: TvApp): Promise<string | null> {
    const path = this.apps.get(app.id)?.icon ?? (app as SamsungApp).icon;
    if (!path || this.off || !this.connected || !this.sock) return null;
    try {
      const reply = this.waitFor('ed.apps.icon');
      this.send([buildAppIconMessage(path)], `ICON ${app.id}`);
      return parseAppIconReply(await reply, path);
    } catch {
      return null;
    }
  }

  async launchApp(appId: string, actionType?: SamsungLaunchType): Promise<void> {
    try {
      const type = actionType ?? launchTypeFor(this.apps.get(appId));
      this.send([buildLaunchMessage(appId, type)], `LAUNCH ${appId}`);
    } catch (e) {
      this.fail(e);
    }
  }

  /**
   * Wake-on-LAN when a MAC and a WOL sender are known; otherwise KEY_POWER over an open channel
   * (works on models that keep the channel alive in network standby). Does not claim the TV is on:
   * call connect() again once it answers.
   */
  async powerOn(): Promise<void> {
    try {
      const mac = this.opts.mac ?? this.info?.wifiMac;
      if (mac && this.opts.wol) {
        const start = this.now();
        try {
          await this.opts.wol(mac);
        } catch {
          throw driverError('network', 'core.driver.common.wakeFailed');
        }
        this.events.emit({ type: 'sent', what: 'POWER_ON', ms: Math.max(0, Math.round(this.now() - start)) });
        return;
      }
      if (this.connected && this.sock) {
        const wasOff = this.off;
        this.off = false;
        try {
          this.send([buildKeyMessage('KEY_POWER', 'Click')], 'POWER_ON');
        } finally {
          this.off = wasOff;
        }
        return;
      }
      throw driverError('unsupported', 'core.driver.common.noMac');
    } catch (e) {
      this.fail(e);
    }
  }
}
