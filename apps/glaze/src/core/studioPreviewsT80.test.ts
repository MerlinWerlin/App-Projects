// T80: the theme page's "Matching widgets" row shows the drafts saved in Widget Studio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES } from './themes.ts';
import { generateWidgetSet, widgetSpecOf } from './widgetSets.ts';
import { initialStudioState, selectWidget, studioKinds, studioPreviews, updateDraft } from './widgetStudio.ts';

const SET = generateWidgetSet(THEMES[0]);

test('no saved studio: one plain preview per kind, small when the kind has it', () => {
  const previews = studioPreviews(SET, null);
  assert.equal(previews.length, studioKinds(SET).length);
  for (const p of previews) {
    assert.equal(p.edited, false);
    assert.equal(p.photoUri, null);
    const small = widgetSpecOf(SET, p.spec.kind, 'small');
    if (small) assert.equal(p.spec.id, small.id);
  }
});

test('an edited widget is drawn with its draft, in the size that was edited', () => {
  let s = initialStudioState(SET, 'photo', 'medium');
  s = updateDraft(SET, s, { background: { kind: 'photo', uri: 'file:///docs/backgrounds/a.jpg' }, accent: '#123456' });
  const previews = studioPreviews(SET, s);
  const photo = previews.find((p) => p.spec.kind === 'photo');
  assert.ok(photo);
  assert.equal(photo.edited, true);
  assert.equal(photo.spec.size, 'medium');
  assert.equal(photo.photoUri, 'file:///docs/backgrounds/a.jpg');
  assert.ok(photo.spec.photoRef);
  // Other kinds stay plain.
  assert.ok(previews.filter((p) => p.spec.kind !== 'photo').every((p) => !p.edited));
});

test('an empty draft (edited then reset) counts as unedited', () => {
  const kind = studioKinds(SET)[0];
  let s = selectWidget(SET, initialStudioState(SET), kind);
  s = updateDraft(SET, s, {});
  const p = studioPreviews(SET, s).find((x) => x.spec.kind === kind);
  assert.equal(p?.edited, false);
});

test('a studio saved for another theme is ignored', () => {
  let s = initialStudioState(SET, 'photo', 'medium');
  s = updateDraft(SET, s, { background: { kind: 'photo', uri: 'file:///x.jpg' } });
  const other = { ...s, themeId: 'some-other-theme' };
  assert.ok(studioPreviews(SET, other).every((p) => !p.edited && p.photoUri === null));
});

test('theme page reads saved studio drafts on focus and passes the photo to the preview', () => {
  const src = readFileSync(new URL('../../app/theme/[id].tsx', import.meta.url), 'utf8');
  assert.match(src, /studioPreviews\(set, saved\)/);
  assert.match(src, /loadStudio\(set\)/);
  assert.match(src, /photoUri=\{photoUri\}/);
});
