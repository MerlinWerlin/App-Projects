import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOOP_MIN_IOS,
  applyInstructions,
  checkClipForPhotos,
  fileExtension,
  heroSubline,
  parseIosMajor,
  saveOptions,
  stillFrameSeconds,
} from './liveSteps.ts';

const BANNED = /Themify|Icon Themer|MyScreen|ScreenKit|Widgetsmith|intoLive|Loopy|Lockio/i;
const allText = (r: { headline: string; steps: string[]; limits: string[] }) => [r.headline, ...r.steps, ...r.limits].join('\n');

test('parseIosMajor reads Platform.Version strings and numbers', () => {
  assert.equal(parseIosMajor('26.0'), 26);
  assert.equal(parseIosMajor('17.4.1'), 17);
  assert.equal(parseIosMajor('18'), 18);
  assert.equal(parseIosMajor(16), 16);
  assert.equal(parseIosMajor(16.4), 16);
  assert.equal(parseIosMajor(' 25.1 '), 25);
  for (const bad of ['', 'abc', '26.x', null, undefined, NaN, -3, 0, {}, '0.1']) {
    assert.equal(parseIosMajor(bad), 0, String(bad));
  }
});

test('iOS 26+ full build: a true loop through Now Playing, with honest limits', () => {
  for (const ios of [26, 27]) {
    const r = applyInstructions({ iosMajor: ios, build: 'full', kind: 'video' });
    assert.equal(r.mode, 'loop');
    assert.match(r.headline, new RegExp(`iOS ${ios}`));
    assert.match(r.headline, /loop/i);
    assert.ok(r.steps.some((s) => /Set on Lock Screen/.test(s)));
    assert.ok(r.steps.some((s) => /Stop/.test(s)));
    assert.ok(r.limits.some((s) => /while Glaze is playing/.test(s)));
  }
  const gif = applyInstructions({ iosMajor: 26, build: 'full', kind: 'gif' });
  assert.equal(gif.mode, 'loop');
  assert.ok(gif.limits.some((s) => /GIF/.test(s)));
});

test('iOS 16-25 full build: Live Photo wallpaper steps, not a constant loop', () => {
  for (const ios of [16, 17, 18, 25]) {
    const r = applyInstructions({ iosMajor: ios, build: 'full', kind: 'video' });
    assert.equal(r.mode, 'live-photo');
    assert.match(r.headline, /Live Photo/);
    const steps = r.steps.join('\n');
    assert.match(steps, /Save as Live Photo/);
    assert.match(steps, /Settings › Wallpaper › Add New Wallpaper › Photos/);
    assert.match(steps, /Live Photo button/);
    assert.ok(r.limits.some((s) => /not a constant loop/.test(s) && /touch and hold/.test(s) && /wakes/.test(s)));
    assert.ok(r.limits.some((s) => s.includes(`iOS ${LOOP_MIN_IOS}`)));
  }
});

test('iOS 16-25 full build with a GIF falls back to a still frame and explains', () => {
  const r = applyInstructions({ iosMajor: 18, build: 'full', kind: 'gif' });
  assert.equal(r.mode, 'still');
  assert.ok(r.limits.some((s) => /never animate a GIF/.test(s)));
  assert.ok(r.steps.some((s) => /Still frame wallpaper/.test(s)));
});

test('Expo Go: preview only, still frame + clip, and what the full build adds', () => {
  for (const ios of [0, 17, 26]) {
    for (const kind of ['video', 'gif'] as const) {
      const r = applyInstructions({ iosMajor: ios, build: 'expo-go', kind });
      assert.equal(r.mode, 'still');
      assert.ok(r.steps.some((s) => /Still frame wallpaper/.test(s)));
      assert.ok(r.steps.some((s) => /Settings › Wallpaper › Add New Wallpaper › Photos/.test(s)));
      assert.ok(r.limits.some((s) => /Expo Go/.test(s) && /cannot/.test(s)));
      assert.ok(r.limits.some((s) => /Save the clip/.test(s)));
      if (kind === 'gif') assert.ok(r.limits.some((s) => /never animate a GIF/.test(s)));
    }
  }
  assert.ok(applyInstructions({ iosMajor: 26, build: 'expo-go', kind: 'video' }).limits.some((s) => /can loop/.test(s)));
  assert.ok(applyInstructions({ iosMajor: 17, build: 'expo-go', kind: 'video' }).limits.some((s) => /Live Photo/.test(s)));
});

test('instructions never name competitors and always have steps', () => {
  for (const ios of [0, 15, 16, 17, 18, 25, 26, 27]) {
    for (const build of ['expo-go', 'full'] as const) {
      for (const kind of ['video', 'gif'] as const) {
        const r = applyInstructions({ iosMajor: ios, build, kind });
        assert.ok(r.steps.length >= 3);
        assert.ok(r.limits.length >= 1);
        assert.doesNotMatch(allText(r), BANNED);
        assert.doesNotMatch(allText(r), /undefined|NaN/);
      }
    }
  }
});

test('saveOptions lists what each build can save', () => {
  const ids = (o: ReturnType<typeof saveOptions>) => o.filter((x) => x.available).map((x) => x.id).sort();
  assert.deepEqual(ids(saveOptions('expo-go', 'video')), ['clip', 'still-frame']);
  assert.deepEqual(ids(saveOptions('expo-go', 'gif')), ['clip', 'still-frame']);
  assert.deepEqual(ids(saveOptions('full', 'video')), ['clip', 'live-photo', 'lock-loop', 'still-frame']);
  assert.deepEqual(ids(saveOptions('full', 'gif')), ['clip', 'lock-loop', 'still-frame']);
  assert.deepEqual(ids(saveOptions('full', 'video', 18)), ['clip', 'live-photo', 'still-frame']);
  assert.deepEqual(ids(saveOptions('full', 'video', 26)), ['clip', 'live-photo', 'lock-loop', 'still-frame']);
  for (const o of saveOptions('expo-go', 'gif')) {
    if (!o.available) assert.match(o.unavailableReason ?? '', /full Glaze build/);
  }
  const gifLive = saveOptions('full', 'gif').find((o) => o.id === 'live-photo');
  assert.match(gifLive?.unavailableReason ?? '', /video/);
  assert.match(saveOptions('full', 'video', 18).find((o) => o.id === 'lock-loop')?.unavailableReason ?? '', /iOS 26/);
  assert.equal(saveOptions('expo-go', 'gif').find((o) => o.id === 'clip')?.label, 'Save the GIF');
});

test('checkClipForPhotos accepts local videos and GIFs, refuses the rest', () => {
  assert.deepEqual(checkClipForPhotos('file:///docs/loops/a.MOV', 'video'), { ok: true, ext: 'mov' });
  assert.deepEqual(checkClipForPhotos('file:///docs/loops/a.mp4', 'video'), { ok: true, ext: 'mp4' });
  assert.deepEqual(checkClipForPhotos('/docs/loops/a.gif', 'gif'), { ok: true, ext: 'gif' });
  assert.deepEqual(checkClipForPhotos('file:///docs/loops/a.webm', 'video'), { ok: false, reason: 'unsupported' });
  assert.deepEqual(checkClipForPhotos('file:///docs/loops/a.png', 'gif'), { ok: false, reason: 'unsupported' });
  assert.deepEqual(checkClipForPhotos('ph://ABC', 'video'), { ok: false, reason: 'unsupported' });
  assert.deepEqual(checkClipForPhotos('https://x.test/a.mp4', 'video'), { ok: false, reason: 'unsupported' });
  assert.deepEqual(checkClipForPhotos('', 'video'), { ok: false, reason: 'missing' });
  assert.equal(fileExtension('file:///a/b.Gif?x=1'), 'gif');
  assert.equal(fileExtension('noext'), '');
});

test('stillFrameSeconds keeps the grab inside the trimmed range', () => {
  const trim = { startMs: 2000, endMs: 8000 };
  assert.equal(stillFrameSeconds(5, trim, 20000), 5);
  assert.equal(stillFrameSeconds(1, trim, 20000), 2);
  assert.equal(stillFrameSeconds(12, trim, 20000), 7.999);
  assert.equal(stillFrameSeconds(NaN, trim, 20000), 2);
  assert.equal(stillFrameSeconds(3, { startMs: 0, endMs: 0 }, 0), 0);
  assert.equal(stillFrameSeconds(3, { startMs: 0, endMs: 0 }, 10000), 3);
  assert.equal(stillFrameSeconds(3, { startMs: 0, endMs: 30000 }, 2000), 1.999);
});

test('heroSubline is honest per build and iOS version', () => {
  assert.match(heroSubline('expo-go', 26), /still/);
  assert.match(heroSubline('expo-go', 26), /full Glaze build/);
  assert.match(heroSubline('full', 26), /Loops/);
  assert.match(heroSubline('full', 17), /Live Photo/);
  assert.doesNotMatch(heroSubline('full', 17), /Loops/);
  assert.ok(heroSubline('full', 0).length > 0);
});
