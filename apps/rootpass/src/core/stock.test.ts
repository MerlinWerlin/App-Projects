// The stocked-steel catalogue: every group sourced, sizes sane, units converted, unverified groups empty.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOGUES } from './catalogue.ts';
import { COUNTRIES, NPS_PIPES } from './country.ts';
import { catalogueFor, sizeLabel, stockFor, stockLengths } from './stock.ts';
import { weight, type ShapeId } from './weight.ts';

const CODES = ['AU', 'NZ', 'GB', 'IE', 'US', 'CA'] as const;
const SHAPES: ShapeId[] = ['shs', 'chs', 'angle', 'flat', 'plate', 'round'];

test('every verified group has a source and a non-empty list; unverified groups are empty', () => {
  for (const c of CODES) {
    const cat = CATALOGUES[c];
    for (const key of ['shs', 'rhs', 'chs', 'angle', 'flat', 'plate', 'round'] as const) {
      const g = cat[key];
      if (g.verified) {
        assert.ok(g.items.length > 0, `${c} ${key} verified but empty`);
        assert.match(g.src, /^https:\/\//, `${c} ${key} source`);
      } else {
        assert.equal(g.items.length, 0, `${c} ${key} unverified but has items`);
      }
    }
    assert.match(cat.pipe.src, /^https:\/\//, `${c} pipe source`);
    assert.match(cat.lengths.src, /^https:\/\//, `${c} lengths source`);
  }
});

test('every stocked size is physically sensible and weighs something', () => {
  for (const c of CODES) {
    for (const shape of SHAPES) {
      const g = stockFor(c, shape);
      if (!g || !g.verified) continue;
      for (const s of g.sizes) {
        for (const d of s.dims) assert.ok(d > 0 && d < 1000, `${c} ${shape} ${s.label} dim ${d}`);
        for (const w of s.walls) {
          assert.ok(w.mm > 0, `${c} ${shape} ${s.label} wall`);
          if (shape === 'shs' || shape === 'chs') assert.ok(w.mm < Math.min(...s.dims) / 2, `${c} ${shape} ${s.label} wall ${w.mm} too thick`);
        }
        // Each size and its thinnest wall must go through the weight calculator.
        const wall = s.walls[0]?.mm;
        const dims = shape === 'shs' || shape === 'angle' ? [s.dims[0], s.dims[1], wall] : shape === 'chs' || shape === 'flat' ? [s.dims[0], wall] : shape === 'plate' ? [1000, s.dims[0]] : [s.dims[0]];
        const r = weight({ shape, material: 'mild', dims, length: 1000, qty: 1 });
        assert.ok(r.ok, `${c} ${shape} ${s.label} ${JSON.stringify(dims)}: ${r.ok ? '' : r.error}`);
      }
    }
  }
});

test('AU box section from the catalogue matches the Australian Tube Mills mass', () => {
  const g = stockFor('AU', 'shs')!;
  const s = g.sizes.find(x => x.label === '50 × 50')!;
  const w = s.walls.find(x => x.mm === 3)!;
  const r = weight({ shape: 'shs', material: 'mild', dims: [s.dims[0], s.dims[1], w.mm], length: 1000, qty: 1 });
  assert.ok(r.ok && Math.abs(r.value.perMetre - 4.25) < 0.01);
});

test('US sizes are converted from inches and labelled the way merchants write them', () => {
  const g = stockFor('US', 'shs')!;
  const s = g.sizes.find(x => x.label === '1-1/2 × 1-1/2"')!;
  assert.ok(Math.abs(s.dims[0] - 38.1) < 1e-9);
  assert.ok(s.walls.some(w => w.label === '0.065"' && Math.abs(w.mm - 1.651) < 1e-9));
  const s2 = g.sizes.find(x => x.label === '1-1/4 × 1-1/4"')!;
  assert.ok(s2.walls.some(w => w.label === '3/16"' && Math.abs(w.mm - 4.7625) < 1e-9), 'fractional walls as exact fractions');
  assert.equal(sizeLabel(0.125, 'in'), '1/8');
  assert.equal(sizeLabel(0.188, 'in'), '3/16');
  assert.equal(sizeLabel(0.065, 'in'), '0.065');
  assert.equal(sizeLabel(0.12, 'in'), '0.120');
  assert.equal(sizeLabel(1.5, 'in'), '1-1/2');
  assert.equal(sizeLabel(2, 'in'), '2');
  assert.equal(sizeLabel(2.5, 'mm'), '2.5');
});

test('the merchant NPS walls agree with the ASME B36.10M table in country.ts', () => {
  for (const p of CATALOGUES.US.pipe.sizes) {
    const mine = NPS_PIPES.find(n => n.label === p.name);
    if (!mine) continue;
    assert.ok(Math.abs(mine.od - p.od * 25.4) < 1e-6, `${p.name} OD`);
    for (const [sch, w] of Object.entries(p.walls)) {
      const key = sch.replace('Sch', 'Sch ');
      if (mine.walls![key] !== undefined) assert.ok(Math.abs(mine.walls![key] - w * 25.4) < 1e-6, `${p.name} ${sch}`);
    }
  }
});

test('stock lengths per country', () => {
  assert.deepEqual(stockLengths('AU', 'tube'), [6500, 8000, 12000]);
  assert.deepEqual(stockLengths('GB', 'tube'), [7500]);
  assert.deepEqual(stockLengths('IE', 'tube'), [7600, 12200]);
  assert.deepEqual(stockLengths('US', 'tube').map(v => Math.round(v * 10) / 10), [6096, 7315.2]);
  assert.equal(stockLengths('CA', 'tube')[0], 6096);
  assert.deepEqual(stockLengths('OTHER', 'tube'), []);
});

test('no catalogue for other countries; Canada shows only what was verified', () => {
  assert.equal(catalogueFor('OTHER'), null);
  assert.equal(stockFor('OTHER', 'shs'), null);
  assert.equal(stockFor('CA', 'shs')!.verified, true);
  assert.equal(stockFor('CA', 'angle')!.verified, false);
  assert.equal(stockFor('CA', 'flat')!.verified, false);
  assert.equal(stockFor('CA', 'square'), null);
  // No structural CHS list for the US: pipe sizes are offered instead, with their schedule walls.
  const usChs = stockFor('US', 'chs')!;
  assert.equal(usChs.verified, true);
  assert.ok(usChs.sizes[0].label.startsWith('NPS'));
  assert.ok(usChs.sizes.some(s => s.walls.some(w => w.label === 'Sch 40')));
  for (const c of CODES) assert.ok(COUNTRIES[c].pipes.length >= 12);
});
