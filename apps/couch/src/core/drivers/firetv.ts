/**
 * Fire TV driver (BETA): the undocumented local API the Fire TV mobile remote uses.
 *
 *  1. Wake the remote service: POST http://<ip>:8009/apps/FireTVRemote (a DIAL app launch; plain HTTP).
 *  2. HTTPS :8080 with a SELF-SIGNED certificate. React Native's fetch rejects it, so this driver
 *     needs an injected FetchLike that trusts self-signed certificates for RFC 1918 hosts only
 *     (the same rule as src/core/lanHost.ts / modules/lan-wss). The stock fetch fails with 'network'.
 *  3. Pairing: POST /v1/FireTV/pin/display {friendlyName} -> the TV shows a 4-digit PIN;
 *     POST /v1/FireTV/pin/verify {pin} -> {description: <client token>}.
 *  4. Every :8080 request carries `x-api-key: <constant>` and, once paired, `x-client-token: <token>`.
 *
 * Keys: POST /v1/FireTV?action=<name> (dpad_*, select, back, home, menu, volume_*, mute);
 * media: POST /v1/media?action=<play|pause|scan> (scan with {direction}). Text: POST /v1/FireTV/text
 * {text}. Apps: GET /v1/FireTV/apps, launch POST /v1/FireTV/app/<packageName>.
 *
 * Vega OS (Amazon's non-Android Fire OS successor, codename Kepler) does not run this service the
 * same way; when the wake reply or the properties endpoint reports it, connect() rejects with
 * DriverError('unsupported').
 *
 * Sources: public Home Assistant community notes on the Fire TV remote protocol — described, not
 * copied. Tested only against reconstructed fixtures (src/core/drivers/__fixtures__/firetv/).
 * EVERY protocol detail here is UNVERIFIED on hardware: the API key value, paths, action names,
 * the verify reply field, the app list shape, the properties endpoint and the Vega OS markers.
 */
import { isTvSuppliedIcon } from '../appIconCache';
import { Emitter, type DriverEvent, type FetchLike, type TvDriver } from '../driver';
import type { Key } from '../keys';
import { DriverError, type Capability, type PairState, type TvApp } from '../types';
import type { MessageKey } from '../../i18n/core';
import { driverError, asDriverError } from './errors';

/** Shown with a "beta" chip (see BETA_PLATFORMS). */
export const FIRETV_BETA = true;

/** What the add-TV flow shows: a 4-digit PIN on the TV. */
export const FIRETV_PAIR_STEP: PairState = { kind: 'code', length: 4 };

export const FIRETV_WAKE_PORT = 8009;
export const FIRETV_PORT = 8080;
export const FIRETV_DEFAULT_FRIENDLY_NAME = 'Couch Remote';

/**
 * x-api-key header. The Fire TV remote app sends a fixed public constant; the value below is the one
 * quoted in community notes but is UNVERIFIED. Override with the `apiKey` constructor option.
 */
export const FIRETV_DEFAULT_API_KEY = '0987654321';

export const FIRETV_PATHS = {
  wake: '/apps/FireTVRemote',
  pinDisplay: '/v1/FireTV/pin/display',
  pinVerify: '/v1/FireTV/pin/verify',
  action: '/v1/FireTV', // ?action=<name>
  media: '/v1/media', // ?action=<play|pause|scan>
  text: '/v1/FireTV/text',
  apps: '/v1/FireTV/apps',
  app: '/v1/FireTV/app/', // + <packageName>
  /** Device properties (model, OS). UNVERIFIED path; a 404 here is tolerated. */
  properties: '/v1/FireTV/properties',
} as const;

export type FireTvCommand =
  | { kind: 'action'; action: string }
  | { kind: 'media'; action: 'play' | 'pause' | 'scan'; body?: { direction: 'forward' | 'back' } };

/** Canonical key -> /v1/FireTV?action=. UNVERIFIED action names (HA community notes). */
export const FIRETV_ACTIONS: Partial<Record<Key, string>> = {
  UP: 'dpad_up',
  DOWN: 'dpad_down',
  LEFT: 'dpad_left',
  RIGHT: 'dpad_right',
  OK: 'select',
  ENTER: 'select',
  BACK: 'back',
  HOME: 'home',
  MENU: 'menu',
  VOL_UP: 'volume_up',
  VOL_DOWN: 'volume_down',
  MUTE: 'mute',
  // No known actions for POWER, INPUT/SOURCE, channels, digits, colour keys, SEARCH, SETTINGS,
  // BACKSPACE or VOICE: those keys are unsupported.
};

/** Keys sent to /v1/media. PLAY_PAUSE alternates pause/play (the API has no toggle we know of). */
export const FIRETV_MEDIA: Partial<Record<Key, FireTvCommand>> = {
  FF: { kind: 'media', action: 'scan', body: { direction: 'forward' } },
  REW: { kind: 'media', action: 'scan', body: { direction: 'back' } },
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Client token from the pin/verify reply: {description: token} (also accepts clientToken / token). */
export function parseFireTvToken(text: string): string | undefined {
  const v = parseJson(text);
  if (!isObj(v)) return undefined;
  const t = str(v.description) ?? str(v.clientToken) ?? str(v.token);
  // "OK"-style descriptions are status text, not a token.
  if (!t || /^(ok|success)$/i.test(t)) return undefined;
  return t;
}

export interface FireTvAppEntry extends TvApp {
  /** Icon as the TV supplied it, if any. Often a cloud URL; only LAN/data: icons are ever shown. */
  icon?: string;
}

/**
 * /v1/FireTV/apps reply. Accepts a bare array or {apps: [...]}; each entry
 * {appName|name, packageName|id, iconArtSmallUri|iconUri|icon?}. UNVERIFIED shape.
 */
export function parseFireTvApps(text: string): FireTvAppEntry[] {
  const v = parseJson(text);
  const list = Array.isArray(v) ? v : isObj(v) && Array.isArray(v.apps) ? v.apps : [];
  const out: FireTvAppEntry[] = [];
  for (const it of list) {
    if (!isObj(it)) continue;
    const id = str(it.packageName) ?? str(it.id);
    if (!id) continue;
    const app: FireTvAppEntry = { id, name: str(it.appName) ?? str(it.name) ?? id };
    const icon = str(it.iconArtSmallUri) ?? str(it.iconUri) ?? str(it.icon);
    if (icon) app.icon = icon;
    out.push(app);
  }
  return out;
}

/** True when an icon came from the TV itself (LAN http(s)) or inline; cloud URLs never qualify. */
export { isTvSuppliedIcon };

const VEGA_MARKER = /\b(vega\s*os|vegaos|kepler)\b/i;
const FIRE_OS_MARKER = /fire\s*os|fireos|android/i;

/**
 * Does a wake reply or properties reply say this is Vega OS (or some other non-Fire-OS platform)?
 * Looks for "Vega OS"/"Kepler" anywhere, then for an explicit OS field that is not Fire OS/Android.
 * UNVERIFIED markers: no Vega OS capture exists yet.
 */
export function isVegaOs(text: string): boolean {
  if (!text) return false;
  const v = parseJson(text);
  if (isObj(v)) {
    // JSON: only the OS fields count, so a device named "Kepler room" is not misread.
    for (const k of ['os', 'osName', 'platform', 'operatingSystem']) {
      const s = str(v[k]);
      if (s && (VEGA_MARKER.test(s) || !FIRE_OS_MARKER.test(s))) return true;
    }
    return false;
  }
  if (VEGA_MARKER.test(text)) return true;
  // XML (DIAL) replies: <os>...</os> / <platform>...</platform>
  const m = /<(os|osName|platform)>([^<]+)<\/\1>/i.exec(text);
  return !!m && !FIRE_OS_MARKER.test(m[2] ?? '');
}

/** Catalogue keys of the Vega OS / no remote service messages (translated when thrown). */
export const VEGA_OS_MESSAGE = 'core.driver.firetv.vegaOs' as const satisfies MessageKey;
export const NO_REMOTE_SERVICE_MESSAGE = 'core.driver.firetv.noRemoteService' as const satisfies MessageKey;

export interface FireTvDriverOptions {
  host: string;
  /** Must trust the TV's self-signed certificate on RFC 1918 hosts (LAN-trusting native fetch). Also used for the plain-HTTP wake. */
  fetch: FetchLike;
  /** Client token from an earlier pairing. */
  token?: string;
  onToken?: (token: string) => void;
  /** x-api-key header; defaults to FIRETV_DEFAULT_API_KEY (UNVERIFIED). */
  apiKey?: string;
  /** Name shown on the TV while pairing. */
  friendlyName?: string;
  port?: number;
  wakePort?: number;
  now?: () => number;
  timeoutMs?: number;
}

function isTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === 'AbortError' || e.name === 'TimeoutError' || /time(d)?\s?out/i.test(e.message);
}

const BASE_CAPS: readonly Capability[] = ['keys', 'text', 'apps', 'launch'];

export class FireTvDriver implements TvDriver {
  readonly platform = 'firetv' as const;

  token: string | undefined;
  readonly base: string;
  readonly wakeUrl: string;

  private readonly opts: FireTvDriverOptions;
  private readonly events = new Emitter();
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private connected = false;
  private playing = true;
  private appCache: FireTvAppEntry[] = [];
  private caps = new Set<Capability>(BASE_CAPS);

  constructor(opts: FireTvDriverOptions) {
    this.opts = opts;
    this.token = opts.token;
    this.base = `https://${opts.host}:${opts.port ?? FIRETV_PORT}`;
    this.wakeUrl = `http://${opts.host}:${opts.wakePort ?? FIRETV_WAKE_PORT}${FIRETV_PATHS.wake}`;
    this.now = opts.now ?? Date.now;
    this.timeoutMs = opts.timeoutMs ?? 4000;
  }

  /** keys/text/apps/launch; 'appIcons' only once the app list carried TV-supplied (LAN or data:) icons. */
  get capabilities(): ReadonlySet<Capability> {
    return this.caps;
  }

  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }

  private fail(e: unknown): never {
    const err = asDriverError(e);
    this.events.emit({ type: 'error', message: err.message });
    throw err;
  }

  private ensureConnected(): void {
    if (!this.connected) throw driverError('not_connected', 'core.driver.common.notConnected');
  }

  /** Step 0: start the remote service. Rejects 'unsupported' for Vega OS. */
  async wake(): Promise<void> {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.opts.fetch(this.wakeUrl, { method: 'POST', body: '', timeoutMs: this.timeoutMs });
    } catch (e) {
      if (isTimeoutError(e)) throw driverError('timeout', 'core.driver.common.deviceTimeout', { device: 'Fire TV' });
      throw driverError('network', 'core.driver.common.deviceUnreachable', { device: 'Fire TV' });
    }
    const body = await res.text().catch(() => '');
    if (isVegaOs(body)) throw driverError('unsupported', VEGA_OS_MESSAGE);
    // 404: no FireTVRemote DIAL app (not a Fire OS device, or a Vega OS build without it).
    if (res.status === 404) throw driverError('unsupported', NO_REMOTE_SERVICE_MESSAGE);
    // DIAL answers 201 Created (or 200 when already running). Other errors: carry on; :8080 decides.
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    opts: { auth?: boolean } = {},
  ): Promise<{ status: number; text: string; ms: number }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
      'x-api-key': this.opts.apiKey ?? FIRETV_DEFAULT_API_KEY,
    };
    if (opts.auth !== false && this.token) headers['x-client-token'] = this.token;
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
      if (isTimeoutError(e)) throw driverError('timeout', 'core.driver.common.deviceTimeout', { device: 'Fire TV' });
      throw driverError('network', 'core.driver.common.deviceUnreachableSecure', { device: 'Fire TV' });
    }
    const ms = Math.max(0, Math.round(this.now() - start));
    return { status: res.status, text: await res.text().catch(() => ''), ms };
  }

  /** request + status check for paired calls. */
  private async call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ text: string; ms: number }> {
    const r = await this.request(method, path, body);
    if (r.status === 401 || r.status === 403) throw driverError('pair_required', 'core.driver.common.pairAgain', { device: 'Fire TV' });
    if (r.status === 404 || r.status === 400 || r.status === 501)
      throw driverError('unsupported', 'core.driver.common.deviceUnsupportedCommand', { device: 'Fire TV' });
    if (r.status < 200 || r.status >= 300) throw driverError('network', 'core.driver.common.deviceHttp', { device: 'Fire TV', status: String(r.status) });
    return r;
  }

  /** Step 1: wake the service and ask the TV to show a 4-digit PIN. */
  async startPairing(): Promise<void> {
    try {
      await this.wake();
      const r = await this.request('POST', FIRETV_PATHS.pinDisplay, { friendlyName: this.opts.friendlyName ?? FIRETV_DEFAULT_FRIENDLY_NAME }, { auth: false });
      if (r.status === 403) throw driverError('forbidden', 'core.driver.firetv.pairRefused', { device: 'Fire TV' });
      if (r.status < 200 || r.status >= 300) throw driverError('network', 'core.driver.firetv.pairingHttp', { device: 'Fire TV', status: String(r.status) });
    } catch (e) {
      this.fail(e);
    }
  }

  /** Step 2: send the PIN; stores and returns the client token. */
  async finishPairing(pin: string): Promise<string> {
    try {
      if (!/^\d{4}$/.test(pin)) throw driverError('forbidden', 'core.driver.firetv.pinFormat', { length: '4' });
      const r = await this.request('POST', FIRETV_PATHS.pinVerify, { pin }, { auth: false });
      if (r.status === 400 || r.status === 401 || r.status === 403) throw driverError('forbidden', 'core.driver.common.pinMismatch');
      if (r.status < 200 || r.status >= 300) throw driverError('network', 'core.driver.firetv.pairingHttp', { device: 'Fire TV', status: String(r.status) });
      const token = parseFireTvToken(r.text);
      if (!token) throw driverError('network', 'core.driver.firetv.noToken', { device: 'Fire TV' });
      this.token = token;
      this.opts.onToken?.(token);
      return token;
    } catch (e) {
      return this.fail(e);
    }
  }

  async connect(): Promise<void> {
    this.events.emit({ type: 'state', state: 'connecting' });
    try {
      await this.wake();
      if (!this.token) throw driverError('pair_required', 'core.driver.common.pairFirst', { device: 'Fire TV' });
      const r = await this.request('GET', FIRETV_PATHS.properties);
      if (r.status === 401 || r.status === 403) throw driverError('pair_required', 'core.driver.common.pairAgain', { device: 'Fire TV' });
      if (r.status >= 200 && r.status < 300 && isVegaOs(r.text)) throw driverError('unsupported', VEGA_OS_MESSAGE);
      // 404 etc.: properties endpoint missing on this build; the wake check already ran.
    } catch (e) {
      this.connected = false;
      this.events.emit({ type: 'state', state: 'error' });
      this.fail(e);
    }
    this.connected = true;
    this.events.emit({ type: 'state', state: 'connected' });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.events.emit({ type: 'state', state: 'disconnected' });
  }

  /** Command for a key, or DriverError('unsupported'). */
  commandFor(key: Key): FireTvCommand {
    if (key === 'PLAY_PAUSE') return { kind: 'media', action: this.playing ? 'pause' : 'play' };
    const media = FIRETV_MEDIA[key];
    if (media) return media;
    const action = FIRETV_ACTIONS[key];
    if (!action) throw driverError('unsupported', 'core.driver.common.deviceKeyUnavailable', { key, device: 'Fire TV' });
    return { kind: 'action', action };
  }

  async sendKey(key: Key): Promise<void> {
    try {
      this.ensureConnected();
      const c = this.commandFor(key);
      const path = c.kind === 'action' ? `${FIRETV_PATHS.action}?action=${c.action}` : `${FIRETV_PATHS.media}?action=${c.action}`;
      const { ms } = await this.call('POST', path, c.kind === 'media' ? c.body : undefined);
      if (key === 'PLAY_PAUSE') this.playing = !this.playing;
      this.events.emit({ type: 'sent', what: key, ms });
    } catch (e) {
      this.fail(e);
    }
  }

  /** Types into the focused field. UNVERIFIED endpoint. */
  async sendText(text: string): Promise<void> {
    try {
      this.ensureConnected();
      const { ms } = await this.call('POST', FIRETV_PATHS.text, { text });
      this.events.emit({ type: 'sent', what: 'TEXT', ms });
    } catch (e) {
      this.fail(e);
    }
  }

  async listApps(): Promise<TvApp[]> {
    try {
      this.ensureConnected();
      const { text } = await this.call('GET', FIRETV_PATHS.apps);
      this.appCache = parseFireTvApps(text);
      if (this.appCache.some((a) => a.icon && isTvSuppliedIcon(a.icon, this.opts.host))) this.caps.add('appIcons');
      else this.caps.delete('appIcons');
      return this.appCache.map(({ id, name }) => ({ id, name }));
    } catch (e) {
      return this.fail(e);
    }
  }

  /** Only icons served by the TV itself (LAN) or inline; cloud icon URLs are never fetched. */
  async appIcon(app: TvApp): Promise<string | null> {
    const icon = this.appCache.find((a) => a.id === app.id)?.icon;
    return icon && isTvSuppliedIcon(icon, this.opts.host) ? icon : null;
  }

  async launchApp(appId: string): Promise<void> {
    try {
      this.ensureConnected();
      const { ms } = await this.call('POST', FIRETV_PATHS.app + encodeURIComponent(appId));
      this.events.emit({ type: 'sent', what: `LAUNCH ${appId}`, ms });
    } catch (e) {
      this.fail(e);
    }
  }
}
