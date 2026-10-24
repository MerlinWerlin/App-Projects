import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, TEMPLATES, type Template } from './templates.ts';
import {
  NEW_SETS,
  SHELF_ORDER,
  isNewTemplate,
  newTemplates,
  parseShelf,
  shelfBubbles,
  shelfCategory,
  shelfGlyph,
  shelfPool,
} from './templateShelf.ts';

const tpl = (id: string, category: Template['category']): Template => ({ id, name: id, category, viewBox: '0 0 400 400', paths: ['M0 0'] });
const LIB: Template[] = [tpl('rose', 'flowers'), tpl('cat', 'animals'), tpl('bun', 'kids'), tpl('bear', 'kids')];

test('New is the most recently added sets (fb-1022 + fb-1022b Sea life and kawaii) and it has art in the library', () => {
  assert.deepEqual([...NEW_SETS], ['heroes', 'game', 'movies', 'fairytales', 'kids', 'sealife', 'trade']);
  const fresh = newTemplates(TEMPLATES);
  assert.ok(fresh.length >= 10);
  assert.ok(fresh.every((t) => NEW_SETS.includes(t.category) || t.id.startsWith('kawaii-') || t.id.startsWith('char-')));
  assert.ok(fresh.some((t) => t.id.startsWith('kawaii-') && t.category === 'cute'));
  assert.equal(isNewTemplate(LIB[0]), false);
  assert.equal(isNewTemplate(LIB[2]), true);
  assert.deepEqual(newTemplates(LIB).map((t) => t.id), ['bun', 'bear']);
});

test('shelf order covers every catalogue category exactly once', () => {
  assert.equal(new Set(SHELF_ORDER).size, SHELF_ORDER.length);
  assert.deepEqual([...SHELF_ORDER].sort(), CATEGORIES.map((c) => c.id).sort());
  // fb-1023b: the paid Trade & workshop pack leads the row.
  assert.deepEqual(SHELF_ORDER.slice(0, 10), ['trade', 'lettering', 'heroes', 'game', 'movies', 'fairytales', 'kids', 'animals', 'flowers', 'cute']);
});

test('parseShelf: new, categories, junk', () => {
  assert.equal(parseShelf('new'), 'new');
  assert.equal(parseShelf(' NEW '), 'new');
  assert.equal(parseShelf('animals'), 'animals');
  assert.equal(parseShelf(['cute', 'animals']), 'cute');
  assert.equal(parseShelf('dragons'), 'all');
  assert.equal(parseShelf(undefined), 'all');
  assert.equal(parseShelf(3), 'all');
});

test('shelfCategory and shelfPool', () => {
  assert.equal(shelfCategory('all'), null);
  assert.equal(shelfCategory('new'), null);
  assert.equal(shelfCategory('animals'), 'animals');
  assert.equal(shelfPool(LIB, 'all'), LIB);
  assert.equal(shelfPool(LIB, 'animals'), LIB);
  assert.deepEqual(shelfPool(LIB, 'new').map((t) => t.id), ['bun', 'bear']);
});

test('shelfBubbles: All, New, then categories with art in shelf order', () => {
  assert.deepEqual(shelfBubbles(LIB), ['all', 'new', 'kids', 'animals', 'flowers']);
  // the current shelf stays visible even with no art
  assert.deepEqual(shelfBubbles(LIB, 'shapes'), ['all', 'new', 'kids', 'animals', 'flowers', 'shapes']);
  // no newest set in the library: no New bubble, unless it is the current shelf
  const old = LIB.slice(0, 2);
  assert.deepEqual(shelfBubbles(old), ['all', 'animals', 'flowers']);
  assert.deepEqual(shelfBubbles(old, 'new'), ['all', 'new', 'animals', 'flowers']);
  // the real library: every category with art, no duplicates
  const real = shelfBubbles(TEMPLATES);
  assert.equal(new Set(real).size, real.length);
  assert.deepEqual(real.slice(0, 2), ['all', 'new']);
  for (const c of CATEGORIES) {
    const has = TEMPLATES.some((t) => t.category === c.id);
    // owner 24 Oct 2026: Trade & workshop lives in the Workshop tab, not in this row.
    assert.equal(real.includes(c.id), has && c.id !== 'trade', c.id);
  }
});

test('shelfGlyph picks the first template of the shelf', () => {
  assert.equal(shelfGlyph(LIB, 'all')?.id, 'rose');
  assert.equal(shelfGlyph(LIB, 'new')?.id, 'bun');
  assert.equal(shelfGlyph(LIB, 'animals')?.id, 'cat');
  assert.equal(shelfGlyph(LIB, 'shapes'), undefined);
  for (const s of shelfBubbles(TEMPLATES)) assert.ok(shelfGlyph(TEMPLATES, s), String(s));
});

test('owner 24 Oct: Trade & workshop lives in the Workshop tab, not the Templates bubble row', async () => {
  const { TAB_SHELVES, shelfBubbles } = await import('./templateShelf.ts');
  const { TEMPLATES } = await import('./templates.ts');
  assert.deepEqual([...TAB_SHELVES], ['trade']);
  assert.ok(!shelfBubbles(TEMPLATES).includes('trade'));
  // A deep link straight to the trade shelf still shows its (selected) bubble.
  assert.ok(shelfBubbles(TEMPLATES, 'trade').includes('trade'));
  assert.ok(TEMPLATES.some((t) => t.category === 'trade'));
});
