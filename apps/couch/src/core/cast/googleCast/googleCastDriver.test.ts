/**
 * T106: Google Cast CastDriver flows against a scripted fake receiver (reconstructed from public
 * CASTV2 descriptions; never captured from a real TV). Fake timer only, no real network.
 */
import { setLocale, t } from '../../../i18n/core';
import { DriverError } from '../../types';
import { FakeTimer, flush } from '../__tests__/fakes';
import { FakeCastDevice, NS_CONN, NS_MEDIA, NS_RCV, SESSION, TRANSPORT } from '../__tests__/fakeCastDevice';
import type { CastMedia } from '../didl';
import type { CastTarget } from '../driver';
import { buildLoadPayload, createGoogleCast, findReceiverApp } from './googleCastDriver';

setLocale('en');

const TARGET: CastTarget = {
  id: 'gcast:192.168.1.60',
  name: 'Living room',
  kind: 'googlecast',
  host: '192.168.1.60',
  accepts: { photo: true, video: true },
  tvId: 'tv1',
};
const VIDEO: CastMedia = {
  url: 'http://192.168.1.20:8090/Q2xpcEJvYXJkVG9rZW4xMjM0NTY.mp4',
  title: 'Party',
  mime: 'video/mp4',
  kind: 'video',
  durationSec: 100,
};
const PHOTO: CastMedia = {
  url: 'http://192.168.1.20:8090/Q2xpcEJvYXJkVG9rZW4xMjM0NTY.jpg',
  title: 'Beach',
  mime: 'image/jpeg',
  kind: 'photo',
};

function setup(target: CastTarget = TARGET) {
  const dev = new FakeCastDevice();
  const timer = new FakeTimer();
  const driver = createGoogleCast(target, dev.tcp, timer);
  return { dev, timer, driver };
}

async function rejection(p: Promise<unknown>): Promise<DriverError> {
  const e = await p.then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(DriverError);
  return e as DriverError;
}

describe('createGoogleCast: loading', () => {
  it('connects, launches the Default Media Receiver, connects to it and loads the video', async () => {
    const { dev, driver } = setup();
    await driver.load(VIDEO);
    const cmds = dev.commands;
    expect(cmds.map((m) => [m.namespace, m.destinationId, m.payload['type']])).toEqual([
      [NS_CONN, 'receiver-0', 'CONNECT'],
      [NS_RCV, 'receiver-0', 'LAUNCH'],
      [NS_CONN, TRANSPORT, 'CONNECT'],
      [NS_MEDIA, TRANSPORT, 'LOAD'],
    ]);
    expect(cmds[1]!.payload['appId']).toBe('CC1AD845');
    expect(cmds[3]!.payload).toMatchObject({
      type: 'LOAD',
      autoplay: true,
      media: {
        contentId: VIDEO.url,
        contentType: 'video/mp4',
        streamType: 'BUFFERED',
        metadata: { metadataType: 0, title: 'Party' },
      },
    });
    expect(typeof cmds[3]!.payload['requestId']).toBe('number');
    const s = driver.snapshot();
    expect(s.state).toBe('playing');
    expect(s.confirmed).toBe(true);
    expect(s.media).toBe(VIDEO);
    expect(s.durationSec).toBe(120); // the receiver's media.duration wins over the picker's
    driver.dispose();
  });

  it('says loading (unconfirmed) while the TV buffers, then confirmed once it reports PLAYING', async () => {
    const { dev, driver } = setup();
    dev.loadMode = 'buffering';
    const seen: [string, boolean | undefined][] = [];
    driver.subscribe((s) => seen.push([s.state, s.confirmed]));
    await driver.load(VIDEO);
    expect(driver.snapshot().state).toBe('loading');
    expect(driver.snapshot().confirmed).toBe(false);
    dev.playerState = 'PLAYING';
    dev.currentTime = 3;
    dev.push(NS_MEDIA, TRANSPORT, dev.mediaStatus(0));
    await flush();
    expect(driver.snapshot()).toMatchObject({ state: 'playing', confirmed: true, positionSec: 3 });
    expect(seen[0]).toEqual(['loading', false]);
    driver.dispose();
  });

  it('polls GET_STATUS every second while playing and tracks the position', async () => {
    const { dev, driver, timer } = setup();
    await driver.load(VIDEO);
    dev.currentTime = 42.7;
    await timer.advance(1000);
    expect(dev.types(NS_MEDIA)).toEqual(['LOAD', 'GET_STATUS']);
    const poll = dev.commands[dev.commands.length - 1]!;
    expect(poll.payload['mediaSessionId']).toBe(dev.mediaSessionId);
    expect(driver.snapshot().positionSec).toBe(42);
    await timer.advance(2000);
    expect(dev.types(NS_MEDIA).filter((x) => x === 'GET_STATUS')).toHaveLength(3);
    driver.dispose();
    expect(timer.active).toBe(0);
  });

  it('reads replies delivered byte by byte', async () => {
    const { dev, driver } = setup();
    dev.chunked = true;
    await driver.load(VIDEO);
    expect(driver.snapshot()).toMatchObject({ state: 'playing', confirmed: true });
    driver.dispose();
  });

  it('waits for a later RECEIVER_STATUS when the app is not listed in the first one', async () => {
    const { dev, driver } = setup();
    dev.launchMode = 'two-step';
    await driver.load(VIDEO);
    expect(driver.snapshot().state).toBe('playing');
    driver.dispose();
  });

  it('reuses the connection and the receiver app for the next item', async () => {
    const { dev, driver } = setup();
    await driver.load(VIDEO);
    await driver.load(PHOTO);
    expect(dev.connects).toHaveLength(1);
    expect(dev.types(NS_RCV)).toEqual(['LAUNCH']);
    expect(dev.types(NS_MEDIA)).toEqual(['LOAD', 'LOAD']);
    driver.dispose();
  });

  it('shows a photo with photo metadata; confirmed when the TV reports it', async () => {
    const { dev, driver, timer } = setup();
    await driver.load(PHOTO);
    const load = dev.commands.find((m) => m.payload['type'] === 'LOAD')!;
    expect(load.payload).toMatchObject({ media: { contentType: 'image/jpeg', metadata: { metadataType: 4, title: 'Beach' } } });
    expect(driver.snapshot()).toMatchObject({ state: 'playing', confirmed: true, positionSec: null, durationSec: null });
    await timer.advance(3000);
    expect(dev.types(NS_MEDIA)).toEqual(['LOAD']); // photos are not polled
    driver.dispose();
  });

  it('counts a photo as shown when the status carries the loaded media (IDLE, no reason)', async () => {
    const { dev, driver } = setup();
    dev.loadMode = 'photo-idle';
    await driver.load(PHOTO);
    expect(driver.snapshot()).toMatchObject({ state: 'playing', confirmed: true });
    driver.dispose();
  });
});

describe('createGoogleCast: errors', () => {
  it.each(['LOAD_FAILED', 'LOAD_CANCELLED', 'INVALID_REQUEST'] as const)('%s rejects with the load error', async (mode) => {
    const { dev, driver } = setup();
    dev.loadMode = mode;
    const e = await rejection(driver.load(VIDEO));
    expect(e.message).toBe(t('core.driver.cast.gcast.loadFailed'));
    expect(driver.snapshot()).toMatchObject({ state: 'error', error: e.message, confirmed: false });
    driver.dispose();
  });

  it('IDLE with idleReason ERROR is an error, also after playback started', async () => {
    const { dev, driver } = setup();
    dev.loadMode = 'idle-error';
    const e = await rejection(driver.load(VIDEO));
    expect(e.message).toBe(t('core.driver.cast.gcast.loadFailed'));

    dev.loadMode = 'playing';
    await driver.load(VIDEO);
    expect(driver.snapshot().state).toBe('playing');
    dev.playerState = 'IDLE';
    dev.push(NS_MEDIA, TRANSPORT, dev.mediaStatus(0, { idleReason: 'ERROR' }));
    await flush();
    expect(driver.snapshot()).toMatchObject({ state: 'error', error: t('core.driver.cast.gcast.loadFailed'), confirmed: false });
    driver.dispose();
  });

  it('a refused connection says the cast connection could not be opened', async () => {
    const { dev, driver } = setup();
    dev.connectMode = 'refuse';
    const e = await rejection(driver.load(VIDEO));
    expect(e.code).toBe('network');
    expect(e.message).toBe(t('core.driver.cast.gcast.connectFailed'));
    expect(driver.snapshot().state).toBe('error');
  });

  it('a connection that never opens times out with the same message', async () => {
    const { dev, driver, timer } = setup();
    dev.connectMode = 'hang';
    const p = rejection(driver.load(VIDEO));
    await timer.advance(8000);
    const e = await p;
    expect(e.code).toBe('timeout');
    expect(e.message).toBe(t('core.driver.cast.gcast.connectFailed'));
    expect(timer.active).toBe(0);
  });

  it('a launch error or no answer says the TV did not open its media player', async () => {
    const a = setup();
    a.dev.launchMode = 'error';
    expect((await rejection(a.driver.load(VIDEO))).message).toBe(t('core.driver.cast.gcast.launchFailed'));
    a.driver.dispose();

    const b = setup();
    b.dev.launchMode = 'silent';
    const p = rejection(b.driver.load(VIDEO));
    await flush(); // let the (already open) socket resolve before time moves
    await b.timer.advance(15_000);
    const e = await p;
    expect(e.code).toBe('timeout');
    expect(e.message).toBe(t('core.driver.cast.gcast.launchFailed'));
    b.driver.dispose();
  });

  it('no answer to LOAD times out', async () => {
    const { dev, driver, timer } = setup();
    dev.loadMode = 'silent';
    const p = rejection(driver.load(VIDEO));
    await flush();
    await timer.advance(20_000);
    expect((await p).message).toBe(t('core.driver.cast.loadTimeout'));
    driver.dispose();
  });

  it('a dropped connection while playing is an error; play() then reconnects', async () => {
    const { dev, driver } = setup();
    await driver.load(VIDEO);
    dev.socket.drop();
    expect(driver.snapshot()).toMatchObject({ state: 'error', error: t('core.driver.cast.gcast.lost'), errorCode: 'network' });
    dev.appRunning = false;
    await driver.play();
    expect(dev.connects).toHaveLength(2);
    expect(driver.snapshot().state).toBe('playing');
    driver.dispose();
  });

  it('refuses a non-LAN TV without connecting', async () => {
    const { dev, driver } = setup({ ...TARGET, host: '8.8.8.8' });
    const e = await rejection(driver.load(VIDEO));
    expect(e.code).toBe('forbidden');
    expect(dev.connects).toEqual([]);
  });
});

describe('createGoogleCast: playback', () => {
  it('pause / play / seek go to the media session', async () => {
    const { dev, driver } = setup();
    await driver.load(VIDEO);
    const msid = dev.mediaSessionId;
    await driver.pause();
    expect(driver.snapshot()).toMatchObject({ state: 'paused', confirmed: true });
    await driver.play();
    expect(driver.snapshot().state).toBe('playing');
    await driver.seek(30);
    expect(driver.snapshot().positionSec).toBe(30);
    await driver.seek(999);
    const media = dev.commands.filter((m) => m.namespace === NS_MEDIA && m.payload['type'] !== 'GET_STATUS');
    expect(media.map((m) => [m.payload['type'], m.payload['mediaSessionId'], m.payload['currentTime']])).toEqual([
      ['LOAD', undefined, 0],
      ['PAUSE', msid, undefined],
      ['PLAY', msid, undefined],
      ['SEEK', msid, 30],
      ['SEEK', msid, 120], // clamped to the duration
    ]);
    driver.dispose();
  });

  it('a video that plays to the end is stopped', async () => {
    const { dev, driver } = setup();
    await driver.load(VIDEO);
    dev.playerState = 'IDLE';
    dev.push(NS_MEDIA, TRANSPORT, dev.mediaStatus(0, { idleReason: 'FINISHED' }));
    await flush();
    expect(driver.snapshot()).toMatchObject({ state: 'stopped', positionSec: 120 });
    driver.dispose();
  });

  it('stop sends media STOP, then receiver STOP of the session, and closes the connection', async () => {
    const { dev, driver, timer } = setup();
    await driver.load(VIDEO);
    await driver.stop();
    const tail = dev.commands.slice(-3);
    expect(tail.map((m) => [m.namespace, m.payload['type']])).toEqual([
      [NS_MEDIA, 'STOP'],
      [NS_RCV, 'STOP'],
      [NS_CONN, 'CLOSE'],
    ]);
    expect(tail[0]!.payload['mediaSessionId']).toBe(dev.mediaSessionId);
    expect(tail[1]!.payload['sessionId']).toBe(SESSION);
    expect(dev.socket.closed).toBe(true);
    expect(driver.snapshot().state).toBe('stopped');
    expect(timer.active).toBe(0);
  });

  it('the receiver app closing on the TV stops the cast', async () => {
    const { dev, driver } = setup();
    await driver.load(VIDEO);
    dev.push(NS_CONN, TRANSPORT, { type: 'CLOSE' });
    await flush();
    expect(driver.snapshot().state).toBe('stopped');
    driver.dispose();
  });

  it('another app taking over the TV stops the cast', async () => {
    const { dev, driver } = setup();
    await driver.load(VIDEO);
    dev.push(NS_RCV, 'receiver-0', {
      type: 'RECEIVER_STATUS',
      requestId: 0,
      status: { applications: [{ appId: 'OTHER', sessionId: 'other', transportId: 'web-9' }] },
    });
    await flush();
    expect(driver.snapshot().state).toBe('stopped');
    driver.dispose();
  });

  it('ignores statuses for another media session', async () => {
    const { dev, driver } = setup();
    await driver.load(VIDEO);
    dev.push(NS_MEDIA, TRANSPORT, { type: 'MEDIA_STATUS', requestId: 0, status: [{ mediaSessionId: 999, playerState: 'IDLE', idleReason: 'FINISHED' }] });
    await flush();
    expect(driver.snapshot().state).toBe('playing');
    driver.dispose();
  });
});

describe('helpers', () => {
  it('findReceiverApp needs appId, transportId and sessionId', () => {
    expect(findReceiverApp({ status: { applications: [{ appId: 'CC1AD845', sessionId: 's', transportId: 't' }] } })).toEqual({ sessionId: 's', transportId: 't' });
    expect(findReceiverApp({ status: { applications: [{ appId: 'CC1AD845', sessionId: 's' }] } })).toBeNull();
    expect(findReceiverApp({ status: {} })).toBeNull();
    expect(findReceiverApp({})).toBeNull();
  });

  it('buildLoadPayload marks photos with metadataType 4', () => {
    expect(buildLoadPayload(PHOTO)).toMatchObject({ media: { metadata: { metadataType: 4 } }, autoplay: true });
    expect(buildLoadPayload(VIDEO)).toMatchObject({ media: { metadata: { metadataType: 0 } } });
  });
});
