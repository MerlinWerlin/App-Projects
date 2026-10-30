// T170: themed vs monogram vs photo classification for the install screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getById } from './catalogue.ts';
import { coverageRows, coverageSummary, iconCoverage } from './iconCoverage.ts';
import { resolveSpec } from './iconspec.ts';
import { MONOGRAM_GLYPH } from './monogram.ts';
import { THEMES } from './themes.ts';

test('iconCoverage: photo > monogram > themed', () => {
  assert.equal(iconCoverage({ appId: 'a', glyph: 'camera' }), 'themed');
  assert.equal(iconCoverage({ appId: 'a', glyph: MONOGRAM_GLYPH }), 'monogram');
  assert.equal(iconCoverage({ appId: 'a', glyph: '' }), 'monogram');
  assert.equal(iconCoverage({ appId: 'a', glyph: 'not-a-glyph' }), 'monogram');
  assert.equal(iconCoverage({ appId: 'a', glyph: MONOGRAM_GLYPH, overrideImage: 'file:///x.png' }), 'photo');
  assert.equal(iconCoverage({ appId: 'a', glyph: 'camera', overrideImage: 'file:///x.png' }), 'photo');
  assert.equal(iconCoverage({ appId: 'a', glyph: 'camera', overrideImage: '  ' }), 'themed');
});

test('coverageSummary counts each app once and lists monograms in order', () => {
  const s = coverageSummary([
    { appId: 'spotify', glyph: 'music' },
    { appId: 'custom-bike', glyph: MONOGRAM_GLYPH },
    { appId: 'mail', glyph: 'mail' },
    { appId: 'custom-zz', glyph: 'nope' },
    { appId: 'mail', glyph: 'mail' },
    { appId: 'photos', glyph: 'image', overrideImage: 'file:///p.png' },
  ]);
  assert.deepEqual(s, { total: 5, themed: 2, monogram: 2, photo: 1, monogramIds: ['custom-bike', 'custom-zz'] });
  assert.deepEqual(coverageSummary([]), { total: 0, themed: 0, monogram: 0, photo: 0, monogramIds: [] });
});

test('coverageRows: monograms first, then photos, then themed; stable', () => {
  const rows = coverageRows([
    { appId: 'a', glyph: 'music' },
    { appId: 'b', glyph: MONOGRAM_GLYPH },
    { appId: 'c', glyph: 'mail', overrideImage: 'file:///c.png' },
    { appId: 'd', glyph: 'mail' },
    { appId: 'e', glyph: '' },
    { appId: 'a', glyph: 'music' },
  ]);
  assert.deepEqual(rows.map((r) => `${r.spec.appId}:${r.coverage}`), ['b:monogram', 'e:monogram', 'c:photo', 'a:themed', 'd:themed']);
});

test('every catalogue app is themed in every theme; a custom app is a monogram', () => {
  const ids = ['spotify', 'instagram', 'mail', 'maps', 'duolingo'];
  for (const t of THEMES) {
    for (const id of ids) {
      const e = getById(id);
      assert.ok(e, id);
      assert.equal(iconCoverage(resolveSpec(e, t.iconStyle)), 'themed', `${t.id} ${id}`);
    }
    const custom = resolveSpec({ id: 'custom-bike', name: 'Bike Club', urlScheme: null, glyph: MONOGRAM_GLYPH }, t.iconStyle);
    assert.equal(iconCoverage(custom), 'monogram');
  }
});
