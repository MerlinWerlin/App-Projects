// Owner 2026-11-08 ("there is a black spot in the copper moon"): a hero that copies one of its pack's
// pieces is not offered; the piece is. Alpine Starlight's small hero is a damaged copy of copper-eclipse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRemoteArtManifest } from './packCatalog.ts';
import { planThemePieces } from './themeArtSync.ts';
import { HERO_COPIES, isHeroCopy } from './heroCopies.ts';
import { drawnForSize } from './widgetOptions.ts';

const alpine = () => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'src', 'core', '__fixtures__', 'packs', 'v3-sizes', 'alpine-starlight.json'), 'utf8'));
  const r = parseRemoteArtManifest(raw, 'alpine-starlight');
  assert.ok(r.ok, r.ok ? '' : r.error);
  return r.ok ? r.value.widgets : [];
};

test('heroCopies: keys are content-hashed small / large hero files', () => {
  const keys = Object.keys(HERO_COPIES);
  assert.ok(keys.length >= 100);
  for (const k of keys) assert.match(k, /^widget-(small|large)\.[0-9a-f]{8}\.webp$/);
  assert.equal(isHeroCopy(null), false);
  assert.equal(isHeroCopy('widget-medium.5a7b8f1e.webp'), false);
});

test('alpine-starlight: the damaged small hero and the saturn copy are not planned; their pieces are', () => {
  const options = alpine();
  const planned = planThemePieces({ themeId: 'a', themeName: 'a', options, name: (o, s) => `${o.id} · ${s}` });
  const at = (size: string) => planned.filter((p) => p.size === size).map((p) => p.optionId);
  assert.ok(!at('small').includes('hero-small'), 'damaged copper copy left out of small');
  assert.ok(!at('large').includes('hero-large'), 'saturn copy left out of large');
  assert.ok(at('small').includes('copper-eclipse'));
  assert.ok(at('large').includes('saturn-rings'));
  assert.deepEqual(at('medium'), ['hero-medium']);
  // No picture twice in one size.
  for (const s of ['small', 'medium', 'large']) assert.equal(new Set(at(s)).size, at(s).length);
});

test('drawnForSize: a hero that is not a listed copy is still offered at its own size', () => {
  const hero = { id: 'hero-small', sizes: ['small', 'medium', 'large'] as const, width: 510, height: 510 };
  assert.equal(drawnForSize({ ...hero, sizes: [...hero.sizes], image: 'widget-small.00000000.webp' }, 'small'), true);
  assert.equal(drawnForSize({ ...hero, sizes: [...hero.sizes], image: 'widget-small.b10e2c03.webp' }, 'small'), false);
});
