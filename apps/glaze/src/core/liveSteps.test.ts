import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkClipForPhotos,
  fileExtension,
  heroSubline,
  parseIosMajor,
  saveOptions,
  stillFrameSeconds,
} from './liveSteps.ts';

const BANNED = /Themify|Icon Themer|MyScreen|ScreenKit|Widgetsmith|intoLive|Loopy|Lockio/i;

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

test('saveOptions lists what each build can save (T127: no looping Lock Screen option)', () => {
  const ids = (o: ReturnType<typeof saveOptions>) => o.filter((x) => x.available).map((x) => x.id).sort();
  assert.deepEqual(ids(saveOptions('expo-go', 'video')), ['clip', 'still-frame']);
  assert.deepEqual(ids(saveOptions('expo-go', 'gif')), ['clip', 'still-frame']);
  assert.deepEqual(ids(saveOptions('full', 'video')), ['clip', 'live-photo', 'still-frame']);
  assert.deepEqual(ids(saveOptions('full', 'gif')), ['clip', 'still-frame']);
  for (const build of ['expo-go', 'full'] as const) {
    for (const kind of ['video', 'gif'] as const) {
      const all = saveOptions(build, kind);
      assert.ok(!all.some((o) => /loop|Now Playing/i.test(o.label)), `${build} ${kind}`);
      for (const o of all) assert.doesNotMatch(`${o.label} ${o.detail} ${o.unavailableReason ?? ''}`, BANNED);
    }
  }
  for (const o of saveOptions('expo-go', 'gif')) {
    if (!o.available) assert.match(o.unavailableReason ?? '', /full Glaze build/);
  }
  const gifLive = saveOptions('full', 'gif').find((o) => o.id === 'live-photo');
  assert.match(gifLive?.unavailableReason ?? '', /video/);
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

test('heroSubline is honest per build and iOS version (T127: Live Photo, never a loop)', () => {
  assert.match(heroSubline('expo-go', 26), /still/);
  assert.match(heroSubline('expo-go', 26), /full Glaze build/);
  for (const ios of [0, 16, 17, 18, 26]) {
    assert.match(heroSubline('full', ios), /Live Photo/);
    assert.doesNotMatch(heroSubline('full', ios), /Loops|Now Playing/);
  }
  assert.match(heroSubline('full', 16), /iOS 16/);
  assert.match(heroSubline('full', 16), /stays still/);
});
