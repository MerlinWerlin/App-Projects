/**
 * Add-TV flow as a pure state machine (reducer) plus the async helpers around it:
 *   scanning -> list(candidates) -> pair step per platform -> name + room -> saved.
 *
 * Scan first (owner feedback 12 Oct): the flow opens scanning and lists TVs as they appear. Typing an
 * address ('manual') is a last-resort step reached only from the "Still not listed? Enter its
 * address" link. The 'ir' step is the "Older TV, or not on Wi-Fi?" row: the screen routes it to
 * ADD_TV_IR_ROUTE. New TVs get the default name "TV n" (next unused number), editable.
 *
 * Pair steps: Roku none; Samsung / LG 'prompt' (press Allow on the TV); Google TV a 6-character hex
 * code; Fire TV a 4-digit PIN; Sony Bravia a Pre-Shared Key the user sets on the TV ('psk', stored as Tv.token). Which platforms can be controlled depends on the transport: Roku needs
 * fetch, Samsung needs fetch + a WebSocket factory (the lan-wss native module, dev builds only), the
 * demo MockTv needs nothing. Everything else is found but shown as "coming soon". Tested end to end
 * against MockTv and fixtures, not real TVs.
 */
import { t } from '../i18n/core';
import { withCopy } from '../i18n/lazyCopy';
import type { TvCandidate } from './discovery';
import type { Transport, TvDriver } from './driver';
import { IrDriver } from './drivers/ir';
import { MockTv, type MockTvOptions } from './drivers/mock';
import { RokuDriver } from './drivers/roku';
import { SamsungDriver, type SamsungDriverOptions } from './drivers/samsung';
import { SonyDriver, type SonyDriverOptions } from './drivers/sony';
import { WebOsDriver, type WebOsDriverOptions } from './drivers/webos';
import { codeSetFor } from './ir/codes';
import { parseManualIp } from './probe';
import type { RemoteSession } from './session';
import type { SavedTvStore } from './store';
import { DriverError, PLATFORM_LABEL, type Platform, type Tv } from './types';

/** A found TV. `pairAs` lets demo (mock) candidates walk through another platform's pair step. */
export type AddCandidate = TvCandidate & { pairAs?: Platform };

export type PairStep =
  | { kind: 'none' }
  | { kind: 'prompt'; message: string }
  | { kind: 'code'; length: number; charset: 'hex' | 'digits'; message: string }
  | { kind: 'psk'; message: string };

/** Samsung / LG: the TV shows an Allow prompt. In the active language. */
export function promptMessage(): string {
  return t('core.addTv.prompt');
}

/** Sony Bravia: the user sets a Pre-Shared Key on the TV and types the same key here. Menu path may differ by model. */
export function pskMessage(): string {
  return t('core.addTv.psk');
}

/** Shown when the Sony TV refuses the typed key (DriverError 'forbidden'). */
export function pskRejected(): string {
  return t('core.addTv.pskRejected');
}

export function pairStepFor(platform: Platform): PairStep {
  switch (platform) {
    case 'samsung':
    case 'webos':
      return { kind: 'prompt', message: promptMessage() };
    case 'androidtv':
      return { kind: 'code', length: 6, charset: 'hex', message: t('core.addTv.enterCode') };
    case 'firetv':
      return { kind: 'code', length: 4, charset: 'digits', message: t('core.addTv.enterPin') };
    case 'sony':
      return { kind: 'psk', message: pskMessage() };
    default:
      return { kind: 'none' };
  }
}

export function candidatePairStep(c: AddCandidate): PairStep {
  return pairStepFor(c.pairAs ?? c.platform);
}

/** Normalises what the user typed into a code field (upper-case hex, or digits only), capped at length. */
export function normalizeCode(input: string, step: Extract<PairStep, { kind: 'code' }>): string {
  const s = step.charset === 'hex' ? input.toUpperCase().replace(/[^0-9A-F]/g, '') : input.replace(/[^0-9]/g, '');
  return s.slice(0, step.length);
}

export function isCodeComplete(code: string, step: Extract<PairStep, { kind: 'code' }>): boolean {
  return normalizeCode(code, step) === code && code.length === step.length;
}

/** Platforms that have a driver. Whether one can be used right now also depends on the transport. */
export const SUPPORTED_PLATFORMS: ReadonlySet<Platform> = new Set<Platform>(['mock', 'roku', 'samsung', 'webos', 'sony']);

/** Which transport adapters are present (what the reducer needs to know; it never holds the adapters). */
export interface TransportCaps {
  fetch: boolean;
  ws: boolean;
}

export function transportCaps(t: Transport): TransportCaps {
  return { fetch: typeof t.fetch === 'function', ws: typeof t.ws === 'function' };
}

/** Caps assumed when none were given: fetch only (Expo Go, no native WebSocket module). */
export const FETCH_ONLY_CAPS: TransportCaps = { fetch: true, ws: false };

function isCaps(t: Transport | TransportCaps): t is TransportCaps {
  return typeof t.fetch === 'boolean';
}

/**
 * True when Couch can control this platform with the given transport: mock always, Roku with fetch,
 * Samsung with fetch + ws, LG webOS with ws, Sony with fetch. Without a transport, FETCH_ONLY_CAPS is assumed.
 */
export function isSupported(platform: Platform, transport: Transport | TransportCaps = FETCH_ONLY_CAPS): boolean {
  const caps = isCaps(transport) ? transport : transportCaps(transport);
  switch (platform) {
    case 'mock':
      return true;
    case 'roku':
      return caps.fetch;
    case 'samsung':
      return caps.fetch && caps.ws;
    case 'webos':
      return caps.ws;
    case 'sony':
      return caps.fetch;
    default:
      return false;
  }
}

export function comingSoonMessage(platform: Platform): string {
  return t('core.addTv.comingSoon', { platform: PLATFORM_LABEL[platform] });
}

/**
 * Driver factory: 'mock' -> MockTv; 'roku' -> RokuDriver (needs transport.fetch); 'samsung' ->
 * SamsungDriver (needs transport.fetch and transport.ws); 'webos' -> WebOsDriver (needs transport.ws);
 * 'sony' -> SonyDriver (needs transport.fetch and the Pre-Shared Key saved as tv.token); 'ir' -> IrDriver from the saved irBrand/irSet
 * (needs transport.ir); anything else, or a missing adapter ->
 * null, which the UI shows as "coming soon". Never throws.
 */
export function driverFor(
  tv: Pick<Tv, 'platform' | 'host'> & Partial<Pick<Tv, 'token' | 'mac' | 'irBrand' | 'irSet'>>,
  transport: Transport,
  opts: { mock?: MockTvOptions } = {},
): TvDriver | null {
  try {
    switch (tv.platform) {
      case 'mock':
        return new MockTv(opts.mock);
      case 'roku':
        return transport.fetch ? new RokuDriver({ host: tv.host, fetch: transport.fetch }) : null;
      case 'samsung': {
        if (!transport.fetch || !transport.ws) return null;
        const o: SamsungDriverOptions = { host: tv.host, fetch: transport.fetch, ws: transport.ws };
        if (tv.token) o.token = tv.token;
        if (tv.mac) o.mac = tv.mac;
        return new SamsungDriver(o);
      }
      case 'webos': {
        // LG webOS (T09): SSAP over the lan-wss socket only; client-key is stored as Tv.token.
        if (!transport.ws) return null;
        const o: WebOsDriverOptions = { host: tv.host, ws: transport.ws };
        if (tv.token) o.clientKey = tv.token;
        if (tv.mac) o.mac = tv.mac;
        return new WebOsDriver(o);
      }
      case 'sony': {
        // Sony Bravia (T30): JSON-RPC over HTTP; the Pre-Shared Key is stored as Tv.token.
        if (!transport.fetch || !tv.token) return null;
        const o: SonyDriverOptions = { host: tv.host, fetch: transport.fetch, psk: tv.token };
        if (tv.mac) o.mac = tv.mac;
        return new SonyDriver(o);
      }
      case 'ir': {
        // Rebuilt from the saved (irBrand, irSet); null without an emitter or when the set is gone.
        if (!transport.ir || typeof tv.irBrand !== 'string' || typeof tv.irSet !== 'number') return null;
        const set = codeSetFor(tv.irBrand, tv.irSet);
        return set ? new IrDriver(set, transport.ir) : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** Stable id for a candidate: platform + USN when known, else platform + IP. */
export function tvIdFor(c: TvCandidate): string {
  const key = (c.usn ?? c.host).replace(/[^A-Za-z0-9._:-]/g, '_');
  return `${c.platform}-${key}`;
}

/** Human description of a found TV (announced name or model). */
export function describeCandidate(c: TvCandidate): string {
  return (c.name ?? c.model ?? platformTv(c.platform)).trim();
}

/** "Roku TV", "Demo TV": the generic name for a TV of a platform. */
function platformTv(platform: Platform): string {
  return t('core.addTv.platformTv', { platform: PLATFORM_LABEL[platform] });
}

const TV_N = /^tv\s*(\d+)$/i;

/** Default name for a new TV: "TV n" with the smallest n >= 1 not already used by a saved TV. */
export function nextTvName(existingNames: Iterable<string>): string {
  const used = new Set<number>();
  for (const name of existingNames) {
    const m = TV_N.exec(name.trim());
    if (m) used.add(Number(m[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `TV ${n}`;
}

/**
 * Whether the add-TV list offers the "Older TV, or not on Wi-Fi?" infrared row. iPhones have no IR
 * emitter, so it is hidden there (oversight D6-2); on Android the IR screen itself says when the
 * phone or build has no emitter (Expo Go). `os` is react-native Platform.OS.
 */
export function irSetupOffered(os: string): boolean {
  return os === 'android';
}

/** Route of the infrared setup screen (app/add-tv-ir.tsx). */
export const ADD_TV_IR_ROUTE = '/add-tv-ir';

// ---------------------------------------------------------------------------------------------
// State machine

/**
 * Fields every step carries. `taken`: names of TVs already saved (for the "TV n" default).
 * `caps`: which transport adapters exist (decides "coming soon"); FETCH_ONLY_CAPS when absent.
 */
export interface AddTvBase {
  candidates: AddCandidate[];
  taken?: string[];
  caps?: TransportCaps;
}

export type AddTvState = AddTvBase &
  (
    | { step: 'scanning' }
    | { step: 'list' }
    | { step: 'manual'; ip: string; error: string | null; probing: boolean }
    | { step: 'ir' }
    | { step: 'unsupported'; candidate: AddCandidate; message: string }
    | { step: 'pair'; candidate: AddCandidate; pair: PairStep; code: string; error: string | null }
    | {
      step: 'name';
      candidate: AddCandidate;
      pair: PairStep;
      name: string;
      room: string;
      token?: string;
      error: string | null;
      saving: boolean;
    }
    | { step: 'saved'; tv: Tv }
  );

export type AddTvEvent =
  | { type: 'found'; candidate: AddCandidate }
  | { type: 'scanDone' }
  | { type: 'rescan' }
  | { type: 'manual' }
  | { type: 'ir' }
  | { type: 'takenNames'; names: string[] }
  | { type: 'ipChanged'; ip: string }
  | { type: 'ipSubmit' }
  | { type: 'probeResult'; candidate: AddCandidate | null }
  | { type: 'pick'; host: string }
  | { type: 'codeChanged'; code: string }
  | { type: 'paired'; token?: string }
  | { type: 'nameChanged'; name: string }
  | { type: 'roomChanged'; room: string }
  | { type: 'save' }
  /** `retryPair`: the pairing itself was refused (wrong Sony key): go back to the pair step with the error. */
  | { type: 'saveFailed'; message: string; retryPair?: boolean }
  | { type: 'saved'; tv: Tv }
  | { type: 'back' };

export const initialAddTvState: AddTvState = { step: 'scanning', candidates: [] };

/** Start state: scanning straight away, knowing the saved TV names and the transport. */
export function createAddTvState(opts: { takenNames?: Iterable<string>; transport?: Transport } = {}): AddTvState {
  const s: AddTvState = { step: 'scanning', candidates: [] };
  if (opts.takenNames) s.taken = [...opts.takenNames];
  if (opts.transport) s.caps = transportCaps(opts.transport);
  return s;
}

/** Where the screen should navigate for this state, or null to stay. */
export function routeFor(s: AddTvState): string | null {
  return s.step === 'ir' ? ADD_TV_IR_ROUTE : null;
}

/** The shared fields of `s`, optionally with new candidates (keeps taken names and caps across steps). */
function base(s: AddTvState, candidates: AddCandidate[] = s.candidates): AddTvBase {
  const b: AddTvBase = { candidates };
  if (s.taken) b.taken = s.taken;
  if (s.caps) b.caps = s.caps;
  return b;
}

function addCandidate(list: AddCandidate[], c: AddCandidate): AddCandidate[] {
  return list.some((x) => x.host === c.host) ? list : [...list, c];
}

function toPair(s: AddTvState, candidates: AddCandidate[], c: AddCandidate): AddTvState {
  if (!isSupported(c.platform, s.caps ?? FETCH_ONLY_CAPS))
    return { ...base(s, candidates), step: 'unsupported', candidate: c, message: comingSoonMessage(c.platform) };
  return { ...base(s, candidates), step: 'pair', candidate: c, pair: candidatePairStep(c), code: '', error: null };
}

function toName(s: Extract<AddTvState, { step: 'pair' }>, token: string | undefined): AddTvState {
  const next: AddTvState = {
    ...base(s),
    step: 'name',
    candidate: s.candidate,
    pair: s.pair,
    name: nextTvName(s.taken ?? []),
    room: '',
    error: null,
    saving: false,
  };
  if (token !== undefined) next.token = token;
  return next;
}

/** Pure reducer: never performs I/O. Unknown events for a step leave the state unchanged. */
export function addTvReducer(s: AddTvState, e: AddTvEvent): AddTvState {
  switch (e.type) {
    case 'found':
      return { ...s, candidates: addCandidate(s.candidates, e.candidate) } as AddTvState;
    case 'takenNames': {
      const taken = [...(s.taken ?? [])];
      for (const n of e.names) if (!taken.includes(n)) taken.push(n);
      const next = { ...s, taken } as AddTvState;
      // Refresh the default name while the user has not edited it.
      if (next.step === 'name' && s.step === 'name' && !s.saving && s.name === nextTvName(s.taken ?? [])) next.name = nextTvName(taken);
      return next;
    }
    case 'scanDone':
      return s.step === 'scanning' ? { ...base(s), step: 'list' } : s;
    case 'rescan':
      return { ...base(s, []), step: 'scanning' };
    // Last resort, reached only from the "Still not listed? Enter its address" link.
    case 'manual':
      return s.step === 'scanning' || s.step === 'list' || s.step === 'unsupported'
        ? { ...base(s), step: 'manual', ip: '', error: null, probing: false }
        : s;
    // "Older TV, or not on Wi-Fi?": the screen routes this step to ADD_TV_IR_ROUTE (see routeFor).
    case 'ir':
      return s.step === 'scanning' || s.step === 'list' || s.step === 'unsupported' ? { ...base(s), step: 'ir' } : s;
    case 'ipChanged':
      return s.step === 'manual' ? { ...s, ip: e.ip, error: null } : s;
    case 'ipSubmit': {
      if (s.step !== 'manual' || s.probing) return s;
      const r = parseManualIp(s.ip);
      return r.ok ? { ...s, ip: r.host, error: null, probing: true } : { ...s, error: r.error };
    }
    case 'probeResult': {
      if (s.step !== 'manual') return s;
      if (!e.candidate)
        return { ...s, probing: false, error: t('core.addTv.noAnswer') };
      const c: AddCandidate = { ...e.candidate, source: 'manual' };
      return toPair(s, addCandidate(s.candidates, c), c);
    }
    case 'pick': {
      if (s.step !== 'list' && s.step !== 'scanning') return s;
      const c = s.candidates.find((x) => x.host === e.host);
      return c ? toPair(s, s.candidates, c) : s;
    }
    case 'codeChanged':
      if (s.step !== 'pair') return s;
      if (s.pair.kind === 'code') return { ...s, code: normalizeCode(e.code, s.pair), error: null };
      // Pre-Shared Key: kept as typed (the TV compares it verbatim), capped to a sane length.
      if (s.pair.kind === 'psk') return { ...s, code: e.code.slice(0, 64), error: null };
      return s;
    case 'paired': {
      if (s.step !== 'pair') return s;
      if (s.pair.kind === 'psk') {
        const key = s.code.trim();
        if (key === '') return { ...s, error: t('core.addTv.pskEmpty') };
        return toName(s, key);
      }
      if (s.pair.kind === 'code' && !isCodeComplete(s.code, s.pair)) {
        const key = s.pair.charset === 'hex' ? 'core.addTv.codeIncomplete' : 'core.addTv.pinIncomplete';
        return { ...s, error: t(key, { count: s.pair.length }) };
      }
      return toName(s, e.token);
    }
    case 'nameChanged':
      return s.step === 'name' ? { ...s, name: e.name, error: null } : s;
    case 'roomChanged':
      return s.step === 'name' ? { ...s, room: e.room } : s;
    case 'save':
      if (s.step !== 'name' || s.saving) return s;
      if (s.name.trim() === '') return { ...s, error: t('core.addTv.nameEmpty') };
      return { ...s, saving: true, error: null };
    case 'saveFailed':
      if (s.step !== 'name') return s;
      if (e.retryPair && s.pair.kind === 'psk')
        return { ...base(s), step: 'pair', candidate: s.candidate, pair: s.pair, code: s.token ?? '', error: e.message };
      return { ...s, saving: false, error: e.message };
    case 'saved': {
      const b = base(s);
      b.taken = [...(s.taken ?? []), e.tv.name];
      return { ...b, step: 'saved', tv: e.tv };
    }
    case 'back':
      switch (s.step) {
        case 'manual':
        case 'ir':
        case 'unsupported':
        case 'pair':
          return { ...base(s), step: 'list' };
        case 'name':
          if (s.saving) return s;
          if (s.pair.kind === 'none') return { ...base(s), step: 'list' };
          // A typed Pre-Shared Key is kept so the user can correct it rather than retype it.
          return { ...base(s), step: 'pair', candidate: s.candidate, pair: s.pair, code: s.pair.kind === 'psk' ? (s.token ?? '') : '', error: null };
        default:
          return s;
      }
  }
}

/** The TV record the name step will save. */
export function tvFromNameStep(s: Extract<AddTvState, { step: 'name' }>, now: number): Tv {
  const c = s.candidate;
  const tv: Tv = {
    id: tvIdFor(c),
    name: s.name.trim(),
    model: c.model ?? c.name ?? platformTv(c.platform),
    platform: c.platform,
    host: c.host,
    lastSeen: now,
  };
  const room = s.room.trim();
  if (room) tv.room = room;
  if (s.token) tv.token = s.token;
  return tv;
}

export interface FinishDeps {
  transport: Transport;
  session: RemoteSession;
  store?: SavedTvStore | null;
  now?: () => number;
  mock?: MockTvOptions;
  /** How the TV joins the session; defaults to `session.add` (the app passes its addTv helper). */
  addToSession?: (session: RemoteSession, tv: Tv, driver: TvDriver) => void;
}

/**
 * Completes a 'name' step that has `saving: true`: builds the driver, connects, records the MAC
 * when the driver learns it (Roku device-info), saves to the store, and makes the TV active.
 * Returns the event to dispatch ('saved' or 'saveFailed'); never throws.
 */
export async function finishAddTv(s: Extract<AddTvState, { step: 'name' }>, deps: FinishDeps): Promise<AddTvEvent> {
  const now = deps.now ?? Date.now;
  const tv = tvFromNameStep(s, now());
  const driver = driverFor(tv, deps.transport, deps.mock ? { mock: deps.mock } : {});
  if (!driver) return { type: 'saveFailed', message: comingSoonMessage(tv.platform) };
  try {
    await driver.connect();
  } catch (e) {
    if (tv.platform === 'sony' && e instanceof DriverError && (e.code === 'forbidden' || e.code === 'pair_required'))
      return { type: 'saveFailed', message: pskRejected(), retryPair: true };
    return { type: 'saveFailed', message: e instanceof Error ? e.message : String(e) };
  }
  if (driver instanceof RokuDriver && driver.info?.mac) tv.mac = driver.info.mac;
  if (driver instanceof SamsungDriver) {
    // The TV hands out a token once Allow is pressed; keep it so later connects skip the prompt.
    if (driver.token) tv.token = driver.token;
    if (driver.info?.wifiMac) tv.mac = driver.info.wifiMac;
  }
  if (driver instanceof WebOsDriver && driver.clientKey) tv.token = driver.clientKey;
  // Sony: getSystemInformation reports macAddr (used for Wake-on-LAN later). The PSK is already tv.token.
  if (driver instanceof SonyDriver && driver.info?.mac) tv.mac = driver.info.mac;
  try {
    if (deps.store) {
      await deps.store.add(tv);
      await deps.store.setLastUsed(tv.id);
    }
  } catch {
    // Saving is best effort; the TV still works for this session.
  }
  if (deps.addToSession) deps.addToSession(deps.session, tv, driver);
  else deps.session.add(tv, driver);
  return { type: 'saved', tv };
}

// ---------------------------------------------------------------------------------------------
// Demo scan (Expo Go / demo mode): fake candidates so the whole flow runs against MockTv.

/** Models translate on read; demoScan copies them in the active language. */
export const DEMO_CANDIDATES: readonly AddCandidate[] = [
  withCopy({ platform: 'mock', pairAs: 'samsung', host: '192.168.1.41', model: '', source: 'probe' } as AddCandidate, { model: 'core.addTv.demoAllow' }),
  withCopy({ platform: 'mock', pairAs: 'androidtv', host: '192.168.1.60', model: '', source: 'probe' } as AddCandidate, { model: 'core.addTv.demoCode' }),
  withCopy({ platform: 'mock', pairAs: 'roku', host: '192.168.1.33', model: '', source: 'probe' } as AddCandidate, { model: 'core.demo.streamingStick' }),
  withCopy({ platform: 'mock', pairAs: 'firetv', host: '192.168.1.71', model: '', source: 'probe' } as AddCandidate, { model: 'core.addTv.demoPin' }),
];

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Reveals DEMO_CANDIDATES one by one (prototype: every 450 ms). */
export async function demoScan(
  onFound: (c: AddCandidate) => void,
  opts: { delayMs?: number; sleep?: (ms: number) => Promise<void>; isCancelled?: () => boolean } = {},
): Promise<AddCandidate[]> {
  const sleep = opts.sleep ?? defaultSleep;
  const out: AddCandidate[] = [];
  for (const c of DEMO_CANDIDATES) {
    await sleep(opts.delayMs ?? 450);
    if (opts.isCancelled?.()) break;
    const copy = { ...c };
    out.push(copy);
    onFound(copy);
  }
  return out;
}

/** "Found N TVs" / "Found 1 TV" / "No TVs found". */
export function foundLabel(n: number): string {
  return t('core.addTv.found', { count: n });
}
