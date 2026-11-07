// Owner 2026-11-08 ("it keeps re-adding oversized sizes"): theme setup, previews, Edit Widget and
// the Add Widget gallery only offer a piece at a size it was drawn for. The real Alpine Starlight and
// Aurora Haven v3 manifests list every size for their square pieces and heroes; none of those may be
// planned into a size of another shape (the square jar in medium, hero-large in small...).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRemoteArtManifest } from './packCatalog.ts';
import { planThemePieces } from './themeArtSync.ts';
import { drawnForSize, OPTION_SIZE_POINTS, aspectMatch, type HomeOptionSize } from './widgetOptions.ts';

const SIZES: HomeOptionSize[] = ['small', 'medium', 'large'];
const load = (id: string) => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'src', 'core', '__fixtures__', 'packs', 'v3-sizes', `${id}.json`), 'utf8'));
  const r = parseRemoteArtManifest(raw, id);
  assert.ok(r.ok, r.ok ? '' : r.error);
  return r.ok ? r.value.widgets : [];
};

for (const id of ['alpine-starlight', 'aurora-haven']) {
  test(`${id}: every planned piece was drawn for its size; heroes only at their own size`, () => {
    const options = load(id);
    const planned = planThemePieces({ themeId: id, themeName: id, options, name: (o, s) => `${o.id} · ${s}` });
    assert.ok(planned.length > 0);
    for (const p of planned) {
      const option = options.find((o) => o.id === p.optionId);
      assert.ok(option, p.optionId);
      if (!option) continue;
      const hero = /^hero-(small|medium|large)$/.exec(option.id);
      if (hero) assert.equal(p.size, hero[1], `${p.optionId} only at ${hero[1]}`);
      const match = aspectMatch({ w: option.width, h: option.height }, OPTION_SIZE_POINTS[p.size as HomeOptionSize]);
      assert.ok(match >= 0.8, `${p.optionId} is not letterboxed into ${p.size} (match ${match.toFixed(2)})`);
    }
    // Square pieces stay in small and large: medium gets only its wide hero.
    assert.deepEqual(planned.filter((p) => p.size === 'medium').map((p) => p.optionId), ['hero-medium']);
  });
}

test('alpine-starlight: all five decorative pieces are planned for small and large', () => {
  const options = load('alpine-starlight');
  const planned = planThemePieces({ themeId: 'a', themeName: 'a', options, name: (o, s) => `${o.id} · ${s}` });
  for (const size of ['small', 'large'] as const) {
    const ids = planned.filter((p) => p.size === size).map((p) => p.optionId);
    for (const piece of ['copper-eclipse', 'jupiter-polar', 'saturn-rings', 'silver-moon', 'spiral-galaxy']) {
      assert.ok(ids.includes(piece), `${piece} in ${size}`);
    }
  }
});

test('drawnForSize: hero ids own one size; others need the size listed and a matching shape', () => {
  const square = { width: 1024, height: 1024, sizes: SIZES };
  assert.equal(drawnForSize({ id: 'hero-large', ...square }, 'small'), false);
  assert.equal(drawnForSize({ id: 'hero-large', ...square }, 'large'), true);
  assert.equal(drawnForSize({ id: 'moon', ...square }, 'small'), true);
  assert.equal(drawnForSize({ id: 'moon', ...square }, 'medium'), false);
  assert.equal(drawnForSize({ id: 'moon', ...square }, 'large'), true);
  assert.equal(drawnForSize({ id: 'moon', ...square, sizes: ['small'] }, 'large'), false);
  assert.equal(drawnForSize({ id: 'banner', width: 1092, height: 510, sizes: SIZES }, 'medium'), true);
  assert.equal(drawnForSize({ id: 'banner', width: 1092, height: 510, sizes: SIZES }, 'small'), false);
});
