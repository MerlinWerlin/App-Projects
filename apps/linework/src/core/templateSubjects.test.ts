// fb-1022b B1: every template sits in a category whose curated subject list names it (no whale in Birds & insects).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, TEMPLATES, getTemplate } from './templates.ts';
import { CATEGORY_SUBJECTS, categoryProblems } from './templateSubjects.ts';

test('every category has a curated subject list', () => {
  for (const c of CATEGORIES) assert.ok(CATEGORY_SUBJECTS[c.id]?.length > 0, c.id);
});

test('every template matches its category subjects', () => {
  const problems = TEMPLATES.flatMap(categoryProblems);
  assert.deepEqual(problems, []);
});

test('owner 22 Oct: sea creatures live in Sea life, not Birds & insects', () => {
  for (const id of ['wild-whale', 'wild-nautilus', 'wild-koi', 'fish']) assert.equal(getTemplate(id)?.category, 'sealife', id);
  assert.ok(TEMPLATES.filter((t) => t.category === 'wildlife').every((t) => !/whale|fish|nautilus|octopus|shark/.test(t.id)));
});

test('the checker catches a misfiled whale', () => {
  const whale = getTemplate('wild-whale');
  assert.ok(whale);
  assert.ok(categoryProblems({ ...whale, category: 'wildlife' }).length > 0);
});
