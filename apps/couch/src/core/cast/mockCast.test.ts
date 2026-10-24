import { FakeTimer } from './__tests__/fakes';
import type { CastMedia } from './didl';
import { MOCK_CAST_TARGET, MOCK_DEFAULT_DURATION_SEC, createMockCast } from './mockCast';

const VIDEO: CastMedia = { url: 'file:///clip.mp4', title: 'Clip', mime: 'video/mp4', kind: 'video', durationSec: 5 };
const PHOTO: CastMedia = { url: 'file:///pic.jpg', title: 'Pic', mime: 'image/jpeg', kind: 'photo' };

describe('MockCast', () => {
  it('exposes the demo target', () => {
    expect(MOCK_CAST_TARGET).toEqual({
      id: 'mock:demo',
      name: 'Demo TV',
      kind: 'mock',
      host: 'demo',
      accepts: { photo: true, video: true },
    });
    expect(createMockCast().target).toBe(MOCK_CAST_TARGET);
  });

  it('loads a video for about 300 ms, then plays with a moving position until it stops at the end', async () => {
    const timer = new FakeTimer();
    const d = createMockCast(undefined, timer);
    await d.load(VIDEO);
    expect(d.snapshot().state).toBe('loading');
    await timer.advance(250);
    expect(d.snapshot().state).toBe('loading');
    await timer.advance(100);
    expect(d.snapshot()).toMatchObject({ state: 'playing', positionSec: 0, durationSec: 5 });
    await timer.advance(2000);
    expect(d.snapshot().positionSec).toBe(2);
    await timer.advance(3000);
    expect(d.snapshot()).toMatchObject({ state: 'stopped', positionSec: 5 });
    expect(timer.active).toBe(0);
  });

  it('uses 60 s when the video has no duration', async () => {
    const timer = new FakeTimer();
    const d = createMockCast(undefined, timer);
    await d.load({ ...VIDEO, durationSec: undefined });
    expect(d.snapshot().durationSec).toBe(MOCK_DEFAULT_DURATION_SEC);
    d.dispose();
  });

  it('pause freezes the position; seek clamps; photos go straight to playing', async () => {
    const timer = new FakeTimer();
    const d = createMockCast(undefined, timer);
    await d.load(VIDEO);
    await timer.advance(1300);
    await d.pause();
    const p = d.snapshot().positionSec;
    await timer.advance(10_000);
    expect(d.snapshot()).toMatchObject({ state: 'paused', positionSec: p });
    await d.seek(99);
    expect(d.snapshot().positionSec).toBe(5);
    await d.seek(-3);
    expect(d.snapshot().positionSec).toBe(0);

    await d.load(PHOTO);
    expect(d.snapshot()).toMatchObject({ state: 'playing', media: PHOTO, durationSec: null });
    expect(timer.active).toBe(0);
  });
});
