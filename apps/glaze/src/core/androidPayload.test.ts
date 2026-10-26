import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LONG_LABEL_MAX,
  SHORT_LABEL_MAX,
  SHORTCUT_ID_MAX,
  fitLabel,
  longLabel,
  pinShortcutJson,
  pinShortcutPayload,
  shortLabel,
  shortcutId,
  wallpaperJson,
  wallpaperPayload,
} from './androidPayload.ts';
import { newProject, type LoopProject } from './loop.ts';
import { androidShortcutTarget } from './androidShortcut.ts';

test('shortcutId: prefixed, sanitised, ≤ 64 chars, stable', () => {
  assert.equal(shortcutId('spotify'), 'glaze-spotify');
  assert.equal(shortcutId('Café Bank!'), 'glaze-cafe-bank');
  assert.equal(shortcutId('  '), 'glaze-icon');
  assert.equal(shortcutId('a.b_c-d'), 'glaze-a.b_c-d');
  const long = shortcutId('x'.repeat(200));
  assert.equal(long.length, SHORTCUT_ID_MAX);
  assert.equal(shortcutId('x'.repeat(200)), long);
  assert.ok(!/[-.]$/.test(shortcutId(`${'y'.repeat(57)}-zzz`)));
  assert.match(shortcutId('🙂 emoji app'), /^glaze-[a-z0-9._-]+$/);
});

test('labels: short ≤ 10, long ≤ 25, ellipsis when cut', () => {
  assert.equal(shortLabel('Music'), 'Music');
  assert.equal(shortLabel('Google Maps Navigation'), 'Google Ma…');
  assert.equal(Array.from(shortLabel('Google Maps Navigation')).length, SHORT_LABEL_MAX);
  assert.equal(longLabel('Google Maps Navigation'), 'Google Maps Navigation');
  const l = longLabel('A very very long application name here');
  assert.ok(Array.from(l).length <= LONG_LABEL_MAX);
  assert.ok(l.endsWith('…'));
  assert.equal(shortLabel('   '), 'App');
  assert.equal(fitLabel('  two   spaces ', 20), 'two spaces');
  assert.equal(fitLabel('abc', 1), 'a');
});

test('pinShortcutPayload: needs a url and an icon', () => {
  const spec = { appId: 'website', label: 'Website', urlScheme: ' https://example.com/ ' };
  assert.deepEqual(pinShortcutPayload(spec, 'iVBO R w0'), {
    id: 'glaze-website',
    label: 'Website',
    longLabel: 'Website',
    url: 'https://example.com/',
    pngBase64: 'iVBORw0',
  });
  assert.equal(pinShortcutPayload({ ...spec, urlScheme: null }, 'abc'), null);
  assert.equal(pinShortcutPayload(spec, ''), null);
  const json = pinShortcutJson(spec, 'abc');
  assert.equal(JSON.parse(json ?? '{}').id, 'glaze-website');
  assert.equal(pinShortcutJson({ ...spec, urlScheme: '' }, 'abc'), null);
});

test('Android shortcuts replace Apple destinations and reject unsupported or unsafe schemes', () => {
  assert.deepEqual(androidShortcutTarget({ appId: 'maps', urlScheme: 'maps://' }), { url: 'geo:0,0' });
  assert.deepEqual(androidShortcutTarget({ appId: 'mail', urlScheme: 'message://' }), { url: 'mailto:' });
  assert.deepEqual(androidShortcutTarget({ appId: 'spotify', urlScheme: 'spotify://' }), { packageName: 'com.spotify.music' });
  for (const url of ['App-prefs:', 'photos-redirect://', 'shortcuts://', 'javascript:alert(1)', 'intent://settings', 'file:///private', 'https://']) {
    assert.equal(androidShortcutTarget({ appId: 'unsupported', urlScheme: url }), null, url);
  }
  assert.equal(pinShortcutPayload({ appId: 'photos', label: 'Photos', urlScheme: 'photos-redirect://' }, 'abc'), null);
  assert.equal(androidShortcutTarget({ appId: '__proto__', urlScheme: null }), null);
});

function project(over: Partial<LoopProject> = {}): LoopProject {
  return {
    ...newProject({ id: 'p1', sourceUri: 'file:///v.mp4', kind: 'video', sourceDurationMs: 20_000, sourceWidth: 1080, sourceHeight: 1920, now: 1 }),
    ...over,
  };
}

test('wallpaperPayload: uri, trim, speed', () => {
  const p = project({ trim: { startMs: 2000, endMs: 8000 }, speed: 1.5 });
  assert.deepEqual(wallpaperPayload(p), { uri: 'file:///v.mp4', trim: { startMs: 2000, endMs: 8000 }, speed: 1.5 });
  assert.deepEqual(JSON.parse(wallpaperJson(p) ?? 'null'), { uri: 'file:///v.mp4', trim: { startMs: 2000, endMs: 8000 }, speed: 1.5 });
});

test('wallpaperPayload: full or unknown range plays to the end (endMs 0)', () => {
  assert.equal(wallpaperPayload(project({ trim: { startMs: 0, endMs: 20_000 } }))?.trim.endMs, 0);
  assert.equal(wallpaperPayload(project({ sourceDurationMs: 0, trim: { startMs: 0, endMs: 0 } }))?.trim.endMs, 0);
  assert.deepEqual(wallpaperPayload(project({ trim: { startMs: 25_000, endMs: 3000 } }))?.trim, { startMs: 0, endMs: 0 });
  assert.equal(wallpaperPayload(project({ speed: 3 as never }))?.speed, 1);
});

test('wallpaperPayload: GIFs and missing sources are not playable', () => {
  assert.equal(wallpaperPayload(project({ kind: 'gif' })), null);
  assert.equal(wallpaperPayload(project({ sourceUri: '' })), null);
  assert.equal(wallpaperJson(project({ kind: 'gif' })), null);
});
