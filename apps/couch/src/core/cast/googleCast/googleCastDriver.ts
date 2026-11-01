/**
 * Google Cast CastDriver (T106): casts a phone photo or video to a TV with Chromecast built in
 * (Google TV / Android TV) over CASTV2, using the Default Media Receiver app (CC1AD845). No Google
 * Cast SDK: the protocol is spoken directly over the injected TLS TcpFactory (channel.ts).
 *
 *   load():  connect (TLS :8009) -> receiver LAUNCH CC1AD845 -> RECEIVER_STATUS with the app's
 *            transportId + sessionId -> CONNECT to transportId -> media LOAD (autoplay)
 *   status:  MEDIA_STATUS PLAYING / PAUSED  -> playing / paused, confirmed: true (the TV itself says
 *            it is showing the media; the Cast tab only says "on the TV" then)
 *            BUFFERING / LOADING before that -> loading, confirmed: false
 *            IDLE + FINISHED -> stopped; IDLE + ERROR, LOAD_FAILED / LOAD_CANCELLED /
 *            INVALID_REQUEST -> error
 *   control: PLAY / PAUSE / SEEK(currentTime) by mediaSessionId; stop = media STOP, then receiver
 *            STOP of the app session, then the connection is closed.
 *   polling: media GET_STATUS every second while a video loads or plays.
 *
 * Only literal RFC 1918 hosts. All timers are injected (CastTimer). Reconstructed from public
 * protocol descriptions and tested against a scripted fake receiver only: NEVER tried on a real TV.
 */
import type { TcpFactory } from '../../driver';
import { driverError } from '../../drivers/errors';
import { isRfc1918Host } from '../../lanHost';
import { DriverError } from '../../types';
import { validateMedia, type CastMedia } from '../didl';
import type { CastDriver, CastTarget } from '../driver';
import { SYSTEM_TIMER, type CastSnapshot, type CastTimer } from '../session';
import {
  CastChannel,
  CastChannelError,
  NS_CONNECTION,
  NS_MEDIA,
  NS_RECEIVER,
  RECEIVER_ID,
  type CastJsonMessage,
  type CastPayload,
} from './channel';

/** The Default Media Receiver: Google's stock receiver app for plain media URLs. */
export const DEFAULT_MEDIA_RECEIVER_APP_ID = 'CC1AD845';
export const GCAST_LAUNCH_TIMEOUT_MS = 15_000;
export const GCAST_LOAD_TIMEOUT_MS = 20_000;
export const GCAST_CONTROL_TIMEOUT_MS = 5000;
export const GCAST_POLL_MS = 1000;
/** Cast metadataType: 0 generic media, 4 photo. */
export const GCAST_METADATA_GENERIC = 0;
export const GCAST_METADATA_PHOTO = 4;

const IDLE: CastSnapshot = {
  state: 'idle',
  media: null,
  positionSec: null,
  durationSec: null,
  error: null,
  errorCode: null,
};

const LOAD_ERRORS = new Set(['LOAD_FAILED', 'LOAD_CANCELLED', 'INVALID_REQUEST']);

interface AppSession {
  transportId: string;
  sessionId: string;
}

type Phase = 'connect' | 'launch' | 'load' | 'control';

/** The Default Media Receiver's transportId + sessionId from a RECEIVER_STATUS payload, if running. */
export function findReceiverApp(payload: CastPayload, appId = DEFAULT_MEDIA_RECEIVER_APP_ID): AppSession | null {
  const status = payload['status'] as { applications?: unknown } | undefined;
  const apps = status && Array.isArray(status.applications) ? (status.applications as unknown[]) : [];
  for (const a of apps) {
    if (!a || typeof a !== 'object') continue;
    const r = a as Record<string, unknown>;
    if (r['appId'] === appId && typeof r['transportId'] === 'string' && typeof r['sessionId'] === 'string') {
      return { transportId: r['transportId'], sessionId: r['sessionId'] };
    }
  }
  return null;
}

function receiverHasSession(payload: CastPayload, sessionId: string): boolean {
  const status = payload['status'] as { applications?: unknown } | undefined;
  const apps = status && Array.isArray(status.applications) ? (status.applications as unknown[]) : [];
  return apps.some((a) => !!a && typeof a === 'object' && (a as Record<string, unknown>)['sessionId'] === sessionId);
}

/** The media LOAD payload (without requestId). */
export function buildLoadPayload(media: CastMedia): CastPayload {
  return {
    type: 'LOAD',
    media: {
      contentId: media.url,
      contentType: media.mime,
      streamType: 'BUFFERED',
      metadata: {
        metadataType: media.kind === 'photo' ? GCAST_METADATA_PHOTO : GCAST_METADATA_GENERIC,
        title: media.title,
      },
    },
    autoplay: true,
    currentTime: 0,
  };
}

/** Any failure as the user-facing DriverError for the step it happened in. */
export function gcastError(e: unknown, phase: Phase): DriverError {
  if (e instanceof DriverError) return e;
  if (e instanceof CastChannelError) {
    if (e.reason === 'notLan') return driverError('forbidden', 'core.driver.cast.notLan');
    if (e.reason === 'timeout') {
      if (phase === 'connect') return driverError('timeout', 'core.driver.cast.gcast.connectFailed');
      if (phase === 'launch') return driverError('timeout', 'core.driver.cast.gcast.launchFailed');
      if (phase === 'load') return driverError('timeout', 'core.driver.cast.loadTimeout');
      return driverError('timeout', 'core.driver.cast.gcast.lost');
    }
    if (phase === 'connect') return withDetail(driverError('network', 'core.driver.cast.gcast.connectFailed'), e.message);
    return withDetail(driverError('network', 'core.driver.cast.gcast.lost'), e.message);
  }
  const detail = e instanceof Error ? e.message : String(e);
  if (phase === 'connect') return withDetail(driverError('network', 'core.driver.cast.gcast.connectFailed'), detail);
  return withDetail(driverError('network', 'core.driver.cast.gcast.lost'), detail);
}

/**
 * Appends the socket's own reason in brackets (owner 1 Nov 2026: the TCL Google TV refused the cast
 * connection and the message gave no clue why). Kept short; empty reasons add nothing.
 */
function withDetail(err: DriverError, detail: string): DriverError {
  const d = detail
    .replace(/\(at ExpoModulesCore[^)]*\)?/g, '')
    .replace(/The operation couldn.t be completed\.\s*/g, '')
    .replace(/Network\.NWError error /g, 'error ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return d ? new DriverError(err.code, `${err.message} (${d})`) : err;
}

export interface GoogleCastOptions {
  connectTimeoutMs?: number;
  /** Overrides the port (tests); real devices use 8009. */
  port?: number;
}

export function createGoogleCast(
  target: CastTarget,
  tcp: TcpFactory,
  timer: CastTimer = SYSTEM_TIMER,
  opts: GoogleCastOptions = {},
): CastDriver {
  let snap: CastSnapshot = IDLE;
  const subs = new Set<(s: CastSnapshot) => void>();
  let channel: CastChannel | null = null;
  let app: AppSession | null = null;
  let mediaSessionId: number | null = null;
  let loadRequestId: number | null = null;
  let poller: unknown = null;
  let gen = 0;
  let disposed = false;

  const set = (patch: Partial<CastSnapshot>): void => {
    const next = { ...snap, ...patch };
    const keys = Object.keys(next) as (keyof CastSnapshot)[];
    if (keys.length === Object.keys(snap).length && keys.every((k) => next[k] === snap[k])) return;
    snap = next;
    for (const cb of [...subs]) cb(next);
  };

  const stopPoll = (): void => {
    if (poller !== null) {
      timer.clearInterval(poller);
      poller = null;
    }
  };
  const poll = (): void => {
    const ch = channel;
    if (!ch || ch.closed || !app || mediaSessionId === null) return;
    try {
      ch.send(NS_MEDIA, app.transportId, { type: 'GET_STATUS', mediaSessionId, requestId: ch.newRequestId() });
    } catch {
      // onLost handles a dead channel
    }
  };
  const updatePoll = (): void => {
    const want = snap.media?.kind === 'video' && (snap.state === 'loading' || snap.state === 'playing') && channel !== null;
    if (want && poller === null) poller = timer.setInterval(poll, GCAST_POLL_MS);
    else if (!want) stopPoll();
  };

  /** The receiver app went away (closed on the TV, or another app took over). */
  const appGone = (): void => {
    app = null;
    mediaSessionId = null;
    if (snap.state === 'playing' || snap.state === 'paused') set({ state: 'stopped' });
    updatePoll();
  };

  const fail = (code: DriverError['code'], message: string): void => {
    set({ state: 'error', error: message, errorCode: code, confirmed: false });
    updatePoll();
  };

  const applyStatus = (entry: Record<string, unknown>): void => {
    const media = snap.media;
    if (!media) return;
    if (typeof entry['mediaSessionId'] === 'number') mediaSessionId = entry['mediaSessionId'];
    const patch: Partial<CastSnapshot> = {};
    if (media.kind === 'video') {
      const m = entry['media'] as { duration?: unknown } | undefined;
      if (m && typeof m.duration === 'number' && Number.isFinite(m.duration) && m.duration > 0) patch.durationSec = m.duration;
      const ct = entry['currentTime'];
      if (typeof ct === 'number' && Number.isFinite(ct) && ct >= 0) patch.positionSec = Math.floor(ct);
    }
    const ps = entry['playerState'];
    if (ps === 'PLAYING') Object.assign(patch, { state: 'playing', confirmed: true, error: null, errorCode: null });
    else if (ps === 'PAUSED') Object.assign(patch, { state: 'paused', confirmed: true, error: null, errorCode: null });
    else if (ps === 'BUFFERING' || ps === 'LOADING') {
      // Before the TV has confirmed, buffering is still "loading"; a re-buffer mid-play keeps the state.
      if (!snap.confirmed) Object.assign(patch, { state: 'loading', confirmed: false });
    } else if (ps === 'IDLE') {
      const reason = entry['idleReason'];
      if (reason === 'ERROR') {
        set(patch);
        const e = driverError('network', 'core.driver.cast.gcast.loadFailed');
        fail(e.code, e.message);
        return;
      }
      if (media.kind === 'video') {
        if (reason === 'FINISHED') {
          const dur = patch.durationSec ?? snap.durationSec;
          Object.assign(patch, { state: 'stopped', positionSec: dur ?? patch.positionSec ?? snap.positionSec });
        } else if (reason === 'CANCELLED' || reason === 'INTERRUPTED') {
          if (snap.state !== 'loading') patch.state = 'stopped';
        }
      } else if (!reason && entry['media'] && snap.state === 'loading') {
        // A photo has no timeline: a status that carries the loaded media means it is on screen.
        Object.assign(patch, { state: 'playing', confirmed: true });
      }
    }
    set(patch);
    updatePoll();
  };

  const onMessage = (m: CastJsonMessage): void => {
    const p = m.payload;
    if (m.namespace === NS_CONNECTION) {
      if (p.type === 'CLOSE' && app && m.sourceId === app.transportId) appGone();
      return;
    }
    if (m.namespace === NS_RECEIVER) {
      if (p.type === 'RECEIVER_STATUS' && app && m.sourceId === RECEIVER_ID && !receiverHasSession(p, app.sessionId)) appGone();
      return;
    }
    if (m.namespace !== NS_MEDIA || !app || m.sourceId !== app.transportId || p.type !== 'MEDIA_STATUS') return;
    const entries = Array.isArray(p['status']) ? (p['status'] as unknown[]) : [];
    const isLoadReply = loadRequestId !== null && p.requestId === loadRequestId;
    let matched = false;
    for (const raw of entries) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as Record<string, unknown>;
      const ours = isLoadReply || (mediaSessionId !== null && entry['mediaSessionId'] === mediaSessionId);
      if (!ours) continue;
      matched = true;
      applyStatus(entry);
    }
    // Nothing loaded any more (stopped from the TV's own remote, or another sender took over).
    if (!matched && !isLoadReply && entries.length === 0 && mediaSessionId !== null && (snap.state === 'playing' || snap.state === 'paused')) {
      mediaSessionId = null;
      set({ state: 'stopped' });
      updatePoll();
    }
  };

  const onLost = (ch: CastChannel): void => {
    if (ch !== channel) return;
    channel = null;
    app = null;
    mediaSessionId = null;
    stopPoll();
    if (snap.state === 'loading' || snap.state === 'playing' || snap.state === 'paused') {
      const e = driverError('network', 'core.driver.cast.gcast.lost');
      fail(e.code, e.message);
    }
  };

  const ensureChannel = async (): Promise<CastChannel> => {
    if (channel && !channel.closed) return channel;
    channel = null;
    app = null;
    mediaSessionId = null;
    const ch = await CastChannel.open(tcp, target.host, timer, { connectTimeoutMs: opts.connectTimeoutMs, port: opts.port });
    if (disposed) {
      ch.close();
      throw driverError('unsupported', 'core.driver.cast.notNow');
    }
    ch.onMessage(onMessage);
    ch.onClose(() => onLost(ch));
    channel = ch;
    return ch;
  };

  const ensureApp = async (ch: CastChannel): Promise<AppSession> => {
    if (app) return app;
    const requestId = ch.newRequestId();
    const wait = ch.waitFor(
      (m) =>
        m.namespace === NS_RECEIVER &&
        m.sourceId === RECEIVER_ID &&
        ((m.payload.type === 'RECEIVER_STATUS' && findReceiverApp(m.payload) !== null) ||
          (m.payload.requestId === requestId && m.payload.type !== 'RECEIVER_STATUS')),
      GCAST_LAUNCH_TIMEOUT_MS,
    );
    try {
      ch.send(NS_RECEIVER, RECEIVER_ID, { type: 'LAUNCH', appId: DEFAULT_MEDIA_RECEIVER_APP_ID, requestId });
    } catch (e) {
      wait.catch(() => undefined);
      throw e;
    }
    const reply = await wait;
    const found = reply.payload.type === 'RECEIVER_STATUS' ? findReceiverApp(reply.payload) : null;
    if (!found) throw driverError('unsupported', 'core.driver.cast.gcast.launchFailed');
    if (ch !== channel || ch.closed) throw new CastChannelError('closed', 'The cast connection is closed.');
    ch.connect(found.transportId);
    app = found;
    return found;
  };

  const ensureUsable = (): void => {
    if (disposed) throw driverError('unsupported', 'core.driver.cast.notNow');
  };

  const load = async (media: CastMedia): Promise<void> => {
    ensureUsable();
    if (!target.accepts[media.kind]) throw driverError('unsupported', 'core.driver.cast.formatUnsupported');
    validateMedia(media);
    if (!isRfc1918Host(target.host)) throw driverError('forbidden', 'core.driver.cast.notLan');
    const g = ++gen;
    stopPoll();
    mediaSessionId = null;
    loadRequestId = null;
    const dur = media.kind === 'video' && media.durationSec !== undefined && media.durationSec > 0 ? media.durationSec : null;
    set({ ...IDLE, state: 'loading', media, durationSec: dur, confirmed: false });
    let phase: Phase = 'connect';
    try {
      const ch = await ensureChannel();
      if (g !== gen) return;
      phase = 'launch';
      const a = await ensureApp(ch);
      if (g !== gen) return;
      phase = 'load';
      const requestId = ch.newRequestId();
      loadRequestId = requestId;
      const wait = ch.waitFor(
        (m) =>
          m.namespace === NS_MEDIA &&
          m.sourceId === a.transportId &&
          m.payload.requestId === requestId &&
          (m.payload.type === 'MEDIA_STATUS' || LOAD_ERRORS.has(String(m.payload.type))),
        GCAST_LOAD_TIMEOUT_MS,
      );
      try {
        ch.send(NS_MEDIA, a.transportId, { ...buildLoadPayload(media), requestId });
      } catch (e) {
        wait.catch(() => undefined);
        throw e;
      }
      const reply = await wait;
      if (g !== gen) return;
      if (reply.payload.type !== 'MEDIA_STATUS') throw driverError('unsupported', 'core.driver.cast.gcast.loadFailed');
      // The channel listener has already applied the reply's status (listeners run before waiters).
      if (snap.state === 'error') throw new DriverError(snap.errorCode ?? 'network', snap.error ?? '');
      updatePoll();
    } catch (e) {
      const err = gcastError(e, phase);
      if (g === gen) {
        stopPoll();
        set({ state: 'error', error: err.message, errorCode: err.code, confirmed: false });
      }
      throw err;
    } finally {
      if (g === gen) loadRequestId = null;
    }
  };

  /** One media command on the current media session. */
  const control = async (type: string, extra: Record<string, unknown> = {}): Promise<void> => {
    const ch = channel;
    const a = app;
    if (!ch || ch.closed || !a || mediaSessionId === null) throw driverError('unsupported', 'core.driver.cast.notNow');
    let reply: CastJsonMessage;
    try {
      reply = await ch.request(NS_MEDIA, a.transportId, { type, mediaSessionId, ...extra }, GCAST_CONTROL_TIMEOUT_MS);
    } catch (e) {
      throw gcastError(e, 'control');
    }
    if (reply.payload.type !== 'MEDIA_STATUS') throw driverError('unsupported', 'core.driver.cast.notNow');
  };

  return {
    target,
    load,
    async play() {
      ensureUsable();
      const media = snap.media;
      if (!media || media.kind === 'photo') return;
      if (snap.state === 'paused') {
        const g = gen;
        await control('PLAY');
        if (g === gen && snap.state === 'paused') set({ state: 'playing' });
        updatePoll();
      } else if (snap.state === 'stopped' || snap.state === 'error') {
        await load(media);
      }
    },
    async pause() {
      ensureUsable();
      if (snap.media?.kind !== 'video' || snap.state === 'paused') return;
      if (snap.state !== 'playing') throw driverError('unsupported', 'core.driver.cast.notNow');
      const g = gen;
      await control('PAUSE');
      if (g === gen && snap.state === 'playing') set({ state: 'paused' });
      updatePoll();
    },
    async seek(positionSec: number) {
      ensureUsable();
      if (snap.media?.kind !== 'video') return;
      const max = snap.durationSec ?? Number.POSITIVE_INFINITY;
      const to = Math.max(0, Math.min(Number.isFinite(positionSec) ? positionSec : 0, max));
      const g = gen;
      await control('SEEK', { currentTime: to });
      if (g === gen) set({ positionSec: Math.floor(to) });
    },
    async stop() {
      ensureUsable();
      if (snap.state === 'idle' || snap.state === 'stopped') return;
      gen += 1;
      loadRequestId = null;
      stopPoll();
      const ch = channel;
      const a = app;
      const msid = mediaSessionId;
      try {
        if (ch && !ch.closed && a) {
          if (msid !== null) {
            await ch.request(NS_MEDIA, a.transportId, { type: 'STOP', mediaSessionId: msid }, GCAST_CONTROL_TIMEOUT_MS).catch(() => undefined);
          }
          try {
            await ch.request(NS_RECEIVER, RECEIVER_ID, { type: 'STOP', sessionId: a.sessionId }, GCAST_CONTROL_TIMEOUT_MS);
          } catch (e) {
            throw gcastError(e, 'control');
          }
        }
      } finally {
        app = null;
        mediaSessionId = null;
        if (channel) {
          const c = channel;
          channel = null;
          c.close();
        }
        set({ state: 'stopped' });
      }
    },
    snapshot: () => snap,
    subscribe(listener) {
      subs.add(listener);
      return () => {
        subs.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      gen += 1;
      stopPoll();
      const c = channel;
      channel = null;
      app = null;
      c?.close();
      subs.clear();
    },
  };
}
