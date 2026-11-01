// T265 (owner-1101i #1): the guided "Use this theme" flow's step model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SETUP_MAX_THEMES,
  SETUP_STEPS,
  advance,
  allDone,
  doneSteps,
  dots,
  firstOpenStep,
  goTo,
  isLastStep,
  markDone,
  onNext,
  onSkip,
  parseProgress,
  serialiseProgress,
  setupStepOf,
  startFlow,
  stepNumber,
  type SetupProgress,
} from './themeSetupFlow.ts';

test('three steps in order: wallpaper, icons, widgets', () => {
  assert.deepEqual([...SETUP_STEPS], ['wallpaper', 'icons', 'widgets']);
  assert.deepEqual(SETUP_STEPS.map(stepNumber), [1, 2, 3]);
  assert.ok(isLastStep('widgets'));
  assert.ok(!isLastStep('icons'));
});

test('a route param picks the step; anything else opens on wallpaper', () => {
  assert.equal(setupStepOf('icons'), 'icons');
  assert.equal(setupStepOf('widgets'), 'widgets');
  assert.equal(setupStepOf('nope'), 'wallpaper');
  assert.equal(setupStepOf(undefined), 'wallpaper');
  assert.equal(setupStepOf(['icons']), 'wallpaper');
  assert.equal(setupStepOf(undefined, 'widgets'), 'widgets');
});

test('Next and Skip move on, and finish on the last step', () => {
  let s = startFlow();
  assert.deepEqual(s, { step: 'wallpaper', finished: false });
  s = advance(s);
  assert.equal(s.step, 'icons');
  s = onSkip(s);
  assert.equal(s.step, 'widgets');
  s = onSkip(s);
  assert.deepEqual(s, { step: 'widgets', finished: true });
  assert.deepEqual(advance(s), s, 'finished stays finished');
});

test('Next ticks the step, Skip does not', () => {
  const r = onNext(startFlow(), {}, 'aurora');
  assert.equal(r.state.step, 'icons');
  assert.deepEqual([...doneSteps(r.progress, 'aurora')], ['wallpaper']);
  const skipped = onSkip(r.state);
  assert.equal(skipped.step, 'widgets');
  assert.deepEqual([...doneSteps(r.progress, 'aurora')], ['wallpaper']);
});

test('a tapped dot jumps to that step (and reopens a finished flow)', () => {
  const s = goTo({ step: 'widgets', finished: true }, 'wallpaper');
  assert.deepEqual(s, { step: 'wallpaper', finished: false });
  assert.deepEqual(goTo(startFlow('icons'), 'bogus' as never), startFlow('icons'));
});

test('completion is per theme, idempotent and kept in step order', () => {
  let p: SetupProgress = {};
  p = markDone(p, 'a', 'widgets');
  p = markDone(p, 'a', 'wallpaper');
  const same = markDone(p, 'a', 'wallpaper');
  assert.equal(same, p, 'no change, same object');
  assert.deepEqual(p.a, ['wallpaper', 'widgets']);
  assert.equal(doneSteps(p, 'b').size, 0);
  assert.ok(!allDone(p, 'a'));
  p = markDone(p, 'a', 'icons');
  assert.ok(allDone(p, 'a'));
  assert.equal(markDone(p, '', 'icons'), p);
});

test('the flow opens on the first step not done yet', () => {
  assert.equal(firstOpenStep({}, 'x'), 'wallpaper');
  assert.equal(firstOpenStep({ x: ['wallpaper'] }, 'x'), 'icons');
  assert.equal(firstOpenStep({ x: ['wallpaper', 'icons'] }, 'x'), 'widgets');
  assert.equal(firstOpenStep({ x: ['wallpaper', 'icons', 'widgets'] }, 'x'), 'wallpaper');
});

test('dots show the current step and the ticked ones', () => {
  const d = dots(startFlow('icons'), new Set(['wallpaper'] as const));
  assert.deepEqual(d, [
    { step: 'wallpaper', number: 1, current: false, done: true },
    { step: 'icons', number: 2, current: true, done: false },
    { step: 'widgets', number: 3, current: false, done: false },
  ]);
});

test('stored record round-trips; junk reads as empty, never throws', () => {
  const p = markDone(markDone({}, 'a', 'icons'), 'b', 'wallpaper');
  assert.deepEqual(parseProgress(serialiseProgress(p)), p);
  assert.deepEqual(parseProgress(null), {});
  assert.deepEqual(parseProgress(''), {});
  assert.deepEqual(parseProgress('{oops'), {});
  assert.deepEqual(parseProgress('[1,2]'), {});
  assert.deepEqual(parseProgress('"x"'), {});
  assert.deepEqual(parseProgress('{"a":["icons","bad"],"b":"wallpaper","c":[]}'), { a: ['icons'] });
});

test('the record is capped; the oldest themes drop off first', () => {
  let p: SetupProgress = {};
  for (let i = 0; i < SETUP_MAX_THEMES + 5; i++) p = markDone(p, `t${i}`, 'wallpaper');
  const keys = Object.keys(p);
  assert.equal(keys.length, SETUP_MAX_THEMES);
  assert.equal(keys[0], 't5');
  assert.equal(keys[keys.length - 1], `t${SETUP_MAX_THEMES + 4}`);
  // A theme touched again moves to the newest end.
  p = markDone(p, 't5', 'icons');
  assert.equal(Object.keys(p).at(-1), 't5');
});

test('prototype keys are not steps', () => {
  assert.equal(doneSteps({}, 'constructor').size, 0);
  assert.equal(doneSteps({}, '__proto__').size, 0);
});

test('the flow UI keeps the brief: dots, Next / Skip, Open Photos, Open Settings, Blur off', () => {
  const root = process.cwd();
  const ui = readFileSync(join(root, 'src', 'ui', 'ThemeSetupFlow.tsx'), 'utf8');
  for (const k of ['theme.setup.next', 'theme.setup.skip', 'theme.setup.done', 'theme.setup.wallpaper.openPhotos', 'theme.setup.icons.openSettings', 'theme.setup.wallpaper.blur']) {
    assert.ok(ui.includes(k), `ThemeSetupFlow uses ${k}`);
  }
  assert.ok(ui.includes('PHOTOS_URL') && ui.includes('SETTINGS_APP_URL') && ui.includes('openSettings'));
  assert.ok(ui.includes("from './ProfileGuideArt'"), 'reuses the T262 profile illustrations');
  // Never the owner's screenshots.
  const art = readFileSync(join(root, 'src', 'ui', 'ThemeSetupArt.tsx'), 'utf8');
  assert.ok(!/owner_screens|require\(|\.png/.test(ui + art));
  // The theme page opens the flow after "Use this theme" and offers the Set it up rows.
  const page = readFileSync(join(root, 'app', 'theme', '[id].tsx'), 'utf8');
  assert.ok(page.includes('ThemeSetupFlow') && page.includes('ThemeSetupSection'));
  // The install screen starts the bulk profile itself when asked (no new profile server).
  const install = readFileSync(join(root, 'app', 'install.tsx'), 'utf8');
  assert.ok(install.includes("auto !== '1'") && install.includes('generate()'));
});
