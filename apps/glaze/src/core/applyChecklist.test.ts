import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHECKLIST_MAX_THEMES,
  CHECKLIST_ROWS,
  CHECKLIST_STEPS,
  celebrationDue,
  checklistFor,
  checklistProgress,
  defaultOpenRow,
  freshChecklist,
  isComplete,
  markCelebrated,
  mergeTicks,
  nextStep,
  pairSaveTicksWallpaper,
  parseChecklist,
  parseChecklistStore,
  resetChecklist,
  rowDone,
  rowParts,
  storeWith,
  studioSaveTicksWidgets,
  tickInStore,
  tickTask,
  widgetsStepMode,
  type ChecklistState,
} from './applyChecklist.ts';

const all = (s: ChecklistState) =>
  (['wallpaper', 'iconStyle', 'iconInstall', 'widgets'] as const).reduce((acc, t) => tickTask(acc, t, 5), s);

test('three steps in order, loop is an optional fourth row', () => {
  assert.deepEqual([...CHECKLIST_STEPS], ['wallpaper', 'icons', 'widgets']);
  assert.deepEqual([...CHECKLIST_ROWS], ['wallpaper', 'icons', 'widgets', 'loop']);
});

test('ticks drive progress, next step and completion', () => {
  let s = freshChecklist('aurora');
  assert.deepEqual(checklistProgress(s), { done: 0, total: 3, fraction: 0 });
  assert.equal(nextStep(s), 'wallpaper');
  s = tickTask(s, 'wallpaper', 1);
  assert.equal(nextStep(s), 'icons');
  s = tickTask(s, 'iconStyle', 2);
  assert.equal(rowDone(s, 'icons'), false);
  assert.deepEqual(rowParts(s, 'icons'), { done: 1, total: 2 });
  assert.deepEqual(checklistProgress(s), { done: 1, total: 3, fraction: 0.5 });
  s = tickTask(s, 'iconInstall', 3);
  assert.equal(rowDone(s, 'icons'), true);
  assert.equal(nextStep(s), 'widgets');
  assert.equal(isComplete(s), false);
  s = tickTask(s, 'widgets', 4);
  assert.equal(isComplete(s), true);
  assert.equal(nextStep(s), null);
  assert.deepEqual(checklistProgress(s), { done: 3, total: 3, fraction: 1 });
  assert.equal(s.updatedAt, 4);
});

test('the loop never counts towards progress or completion', () => {
  const s = tickTask(freshChecklist('a'), 'loop');
  assert.equal(rowDone(s, 'loop'), true);
  assert.equal(checklistProgress(s).fraction, 0);
  assert.equal(isComplete(s), false);
  assert.equal(defaultOpenRow(s), 'wallpaper');
  assert.equal(defaultOpenRow(all(freshChecklist('a'))), 'loop');
});

test('ticking is idempotent and ignores unknown tasks', () => {
  const s = tickTask(freshChecklist('a'), 'wallpaper', 1);
  assert.equal(tickTask(s, 'wallpaper', 9), s);
  assert.equal(tickTask(s, 'nope' as never, 9), s);
});

test('success moment is due once, after the third step', () => {
  let s = all(freshChecklist('a'));
  assert.equal(celebrationDue(s), true);
  s = markCelebrated(s, 6);
  assert.equal(celebrationDue(s), false);
  assert.equal(markCelebrated(s, 7), s);
  assert.equal(celebrationDue(tickTask(s, 'loop')), false);
  assert.equal(celebrationDue(tickTask(freshChecklist('a'), 'wallpaper')), false);
});

test('reset clears the ticks and re-arms the moment; theme change gives a fresh list', () => {
  const s = markCelebrated(all(freshChecklist('a')));
  const r = resetChecklist(s, 10);
  assert.equal(r.themeId, 'a');
  assert.equal(nextStep(r), 'wallpaper');
  assert.equal(r.celebrated, false);
  assert.equal(checklistFor(s, 'a'), s);
  const b = checklistFor(s, 'b');
  assert.equal(b.themeId, 'b');
  assert.equal(checklistProgress(b).done, 0);
  assert.equal(checklistFor(null, 'c').themeId, 'c');
});

test('widgets step is honest: preview unless the widget bridge is there', () => {
  assert.equal(widgetsStepMode(false), 'preview');
  assert.equal(widgetsStepMode(true), 'add');
});

test('persistence round-trips and rejects junk', () => {
  const s = markCelebrated(all(freshChecklist('aurora', 3)), 8);
  const store = parseChecklistStore(JSON.stringify(storeWith({}, s)));
  assert.deepEqual(parseChecklist(store.aurora, 'aurora'), s);
  // Wrong theme or version -> fresh.
  assert.deepEqual(parseChecklist(store.aurora, 'other'), freshChecklist('other'));
  assert.deepEqual(parseChecklist({ ...s, v: 2 }, 'aurora'), freshChecklist('aurora'));
  for (const bad of [null, undefined, 3, 'x', [], { v: 1, themeId: 'aurora', ticks: [true] }]) {
    const p = parseChecklist(bad, 'aurora');
    assert.equal(p.themeId, 'aurora');
    assert.equal(checklistProgress(p).done, 0);
  }
  // Non-boolean ticks are false; celebrated without completion is re-armed.
  const odd = parseChecklist({ v: 1, themeId: 'a', ticks: { wallpaper: 'yes', widgets: true }, celebrated: true, updatedAt: -1 }, 'a');
  assert.equal(odd.ticks.wallpaper, false);
  assert.equal(odd.ticks.widgets, true);
  assert.equal(odd.celebrated, false);
  assert.equal(odd.updatedAt, 0);
  for (const bad of ['{', 'null', '[]', '7', null, 42]) assert.deepEqual(parseChecklistStore(bad), {});
  assert.deepEqual(parseChecklistStore({ a: 1, b: { v: 1 } }), { b: { v: 1 } });
});

test('the store keeps only the most recent themes', () => {
  let store: Record<string, unknown> = {};
  for (let i = 0; i < CHECKLIST_MAX_THEMES + 5; i++) store = storeWith(store, tickTask(freshChecklist(`t${i}`), 'wallpaper', i + 1));
  assert.equal(Object.keys(store).length, CHECKLIST_MAX_THEMES);
  assert.ok(!('t0' in store));
  assert.ok(`t${CHECKLIST_MAX_THEMES + 4}` in store);
  // The theme being saved is always kept, even if its timestamp is oldest.
  store = storeWith(store, freshChecklist('old', 0));
  assert.ok('old' in store);
  assert.equal(Object.keys(store).length, CHECKLIST_MAX_THEMES);
});

test('theme detail shows the 3-step checklist with widgets, persisted, with a success moment', () => {
  const src = readFileSync(new URL('../../app/theme/[id].tsx', import.meta.url), 'utf8');
  assert.match(src, /CHECKLIST_ROWS/);
  assert.match(src, /loadChecklist\(/);
  assert.match(src, /saveChecklist\(/);
  assert.match(src, /widgetsStepMode\(/);
  assert.match(src, /celebrationDue\(/);
  assert.match(src, /\/widget-studio/);
  assert.doesNotMatch(src, /STEP_KEYS/);
  const store = readFileSync(new URL('../store/applyChecklist.ts', import.meta.url), 'utf8');
  assert.match(store, /CHECKLIST_STORAGE_KEY/);
});

// ---- T81 ----------------------------------------------------------------------------------

test('mergeTicks is a union of ticks for the same theme and never clears one', () => {
  const a = tickTask(freshChecklist('t'), 'wallpaper', 1);
  const b = tickTask(tickTask(freshChecklist('t'), 'widgets', 2), 'loop', 2);
  const m = mergeTicks(a, b, 3);
  assert.deepEqual(m.ticks, { wallpaper: true, iconStyle: false, iconInstall: false, widgets: true, loop: true });
  assert.equal(m.updatedAt, 3);
  // Nothing new: same object back.
  assert.equal(mergeTicks(m, a, 9), m);
  assert.equal(mergeTicks(m, freshChecklist('t'), 9), m);
  // Another theme's record never leaks in.
  assert.equal(mergeTicks(a, tickTask(freshChecklist('other'), 'widgets'), 4), a);
});

test('tickInStore ticks the stored record for that theme only', () => {
  const store0: Record<string, unknown> = {};
  const s1 = tickInStore(store0, 'cloud-nine', 'wallpaper', 10);
  assert.notEqual(s1, store0);
  const rec = parseChecklist(s1['cloud-nine'], 'cloud-nine');
  assert.equal(rec.ticks.wallpaper, true);
  assert.equal(rec.ticks.widgets, false);
  assert.equal(rec.updatedAt, 10);
  // Already ticked: the same store comes back (no write needed).
  assert.equal(tickInStore(s1, 'cloud-nine', 'wallpaper', 20), s1);
  // A second task keeps the first; other themes are untouched.
  const s2 = tickInStore({ ...s1, other: { ...freshChecklist('other'), updatedAt: 5 } }, 'cloud-nine', 'widgets', 30);
  const rec2 = parseChecklist(s2['cloud-nine'], 'cloud-nine');
  assert.equal(rec2.ticks.wallpaper && rec2.ticks.widgets, true);
  assert.deepEqual(parseChecklist(s2.other, 'other').ticks, freshChecklist('other').ticks);
  // A malformed record starts fresh and gains the tick; an empty id does nothing.
  const s3 = tickInStore({ x: { v: 99 } }, 'x', 'widgets', 1);
  assert.equal(parseChecklist(s3.x, 'x').ticks.widgets, true);
  assert.equal(tickInStore(store0, '', 'widgets'), store0);
  // The store round-trips through JSON like AsyncStorage does.
  assert.equal(parseChecklist(parseChecklistStore(JSON.stringify(s2))['cloud-nine'], 'cloud-nine').ticks.widgets, true);
});

test('a ticked stored record merges into the open checklist and can complete the look', () => {
  // Theme detail has wallpaper + icons; Widget Studio saved meanwhile.
  const open = (['wallpaper', 'iconStyle', 'iconInstall'] as const).reduce((acc, t) => tickTask(acc, t, 1), freshChecklist('t'));
  const stored = parseChecklist(tickInStore(storeWith({}, open), 't', 'widgets', 2).t, 't');
  const merged = mergeTicks(stored, open, 3);
  assert.equal(isComplete(merged), true);
  assert.equal(celebrationDue(merged), true);
});

test('only a saved Lock + Home pair ticks the wallpaper step', () => {
  assert.equal(pairSaveTicksWallpaper('saved'), true);
  assert.equal(pairSaveTicksWallpaper('lockFailed'), false);
  assert.equal(pairSaveTicksWallpaper('homeFailed'), false);
});

test('the widgets step ticks only when the studio saves (added or preview saved)', () => {
  assert.equal(studioSaveTicksWidgets('saved'), true);
  assert.equal(studioSaveTicksWidgets('preview'), true);
  assert.equal(studioSaveTicksWidgets('failed'), false);
  assert.equal(studioSaveTicksWidgets('photoFailed'), false);
  assert.equal(studioSaveTicksWidgets(null), false);
});

test('screens wire the T81 ticks: pair save, studio save, and a focus reload on theme detail', () => {
  const detail = readFileSync(new URL('../../app/theme/[id].tsx', import.meta.url), 'utf8');
  // Opening the studio no longer ticks widgets; only the studio's save does.
  assert.doesNotMatch(detail, /tick\('widgets'\)/);
  assert.match(detail, /useFocusEffect\(\s*useCallback\(\(\) => \{\s*let alive = true;\s*const fresh = checklistFor/);
  assert.match(detail, /mergeTicks\(/);
  const studio = readFileSync(new URL('../../app/widget-studio.tsx', import.meta.url), 'utf8');
  assert.match(studio, /studioSaveTicksWidgets\(next\)\) void tickStoredChecklist\(theme\.id, 'widgets'\)/);
  const maker = readFileSync(new URL('../../app/wallpaper.tsx', import.meta.url), 'utf8');
  assert.match(maker, /pairSaveTicksWallpaper\(/);
  assert.match(maker, /tickStoredChecklist\([^)]*'wallpaper'\)/);
  assert.match(maker, /wallpaperMakerTheme\(/);
  const store = readFileSync(new URL('../store/applyChecklist.ts', import.meta.url), 'utf8');
  assert.match(store, /export function tickStoredChecklist/);
  assert.match(store, /tickInStore\(/);
});

test('theme.applyHint mentions widgets in every locale', () => {
  const words: Record<string, RegExp> = {
    en: /widgets/i, de: /Widgets/, es: /widgets/, fr: /widgets/, it: /widget/, 'pt-BR': /widgets/,
    ja: /ウィジェット/, ko: /위젯/, 'zh-Hans': /小组件/, hi: /विजेट/, ar: /الأدوات/,
  };
  for (const [loc, re] of Object.entries(words)) {
    const src = readFileSync(new URL(`../i18n/ns/theme/${loc}.ts`, import.meta.url), 'utf8');
    const line = /^  applyHint: '(.*)',$/m.exec(src);
    assert.ok(line, `${loc} has theme.applyHint`);
    assert.match(line[1], re, `${loc} applyHint mentions widgets`);
  }
});
