/**
 * DLNA / UPnP MediaRenderer CastDriver (cast-1024, T89): a thin adapter from the CastDriver
 * contract to the T76 pieces, AvTransportClient (SOAP) and CastSession (state machine + polling).
 * No SOAP is built here.
 *
 * Tested against reconstructed SOAP fixtures only; never tried on a real TV.
 */
import type { FetchLike } from '../driver';
import { driverError } from '../drivers/errors';
import { DriverError } from '../types';
import { AvTransportClient } from './avTransport';
import type { CastRenderer } from './description';
import type { CastMedia } from './didl';
import type { CastDriver, CastTarget } from './driver';
import { CastSession, SYSTEM_TIMER, type CastSessionOptions, type CastTimer } from './session';

/**
 * Builds the driver. Throws a translated DriverError ('forbidden') right away when the renderer's
 * AVTransport control URL is not on the LAN.
 */
export function createDlnaDriver(
  target: CastTarget,
  renderer: CastRenderer,
  fetch: FetchLike,
  timer: CastTimer = SYSTEM_TIMER,
  sessionOptions: CastSessionOptions = {},
): CastDriver {
  const client = new AvTransportClient(fetch, renderer.avTransportUrl, { serviceType: renderer.avTransportType });
  const session = new CastSession(client, timer, sessionOptions);
  let disposed = false;

  const ensureUsable = (): void => {
    if (disposed) throw driverError('unsupported', 'core.driver.cast.notNow');
  };

  const load = async (media: CastMedia): Promise<void> => {
    ensureUsable();
    if (!target.accepts[media.kind]) throw driverError('unsupported', 'core.driver.cast.formatUnsupported');
    // CastSession.load never throws; a failure lands in the snapshot. The contract wants a rejection.
    const s = await session.load(media);
    if (s.state === 'error' && s.media === media) {
      throw new DriverError(s.errorCode ?? 'network', s.error ?? '');
    }
  };

  return {
    target,
    load,
    async play() {
      ensureUsable();
      const s = session.snapshot;
      if (!s.media || s.media.kind === 'photo') return;
      if (s.state === 'paused') await session.resume();
      else if (s.state === 'stopped' || s.state === 'error') await load(s.media);
    },
    async pause() {
      ensureUsable();
      const s = session.snapshot;
      if (s.media?.kind !== 'video' || s.state === 'paused') return;
      await session.pause();
    },
    async seek(positionSec: number) {
      ensureUsable();
      if (session.snapshot.media?.kind !== 'video') return;
      await session.seek(positionSec);
    },
    async stop() {
      ensureUsable();
      await session.stop();
    },
    snapshot: () => session.snapshot,
    subscribe: (listener) => session.subscribe(listener),
    dispose() {
      disposed = true;
      session.dispose();
    },
  };
}
