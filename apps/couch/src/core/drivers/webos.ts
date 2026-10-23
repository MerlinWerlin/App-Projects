/**
 * LG webOS driver: SSAP (JSON request/response) over wss://<tv>:3001 (self-signed TLS), falling
 * back to ws://<tv>:3000 for older firmware. First connect sends a `register` message carrying the
 * standard pairing manifest (pairingType PROMPT): the TV shows an Allow prompt and answers
 * `registered` with a client-key, which later connects send back to skip the prompt.
 *
 * Remote buttons go over a second socket ("pointer input socket") whose URL the TV hands out via
 * ssap://com.webos.service.networkinput/getPointerInputSocket; frames are plain text
 * `type:button\nname:<NAME>\n\n`.
 *
 * Written from public protocol knowledge (logic as described by aiowebostv, Apache-2.0, and the
 * LG Connect SDK; no code copied). Tested against fixtures reconstructed from that knowledge
 * (src/core/drivers/__fixtures__/webos/); NOT yet verified on hardware. Points we are unsure
 * about are marked "UNVERIFIED".
 */
import { isTvSuppliedIcon } from '../appIconCache';
import { Emitter, type DriverEvent, type TvDriver, type WsFactory, type WsLike } from '../driver';
import type { Key, KeyMap } from '../keys';
import { DriverError, type Capability, type TvApp, type TvInput } from '../types';
import { driverError, asDriverError } from './errors';

export const WEBOS_WSS_PORT = 3001;
export const WEBOS_WS_PORT = 3000;

export const WEBOS_URI = {
  pointerSocket: 'ssap://com.webos.service.networkinput/getPointerInputSocket',
  turnOff: 'ssap://system/turnOff',
  volumeUp: 'ssap://audio/volumeUp',
  volumeDown: 'ssap://audio/volumeDown',
  getVolume: 'ssap://audio/getVolume',
  listLaunchPoints: 'ssap://com.webos.applicationManager/listLaunchPoints',
  listApps: 'ssap://com.webos.applicationManager/listApps',
  launch: 'ssap://system.launcher/launch',
  foregroundApp: 'ssap://com.webos.applicationManager/getForegroundAppInfo',
  inputList: 'ssap://tv/getExternalInputList',
  switchInput: 'ssap://tv/switchInput',
  insertText: 'ssap://com.webos.service.ime/insertText',
  deleteCharacters: 'ssap://com.webos.service.ime/deleteCharacters',
  sendEnterKey: 'ssap://com.webos.service.ime/sendEnterKey',
} as const;

/**
 * Canonical key -> pointer-socket button name. Source: button names as listed by aiowebostv's
 * button helper and the LG Connect SDK's MouseSocket (public). PLAY_PAUSE toggles PLAY/PAUSE from
 * local state at send time (see WebOsDriver.sendKey).
 *
 * Decisions / UNVERIFIED:
 * - SETTINGS -> 'MENU': on webOS the remote's settings (gear) key is the MENU button, which opens
 *   the settings overlay on top of the current app. We chose it over launching com.palm.app.settings
 *   because launching replaces the foreground app. MENU maps to the same button (as Samsung does).
 * - OK and ENTER-less selection both use 'ENTER'. The canonical ENTER key (keyboard submit) goes to
 *   the IME instead (WEBOS_SSAP_KEYS).
 * - INPUT / SOURCE have no well-known pointer button; the source picker uses listInputs/setInput.
 * - SEARCH and VOICE are unmapped (no reliable button); voice falls back to phone STT + sendText.
 */
export const WEBOS_BUTTONS: KeyMap = {
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  OK: 'ENTER',
  BACK: 'BACK',
  HOME: 'HOME',
  MENU: 'MENU',
  SETTINGS: 'MENU',
  MUTE: 'MUTE',
  CH_UP: 'CHANNELUP',
  CH_DOWN: 'CHANNELDOWN',
  REW: 'REWIND',
  PLAY_PAUSE: 'PLAY',
  FF: 'FASTFORWARD',
  NUM_0: '0',
  NUM_1: '1',
  NUM_2: '2',
  NUM_3: '3',
  NUM_4: '4',
  NUM_5: '5',
  NUM_6: '6',
  NUM_7: '7',
  NUM_8: '8',
  NUM_9: '9',
  NUM_DASH: 'DASH',
  RED: 'RED',
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  BLUE: 'BLUE',
};

export interface SsapCall {
  uri: string;
  payload?: Record<string, unknown>;
}

/**
 * Keys sent as SSAP requests instead of pointer buttons (these take precedence over WEBOS_BUTTONS).
 * Volume via ssap://audio works even when the pointer socket is unavailable. POWER is power-off
 * only; power-on is Wake-on-LAN (WebOsDriver.powerOn). BACKSPACE / ENTER act on the TV's open
 * on-screen keyboard.
 */
export const WEBOS_SSAP_KEYS: Partial<Record<Key, SsapCall>> = {
  POWER: { uri: WEBOS_URI.turnOff },
  VOL_UP: { uri: WEBOS_URI.volumeUp },
  VOL_DOWN: { uri: WEBOS_URI.volumeDown },
  BACKSPACE: { uri: WEBOS_URI.deleteCharacters, payload: { count: 1 } },
  ENTER: { uri: WEBOS_URI.sendEnterKey },
};

/**
 * Standard pairing manifest (the LG Connect SDK manifest that open-source clients send). The
 * `signed` block and its signature are a fixed published pair: they must be sent byte-for-byte or
 * the TV may refuse or grant fewer permissions. They name the vendor because they are protocol
 * data; this text is not shown in our app.
 * UNVERIFIED: reproduced from public knowledge, not copied from a capture. Before hardware testing,
 * diff the signed block and signature against aiowebostv's handshake constant.
 */
export const WEBOS_MANIFEST = {
  manifestVersion: 1,
  appVersion: '1.1',
  signed: {
    created: '20140509',
    appId: 'com.lge.test',
    vendorId: 'com.lge',
    localizedAppNames: { '': 'LG Remote App', 'ko-KR': '리모컨 앱', 'zxx-XX': 'ЛГ Rэмotэ AПП' },
    localizedVendorNames: { '': 'LG Electronics' },
    permissions: [
      'TEST_SECURE',
      'CONTROL_INPUT_TEXT',
      'CONTROL_MOUSE_AND_KEYBOARD',
      'READ_INSTALLED_APPS',
      'READ_LGE_SDX',
      'READ_NOTIFICATIONS',
      'SEARCH',
      'WRITE_SETTINGS',
      'WRITE_NOTIFICATION_ALERT',
      'CONTROL_POWER',
      'READ_CURRENT_CHANNEL',
      'READ_RUNNING_APPS',
      'READ_UPDATE_INFO',
      'UPDATE_FROM_REMOTE_APP',
      'READ_LGE_TV_INPUT_EVENTS',
      'READ_TV_CURRENT_TIME',
    ],
    serial: '2f930e2d2cfe083771f68e4fe7bb07',
  },
  permissions: [
    'LAUNCH',
    'LAUNCH_WEBAPP',
    'APP_TO_APP',
    'CLOSE',
    'TEST_OPEN',
    'TEST_PROTECTED',
    'CONTROL_AUDIO',
    'CONTROL_DISPLAY',
    'CONTROL_INPUT_JOYSTICK',
    'CONTROL_INPUT_MEDIA_RECORDING',
    'CONTROL_INPUT_MEDIA_PLAYBACK',
    'CONTROL_INPUT_TV',
    'CONTROL_POWER',
    'READ_APP_STATUS',
    'READ_CURRENT_CHANNEL',
    'READ_INPUT_DEVICE_LIST',
    'READ_NETWORK_STATE',
    'READ_RUNNING_APPS',
    'READ_TV_CHANNEL_LIST',
    'WRITE_NOTIFICATION_TOAST',
    'READ_POWER_STATE',
    'READ_COUNTRY_INFO',
    'READ_SETTINGS',
    'CONTROL_TV_SCREEN',
    'CONTROL_TV_STANBY',
    'CONTROL_FAVORITE_GROUP',
    'CONTROL_USER_INFO',
    'CHECK_BLUETOOTH_DEVICE',
    'CONTROL_BLUETOOTH',
    'CONTROL_TIMER_INFO',
    'STB_INTERNAL_CONNECTION',
    'CONTROL_RECORDING',
    'READ_RECORDING_STATE',
    'WRITE_RECORDING_LIST',
    'READ_RECORDING_LIST',
    'READ_RECORDING_SCHEDULE',
    'WRITE_RECORDING_SCHEDULE',
    'READ_STORAGE_DEVICE_LIST',
    'READ_TV_PROGRAM_INFO',
    'CONTROL_BOX_CHANNEL',
    'READ_TV_ACR_AUTH_TOKEN',
    'READ_TV_CONTENT_STATE',
    'READ_TV_CURRENT_TIME',
    'ADD_LAUNCHER_CHANNEL',
    'SET_CHANNEL_SKIP',
    'RELEASE_CHANNEL_SKIP',
    'CONTROL_CHANNEL_BLOCK',
    'DELETE_SELECT_CHANNEL',
    'CONTROL_CHANNEL_GROUP',
    'SCAN_TV_CHANNELS',
    'CONTROL_TV_POWER',
    'CONTROL_WOL',
  ],
  signatures: [
    {
      signatureVersion: 1,
      signature:
        'eyJhbGdvcml0aG0iOiJSU0EtU0hBMjU2Iiwia2V5SWQiOiJ0ZXN0LXNpZ25pbmctY2VydCIsInNpZ25hdHVyZVZlcnNpb24iOjF9.' +
        'hrVRgjCwXVvE2OOSpDZ58hR+59aFNwYDyjQgKk3auukd7pcegmE2CzPCa0bJ0ZsRAcKkCTJrWo5iDzNhMBWRyaMOv5zWSrthlf7G128qvIlpMT0YNY+n/' +
        'FaOHE73uLrS/g7swl3/qH/BGFG2Hu4RlL48eb3lLKqTt2xKHdCs6Cd4RMfJPYnzgvI4BNrFUKsjkcu+WD4OO2A27Pq1n50cMchmcaXadJhGrOqH5YmHdOCj5' +
        'NSHzJYrsW0HPlpuAx/ECMeIZYDh6RMqaFM2DXzdKX9NmmyqzJ3o/0lkk/N97gfVRLW5hA29yeAwaCViZNCP8iC9aO0q9fQojoa7NQnAtw==',
    },
  ],
} as const;

export const WEBOS_REGISTER_ID = 'register_0';

export function buildWebOsUrl(host: string, secure: boolean): string {
  return secure ? `wss://${host}:${WEBOS_WSS_PORT}` : `ws://${host}:${WEBOS_WS_PORT}`;
}

/** The register message. A stored client-key skips the Allow prompt. */
export function buildRegisterMessage(clientKey?: string, id: string = WEBOS_REGISTER_ID): string {
  const payload: Record<string, unknown> = { forcePairing: false, pairingType: 'PROMPT' };
  if (clientKey) payload['client-key'] = clientKey;
  payload.manifest = WEBOS_MANIFEST;
  return JSON.stringify({ type: 'register', id, payload });
}

/** An SSAP request. */
export function buildRequest(id: string, uri: string, payload?: Record<string, unknown>): string {
  const msg: Record<string, unknown> = { id, type: 'request', uri };
  if (payload !== undefined) msg.payload = payload;
  return JSON.stringify(msg);
}

/** Pointer-socket button frame. */
export function buildButtonFrame(name: string): string {
  return `type:button\nname:${name}\n\n`;
}

/** Pointer-socket relative move (touchpad cursor). `down` 1 while dragging. UNVERIFIED on hardware. */
export function buildMoveFrame(dx: number, dy: number, down = false): string {
  return `type:move\ndx:${Math.round(dx)}\ndy:${Math.round(dy)}\ndown:${down ? 1 : 0}\n\n`;
}

/** Pointer-socket click at the cursor. UNVERIFIED on hardware. */
export function buildClickFrame(): string {
  return 'type:click\n\n';
}

/** Pointer-socket scroll. UNVERIFIED on hardware. */
export function buildScrollFrame(dx: number, dy: number): string {
  return `type:scroll\ndx:${Math.round(dx)}\ndy:${Math.round(dy)}\n\n`;
}

export interface SsapMessage {
  type: string;
  id?: string;
  error?: string;
  payload?: Record<string, unknown>;
}

/** Parses an incoming SSAP frame; null for anything that is not a JSON object with a string `type`. */
export function parseSsap(raw: string): SsapMessage | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof (v as { type?: unknown }).type === 'string') {
      const m = v as Record<string, unknown>;
      const out: SsapMessage = { type: m.type as string };
      if (typeof m.id === 'string' || typeof m.id === 'number') out.id = String(m.id);
      if (typeof m.error === 'string') out.error = m.error;
      if (m.payload && typeof m.payload === 'object' && !Array.isArray(m.payload)) {
        out.payload = m.payload as Record<string, unknown>;
      }
      return out;
    }
  } catch {
    // not JSON
  }
  return null;
}

/** client-key from a `registered` payload. */
export function clientKeyFrom(msg: SsapMessage): string | undefined {
  const k = msg.payload?.['client-key'];
  return typeof k === 'string' && k !== '' ? k : undefined;
}

/**
 * Maps an SSAP error string ("403 User denied access", "401 insufficient permissions", ...) to a
 * DriverError. UNVERIFIED: exact error texts vary by firmware; we key on the leading status code.
 */
export function errorFromSsap(error: string | undefined, registering = false): DriverError {
  const text = (error ?? '').trim();
  const code = /^(\d{3})\b/.exec(text)?.[1];
  if (registering && (code === '403' || /denied|cancel|reject/i.test(text))) {
    return driverError('pair_required', 'core.driver.webos.refused');
  }
  if (code === '401' || code === '403') return driverError('forbidden', 'core.driver.webos.notAllowed');
  if (code === '404') return driverError('unsupported', 'core.driver.common.unsupportedCommand');
  return text ? driverError('network', 'core.driver.webos.tvSaid', { detail: text }) : driverError('network', 'core.driver.webos.tvError');
}

export interface WebOsApp extends TvApp {
  /** Icon URL exactly as the TV supplies it (largeIcon preferred over icon). */
  icon?: string;
}

function str(o: Record<string, unknown> | undefined, k: string): string | undefined {
  const v = o?.[k];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

const HTTP_URL = /^https?:\/\/\S+$/i;

function iconUrl(r: Record<string, unknown>): string | undefined {
  for (const k of ['largeIcon', 'icon', 'mediumIcon']) {
    const v = str(r, k);
    if (v && HTTP_URL.test(v)) return v;
  }
  return undefined;
}

/**
 * Parses a listLaunchPoints payload ({ launchPoints: [{ id, title, icon, largeIcon, ... }] }) or a
 * listApps payload ({ apps: [{ id, title, icon, ... }] }). Entries without an id are skipped;
 * duplicates (several launch points for one app) keep the first.
 */
export function parseLaunchPoints(payload: unknown): WebOsApp[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const p = payload as Record<string, unknown>;
  const list = Array.isArray(p.launchPoints) ? p.launchPoints : Array.isArray(p.apps) ? p.apps : [];
  const out: WebOsApp[] = [];
  const seen = new Set<string>();
  for (const a of list) {
    if (!a || typeof a !== 'object') continue;
    const r = a as Record<string, unknown>;
    const id = str(r, 'id');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const app: WebOsApp = { id, name: str(r, 'title') ?? id };
    const icon = iconUrl(r);
    if (icon) app.icon = icon;
    out.push(app);
  }
  return out;
}

export interface WebOsInput extends TvInput {
  /** App that shows this input (com.webos.app.hdmi1 ...), used to work out the current input. */
  appId?: string;
}

/** Parses getExternalInputList: { devices: [{ id: 'HDMI_1', label: 'HDMI 1', appId, connected }] }. */
export function parseInputList(payload: unknown): WebOsInput[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const devices = (payload as { devices?: unknown }).devices;
  if (!Array.isArray(devices)) return [];
  const out: WebOsInput[] = [];
  for (const d of devices) {
    if (!d || typeof d !== 'object') continue;
    const r = d as Record<string, unknown>;
    const id = str(r, 'id');
    if (!id) continue;
    const input: WebOsInput = { id, name: str(r, 'label') ?? id.replace(/_/g, ' ') };
    const appId = str(r, 'appId');
    if (appId) input.appId = appId;
    out.push(input);
  }
  return out;
}

/**
 * Volume from getVolume. Older firmware: { volume, muted }; webOS 5+: { volumeStatus: { volume,
 * muteStatus } }. UNVERIFIED: the second shape is from public reports. null when absent.
 */
export function parseVolume(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.volume === 'number') return p.volume;
  const vs = p.volumeStatus;
  if (vs && typeof vs === 'object' && typeof (vs as { volume?: unknown }).volume === 'number') {
    return (vs as { volume: number }).volume;
  }
  return null;
}

export interface WebOsDriverOptions {
  host: string;
  ws: WsFactory;
  /** client-key from an earlier pairing. */
  clientKey?: string;
  /** Called whenever the TV hands out a new client-key; persist it with the Tv record (Tv.token). */
  onClientKey?: (key: string) => void;
  /** MAC for Wake-on-LAN. webOS needs "Turn on via Wi-Fi / Mobile TV On" enabled on the TV. */
  mac?: string;
  /** Sends a Wake-on-LAN magic packet. */
  wol?: (mac: string) => Promise<void>;
  now?: () => number;
  /** How long to wait for `registered` (the user may need to press Allow). Default 60 s. */
  connectTimeoutMs?: number;
  /** Timeout for request/response. Default 4 s. */
  timeoutMs?: number;
  /** Try ws://:3000 when wss://:3001 cannot be opened (older firmware). Default true. */
  legacyFallback?: boolean;
}

type Waiter = { resolve: (p: Record<string, unknown>) => void; reject: (e: DriverError) => void; timer: ReturnType<typeof setTimeout> };

const BASE_CAPS: readonly Capability[] = [
  'keys',
  'text',
  'apps',
  'launch',
  'volume',
  'inputs',
  'numbers',
  'colorKeys',
  'appIcons',
  'touchpad',
];

export class WebOsDriver implements TvDriver {
  readonly platform = 'webos' as const;
  readonly capabilities: ReadonlySet<Capability>;

  clientKey: string | undefined;
  /** True after the TV answered register with pairingType PROMPT (Allow prompt on screen). */
  prompting = false;
  /** Whether the main socket is wss (true) or the legacy ws fallback (false); null before connect. */
  secure: boolean | null = null;

  private readonly opts: WebOsDriverOptions;
  private readonly events = new Emitter();
  private readonly now: () => number;
  private readonly connectTimeoutMs: number;
  private readonly timeoutMs: number;
  private sock: WsLike | null = null;
  private pointer: WsLike | null = null;
  private pointerOpening: Promise<WsLike> | null = null;
  private connected = false;
  private playing = false;
  private seq = 0;
  private apps = new Map<string, WebOsApp>();
  private waiters = new Map<string, Waiter>();

  constructor(opts: WebOsDriverOptions) {
    this.opts = opts;
    this.clientKey = opts.clientKey;
    this.now = opts.now ?? Date.now;
    this.connectTimeoutMs = opts.connectTimeoutMs ?? 60000;
    this.timeoutMs = opts.timeoutMs ?? 4000;
    const caps = new Set<Capability>(BASE_CAPS);
    if (opts.mac && opts.wol) caps.add('powerOn');
    this.capabilities = caps;
  }

  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }

  private fail(e: unknown): never {
    const err = asDriverError(e);
    this.events.emit({ type: 'error', message: err.message });
    throw err;
  }

  async connect(): Promise<void> {
    this.events.emit({ type: 'state', state: 'connecting' });
    try {
      await this.openMain();
    } catch (e) {
      this.connected = false;
      this.events.emit({ type: 'state', state: 'error' });
      this.fail(e);
    }
    // Best effort: keys retry the pointer socket lazily if this fails.
    try {
      await this.ensurePointer();
    } catch {
      // ignore
    }
    this.events.emit({ type: 'state', state: 'connected' });
  }

  private async openSocket(): Promise<WsLike> {
    const host = this.opts.host;
    try {
      const s = await this.opts.ws(buildWebOsUrl(host, true), { allowSelfSignedLan: true });
      this.secure = true;
      return s;
    } catch {
      if (this.opts.legacyFallback === false) {
        throw driverError('network', 'core.driver.common.channelFailed', { port: String(WEBOS_WSS_PORT) });
      }
    }
    try {
      const s = await this.opts.ws(buildWebOsUrl(host, false));
      this.secure = false;
      return s;
    } catch {
      throw driverError('network', 'core.driver.common.unreachable');
    }
  }

  /** Opens the SSAP socket and registers (Allow prompt on first pairing). */
  private async openMain(): Promise<void> {
    const sock = await this.openSocket();
    this.prompting = false;
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
        const m = parseSsap(raw);
        if (!m) return;
        if (!settled) {
          if (m.id !== WEBOS_REGISTER_ID) return;
          if (m.type === 'registered') {
            const k = clientKeyFrom(m);
            if (k && k !== this.clientKey) {
              this.clientKey = k;
              this.opts.onClientKey?.(k);
            }
            this.prompting = false;
            this.sock = sock;
            this.connected = true;
            settle();
          } else if (m.type === 'response') {
            if (m.payload?.pairingType === 'PROMPT') this.prompting = true;
          } else if (m.type === 'error') {
            settle(errorFromSsap(m.error, true));
          }
          return;
        }
        this.handle(m);
      });
      sock.onClose(() => {
        if (!settled) {
          settle(driverError('network', 'core.driver.common.channelClosed'));
          return;
        }
        if (this.sock !== sock) return;
        this.dropConnection();
        this.events.emit({ type: 'state', state: 'disconnected' });
      });
      try {
        sock.send(buildRegisterMessage(this.clientKey));
      } catch {
        settle(driverError('network', 'core.driver.common.channelClosed'));
      }
    });
  }

  private handle(m: SsapMessage): void {
    if (m.id === undefined) return;
    const w = this.waiters.get(m.id);
    if (!w) return; // subscription updates or stale replies
    this.waiters.delete(m.id);
    clearTimeout(w.timer);
    if (m.type === 'error') w.reject(errorFromSsap(m.error));
    else if (m.type === 'response' && m.payload?.returnValue === false) {
      w.reject(errorFromSsap(typeof m.payload.errorText === 'string' ? m.payload.errorText : undefined));
    } else w.resolve(m.payload ?? {});
  }

  private dropConnection(): void {
    this.sock = null;
    this.connected = false;
    const p = this.pointer;
    this.pointer = null;
    this.pointerOpening = null;
    try {
      p?.close();
    } catch {
      // ignore
    }
    const err = driverError('not_connected', 'core.driver.common.notConnected');
    for (const w of this.waiters.values()) {
      clearTimeout(w.timer);
      w.reject(err);
    }
    this.waiters.clear();
  }

  async disconnect(): Promise<void> {
    const s = this.sock;
    this.dropConnection();
    try {
      s?.close();
    } catch {
      // ignore
    }
    this.events.emit({ type: 'state', state: 'disconnected' });
  }

  private ensureConnected(): WsLike {
    if (!this.connected || !this.sock) throw driverError('not_connected', 'core.driver.common.notConnected');
    return this.sock;
  }

  /** Sends an SSAP request and resolves with the response payload. */
  request(uri: string, payload?: Record<string, unknown>): Promise<Record<string, unknown>> {
    let sock: WsLike;
    try {
      sock = this.ensureConnected();
    } catch (e) {
      return Promise.reject(e);
    }
    this.seq += 1;
    const id = `couch_${this.seq}`;
    return new Promise((resolve, reject) => {
      const w: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters.delete(id);
          reject(driverError('timeout', 'core.driver.common.timeout'));
        }, this.timeoutMs),
      };
      this.waiters.set(id, w);
      try {
        sock.send(buildRequest(id, uri, payload));
      } catch {
        this.waiters.delete(id);
        clearTimeout(w.timer);
        reject(driverError('not_connected', 'core.driver.common.notConnected'));
      }
    });
  }

  private async call(uri: string, payload: Record<string, unknown> | undefined, what: string): Promise<Record<string, unknown>> {
    const start = this.now();
    const r = await this.request(uri, payload);
    this.events.emit({ type: 'sent', what, ms: Math.max(0, Math.round(this.now() - start)) });
    return r;
  }

  /** Opens (once) the pointer input socket the TV hands out. */
  private ensurePointer(): Promise<WsLike> {
    if (this.pointer) return Promise.resolve(this.pointer);
    if (this.pointerOpening) return this.pointerOpening;
    const main = this.sock;
    const run = (async (): Promise<WsLike> => {
      const r = await this.request(WEBOS_URI.pointerSocket);
      const path = str(r, 'socketPath');
      if (!path || !/^wss?:\/\//i.test(path)) throw driverError('unsupported', 'core.driver.webos.noButtonChannel');
      let p: WsLike;
      try {
        p = await this.opts.ws(path, path.toLowerCase().startsWith('wss:') ? { allowSelfSignedLan: true } : undefined);
      } catch {
        throw driverError('network', 'core.driver.webos.buttonChannelFailed');
      }
      if (this.sock !== main || !this.connected) {
        try {
          p.close();
        } catch {
          // ignore
        }
        throw driverError('not_connected', 'core.driver.common.notConnected');
      }
      p.onClose(() => {
        if (this.pointer === p) this.pointer = null;
      });
      this.pointer = p;
      return p;
    })();
    this.pointerOpening = run;
    run.then(
      () => {
        if (this.pointerOpening === run) this.pointerOpening = null;
      },
      () => {
        if (this.pointerOpening === run) this.pointerOpening = null;
      },
    );
    return run;
  }

  private async sendPointer(frame: string, what: string): Promise<void> {
    this.ensureConnected();
    const start = this.now();
    const p = await this.ensurePointer();
    try {
      p.send(frame);
    } catch {
      if (this.pointer === p) this.pointer = null;
      throw driverError('network', 'core.driver.webos.buttonChannelClosed');
    }
    this.events.emit({ type: 'sent', what, ms: Math.max(0, Math.round(this.now() - start)) });
  }

  async sendKey(key: Key): Promise<void> {
    try {
      if (key === 'POWER' && !this.connected) {
        await this.powerOn();
        return;
      }
      const ssap = WEBOS_SSAP_KEYS[key];
      if (ssap) {
        await this.call(ssap.uri, ssap.payload, key);
        return;
      }
      let name = WEBOS_BUTTONS[key];
      if (key === 'PLAY_PAUSE') name = this.playing ? 'PAUSE' : 'PLAY';
      if (!name) throw driverError('unsupported', 'core.driver.common.keyUnavailable', { key });
      await this.sendPointer(buildButtonFrame(name), key);
      if (key === 'PLAY_PAUSE') this.playing = !this.playing;
    } catch (e) {
      this.fail(e);
    }
  }

  /** Moves the TV's pointer (touchpad cursor mode). */
  async pointerMove(dx: number, dy: number, down = false): Promise<void> {
    try {
      await this.sendPointer(buildMoveFrame(dx, dy, down), 'MOVE');
    } catch (e) {
      this.fail(e);
    }
  }

  async pointerClick(): Promise<void> {
    try {
      await this.sendPointer(buildClickFrame(), 'CLICK');
    } catch (e) {
      this.fail(e);
    }
  }

  async pointerScroll(dx: number, dy: number): Promise<void> {
    try {
      await this.sendPointer(buildScrollFrame(dx, dy), 'SCROLL');
    } catch (e) {
      this.fail(e);
    }
  }

  /** Types into the TV's open on-screen keyboard (insertText with replace 0 appends). */
  async sendText(text: string): Promise<void> {
    try {
      await this.call(WEBOS_URI.insertText, { text, replace: 0 }, `TEXT ${JSON.stringify(text)}`);
    } catch (e) {
      this.fail(e);
    }
  }

  /** Launch points carry the TV's icon URLs (listApps is used only when listLaunchPoints fails). */
  async listApps(): Promise<TvApp[]> {
    try {
      let apps: WebOsApp[];
      try {
        apps = parseLaunchPoints(await this.request(WEBOS_URI.listLaunchPoints));
      } catch (e) {
        if (e instanceof DriverError && (e.code === 'not_connected' || e.code === 'timeout')) throw e;
        apps = parseLaunchPoints(await this.request(WEBOS_URI.listApps));
      }
      this.apps = new Map(apps.map((a) => [a.id, a]));
      return apps;
    } catch (e) {
      return this.fail(e);
    }
  }

  /**
   * The icon URL the TV supplied in listLaunchPoints (call listApps first); null when it gave none.
   * The URL points at the TV (http://<tv>:3000/resources/...). Never throws. UNVERIFIED: whether the
   * icon URLs load without the SSAP session on every firmware.
   */
  async appIcon(app: TvApp): Promise<string | null> {
    const icon = this.apps.get(app.id)?.icon ?? (app as WebOsApp).icon;
    return icon && isTvSuppliedIcon(icon, this.opts.host) ? icon : null;
  }

  async launchApp(appId: string): Promise<void> {
    try {
      await this.call(WEBOS_URI.launch, { id: appId }, `LAUNCH ${appId}`);
    } catch (e) {
      this.fail(e);
    }
  }

  /** getExternalInputList; current from getForegroundAppInfo when it matches an input's appId. */
  async listInputs(): Promise<TvInput[]> {
    try {
      const inputs = parseInputList(await this.request(WEBOS_URI.inputList));
      let fg: string | undefined;
      try {
        fg = str(await this.request(WEBOS_URI.foregroundApp), 'appId');
      } catch {
        fg = undefined;
      }
      return inputs.map((i) => {
        const out: TvInput = { id: i.id, name: i.name };
        if (fg !== undefined) out.current = i.appId === fg;
        return out;
      });
    } catch (e) {
      return this.fail(e);
    }
  }

  async setInput(inputId: string): Promise<void> {
    try {
      await this.call(WEBOS_URI.switchInput, { inputId }, `INPUT ${inputId}`);
    } catch (e) {
      this.fail(e);
    }
  }

  async volume(): Promise<number> {
    try {
      const v = parseVolume(await this.request(WEBOS_URI.getVolume));
      if (v === null) throw driverError('unsupported', 'core.driver.common.noVolume');
      return v;
    } catch (e) {
      return this.fail(e);
    }
  }

  /**
   * Wake-on-LAN (needs a MAC and a WOL sender; the TV must have "Turn on via Wi-Fi" enabled).
   * webOS has no SSAP power-on: the socket is gone while the TV is off. Does not claim the TV is
   * on: call connect() again once it answers.
   */
  async powerOn(): Promise<void> {
    try {
      const mac = this.opts.mac;
      if (!mac || !this.opts.wol) {
        throw driverError('unsupported', 'core.driver.common.noMac');
      }
      const start = this.now();
      try {
        await this.opts.wol(mac);
      } catch {
        throw driverError('network', 'core.driver.common.wakeFailed');
      }
      this.events.emit({ type: 'sent', what: 'POWER_ON', ms: Math.max(0, Math.round(this.now() - start)) });
    } catch (e) {
      this.fail(e);
    }
  }
}
