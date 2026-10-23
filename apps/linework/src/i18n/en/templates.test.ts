// Runtime-built keys (tDynamic) have no compile-time check, so this asserts the English catalogue covers every
// id the UI looks up: template names, categories, levels, collections and the setup guide steps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { en } from './index.ts';
import { CATEGORIES, LEVELS, TEMPLATES } from '../../core/templates.ts';
import { COLLECTIONS } from '../../core/templateSearch.ts';
import { SETUP_GUIDE_STEPS } from '../../core/setupGuide.ts';

const EN: Readonly<Record<string, unknown>> = en;

function missing(keys: readonly string[]): string[] {
  return keys.filter((k) => EN[k] === undefined);
}

test('every template has an English name key matching the catalogue', () => {
  assert.deepEqual(missing(TEMPLATES.map((t) => `templates.name.${t.id}`)), [], 'run node scripts/i18n-template-names.mjs');
  for (const t of TEMPLATES) assert.equal(EN[`templates.name.${t.id}`], t.name, t.id);
  const extra = Object.keys(EN).filter((k) => k.startsWith('templates.name.') && !TEMPLATES.some((t) => `templates.name.${t.id}` === k));
  assert.deepEqual(extra, [], 'stale template names');
});

test('categories, levels and collections have English labels', () => {
  assert.deepEqual(missing(CATEGORIES.map((c) => `templates.category.${c.id}`)), []);
  assert.deepEqual(missing(LEVELS.map((l) => `templates.level.${l.id}`)), []);
  assert.deepEqual(missing(COLLECTIONS.map((c) => `templates.collection.${c.id}`)), []);
  assert.deepEqual(missing(COLLECTIONS.map((c) => `templates.collectionShort.${c.id}`)), []);
  for (const c of CATEGORIES) assert.equal(EN[`templates.category.${c.id}`], c.label);
  for (const c of COLLECTIONS) assert.equal(EN[`templates.collection.${c.id}`], c.label);
});

test('setup guide steps have English title and body matching the step data', () => {
  const keys = SETUP_GUIDE_STEPS.flatMap((s) => [`home.guide.step.${s.id}.title`, `home.guide.step.${s.id}.body`]);
  assert.deepEqual(missing(keys), []);
  for (const s of SETUP_GUIDE_STEPS) {
    assert.equal(EN[`home.guide.step.${s.id}.title`], s.title);
    assert.equal(EN[`home.guide.step.${s.id}.body`], s.body);
  }
  const stale = Object.keys(EN).filter((k) => k.startsWith('home.tip.') || k.startsWith('home.tips.'));
  assert.deepEqual(stale, [], 'old first-run tip keys removed');
});
