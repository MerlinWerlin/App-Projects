// Trade & workshop pack (fb-1023b): count, category, exact angles, Plus-only, names in every locale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { trade, claimedAngles } from './trade.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';
import { tradeNames } from '../../i18n/packs/trade.ts';

function pts(d: string): [number, number][] {
  const n = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i]!, n[i + 1]!]);
  return out;
}

test('trade: 60+ templates, all on the Trade & workshop shelf, three levels', () => {
  assert.ok(trade.length >= 60, `${trade.length}`);
  const shelf = new Set(templatesIn('trade').map((t) => t.id));
  for (const t of trade) {
    assert.equal(t.category, 'trade');
    assert.ok(shelf.has(t.id), t.id);
    assert.match(t.id, /^trade-[a-z0-9-]+$/);
    for (const d of [...t.paths, ...(t.detail ?? [])]) assert.doesNotMatch(d, /NaN|undefined|Infinity/, t.id);
  }
  for (const l of ['beginner', 'intermediate', 'advanced']) assert.ok(trade.some((t) => t.level === l), l);
  const ids = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'ids unique');
});

test('trade: every labelled angle is exact in the drawn path data (within 0.1°)', () => {
  const byId = new Map(trade.map((t) => [t.id, t]));
  for (const c of claimedAngles()) {
    const t = byId.get(c.id);
    assert.ok(t, c.id);
    // the rounded coordinates that ship must still give the angle
    const all = t!.paths.flatMap(pts);
    const near = (p: readonly number[]) => all.find((q) => Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!) < 0.11)!;
    const v = near(c.v), a = near(c.a), b = near(c.b);
    assert.ok(v && a && b, `${c.id}: vertex and ray ends are in the path data`);
    const ang = (Math.atan2(-(b[1]! - v[1]!), b[0]! - v[0]!) - Math.atan2(-(a[1]! - v[1]!), a[0]! - v[0]!)) * (180 / Math.PI);
    assert.ok(Math.abs(Math.abs(ang) - c.deg) < 0.1, `${c.id}: ${ang} vs ${c.deg}`);
  }
});

test('trade: every name translated in all 10 pack locales', () => {
  for (const [loc, names] of Object.entries(tradeNames)) {
    for (const t of trade) assert.ok(names[`templates.name.${t.id}`], `${loc} ${t.id}`);
  }
});
