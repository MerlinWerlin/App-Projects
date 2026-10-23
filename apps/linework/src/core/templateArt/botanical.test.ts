// Botanical & floral template pack: ids, levels, tags and per-template budgets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { botanical } from './botanical.ts';
import { TEMPLATES, templateLevel } from '../templates.ts';

const chars = (paths: readonly string[]): number => paths.reduce((n, d) => n + d.length, 0);

test('botanical: a curated pack of 16-24 flower templates with bot- ids', () => {
  assert.ok(botanical.length >= 16 && botanical.length <= 24, `${botanical.length} templates`);
  for (const t of botanical) {
    assert.match(t.id, /^bot-[a-z0-9]+(?:-[a-z0-9]+)*$/, t.id);
    assert.equal(t.category, 'flowers', t.id);
    assert.equal(t.viewBox, '0 0 400 400', t.id);
    assert.ok(t.tags && t.tags.includes('botanical'), `${t.id}: tagged botanical`);
    assert.ok(TEMPLATES.some((x) => x.id === t.id), `${t.id} is registered`);
  }
});

test('botanical: every level is represented with a sensible spread', () => {
  const count = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const t of botanical) {
    assert.ok(t.level, `${t.id}: explicit level`);
    count[templateLevel(t)]++;
  }
  assert.ok(count.beginner >= 3, `beginner ${count.beginner}`);
  assert.ok(count.intermediate >= 5, `intermediate ${count.intermediate}`);
  assert.ok(count.advanced >= 5, `advanced ${count.advanced}`);
});

test('botanical: occasion tags cover weddings, love, birthdays, Christmas and thanks', () => {
  const tags = new Set(botanical.flatMap((t) => t.tags ?? []));
  for (const occ of ['wedding', 'love', 'birthday', 'christmas', 'thanks']) assert.ok(tags.has(occ), occ);
});

test('botanical: path budget (<= 30000 chars, <= 300 path strings) and absolute commands only', () => {
  for (const t of botanical) {
    const all = [...t.paths, ...(t.detail ?? [])];
    assert.ok(all.length <= 300, `${t.id}: ${all.length} paths`);
    assert.ok(chars(all) <= 30000, `${t.id}: ${chars(all)} chars`);
    for (const d of all) {
      assert.match(d, /^M[MLCQAZ0-9.\s-]*$/, `${t.id}: absolute M/L/C/Q/A/Z only`);
      for (const n of d.match(/-?\d+(?:\.\d+)?/g) ?? []) assert.ok(!/\.\d\d/.test(n), `${t.id}: 1-decimal coords`);
    }
  }
});

test('botanical: advanced templates are genuinely intricate, beginner ones stay simple', () => {
  for (const t of botanical) {
    const n = chars([...t.paths, ...(t.detail ?? [])]);
    if (templateLevel(t) === 'advanced') {
      assert.ok(n >= 10000, `${t.id}: advanced but only ${n} chars`);
      assert.ok((t.detail ?? []).length > 0, `${t.id}: advanced needs fine detail lines`);
    }
    if (templateLevel(t) === 'beginner') assert.ok(n <= 6000, `${t.id}: beginner but ${n} chars`);
  }
});
