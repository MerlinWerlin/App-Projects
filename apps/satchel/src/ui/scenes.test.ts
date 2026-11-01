// T119: the tab hero scenes draw only from theme tokens (no raw colours, every fill / stroke from the scene's ink set),
// each scene names itself with a look2.scene.* string, each tool tab shows its scene, and the tabs share the section
// rhythm (SectionHeader + rhythm tokens). Reads sources as text, so it runs under plain `node --test`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const scenes = read('src/ui/scenes.tsx');
const KINDS = [...(/SCENE_KINDS[^=]*=\s*\[([^\]]*)\]/.exec(scenes)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]);

test('scenes: four kinds, each with a look2 label in the catalogue', () => {
  assert.deepEqual(KINDS, ['wallet', 'emergency', 'toilets', 'map']);
  for (const k of KINDS) {
    const key = `look2.scene.${k}`;
    assert.ok(scenes.includes(`'${key}'`), `${k} label key`);
    assert.ok(key in en && (en as Record<string, string>)[key].length > 10, key);
  }
  assert.match(scenes, /accessibilityRole="image"/);
  assert.match(scenes, /accessibilityLabel=\{t\(SCENE_LABEL\[kind\]\)\}/);
});

test('scenes: every colour is a token from the ink set, light and dark versions differ (sun / moon)', () => {
  const code = scenes
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  assert.doesNotMatch(code, /#[0-9a-fA-F]{3,8}\b|rgba?\(|['"](white|black)['"]/);
  for (const m of code.matchAll(/\b(fill|stroke)=(\{[^}]*\}|"[^"]*")/g)) {
    const v = m[2];
    assert.ok(v === '"none"' || /^\{c\.(paper|wash|chip|line|warm|deep|mid)\}$/.test(v), `${m[1]}=${v}`);
  }
  assert.match(code, /night=\{theme\.dark\}/);
  assert.match(code, /theme\.heroPaper/);
});

test('the four tool tabs show their scene; Wallet, Emergency and Toilets use SectionHeader and the rhythm tokens', () => {
  const tabs: Record<string, string> = { wallet: 'wallet', emergency: 'emergency', toilets: 'toilets', map: 'map' };
  for (const [file, kind] of Object.entries(tabs)) {
    const src = read(`app/(tabs)/${file}.tsx`);
    assert.match(src, new RegExp(`<HeroHeader[^>]*scene="${kind}"`), `${file} scene`);
    assert.doesNotMatch(src, /illustration="/, `${file} still uses the small illustration`);
  }
  for (const file of ['wallet', 'emergency', 'toilets']) {
    const src = read(`app/(tabs)/${file}.tsx`);
    assert.match(src, /<SectionHeader /, `${file} SectionHeader`);
    assert.match(src, /\brhythm\.(section|stack|tight)\b/, `${file} rhythm`);
    assert.match(src, /<FocusEntrance /, `${file} focus entrance`);
    assert.doesNotMatch(src, /\bgap: 2\b/, `${file} raw gap`);
  }
});

test('focus entrance is timed and static under Reduce Motion', () => {
  const hero = read('src/ui/hero.tsx');
  const body = hero.slice(hero.indexOf('export function useFocusEntrance'), hero.indexOf('export function FocusEntrance'));
  assert.match(body, /useFocusEffect/);
  assert.match(body, /if \(reduceMotion\) \{\s*progress\.setValue\(1\);/);
  assert.match(body, /timed\(progress, 1,/);
});
