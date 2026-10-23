/**
 * Sony Bravia driver: the Bravia "Scalar" REST API (JSON-RPC over plain HTTP POST to
 * http://<tv>/sony/<service>) plus IRCC (SOAP over HTTP) for remote keys.
 *
 * Auth: Pre-Shared Key. The user turns on Settings › Network › Home network › IP control ›
 * Authentication "Normal and Pre-Shared Key" (wording varies by model year) and types a PSK on the
 * TV; we send it as the `X-Auth-PSK` header on every request. Plain HTTP on :80, so the normal
 * fetch works (no self-signed TLS).
 *
 * PIN pairing (not implemented, documented only): POST /sony/accessControl `actRegister` with a
 * clientid/nickname makes the TV show a 4-digit PIN and answer 401; repeating it with
 * `Authorization: Basic base64(":" + pin)` returns 200 and an `auth=` cookie that must accompany
 * later requests. That needs response-header / cookie access FetchLike does not expose, and PSK is
 * the simpler documented route, so PSK is the only supported mode for now.
 *
 * Ported from public knowledge of the Bravia REST/IRCC API (Sony's BRAVIA Professional Display
 * docs, pybravia / braviarc behaviour) — described, not copied. Tested only against fixtures
 * reconstructed from those docs (src/core/drivers/__fixtures__/sony/). Every protocol detail here
 * is UNVERIFIED on hardware: method versions, result shapes, error codes and IRCC names.
 */
import { isTvSuppliedIcon } from '../appIconCache';
import { Emitter, type DriverEvent, type FetchLike, type TvDriver } from '../driver';
import type { Key } from '../keys';
import { DriverError, type Capability, type TvApp, type TvInput } from '../types';
import type { MessageKey } from '../../i18n/core';
import { driverError, asDriverError } from './errors';

export const SONY_HTTP_PORT = 80;

/** Catalogue key of the IP control / Pre-Shared Key help (translated when thrown). */
export const SONY_PSK_HELP = 'core.driver.sony.pskHelp' as const satisfies MessageKey;

/**
 * Canonical key -> IRCC command names to try, in order, against the TV's own
 * getRemoteControllerInfo list (names vary by model year, codes are looked up by name).
 * POWER is handled via setPowerStatus; PLAY_PAUSE alternates Play / Pause. UNVERIFIED names.
 */
export const SONY_KEY_NAMES: Partial<Record<Key, readonly string[]>> = {
  UP: ['Up'],
  DOWN: ['Down'],
  LEFT: ['Left'],
  RIGHT: ['Right'],
  OK: ['Confirm', 'DpadCenter'],
  BACK: ['Return', 'Back'],
  HOME: ['Home'],
  MENU: ['Options', 'ActionMenu'],
  INPUT: ['Input'],
  SOURCE: ['Input'],
  SETTINGS: ['ActionMenu', 'Options'],
  VOL_UP: ['VolumeUp'],
  VOL_DOWN: ['VolumeDown'],
  MUTE: ['Mute'],
  CH_UP: ['ChannelUp'],
  CH_DOWN: ['ChannelDown'],
  REW: ['Rewind'],
  FF: ['Forward'],
  ENTER: ['Enter', 'Confirm'],
  SEARCH: ['Assists', 'GooglePlay'],
  NUM_0: ['Num0'],
  NUM_1: ['Num1'],
  NUM_2: ['Num2'],
  NUM_3: ['Num3'],
  NUM_4: ['Num4'],
  NUM_5: ['Num5'],
  NUM_6: ['Num6'],
  NUM_7: ['Num7'],
  NUM_8: ['Num8'],
  NUM_9: ['Num9'],
  NUM_DASH: ['DOT'],
  RED: ['Red'],
  GREEN: ['Green'],
  YELLOW: ['Yellow'],
  BLUE: ['Blue'],
};

const BASE_CAPS: readonly Capability[] = ['keys', 'text', 'apps', 'launch', 'volume', 'powerOn', 'inputs', 'appIcons'];

/** JSON-RPC request body as the Bravia API expects it. */
export function sonyRpc(method: string, params: unknown[] = [], version = '1.0', id = 1): string {
  return JSON.stringify({ method, id, params, version });
}

/** IRCC SOAP envelope for one code. */
export function irccEnvelope(code: string): string {
  return (
    '<?xml version="1.0"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
    '<s:Body><u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">' +
    `<IRCCCode>${code}</IRCCCode>` +
    '</u:X_SendIRCC></s:Body></s:Envelope>'
  );
}

export const SONY_IRCC_SOAPACTION = '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"';

type RpcReply = { result?: unknown[]; error?: [number, string?] | unknown[]; id?: number };

function parseRpc(text: string): RpcReply {
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === 'object' ? (v as RpcReply) : {};
  } catch {
    return {};
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** getRemoteControllerInfo: result [ {bundled,type}, [ {name, value}, ... ] ] -> name -> IRCC code. */
export function parseRemoteControllerInfo(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const list = parseRpc(text).result?.[1];
  if (!Array.isArray(list)) return out;
  for (const c of list) {
    if (isObj(c) && typeof c.name === 'string' && typeof c.value === 'string') out.set(c.name, c.value);
  }
  return out;
}

export interface SonyApp extends TvApp {
  /** Launch URI for setActiveApp. Equals id. */
  uri: string;
  /** Icon URL as the TV supplies it (may be absent). */
  icon?: string;
}

/** getApplicationList: result [[ {title, uri, icon}, ... ]]. */
export function parseApplicationList(text: string): SonyApp[] {
  const list = parseRpc(text).result?.[0];
  if (!Array.isArray(list)) return [];
  const out: SonyApp[] = [];
  for (const a of list) {
    if (!isObj(a)) continue;
    const uri = str(a.uri);
    if (!uri) continue;
    out.push({ id: uri, uri, name: str(a.title) ?? uri, icon: str(a.icon) });
  }
  return out;
}

/** getCurrentExternalInputsStatus: result [[ {uri, title, label, connection, icon}, ... ]]. */
export function parseExternalInputs(text: string, currentUri?: string): TvInput[] {
  const list = parseRpc(text).result?.[0];
  if (!Array.isArray(list)) return [];
  const out: TvInput[] = [];
  for (const i of list) {
    if (!isObj(i)) continue;
    const uri = str(i.uri);
    if (!uri) continue;
    const title = str(i.title) ?? uri;
    const label = str(i.label);
    const input: TvInput = { id: uri, name: label ? `${title} (${label})` : title };
    if (currentUri !== undefined) input.current = uri === currentUri;
    out.push(input);
  }
  return out;
}

/** getPlayingContentInfo: result [ {uri, source, title} ]. undefined when an app is in front (error). */
export function parsePlayingUri(text: string): string | undefined {
  const r = parseRpc(text).result?.[0];
  return isObj(r) ? str(r.uri) : undefined;
}

/** getPowerStatus: result [ {status: "active" | "standby"} ]. */
export function parsePowerStatus(text: string): 'active' | 'standby' | undefined {
  const r = parseRpc(text).result?.[0];
  const s = isObj(r) ? r.status : undefined;
  return s === 'active' || s === 'standby' ? s : undefined;
}

export interface SonySystemInfo {
  name?: string;
  model?: string;
  mac?: string;
  serial?: string;
  generation?: string;
}

/** getSystemInformation: result [ {product, name, model, macAddr, serial, generation, ...} ]. */
export function parseSystemInformation(text: string): SonySystemInfo {
  const r = parseRpc(text).result?.[0];
  if (!isObj(r)) return {};
  return {
    name: str(r.name),
    model: str(r.model),
    mac: str(r.macAddr),
    serial: str(r.serial),
    generation: str(r.generation),
  };
}

/** getVolumeInformation: result [[ {target, volume, mute, maxVolume, minVolume} ]]; prefers "speaker". */
export function parseVolume(text: string): { volume: number; mute: boolean } | undefined {
  const list = parseRpc(text).result?.[0];
  if (!Array.isArray(list)) return undefined;
  const objs = list.filter(isObj);
  const v = objs.find((o) => o.target === 'speaker') ?? objs[0];
  if (!v || typeof v.volume !== 'number') return undefined;
  return { volume: v.volume, mute: v.mute === true };
}

export interface SonyDriverOptions {
  host: string;
  fetch: FetchLike;
  /** Pre-Shared Key set on the TV (IP control › Pre-Shared Key). */
  psk?: string;
  /** MAC for Wake-on-LAN, used when setPowerStatus cannot wake the TV. */
  mac?: string;
  wol?: (mac: string) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
}

function isTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === 'AbortError' || e.name === 'TimeoutError' || /time(d)?\s?out/i.test(e.message);
}

export class SonyDriver implements TvDriver {
  readonly platform = 'sony' as const;
  get capabilities(): ReadonlySet<Capability> {
    const caps = new Set<Capability>(BASE_CAPS);
    if (this.codes.has('Num0')) caps.add('numbers');
    if (this.codes.has('Red')) caps.add('colorKeys');
    return caps;
  }

  info: SonySystemInfo | null = null;
  power: 'active' | 'standby' | undefined;
  readonly base: string;

  private readonly opts: SonyDriverOptions;
  private readonly events = new Emitter();
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private codes = new Map<string, string>();
  private apps = new Map<string, SonyApp>();
  private connected = false;
  private playing = true;
  private rpcId = 1;

  constructor(opts: SonyDriverOptions) {
    this.opts = opts;
    this.base = `http://${opts.host}`;
    this.now = opts.now ?? Date.now;
    this.timeoutMs = opts.timeoutMs ?? 4000;
  }

  on(cb: (e: DriverEvent) => void): () => void {
    return this.events.on(cb);
  }

  private headers(extra: Record<string, string>): Record<string, string> {
    return this.opts.psk ? { ...extra, 'X-Auth-PSK': this.opts.psk } : extra;
  }

  private async http(path: string, body: string, headers: Record<string, string>): Promise<{ text: string; ms: number }> {
    const start = this.now();
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.opts.fetch(this.base + path, { method: 'POST', headers: this.headers(headers), body, timeoutMs: this.timeoutMs });
    } catch (e) {
      if (isTimeoutError(e)) throw driverError('timeout', 'core.driver.common.deviceTimeout', { device: 'Sony TV' });
      throw driverError('network', 'core.driver.common.deviceUnreachable', { device: 'Sony TV' });
    }
    const ms = Math.max(0, Math.round(this.now() - start));
    if (res.status === 401 || res.status === 403) {
      throw driverError(this.opts.psk ? 'forbidden' : 'pair_required', SONY_PSK_HELP);
    }
    const text = await res.text();
    // IRCC answers 500 with a SOAP fault for an unknown code.
    if (!res.ok) {
      if (res.status === 404) throw driverError('unsupported', 'core.driver.common.deviceNoControl', { device: 'Sony TV' });
      throw driverError('network', 'core.driver.common.deviceHttp', { device: 'Sony TV', status: String(res.status) });
    }
    return { text, ms };
  }

  /** JSON-RPC call; maps the Bravia error array to DriverError. */
  private async rpc(service: string, method: string, params: unknown[] = [], version = '1.0'): Promise<{ text: string; ms: number }> {
    const r = await this.http(`/sony/${service}`, sonyRpc(method, params, version, this.rpcId++), {
      'Content-Type': 'application/json; charset=UTF-8',
    });
    const reply = parseRpc(r.text);
    if (Array.isArray(reply.error)) {
      const code = typeof reply.error[0] === 'number' ? reply.error[0] : -1;
      const msg = typeof reply.error[1] === 'string' ? reply.error[1] : 'error';
      if (code === 401 || code === 403) throw driverError(this.opts.psk ? 'forbidden' : 'pair_required', SONY_PSK_HELP);
      if (code === 40005) throw driverError('tv_off', 'core.driver.sony.screenOff', { device: 'Sony TV' });
      if (code === 12 || code === 14 || code === 15)
        throw driverError('unsupported', 'core.driver.sony.methodUnsupported', { device: 'Sony TV', method });
      throw driverError('network', 'core.driver.sony.tvError', { device: 'Sony TV', code: String(code), detail: String(msg) });
    }
    return r;
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
      this.power = parsePowerStatus((await this.rpc('system', 'getPowerStatus')).text);
      this.codes = parseRemoteControllerInfo((await this.rpc('system', 'getRemoteControllerInfo')).text);
      // getSystemInformation needs auth: proves the PSK before we claim to be connected.
      this.info = parseSystemInformation((await this.rpc('system', 'getSystemInformation')).text);
    } catch (e) {
      this.connected = false;
      this.events.emit({ type: 'state', state: 'error' });
      this.fail(e);
    }
    this.connected = true;
    this.events.emit({ type: 'state', state: this.power === 'standby' ? 'off' : 'connected' });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.events.emit({ type: 'state', state: 'disconnected' });
  }

  /** IRCC code for a key, resolved by name against the TV's remote-controller info. */
  irccCode(key: Key): string {
    if (key === 'PLAY_PAUSE') {
      const name = this.playing ? 'Pause' : 'Play';
      const c = this.codes.get(name);
      if (c) return c;
    }
    for (const name of SONY_KEY_NAMES[key] ?? []) {
      const c = this.codes.get(name);
      if (c) return c;
    }
    throw driverError('unsupported', 'core.driver.sony.keyUnavailable', { key, device: 'Sony TV' });
  }

  private async sendIrcc(code: string, what: string): Promise<void> {
    const { ms } = await this.http('/sony/IRCC', irccEnvelope(code), {
      'Content-Type': 'text/xml; charset=UTF-8',
      SOAPACTION: SONY_IRCC_SOAPACTION,
    });
    this.events.emit({ type: 'sent', what, ms });
  }

  private async setPower(on: boolean): Promise<void> {
    const { ms } = await this.rpc('system', 'setPowerStatus', [{ status: on }]);
    this.power = on ? 'active' : 'standby';
    this.events.emit({ type: 'sent', what: on ? 'POWER_ON' : 'POWER_OFF', ms });
    if (this.connected) this.events.emit({ type: 'state', state: on ? 'connected' : 'off' });
  }

  async sendKey(key: Key): Promise<void> {
    try {
      this.ensureConnected();
      if (key === 'POWER') {
        await this.setPower(this.power === 'standby');
        return;
      }
      await this.sendIrcc(this.irccCode(key), key);
      if (key === 'PLAY_PAUSE') this.playing = !this.playing;
    } catch (e) {
      this.fail(e);
    }
  }

  /**
   * appControl setTextForm: fills the TV's open on-screen keyboard (replaces its contents).
   * Only works while a text field is focused. UNVERIFIED: newer firmware may want version 1.1
   * with an encrypted payload.
   */
  async sendText(text: string): Promise<void> {
    try {
      this.ensureConnected();
      const { ms } = await this.rpc('appControl', 'setTextForm', [{ text }]);
      this.events.emit({ type: 'sent', what: `TEXT ${JSON.stringify(text)}`, ms });
    } catch (e) {
      this.fail(e);
    }
  }

  async listApps(): Promise<TvApp[]> {
    try {
      this.ensureConnected();
      const apps = parseApplicationList((await this.rpc('appControl', 'getApplicationList')).text);
      this.apps = new Map(apps.map((a) => [a.id, a]));
      return apps.map((a) => ({ id: a.id, name: a.name }));
    } catch (e) {
      return this.fail(e);
    }
  }

  /**
   * The icon URL from getApplicationList, exactly as the TV supplies it (needs listApps first).
   * Only URLs served by the TV / LAN are returned; a cloud URL counts as no icon.
   */
  async appIcon(app: TvApp): Promise<string | null> {
    const icon = this.apps.get(app.id)?.icon;
    return icon && isTvSuppliedIcon(icon, this.opts.host) ? icon : null;
  }

  /** appControl setActiveApp with the app's URI (the id from listApps). */
  async launchApp(appId: string): Promise<void> {
    try {
      this.ensureConnected();
      const { ms } = await this.rpc('appControl', 'setActiveApp', [{ uri: appId }]);
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
        current = parsePlayingUri((await this.rpc('avContent', 'getPlayingContentInfo')).text);
      } catch {
        current = undefined; // an app is in front ("Illegal State") or unsupported
      }
      const text = (await this.rpc('avContent', 'getCurrentExternalInputsStatus', [], '1.1')).text;
      return parseExternalInputs(text, current);
    } catch (e) {
      return this.fail(e);
    }
  }

  /** avContent setPlayContent with the input URI (e.g. extInput:hdmi?port=1). */
  async setInput(inputId: string): Promise<void> {
    try {
      this.ensureConnected();
      const { ms } = await this.rpc('avContent', 'setPlayContent', [{ uri: inputId }]);
      this.events.emit({ type: 'sent', what: `INPUT ${inputId}`, ms });
    } catch (e) {
      this.fail(e);
    }
  }

  /** Speaker volume from audio getVolumeInformation. */
  async volume(): Promise<number> {
    try {
      this.ensureConnected();
      const v = parseVolume((await this.rpc('audio', 'getVolumeInformation')).text);
      if (!v) throw driverError('unsupported', 'core.driver.common.deviceNoVolume', { device: 'Sony TV' });
      return v.volume;
    } catch (e) {
      return this.fail(e);
    }
  }

  /** audio setAudioVolume: absolute ("25") or relative ("+1" / "-1"). */
  async setVolume(volume: number | `+${number}` | `-${number}`): Promise<void> {
    try {
      this.ensureConnected();
      const { ms } = await this.rpc('audio', 'setAudioVolume', [{ target: 'speaker', volume: String(volume) }]);
      this.events.emit({ type: 'sent', what: `VOLUME ${volume}`, ms });
    } catch (e) {
      this.fail(e);
    }
  }

  async setMute(mute: boolean): Promise<void> {
    try {
      this.ensureConnected();
      const { ms } = await this.rpc('audio', 'setAudioMute', [{ status: mute }]);
      this.events.emit({ type: 'sent', what: mute ? 'MUTE_ON' : 'MUTE_OFF', ms });
    } catch (e) {
      this.fail(e);
    }
  }

  /**
   * setPowerStatus true (works from standby when "Remote start" is on); falls back to
   * Wake-on-LAN when that request fails and a MAC is known. No connect needed.
   */
  async powerOn(): Promise<void> {
    try {
      await this.setPower(true);
    } catch (e) {
      const mac = this.opts.mac ?? this.info?.mac;
      if (mac && this.opts.wol) {
        await this.opts.wol(mac);
        this.events.emit({ type: 'sent', what: 'WOL', ms: 0 });
        return;
      }
      this.fail(e);
    }
  }
}
