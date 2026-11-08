import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { cardPhotoProblem, type CardPhotoFailure, type CardPhotoSource } from './followups92.ts';
import type { PermissionState } from './permissions.ts';

const root = new URL('../..', import.meta.url).pathname;

test('card photo: closing the picker or camera says nothing', () => {
  assert.equal(cardPhotoProblem('library', 'canceled'), null);
  assert.equal(cardPhotoProblem('camera', 'canceled'), null);
});

test('card photo: camera refused offers Settings, not-yet-decided asks again from the button', () => {
  assert.deepEqual(cardPhotoProblem('camera', 'denied', 'blocked'), { key: 'f92.camera.denied', settings: true });
  assert.deepEqual(cardPhotoProblem('camera', 'denied'), { key: 'f92.camera.denied', settings: true });
  assert.deepEqual(cardPhotoProblem('camera', 'denied', 'ask'), { key: 'f92.camera.ask', settings: false });
  assert.deepEqual(cardPhotoProblem('camera', 'unavailable'), { key: 'f92.camera.unavailable', settings: false });
});

test('card photo: library failures keep the T88 wording', () => {
  assert.deepEqual(cardPhotoProblem('library', 'denied', 'blocked'), { key: 'f91.photo.denied', settings: true });
  assert.deepEqual(cardPhotoProblem('library', 'denied', 'unavailable'), { key: 'f91.photo.denied', settings: false });
  assert.deepEqual(cardPhotoProblem('library', 'storage'), { key: 'journal.edit.photos.storage', settings: false });
  assert.deepEqual(cardPhotoProblem('library', 'unreadable'), { key: 'journal.edit.photos.unreadable', settings: false });
});

test('card photo: every message is in the catalogue', () => {
  const sources: CardPhotoSource[] = ['library', 'camera'];
  const reasons: CardPhotoFailure[] = ['denied', 'unavailable', 'unreadable', 'storage'];
  const perms: (PermissionState | undefined)[] = [undefined, 'ask', 'blocked', 'unavailable', 'limited'];
  for (const s of sources) for (const r of reasons) for (const p of perms) {
    const out = cardPhotoProblem(s, r, p);
    assert.ok(out, `${s} ${r} ${p}`);
    assert.ok(out.key in en, out.key);
  }
});

test('f92 strings: all in followups92.ts', () => {
  const src = readFileSync(`${root}src/i18n/en/followups92.ts`, 'utf8');
  const keys = Object.keys(en).filter((k) => k.startsWith('f92.'));
  assert.ok(keys.length >= 7);
  for (const k of keys) assert.ok(src.includes(`'${k}'`), `${k} lives in followups92.ts`);
});

test('camera permission: app.json declares it in both places and names membership cards (applied in T159)', () => {
  const app = JSON.parse(readFileSync(`${root}app.json`, 'utf8'));
  const plist: string = app.expo.ios.infoPlist.NSCameraUsageDescription;
  const plugin = app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-image-picker');
  assert.ok(plist && plist.length > 20, 'NSCameraUsageDescription');
  assert.ok(plugin, 'expo-image-picker plugin');
  assert.equal(plugin[1].cameraPermission, plist);
  // T159 applied the queued wording (docs/RELEASE_CHECKLIST.md "Next native build"; docs/APP_PRIVACY.md).
  assert.match(plist, /membership card/);
});

test('card editor offers both the library and the camera', () => {
  const src = readFileSync(`${root}app/loyalty-edit.tsx`, 'utf8');
  assert.match(src, /pickJournalPhotos\(1\)/);
  assert.match(src, /takeJournalPhoto\(\)/);
  assert.match(src, /f92\.camera\.take/);
});
