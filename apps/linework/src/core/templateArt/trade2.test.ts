// Trade & workshop pack, part 2 (owner 23 Oct 2026): 120+ templates in every sub-category, exact labelled angles
// re-measured from the shipped path data, level mix, budgets, bounds, unique names, and names in all 10 pack locales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { trade2, trade2Claims } from './trade2.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';
import { TRADE_SUBS, tradeSubOf } from '../tradeSubs.ts';
import { trade2Names } from '../../i18n/packs/trade2.ts';

/** End points (and control points) of every command in an absolute M L Q A Z path. */
function pts(d: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of d.matchAll(/([MLQA])([^MLQAZ]*)/g)) {
    const n = (m[2]!.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const step = m[1] === 'A' ? 7 : 2;
    for (let i = 0; i + step <= n.length; i += step) out.push(m[1] === 'A' ? [n[i + 5]!, n[i + 6]!] : [n[i]!, n[i + 1]!]);
    if (m[1] === 'Q') for (let i = 0; i + 4 <= n.length; i += 4) out.push([n[i + 2]!, n[i + 3]!]);
  }
  return out;
}

test('trade2: 120+ templates on the Trade & workshop shelf, ids unique', () => {
  assert.ok(trade2.length >= 120, `${trade2.length}`);
  const shelf = new Set(templatesIn('trade').map((t) => t.id));
  for (const t of trade2) {
    assert.equal(t.category, 'trade');
    assert.ok(shelf.has(t.id), t.id);
    assert.match(t.id, /^trade-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const d of [...t.paths, ...(t.detail ?? [])]) assert.doesNotMatch(d, /NaN|undefined|Infinity/, t.id);
  }
  const ids = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'ids unique across the catalogue');
});

test('trade2: every sub-category gets 12+ templates, exactly one sub tag each, tags valid', () => {
  for (const sub of TRADE_SUBS) {
    const n = trade2.filter((t) => tradeSubOf(t) === sub).length;
    assert.ok(n >= 12, `${sub}: ${n}`);
  }
  for (const t of trade2) {
    const tags = t.tags ?? [];
    assert.equal(tags.filter((x) => x.startsWith('sub-')).length, 1, t.id);
    for (const need of ['trade', 'workshop']) assert.ok(tags.includes(need), `${t.id}: ${need}`);
    assert.ok(tags.length >= 5, `${t.id}: needs 2+ more tags`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
  }
});

test('trade2: level mix about 40 / 35 / 25, beginner simple, advanced within budget', () => {
  const count = (l: string) => trade2.filter((t) => t.level === l).length;
  const n = trade2.length;
  assert.ok(count('beginner') >= n * 0.3 && count('beginner') <= n * 0.5, `beginner ${count('beginner')}`);
  assert.ok(count('intermediate') >= n * 0.25 && count('intermediate') <= n * 0.45, `intermediate ${count('intermediate')}`);
  assert.ok(count('advanced') >= n * 0.15 && count('advanced') <= n * 0.35, `advanced ${count('advanced')}`);
  for (const t of trade2) {
    const all = [...t.paths, ...(t.detail ?? [])];
    if (t.level === 'beginner') assert.ok(t.paths.length <= 40, `${t.id}: ${t.paths.length} paths`);
    assert.ok(all.join('').length <= 30000, `${t.id}: ${all.join('').length} chars`);
  }
});

test('trade2: art stays inside the 400 x 400 viewBox', () => {
  for (const t of trade2) {
    for (const d of [...t.paths, ...(t.detail ?? [])]) {
      assert.match(d, /^M[MLQAZ0-9. -]*$/, `${t.id}: absolute M L Q A Z only`);
      for (const sub of samplePath(d, 4)) for (const [x, y] of sub.pts) assert.ok(x >= 2 && x <= 398 && y >= 2 && y <= 398, `${t.id}: ${x},${y}`);
    }
  }
});

test('trade2: 30+ labelled angles are exact in the shipped path data (within 0.1°)', () => {
  const byId = new Map(trade2.map((t) => [t.id, t]));
  const claims = trade2Claims();
  assert.ok(claims.length >= 30, `${claims.length} claims`);
  for (const c of claims) {
    const t = byId.get(c.id);
    assert.ok(t, c.id);
    const all = [...t!.paths, ...(t!.detail ?? [])].flatMap(pts);
    const near = (p: readonly number[]) => all.find((q) => Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!) < 0.11);
    const v = near(c.v), a = near(c.a), b = near(c.b);
    assert.ok(v && a && b, `${c.id}: vertex and ray ends are in the path data`);
    let ang = (Math.atan2(-(b![1]! - v![1]!), b![0]! - v![0]!) - Math.atan2(-(a![1]! - v![1]!), a![0]! - v![0]!)) * (180 / Math.PI);
    ang = ((ang % 360) + 360) % 360;
    const err = Math.min(Math.abs(ang - c.deg), Math.abs(360 - ang - c.deg));
    assert.ok(err < 0.1, `${c.id}: ${ang} vs ${c.deg}`);
  }
});

test('trade2: names unique across the catalogue and translated in all 10 pack locales', () => {
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of trade2) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  assert.equal(Object.keys(trade2Names).length, 10);
  for (const [loc, names] of Object.entries(trade2Names)) {
    for (const t of trade2) assert.ok(names[`templates.name.${t.id}`]?.trim(), `${loc} ${t.id}`);
  }
});
