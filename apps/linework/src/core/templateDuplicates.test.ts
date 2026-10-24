// fb-1022b B4: no near-duplicate shapes in the template library.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, getTemplate, type Template } from './templates.ts';
import { fingerprint, nearDuplicates, similarity } from './templateDuplicates.ts';
import { shift } from './templateArt/draw.ts';

test('no two templates are near-duplicates', () => {
  // Letters (owner 24 Oct 2026) are exempt: the same character in two typefaces, or O and 0 in one, are meant to
  // look alike; src/core/letterStyles.test.ts guards that set instead (unique ids, full alphabets, names).
  assert.deepEqual(nearDuplicates(TEMPLATES.filter((t) => !t.id.startsWith('char-'))), []);
});

test('the guard catches a nudged copy and a re-named copy', () => {
  const base = getTemplate('cute-penguin') as Template;
  const nudged: Template = { ...base, id: 'copy', paths: base.paths.map((d) => shift(d, 3, 2)), detail: base.detail?.map((d) => shift(d, 3, 2)) };
  assert.ok(similarity(fingerprint(base), fingerprint(nudged)) >= 0.9);
  assert.equal(nearDuplicates([base, nudged]).length, 1);
  assert.equal(nearDuplicates([base, { ...base, id: 'renamed', name: 'Other name' }]).length, 1);
});

test('different pieces are not flagged', () => {
  const a = getTemplate('tulip') as Template;
  const b = getTemplate('cute-penguin') as Template;
  assert.equal(nearDuplicates([a, b]).length, 0);
});
