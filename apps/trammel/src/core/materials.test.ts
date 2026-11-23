import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUIDED } from './country.ts';
import { CATALOGUES, materialsFor } from './materials.ts';

test('every guided country has a verified catalogue with sane sizes and sources', () => {
  for (const c of GUIDED) {
    const cat = materialsFor(c);
    assert.equal(cat.country, c);
    assert.equal(cat.verified, true, c);
    assert.ok(cat.sources.length > 0, c);
    assert.ok(cat.framing.length >= 2 && cat.decking.length >= 2 && cat.sheets.length >= 2, c);
    const ids = [...cat.framing, ...cat.decking, ...cat.sheets].map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, `${c} ids unique`);
    for (const f of cat.framing) {
      assert.ok(f.w > f.d && f.d >= 30 && f.w <= 300, `${f.id} section ${f.w} x ${f.d}`);
      assert.ok(f.lengths.length > 0 && f.lengths.every((l) => l >= 1800 && l <= 7400), `${f.id} lengths`);
    }
    for (const d of cat.decking) assert.ok(d.w > d.t && d.t >= 18 && d.lengths.every((l) => l >= 1800), d.id);
    for (const s of cat.sheets) assert.ok(s.l >= s.w && s.thicknesses.every((t) => t > 0 && t < 40), s.id);
  }
});

test('spot checks against the cited listings', () => {
  const au = CATALOGUES.AU.framing.find((f) => f.id === 'au-90x45')!;
  assert.ok(au.lengths.includes(2400) && au.lengths.includes(6000));
  const us = CATALOGUES.US.framing.find((f) => f.id === 'us-2x4')!;
  assert.equal(Math.round(us.w), 89);
  assert.equal(Math.round(us.d), 38);
  assert.ok(us.lengths.includes(2353)); // 92 5/8 in precut stud
  assert.ok(us.lengths.includes(2438)); // 8 ft
  const gb = CATALOGUES.GB.framing.find((f) => f.id === 'gb-47x100')!;
  assert.deepEqual([gb.w, gb.d], [95, 45]); // regularised 47 x 100
  assert.ok(CATALOGUES.NZ.framing.find((f) => f.id === 'nz-90x45')!.lengths.includes(2330)); // NZ precut stud
});

test('anywhere else gets generic sizes, clearly marked unverified', () => {
  const g = materialsFor('OTHER');
  assert.equal(g.verified, false);
  assert.match(g.label, /Generic/);
});
