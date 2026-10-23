// Ornament templates (frames, patterns, mandalas, lettering): ids, categories, levels, budgets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ornament } from './ornament.ts';

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

test('ornament: ids are prefixed, unique, and categories are patterns/mandalas/lettering', () => {
  assert.ok(ornament.length >= 18, `only ${ornament.length} templates`);
  const ids = new Set<string>();
  for (const t of ornament) {
    assert.match(t.id, /^orn-[a-z0-9-]+$/, t.id);
    assert.ok(!ids.has(t.id), `duplicate ${t.id}`);
    ids.add(t.id);
    assert.ok(['patterns', 'mandalas', 'lettering'].includes(t.category), `${t.id}: ${t.category}`);
    assert.equal(t.viewBox, '0 0 400 400');
    assert.ok((t.tags ?? []).length >= 2, `${t.id}: needs tags`);
  }
  for (const c of ['patterns', 'mandalas', 'lettering']) {
    assert.ok(ornament.some((t) => t.category === c), `no ${c}`);
  }
});

test('ornament: every level is represented, including within mandalas and lettering', () => {
  for (const level of LEVELS) {
    assert.ok(ornament.some((t) => t.level === level), `no ${level}`);
  }
  for (const c of ['mandalas', 'lettering', 'patterns']) {
    const levels = new Set(ornament.filter((t) => t.category === c).map((t) => t.level));
    assert.ok(levels.has('beginner') && levels.has('intermediate') && levels.has('advanced'), `${c}: ${[...levels]}`);
  }
  assert.ok(ornament.filter((t) => t.level === 'advanced').length >= 6);
  assert.ok(ornament.filter((t) => t.level === 'beginner').length >= 3);
});

test('ornament: occasions are covered (birthday, christmas, wedding, love, thanks)', () => {
  for (const tag of ['birthday', 'christmas', 'wedding', 'love', 'thanks']) {
    assert.ok(ornament.some((t) => t.tags?.includes(tag)), `no ${tag} template`);
  }
});

test('ornament: path budget (<= 30000 chars, <= 300 paths) and absolute commands only', () => {
  for (const t of ornament) {
    const all = [...t.paths, ...(t.detail ?? [])];
    const chars = all.reduce((n, d) => n + d.length, 0);
    assert.ok(chars <= 30000, `${t.id}: ${chars} chars`);
    assert.ok(all.length <= 300, `${t.id}: ${all.length} paths`);
    for (const d of all) {
      assert.match(d, /^M/, `${t.id}: path must start with M`);
      assert.match(d, /^[MLQCAZ0-9.\s-]+$/, `${t.id}: absolute M/L/Q/C/A/Z commands only`);
      assert.doesNotMatch(d, /\d\.\d\d/, `${t.id}: coordinates use one decimal`);
    }
  }
});

test('ornament: advanced pieces are genuinely detailed', () => {
  for (const t of ornament.filter((x) => x.level === 'advanced')) {
    const chars = [...t.paths, ...(t.detail ?? [])].reduce((n, d) => n + d.length, 0);
    assert.ok(chars > 6000, `${t.id}: only ${chars} chars of line art`);
  }
});
