// T194: the record of Shortcuts icons Glaze walked through, and the "remove these old icons" list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOM_THEME_ID,
  cleanupThemeId,
  emptyCleanupRecord,
  markOldRemoved,
  namesList,
  oldIconNames,
  oldIconsToRemove,
  parseCleanupRecord,
  recordWalk,
  serializeCleanupRecord,
} from './iconCleanup.ts';

const apps = (...ids: string[]) => ids.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }));

test('nothing recorded: no note', () => {
  assert.equal(oldIconsToRemove(emptyCleanupRecord(), 'plum', ['music']), null);
});

test('same theme: no note, apps merge', () => {
  let r = recordWalk(emptyCleanupRecord(), 'plum', 'Plum', apps('music'));
  r = recordWalk(r, 'plum', 'Plum', apps('maps', 'music'));
  assert.deepEqual(r.last?.apps.map((a) => a.id), ['music', 'maps']);
  assert.equal(r.previous, null);
  assert.equal(oldIconsToRemove(r, 'plum', ['music', 'maps']), null);
  assert.equal(recordWalk(r, 'plum', 'Plum', apps('music')), r, 'unchanged returns the same object');
});

test('a different theme lists the old icons, replaced first then leftovers', () => {
  const r = recordWalk(emptyCleanupRecord(), 'plum', 'Plum', apps('music', 'maps', 'notes'));
  const o = oldIconsToRemove(r, 'sea', ['notes', 'mail', 'music'])!;
  assert.equal(o.themeName, 'Plum');
  assert.deepEqual(o.replaced.map((a) => a.id), ['music', 'notes']);
  assert.deepEqual(o.leftover.map((a) => a.id), ['maps']);
  assert.deepEqual(oldIconNames(o), ['Music', 'Notes', 'Maps']);
});

test('starting the new theme keeps the old set as previous until marked removed', () => {
  let r = recordWalk(emptyCleanupRecord(), 'plum', 'Plum', apps('music'));
  r = recordWalk(r, 'sea', 'Sea Salt', apps('music'));
  assert.equal(r.last?.themeId, 'sea');
  assert.equal(r.previous?.themeId, 'plum');
  assert.equal(oldIconsToRemove(r, 'sea', ['music'])?.themeName, 'Plum');
  // Going back to Plum: the Sea Salt icons are now the old ones.
  assert.equal(oldIconsToRemove(r, 'plum', ['music'])?.themeName, 'Sea Salt');
  const cleared = markOldRemoved(r, 'sea');
  assert.equal(cleared.previous, null);
  assert.equal(cleared.last?.themeId, 'sea');
  assert.equal(oldIconsToRemove(cleared, 'sea', ['music']), null);
  assert.equal(markOldRemoved(cleared, 'sea'), cleared);
});

test('marking removed while on a theme not yet walked forgets the old last set', () => {
  const r = recordWalk(emptyCleanupRecord(), 'plum', 'Plum', apps('music'));
  const cleared = markOldRemoved(r, 'sea');
  assert.deepEqual(cleared, emptyCleanupRecord());
  assert.equal(oldIconsToRemove(cleared, 'sea', ['music']), null);
});

test('no theme applied records as "custom"', () => {
  assert.equal(cleanupThemeId(null), CUSTOM_THEME_ID);
  assert.equal(cleanupThemeId('  '), CUSTOM_THEME_ID);
  const r = recordWalk(emptyCleanupRecord(), cleanupThemeId(null), 'Custom', apps('music'));
  assert.equal(oldIconsToRemove(r, null, ['music']), null);
  assert.ok(oldIconsToRemove(r, 'plum', ['music']));
});

test('empty or junk apps are ignored', () => {
  const r0 = emptyCleanupRecord();
  assert.equal(recordWalk(r0, 'plum', 'Plum', []), r0);
  assert.equal(recordWalk(r0, 'plum', 'Plum', [{ id: '', label: 'x' }, { id: 'a', label: ' ' }]), r0);
});

test('round trip and corrupt input', () => {
  let r = recordWalk(emptyCleanupRecord(), 'plum', 'Plum', apps('music'));
  r = recordWalk(r, 'sea', 'Sea', apps('maps'));
  assert.deepEqual(parseCleanupRecord(serializeCleanupRecord(r)), r);
  for (const bad of [null, '', '{', '[]', '{"v":2}', '{"v":1,"last":{"themeId":"x","apps":[]}}']) {
    assert.deepEqual(parseCleanupRecord(bad), emptyCleanupRecord(), String(bad));
  }
  // A previous set of the same theme as last is dropped.
  const same = JSON.stringify({ v: 1, last: { themeId: 'a', themeName: 'A', apps: apps('music') }, previous: { themeId: 'a', themeName: 'A', apps: apps('maps') } });
  assert.equal(parseCleanupRecord(same).previous, null);
});

test('namesList caps the shown names and counts the rest', () => {
  assert.deepEqual(namesList(['A', 'B', 'C'], 8), { shown: 'A, B, C', more: 0 });
  assert.deepEqual(namesList(['A', 'B', 'C', 'D'], 2, '、'), { shown: 'A、B', more: 2 });
  assert.deepEqual(namesList([' ', 'A']), { shown: 'A', more: 0 });
});
