/**
 * CastDriver contract (T89), run against all three drivers: DLNA (fake renderer answering with SOAP
 * fixtures), Roku (fake ECP fetch) and MockCast. Fake timer only.
 */
import { setLocale, t } from '../../i18n/core';
import { DriverError } from '../types';
import { FakeRenderer, FakeTimer, fx, recordingFetch } from './__tests__/fakes';
import { parseDeviceDescription } from './description';
import type { CastMedia } from './didl';
import type { CastDriver, CastTarget } from './driver';
import { createDlnaDriver } from './dlnaDriver';
import { MOCK_CAST_TARGET, createMockCast } from './mockCast';
import { createRokuCast } from './rokuCast';

setLocale('en');

const VIDEO: CastMedia = {
  url: 'http://192.168.1.20:8090/Q2xpcEJvYXJkVG9rZW4xMjM0NTY.mp4',
  title: 'Party',
  mime: 'video/mp4',
  kind: 'video',
  durationSec: 120,
};
const PHOTO: CastMedia = {
  url: 'http://192.168.1.20:8090/Q2xpcEJvYXJkVG9rZW4xMjM0NTY.jpg',
  title: 'Beach',
  mime: 'image/jpeg',
  kind: 'photo',
};

interface Harness {
  driver: CastDriver;
  timer: FakeTimer;
  /** Advances time until a just-loaded video is playing. */
  settle(): Promise<void>;
  seeks: boolean;
}

const RENDERER = parseDeviceDescription(fx('description-urlbase.xml'), 'http://192.168.1.40:49152/description.xml');

function make(kind: 'dlna' | 'roku' | 'mock', accepts = { photo: true, video: true }): Harness {
  const timer = new FakeTimer();
  if (kind === 'dlna') {
    const target: CastTarget = { id: 'dlna:x', name: 'Screen', kind: 'dlna', host: '192.168.1.40', accepts };
    const tv = new FakeRenderer();
    return { driver: createDlnaDriver(target, RENDERER, tv.http.fetch, timer), timer, settle: () => timer.advance(1000), seeks: true };
  }
  if (kind === 'roku') {
    const target: CastTarget = { id: 'roku:192.168.1.30', name: 'Roku', kind: 'roku', host: '192.168.1.30', accepts };
    const { fetch } = recordingFetch(() => ({ status: 200 }));
    return { driver: createRokuCast(target, fetch, timer), timer, settle: () => timer.advance(0), seeks: false };
  }
  return { driver: createMockCast({ ...MOCK_CAST_TARGET, accepts }, timer), timer, settle: () => timer.advance(500), seeks: true };
}

describe.each(['dlna', 'roku', 'mock'] as const)('CastDriver contract: %s', (kind) => {
  it('starts idle', () => {
    const { driver } = make(kind);
    expect(driver.snapshot().state).toBe('idle');
    expect(driver.snapshot().media).toBeNull();
  });

  it('loads a video, pauses, resumes, seeks and stops', async () => {
    const h = make(kind);
    const d = h.driver;
    await d.load(VIDEO);
    await h.settle();
    expect(d.snapshot().state).toBe('playing');
    expect(d.snapshot().media).toBe(VIDEO);
    expect(d.snapshot().durationSec).not.toBeNull();

    await d.pause();
    expect(d.snapshot().state).toBe('paused');
    await d.pause(); // already paused: no-op
    expect(d.snapshot().state).toBe('paused');
    await d.play();
    expect(d.snapshot().state).toBe('playing');
    await d.play(); // already playing: no-op
    expect(d.snapshot().state).toBe('playing');

    if (h.seeks) {
      await d.seek(30);
      expect(d.snapshot().positionSec).toBe(30);
    } else {
      const e = await d.seek(30).then(() => null, (x: unknown) => x);
      expect(e).toBeInstanceOf(DriverError);
      expect((e as DriverError).code).toBe('unsupported');
      expect((e as DriverError).message).toBe(t('core.driver.cast.seekUnsupported'));
    }

    await d.stop();
    expect(d.snapshot().state).toBe('stopped');
    await d.stop(); // no-op
    expect(d.snapshot().state).toBe('stopped');
    d.dispose();
  });

  it('play after stop loads the same media again', async () => {
    const h = make(kind);
    await h.driver.load(VIDEO);
    await h.settle();
    await h.driver.stop();
    await h.driver.play();
    await h.settle();
    expect(h.driver.snapshot().state).toBe('playing');
    h.driver.dispose();
  });

  it('shows a photo: playing, no timeline; seek / pause / play are ignored', async () => {
    const h = make(kind);
    await h.driver.load(PHOTO);
    await h.settle();
    expect(h.driver.snapshot().state).toBe('playing');
    expect(h.driver.snapshot().durationSec).toBeNull();
    await h.driver.seek(10);
    await h.driver.pause();
    await h.driver.play();
    expect(h.driver.snapshot().state).toBe('playing');
    h.driver.dispose();
  });

  it('notifies subscribers until they unsubscribe', async () => {
    const h = make(kind);
    const states: string[] = [];
    const off = h.driver.subscribe((s) => states.push(s.state));
    await h.driver.load(VIDEO);
    await h.settle();
    expect(states[0]).toBe('loading');
    expect(states).toContain('playing');
    off();
    const n = states.length;
    await h.driver.stop();
    expect(states.length).toBe(n);
    h.driver.dispose();
  });

  it('refuses a media kind the target does not accept', async () => {
    const h = make(kind, { photo: true, video: false });
    const e = await h.driver.load(VIDEO).then(() => null, (x: unknown) => x);
    expect(e).toBeInstanceOf(DriverError);
    expect((e as DriverError).message).toBe(t('core.driver.cast.formatUnsupported'));
  });

  it('is unusable after dispose and leaves no timers running', async () => {
    const h = make(kind);
    await h.driver.load(VIDEO);
    await h.settle();
    h.driver.dispose();
    expect(h.timer.active).toBe(0);
    await expect(h.driver.load(VIDEO)).rejects.toBeInstanceOf(DriverError);
  });
});
