// Owner 2026-11-13: the "Use everything" icons part "seems scary... looks scammy... so much
// information thrown at you at once". A gentle first-time walkthrough (one idea per card), then a
// one-line "Set up icons" with a "How it works" link.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ICONS_INTRO_STEPS, iconsAfterUseEverything } from './iconsIntro.ts';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

test('walkthrough: four one-idea cards, first time only, then the inline row', () => {
  assert.deepEqual([...ICONS_INTRO_STEPS], ['look', 'oneGo', 'confirm', 'undo']);
  assert.equal(iconsAfterUseEverything(false), 'intro');
  assert.equal(iconsAfterUseEverything(true), 'inline');
  const page = read('app', 'theme', '[id].tsx');
  assert.match(page, /iconsAfterUseEverything\(await iconsIntroSeen\(\)\) === 'intro'/);
  assert.match(page, /theme\.iconsIntro\.setUp/);
  assert.match(page, /openIconsIntro\(true\)/);
  const screen = read('app', 'icons-intro.tsx');
  assert.match(screen, /markIconsIntroSeen\(\)/);
  assert.match(screen, /router\.replace\(\{ pathname: '\/install'/);
  assert.match(screen, /ICONS_INTRO_DEMO !== null \? <DemoVideo/);
  assert.match(read('app', '_layout.tsx'), /name="icons-intro"/);
});

test('walkthrough copy: calm and plain, no technical terms, in every language', () => {
  for (const lang of ['en', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt-BR', 'zh-Hans']) {
    const src = read('src', 'i18n', 'ns', 'theme', `${lang}.ts`);
    const block = src.slice(src.indexOf('iconsIntro: {'), src.indexOf('  parts: {'));
    for (const s of ICONS_INTRO_STEPS) assert.ok(block.includes(`${s}: { title:`), `${lang} ${s}`);
    for (const k of ['skip:', 'next:', 'back:', 'start:', 'stepOf:', 'setUp:', 'howItWorks:']) assert.ok(block.includes(k), `${lang} ${k}`);
    if (lang === 'en') assert.doesNotMatch(block, /shortcut|automation|profile|configuration|Safari|web clip/i);
  }
});
