/**
 * Roku media player CastDriver (cast-1024, T89), over ECP (plain HTTP on port 8060).
 *
 * Loading uses the "PlayOnRoku" input of Roku's built-in media player channel (id 15985):
 *
 *   POST http://<host>:8060/input/15985?t=v&u=<url>&k=&videoName=<title>&videoFormat=mp4   (video)
 *   POST http://<host>:8060/input/15985?t=p&u=<url>&k=                                     (photo)
 *
 * That form comes from COMMUNITY documentation, not from Roku's official ECP reference, and is
 * UNVERIFIED on hardware. Play/pause is the ECP `Play` keypress (a toggle, so the state is tracked
 * here), stop is the `Back` keypress, and seek is not offered (ECP has no absolute seek).
 *
 * ECP reports nothing about the media player, so there is no polling: state is local. While a
 * video plays, the position is an estimate from the phone's clock; when the media carries a
 * duration, the cast is marked 'stopped' a few seconds after the estimated end so the queue can
 * advance. A Roku that buffers will drift from this estimate.
 *
 * Tested against fake fetch only; never tried on a real Roku.
 */
import type { FetchLike } from '../driver';
import { driverError } from '../drivers/errors';
import { ROKU_ECP_PORT, ROKU_MOBILE_CONTROL_HELP } from '../drivers/roku';
import { isRfc1918Host } from '../lanHost';
import { validateMedia, type CastMedia } from './didl';
import type { CastDriver, CastTarget } from './driver';
import { SYSTEM_TIMER, type CastSnapshot, type CastTimer } from './session';

/** Channel id of the Roku media player ("PlayOnRoku" input), from community docs. */
export const ROKU_MEDIA_PLAYER_ID = '15985';
/** Seconds after the estimated end of a video before it counts as finished. */
export const ROKU_END_GRACE_SEC = 3;
const TICK_MS = 1000;

const IDLE: CastSnapshot = {
  state: 'idle',
  media: null,
  positionSec: null,
  durationSec: null,
  error: null,
  errorCode: null,
};

/** ECP videoFormat for a MIME type (mp4 unless the type says otherwise). */
export function rokuVideoFormat(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'video/x-matroska') return 'mkv';
  if (m === 'video/quicktime') return 'mov';
  if (m === 'application/x-mpegurl' || m === 'application/vnd.apple.mpegurl') return 'hls';
  return 'mp4';
}

/** Path + query of the PlayOnRoku input for `media` (community-documented form, unverified). */
export function rokuPlayPath(media: CastMedia): string {
  const u = encodeURIComponent(media.url);
  if (media.kind === 'photo') return `/input/${ROKU_MEDIA_PLAYER_ID}?t=p&u=${u}&k=`;
  return (
    `/input/${ROKU_MEDIA_PLAYER_ID}?t=v&u=${u}&k=` +
    `&videoName=${encodeURIComponent(media.title)}&videoFormat=${rokuVideoFormat(media.mime)}`
  );
}

/** `<player error="false" state="play">` from ECP /query/media-player, or null when unreadable. */
export function parseRokuMediaPlayer(xml: string): { state: string; error: boolean } | null {
  const tag = /<player\b([^>]*)>/i.exec(xml);
  if (!tag) return null;
  const attr = (name: string): string | null => {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag[1]!);
    return m ? m[1]! : null;
  };
  return { state: (attr('state') ?? '').toLowerCase(), error: (attr('error') ?? '').toLowerCase() === 'true' };
}

function isTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === 'AbortError' || e.name === 'TimeoutError' || /time(d)?\s?out/i.test(e.message);
}

export function createRokuCast(target: CastTarget, fetch: FetchLike, timer: CastTimer = SYSTEM_TIMER): CastDriver {
  const base = `http://${target.host}:${ROKU_ECP_PORT}`;
  let snap: CastSnapshot = IDLE;
  const subs = new Set<(s: CastSnapshot) => void>();
  let ticker: unknown = null;
  let confirmPoll: unknown = null;
  let confirmTries = 0;
  let posBase = 0;
  let playStartedAt = 0;
  let gen = 0;
  let disposed = false;

  const set = (patch: Partial<CastSnapshot>): void => {
    const next = { ...snap, ...patch };
    const keys = Object.keys(next) as (keyof CastSnapshot)[];
    if (keys.every((k) => next[k] === snap[k])) return;
    snap = next;
    for (const cb of [...subs]) cb(next);
  };
  const stopTicker = (): void => {
    if (ticker !== null) {
      timer.clearInterval(ticker);
      ticker = null;
    }
  };
  const estimate = (): number => posBase + Math.max(0, timer.now() - playStartedAt) / 1000;
  const tick = (): void => {
    if (snap.state !== 'playing' || snap.media?.kind !== 'video') return;
    const pos = estimate();
    const dur = snap.durationSec;
    if (dur !== null && pos >= dur + ROKU_END_GRACE_SEC) {
      stopTicker();
      set({ state: 'stopped', positionSec: dur });
    } else {
      set({ positionSec: Math.floor(dur !== null ? Math.min(pos, dur) : pos) });
    }
  };
  const stopConfirm = (): void => {
    if (confirmPoll !== null) {
      timer.clearInterval(confirmPoll);
      confirmPoll = null;
    }
  };
  /**
   * Owner brief 25 Oct 2026: ask the Roku media player whether it is really showing the item
   * (ECP GET /query/media-player, from Roku's ECP reference; unverified on hardware). play/pause
   * confirms it; error="true" ends it with an honest error. Gives up quietly after 30 tries; the
   * Cast tab's own deadline then says the TV never showed it.
   */
  const pollConfirm = async (g: number): Promise<void> => {
    if (g !== gen || disposed) return stopConfirm();
    confirmTries += 1;
    if (confirmTries > 30) return stopConfirm();
    try {
      const res = await fetch(`${base}/query/media-player`, { method: 'GET', timeoutMs: 3000 });
      if (g !== gen || !res.ok) return;
      const info = parseRokuMediaPlayer(await res.text());
      if (g !== gen || !info) return;
      if (info.error) {
        stopConfirm();
        stopTicker();
        const e = driverError('network', 'core.driver.cast.notShown', { name: target.name });
        set({ state: 'error', error: e.message, errorCode: e.code, confirmed: false });
      } else if (info.state === 'play' || info.state === 'pause') {
        stopConfirm();
        set({ confirmed: true });
      }
    } catch {
      // keep trying until the limit; the Cast tab deadline covers a Roku that never answers
    }
  };
  const startConfirm = (g: number): void => {
    stopConfirm();
    confirmTries = 0;
    confirmPoll = timer.setInterval(() => {
      void pollConfirm(g);
    }, 1500);
  };
  const startTicker = (): void => {
    stopTicker();
    ticker = timer.setInterval(tick, TICK_MS);
  };

  const post = async (path: string): Promise<void> => {
    if (!isRfc1918Host(target.host)) throw driverError('forbidden', 'core.driver.cast.notLan');
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await fetch(base + path, { method: 'POST', body: '', timeoutMs: 5000 });
    } catch (e) {
      if (isTimeoutError(e)) throw driverError('timeout', 'core.driver.common.deviceTimeout', { device: 'Roku' });
      throw driverError('network', 'core.driver.common.deviceUnreachable', { device: 'Roku' });
    }
    if (res.status === 403) throw driverError('forbidden', ROKU_MOBILE_CONTROL_HELP);
    if (res.status === 404) throw driverError('unsupported', 'core.driver.cast.actionUnsupported');
    if (!res.ok) throw driverError('network', 'core.driver.common.deviceHttp', { device: 'Roku', status: String(res.status) });
  };
  const ensureUsable = (): void => {
    if (disposed) throw driverError('unsupported', 'core.driver.cast.notNow');
  };

  const load = async (media: CastMedia): Promise<void> => {
    ensureUsable();
    if (!target.accepts[media.kind]) throw driverError('unsupported', 'core.driver.cast.formatUnsupported');
    validateMedia(media);
    const g = ++gen;
    stopTicker();
    const dur = media.kind === 'video' && media.durationSec !== undefined && media.durationSec > 0 ? media.durationSec : null;
    set({ ...IDLE, state: 'loading', media, durationSec: dur });
    try {
      await post(rokuPlayPath(media));
    } catch (e) {
      if (g === gen) {
        const err = e as { code?: CastSnapshot['errorCode']; message?: string };
        set({ state: 'error', error: err.message ?? null, errorCode: err.code ?? 'network' });
      }
      throw e;
    }
    if (g !== gen) return;
    posBase = 0;
    playStartedAt = timer.now();
    set({ state: 'playing', positionSec: media.kind === 'video' ? 0 : null, confirmed: false });
    if (media.kind === 'video') startTicker();
    startConfirm(g);
  };

  return {
    target,
    load,
    async play() {
      ensureUsable();
      const media = snap.media;
      if (!media || media.kind === 'photo') return;
      if (snap.state === 'paused') {
        await post('/keypress/Play');
        playStartedAt = timer.now();
        set({ state: 'playing' });
        startTicker();
      } else if (snap.state === 'stopped' || snap.state === 'error') {
        await load(media);
      }
    },
    async pause() {
      ensureUsable();
      if (snap.media?.kind !== 'video' || snap.state === 'paused') return;
      if (snap.state !== 'playing') throw driverError('unsupported', 'core.driver.cast.notNow');
      await post('/keypress/Play');
      posBase = estimate();
      stopTicker();
      set({ state: 'paused', positionSec: Math.floor(posBase) });
    },
    async seek(_positionSec: number) {
      ensureUsable();
      if (snap.media?.kind !== 'video') return;
      throw driverError('unsupported', 'core.driver.cast.seekUnsupported');
    },
    async stop() {
      ensureUsable();
      if (snap.state === 'idle' || snap.state === 'stopped') return;
      gen += 1;
      stopTicker();
      stopConfirm();
      try {
        await post('/keypress/Back');
      } finally {
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
      stopTicker();
      stopConfirm();
      subs.clear();
    },
  };
}
