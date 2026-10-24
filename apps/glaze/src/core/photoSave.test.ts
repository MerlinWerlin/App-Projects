import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  SAVE_FAILURES,
  captureAttempts,
  classifySaveError,
  offersOpenSettings,
  runPhotoSave,
  saveFailureKey,
  withImageExtension,
  type SaveSteps,
} from './photoSave.ts';

function steps(over: Partial<SaveSteps> = {}): SaveSteps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    platform: 'ios',
    access: async () => {
      calls.push('access');
      return 'granted';
    },
    render: async () => {
      calls.push('render');
    },
    capture: async (a) => {
      calls.push(`capture:${a.useRenderInContext ? 'ctx' : 'default'}`);
      return '/private/var/tmp/ReactNative/abc.png';
    },
    rename: async (from, to) => {
      calls.push(`rename:${from}->${to}`);
    },
    save: async (uri) => {
      calls.push(`save:${uri}`);
    },
    ...over,
  };
}

test('happy path: access, render, one capture, save a file:// png', async () => {
  const s = steps();
  const res = await runPhotoSave(s);
  assert.deepEqual(res, { ok: true, uri: 'file:///private/var/tmp/ReactNative/abc.png' });
  assert.deepEqual(s.calls, ['access', 'render', 'capture:ctx', 'save:file:///private/var/tmp/ReactNative/abc.png']);
});

test('denied or blocked access never captures and offers Open Settings', async () => {
  for (const access of ['denied', 'blocked'] as const) {
    const s = steps({ access: async () => access });
    const res = await runPhotoSave(s);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, 'denied');
      assert.ok(offersOpenSettings(res.reason));
    }
  }
});

test('a throwing permission request is reported, not thrown', async () => {
  const res = await runPhotoSave(steps({ access: async () => { throw new Error('Missing NSPhotoLibraryAddUsageDescription permission'); } }));
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, 'denied');
});

test('iOS off-screen snapshot failure falls back to the default strategy', async () => {
  const s = steps({
    capture: async (a) => {
      s.calls.push(`capture:${a.useRenderInContext ? 'ctx' : 'default'}`);
      if (a.useRenderInContext) throw new Error('renderInContext failed');
      return 'file:///tmp/x.png';
    },
  });
  const res = await runPhotoSave(s);
  assert.equal(res.ok, true);
  assert.ok(s.calls.includes('capture:ctx') && s.calls.includes('capture:default'));
});

test('every capture attempt failing gives reason capture with the real message', async () => {
  const res = await runPhotoSave(
    steps({
      capture: async () => {
        throw new Error('The view cannot be captured. drawViewHierarchyInRect was not successful.');
      },
    }),
  );
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, 'capture');
    assert.match(res.detail ?? '', /drawViewHierarchyInRect/);
  }
});

test('render timeout and unreadable photo are told apart', async () => {
  const t = await runPhotoSave(steps({ render: async () => { throw new Error('Wallpaper did not render in time'); } }));
  assert.equal(!t.ok && t.reason, 'timeout');
  const u = await runPhotoSave(steps({ render: async () => { throw new Error('Image could not be read'); } }));
  assert.equal(!u.ok && u.reason, 'unreadable');
});

test('a capture without an extension is copied to a .png before saving', async () => {
  const s = steps({ capture: async () => '/tmp/ReactNative/abc' });
  const res = await runPhotoSave(s);
  assert.equal(res.ok, true);
  assert.ok(s.calls.includes('rename:file:///tmp/ReactNative/abc->file:///tmp/ReactNative/abc.png'));
  assert.ok(s.calls.includes('save:file:///tmp/ReactNative/abc.png'));
});

test('a Photos save error is classified (storage, permission, unknown)', async () => {
  const full = await runPhotoSave(steps({ save: async () => { throw new Error('Not enough storage space'); } }));
  assert.equal(!full.ok && full.reason, 'storage');
  const perm = await runPhotoSave(steps({ save: async () => { throw new Error('This app is not authorized'); } }));
  assert.equal(!perm.ok && perm.reason, 'denied');
  const other = await runPhotoSave(steps({ save: async () => { throw new Error('E_UNKNOWN 3302'); } }));
  assert.equal(!other.ok && other.reason, 'unknown');
});

test('capture strategies per platform', () => {
  assert.deepEqual(captureAttempts('ios').map((a) => a.useRenderInContext), [true, false]);
  assert.deepEqual(captureAttempts('android').map((a) => a.useRenderInContext), [false]);
});

test('withImageExtension keeps image names and adds file://', () => {
  assert.equal(withImageExtension('/a/b.PNG'), 'file:///a/b.PNG');
  assert.equal(withImageExtension('file:///a/b.jpg'), 'file:///a/b.jpg');
  assert.equal(withImageExtension('file:///a/b'), 'file:///a/b.png');
  assert.equal(classifySaveError('Already saving'), 'busy');
});

test('every reason has words in every theme locale, and the UI uses the pipeline', () => {
  for (const loc of ['en', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pt-BR', 'zh-Hans', 'ar', 'hi']) {
    const src = readFileSync(new URL(`../i18n/ns/theme/${loc}.ts`, import.meta.url), 'utf8');
    const why = src.slice(src.indexOf('why:'));
    assert.ok(src.includes('why:'), `${loc} has theme.save.why`);
    for (const r of SAVE_FAILURES) assert.match(why, new RegExp(`\\b${r}:`), `${loc} ${saveFailureKey(r)}`);
  }
  const saver = readFileSync(new URL('../render/saveWallpaper.ts', import.meta.url), 'utf8');
  assert.match(saver, /runPhotoSave\(/);
  assert.match(saver, /useRenderInContext/);
  const detail = readFileSync(new URL('../../app/theme/[id].tsx', import.meta.url), 'utf8');
  assert.match(detail, /saveFailureKey\(/);
  assert.match(detail, /offersOpenSettings\(/);
});
