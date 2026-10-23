// fb-1022 (owner test 22 Oct, docs/OWNER_1022.md) G1–G4 source checks for the Themes screen,
// the Your look panel, theme detail and the PillTabs sub-tabs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { lookup, type CatalogueTree } from './i18n.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const themes = read('app', '(tabs)', 'themes.tsx');
const detail = read('app', 'theme', '[id].tsx');
const look = read('src', 'ui', 'YourLookPanel.tsx');
const pills = read('src', 'ui', 'PillTabs.tsx');

/** The JSX of the screen's return block (after `return (`). */
const rendered = themes.slice(themes.indexOf('<LargeTitle '));

test('G1: no stacked first-run tip cards on the Themes screen; help stays behind the header "?"', () => {
  assert.doesNotMatch(themes, /themeUi\.tips\./);
  assert.doesNotMatch(themes, /dismissTip|dismissAllTips|visibleTips|themes\.hideTips/);
  assert.match(themes, /icon="help-circle"[^\n]*router\.push\('\/tips'\)/s);
  // The hints show one at a time, after the first action (opening a theme).
  assert.match(detail, /<ContextTip ids=\{DETAIL_TIPS\} \/>/);
  assert.match(detail, /FIRST_RUN_TIP_IDS/);
});

test('G2: the shape picker is only in theme detail, behind a collapsed Shape row', () => {
  assert.doesNotMatch(themes, /ShapePicker/);
  assert.doesNotMatch(look, /<ShapePicker/);
  assert.match(detail, /const \[shapeOpen, setShapeOpen\] = useState\(false\)/);
  assert.match(detail, /\{shapeOpen \? \(\s*<SquircleCard[^>]*>\s*<ShapePicker/);
  assert.match(detail, /theme\.shapeRow\.title/);
});

test('G3: category bubbles come first, directly under the large title', () => {
  const at = (s: string) => {
    const i = rendered.indexOf(s);
    assert.ok(i >= 0, `${s} is rendered`);
    return i;
  };
  const bubbles = at('<CategoryBubbleRow');
  for (const later of ['<PillTabs', '<SearchField', '<ShowcaseGrid', '<SeasonalBanner', '<LiveHeroCard', '<YourLookPanel', '<InsetGroup']) {
    assert.ok(bubbles < at(later), `bubbles before ${later}`);
  }
  // Nothing but the inner wrapper between the title and the bubbles.
  const between = rendered.slice(0, bubbles).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.doesNotMatch(between, /<(SquircleCard|InsetGroup|SeasonalBanner|LiveHeroCard|YourLookPanel|Text)\b/);
});

test('G4: discovery sub-tabs are content-sized one-line pills that scroll, never squeezed', () => {
  assert.match(themes, /<PillTabs\b/);
  assert.doesNotMatch(themes, /<Segmented\b/);
  assert.match(pills, /horizontal/);
  assert.match(pills, /numberOfLines=\{1\}/);
  const pill = pills.match(/pill: \{[^}]*\}/)?.[0] ?? '';
  assert.doesNotMatch(pill, /flex: 1|width:/, 'pills size to their label');
  assert.match(pill, /minHeight: sizeV2\.touch/);
  assert.match(themes, /<View style=\{styles\.sectionHead\}>[\s\S]*themes\.discover\.picksNote/);
});

test('G2 Shape row copy is in every locale', () => {
  for (const key of ['theme.shapeRow.title', 'theme.shapeRow.a11y', 'theme.shapeRow.showHint', 'theme.shapeRow.hideHint']) {
    assert.equal(typeof lookup(en as unknown as CatalogueTree, key), 'string', `en ${key}`);
    for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
      assert.equal(typeof lookup(cat as unknown as CatalogueTree, key), 'string', `${locale} ${key}`);
    }
  }
});

test('G5a: Space (Webb) themes are in the gallery, resolve by id, and show their credit in detail', async () => {
  const { getAnyTheme } = await import('./plusThemes.ts');
  const { SPACE_THEMES } = await import('./spacePack.ts');
  assert.ok(SPACE_THEMES.length >= 6);
  for (const s of SPACE_THEMES) {
    assert.equal(getAnyTheme(s.id)?.id, s.id);
    assert.equal(s.plus, false, `${s.id} is free`);
  }
  assert.match(themes, /filter(List|All)\(SPACE_THEMES\)/);
  assert.match(themes, /themes\.space\.title/);
  assert.match(detail, /<PhotoCredit theme=\{theme\}/);
  assert.match(detail, /usePhotoTheme\(theme\)/);
});
