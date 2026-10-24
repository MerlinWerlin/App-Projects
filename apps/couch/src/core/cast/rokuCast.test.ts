import { setLocale, t } from '../../i18n/core';
import { DriverError } from '../types';
import { FakeTimer, recordingFetch, unreachable } from './__tests__/fakes';
import type { CastMedia } from './didl';
import type { CastTarget } from './driver';
import { ROKU_END_GRACE_SEC, createRokuCast, rokuPlayPath, rokuVideoFormat } from './rokuCast';

setLocale('en');

const TARGET: CastTarget = { id: 'roku:192.168.1.30', name: 'Roku', kind: 'roku', host: '192.168.1.30', accepts: { photo: true, video: true } };
const VIDEO: CastMedia = {
  url: 'http://192.168.1.20:8090/Q2xpcEJvYXJkVG9rZW4xMjM0NTY.mp4?a=1&b=2',
  title: 'Kid & dog',
  mime: 'video/mp4',
  kind: 'video',
  durationSec: 10,
};
const PHOTO: CastMedia = { url: 'http://192.168.1.20:8090/Q2xpcEJvYXJkVG9rZW4xMjM0NTY.jpg', title: 'Beach', mime: 'image/jpeg', kind: 'photo' };
const ENC_VIDEO = 'http%3A%2F%2F192.168.1.20%3A8090%2FQ2xpcEJvYXJkVG9rZW4xMjM0NTY.mp4%3Fa%3D1%26b%3D2';

function setup(status = 200) {
  const http = recordingFetch(() => ({ status }));
  const timer = new FakeTimer();
  return { http, timer, d: createRokuCast(TARGET, http.fetch, timer) };
}

describe('createRokuCast', () => {
  it('loads a video through the PlayOnRoku input with the exact ECP URL', async () => {
    const { http, d } = setup();
    await d.load(VIDEO);
    expect(http.calls).toHaveLength(1);
    expect(http.calls[0]!.method).toBe('POST');
    expect(http.calls[0]!.url).toBe(
      `http://192.168.1.30:8060/input/15985?t=v&u=${ENC_VIDEO}&k=&videoName=Kid%20%26%20dog&videoFormat=mp4`,
    );
    expect(d.snapshot()).toMatchObject({ state: 'playing', positionSec: 0, durationSec: 10 });
    d.dispose();
  });

  it('loads a photo with t=p', async () => {
    const { http, d } = setup();
    await d.load(PHOTO);
    expect(http.calls[0]!.url).toBe(
      'http://192.168.1.30:8060/input/15985?t=p&u=http%3A%2F%2F192.168.1.20%3A8090%2FQ2xpcEJvYXJkVG9rZW4xMjM0NTY.jpg&k=',
    );
    expect(d.snapshot().state).toBe('playing');
  });

  it('pause and play send the Play toggle; stop sends Back', async () => {
    const { http, d } = setup();
    await d.load(VIDEO);
    await d.pause();
    await d.pause(); // tracked locally: no second toggle
    await d.play();
    await d.play();
    await d.stop();
    expect(http.calls.slice(1).map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST http://192.168.1.30:8060/keypress/Play',
      'POST http://192.168.1.30:8060/keypress/Play',
      'POST http://192.168.1.30:8060/keypress/Back',
    ]);
    expect(d.snapshot().state).toBe('stopped');
  });

  it('seek on a video is unsupported and sends nothing', async () => {
    const { http, d } = setup();
    await d.load(VIDEO);
    const e = await d.seek(5).then(() => null, (x: unknown) => x);
    expect((e as DriverError).code).toBe('unsupported');
    expect((e as DriverError).message).toBe(t('core.driver.cast.seekUnsupported'));
    expect(http.calls).toHaveLength(1);
    d.dispose();
  });

  it('estimates the position and marks the video stopped after its end', async () => {
    const { timer, d } = setup();
    await d.load(VIDEO);
    await timer.advance(4000);
    expect(d.snapshot().positionSec).toBe(4);
    await d.pause();
    await timer.advance(60_000);
    expect(d.snapshot()).toMatchObject({ state: 'paused', positionSec: 4 });
    await d.play();
    await timer.advance(6000);
    expect(d.snapshot()).toMatchObject({ state: 'playing', positionSec: 10 });
    await timer.advance(ROKU_END_GRACE_SEC * 1000);
    expect(d.snapshot().state).toBe('stopped');
    expect(timer.active).toBe(0);
  });

  it('403 becomes the mobile-control help error', async () => {
    const { d } = setup(403);
    const e = await d.load(VIDEO).then(() => null, (x: unknown) => x);
    expect((e as DriverError).code).toBe('forbidden');
    expect((e as DriverError).message).toBe(t('core.driver.roku.blocked'));
    expect(d.snapshot()).toMatchObject({ state: 'error', errorCode: 'forbidden' });
  });

  it('an unreachable Roku rejects with network', async () => {
    const http = recordingFetch(unreachable);
    const d = createRokuCast(TARGET, http.fetch, new FakeTimer());
    await expect(d.load(VIDEO)).rejects.toMatchObject({ code: 'network' });
  });

  it('refuses a non-LAN host before any request', async () => {
    const http = recordingFetch(() => ({}));
    const d = createRokuCast({ ...TARGET, host: '8.8.8.8' }, http.fetch, new FakeTimer());
    await expect(d.load(VIDEO)).rejects.toMatchObject({ code: 'forbidden' });
    expect(http.calls).toHaveLength(0);
  });

  it('refuses a media URL that is not on the LAN', async () => {
    const { http, d } = setup();
    await expect(d.load({ ...VIDEO, url: 'http://example.com/a.mp4' })).rejects.toMatchObject({ code: 'forbidden' });
    expect(http.calls).toHaveLength(0);
  });

  it('videoFormat follows the MIME type', () => {
    expect(rokuVideoFormat('video/mp4')).toBe('mp4');
    expect(rokuVideoFormat('video/quicktime')).toBe('mov');
    expect(rokuVideoFormat('video/x-matroska')).toBe('mkv');
    expect(rokuPlayPath({ ...VIDEO, mime: 'video/quicktime' })).toContain('&videoFormat=mov');
  });
});
