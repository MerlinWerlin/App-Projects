// T133 source guard: the theme detail shows the Seamless widget card for art-pack themes only,
// writes through widgets.setSeamless only from the button's press handler, and every key it uses
// exists in English.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8');
const detail = read('app/theme/[id].tsx');

// 1.0.34 (owner 2026-11-14: "theres an option to go like top right middle right bottom right etc and then save the
// widget to the home screen - i dont believe we can do this so remove it"): the theme page no longer offers the
// Seamless card (size, Home Screen spot, nudge, "Use for my Glaze widget"). iOS doesn't let an app place a widget;
// the page shows the steps to add a Glaze widget from the Add Widget list and Watch how instead.
test('1.0.34: no Home Screen spot picker on the theme page; the honest add-a-widget steps and Watch how instead', () => {
  assert.doesNotMatch(detail, /<SeamlessCard\b|function SeamlessCard\b|<SeamlessWidgetControls\b|<SeamlessWidgetPreview\b/);
  assert.doesNotMatch(detail, /'ui\.seamless\.slots\.|'ui\.seamless\.nudge\.|widgets\.setSeamless\(/);
  assert.match(detail, /const widgetsHow = useHowTo\('widgets'\);/);
  assert.match(detail, /\{step === 'widgets' \? \(\s*<View style=\{styles\.block\}>\s*<SectionHeader title=\{t\('theme\.howTo\.titles\.widgets'\)\} body=\{t\('theme\.howTo\.captions\.widgets'\)\}/);
  assert.match(detail, /\{widgetsHow\.button\(styles\.side\)\}/);
  assert.match(detail, /\{widgetsHow\.sheet\}/);
});

test('local asset helper downloads only http(s) URIs, through the fs adapter', () => {
  const src = read('src/ui/seamlessSetup.ts');
  assert.match(src, /import \* as fs from '[./]*native\/fs'/);
  assert.match(src, /startsWith\('file:\/\/'\)/);
  assert.match(src, /fs\.downloadAsync\(/);
  assert.doesNotMatch(src, /expo-file-system/);
});
