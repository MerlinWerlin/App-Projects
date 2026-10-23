// Scene templates (buildings, landscapes, fantasy, still life, faces): ids, levels, categories, budgets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scenes } from './scenes.ts';
import { TEMPLATES } from '../templates.ts';

const CATS = new Set(['places', 'fantasy', 'stilllife', 'faces']);

test('scenes: ids are prefixed, unique and registered in the catalogue', () => {
  assert.ok(scenes.length >= 16, `expected at least 16 scene templates, got ${scenes.length}`);
  const ids = scenes.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of scenes) {
    assert.match(t.id, /^scn-[a-z0-9-]+$/, t.id);
    assert.ok(TEMPLATES.some((x) => x.id === t.id), `${t.id} missing from TEMPLATES`);
    assert.ok(CATS.has(t.category), `${t.id}: unexpected category ${t.category}`);
    assert.equal(t.viewBox, '0 0 400 400');
    assert.ok(t.name.length > 2);
    assert.ok((t.tags ?? []).length >= 3, `${t.id}: needs search tags`);
  }
});

test('scenes: every level and every scene category is represented', () => {
  for (const level of ['beginner', 'intermediate', 'advanced']) {
    assert.ok(scenes.some((t) => t.level === level), `no ${level} scene`);
  }
  for (const c of CATS) assert.ok(scenes.some((t) => t.category === c), `no scene in ${c}`);
  for (const t of scenes) assert.ok(t.level, `${t.id}: level must be explicit`);
});

test('scenes: path budget and detail split', () => {
  for (const t of scenes) {
    const all = [...t.paths, ...(t.detail ?? [])];
    const chars = all.reduce((n, d) => n + d.length, 0);
    assert.ok(chars <= 30000, `${t.id}: ${chars} chars of path data`);
    assert.ok(all.length <= 300, `${t.id}: ${all.length} path strings`);
    for (const d of all) assert.ok(!/[a-z]/.test(d), `${t.id}: relative commands are not allowed`);
    if (t.level === 'advanced') assert.ok((t.detail ?? []).length > 0, `${t.id}: advanced art needs detail lines`);
  }
});

test('scenes: occasion tags cover the main card occasions', () => {
  const tags = new Set(scenes.flatMap((t) => t.tags ?? []));
  for (const occ of ['birthday', 'christmas', 'wedding', 'halloween', 'gift']) assert.ok(tags.has(occ), occ);
});
