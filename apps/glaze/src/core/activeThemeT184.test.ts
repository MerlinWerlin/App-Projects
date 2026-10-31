// T184 / T185 (owner-1101 items 2 and 3): the theme in use, the Widgets tab pick reset, the saved
// wallpaper flag, and source guards: "Use this theme" writes every dependent state, and the Icons,
// Widgets and wallpaper screens re-read the theme in use on focus (the tabs are lazy + freezeOnBlur).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  activeThemeId,
  isThemeInUse,
  markWallpaperSaved,
  parseActiveTheme,
  parseSavedWallpapers,
  pickAfterActiveChange,
  serializeActiveTheme,
  serializeSavedWallpapers,
  startThemeId,
  themeStepOf,
  wallpaperSaveView,
} from './activeTheme.ts';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('active theme round-trips and rejects junk', () => {
  const a = { themeId: 'cloud-atelier', at: 5 };
  assert.deepEqual(parseActiveTheme(serializeActiveTheme(a)), a);
  assert.equal(parseActiveTheme(null), null);
  assert.equal(parseActiveTheme('nope'), null);
  assert.equal(parseActiveTheme('{"themeId":""}'), null);
  assert.equal(parseActiveTheme('{"themeId":3}'), null);
  assert.deepEqual(parseActiveTheme('{"themeId":" moonpatch ","at":-1}'), { themeId: 'moonpatch', at: 0 });
});

test('the theme in use: stored wins, else the Icon Studio theme (pre-T184 installs), else none', () => {
  assert.equal(activeThemeId({ themeId: 'cloud-atelier', at: 1 }, 'ink-underwater'), 'cloud-atelier');
  assert.equal(activeThemeId(null, 'ink-underwater'), 'ink-underwater');
  assert.equal(activeThemeId(null, null), null);
  assert.equal(activeThemeId(null, '  '), null);
});

test('"In use ✓" only for the theme in use', () => {
  assert.equal(isThemeInUse('cloud-atelier', 'cloud-atelier'), true);
  assert.equal(isThemeInUse('cloud-atelier', 'moonpatch'), false);
  assert.equal(isThemeInUse(null, 'moonpatch'), false);
});

test('the Widgets tab drops its local pick when another theme is put in use', () => {
  // First load (null -> id) keeps whatever was picked.
  assert.equal(pickAfterActiveChange(null, 'a', 'b'), 'b');
  // Same theme: pick kept.
  assert.equal(pickAfterActiveChange('a', 'a', 'b'), 'b');
  // Owner-1101: Cloud Atelier applied while the tab had the old theme: the pick goes.
  assert.equal(pickAfterActiveChange('ink-underwater', 'cloud-atelier', 'ink-underwater'), null);
  assert.equal(pickAfterActiveChange('a', null, 'b'), null);
});

test('a screen opened without a theme starts from the theme in use', () => {
  assert.equal(startThemeId(undefined, 'cloud-atelier'), 'cloud-atelier');
  assert.equal(startThemeId('moonpatch', 'cloud-atelier'), 'moonpatch');
  assert.equal(startThemeId('', null), undefined);
});

test('saved wallpapers: per theme, capped, junk dropped', () => {
  let s = parseSavedWallpapers(null);
  assert.deepEqual(s, {});
  s = markWallpaperSaved(s, 'cloud-atelier', 10);
  assert.deepEqual(parseSavedWallpapers(serializeSavedWallpapers(s)), { 'cloud-atelier': 10 });
  assert.deepEqual(parseSavedWallpapers('{"a":1,"b":"x","":2}'), { a: 1 });
  assert.deepEqual(parseSavedWallpapers('[1]'), {});
  for (let i = 0; i < 230; i++) s = markWallpaperSaved(s, `t${i}`, 100 + i);
  assert.equal(Object.keys(s).length, 200);
  assert.ok('t229' in s);
  assert.ok(!('cloud-atelier' in s), 'the oldest goes first');
});

test('the Save button never hides: Saved to Photos ✓ plus Save again', () => {
  assert.deepEqual(wallpaperSaveView(false, false), { badge: false, showSave: true, label: 'cta' });
  assert.deepEqual(wallpaperSaveView(true, false), { badge: true, showSave: true, label: 'again' });
  assert.deepEqual(wallpaperSaveView(true, true), { badge: true, showSave: true, label: 'saving' });
});

test('theme page steps', () => {
  assert.equal(themeStepOf('wallpaper'), 'wallpaper');
  assert.equal(themeStepOf('icons'), 'icons');
  assert.equal(themeStepOf(undefined), 'overview');
  assert.equal(themeStepOf(['icons']), 'overview');
});

test('T184 "Use this theme" writes the icon style, the widget theme (bridge) and the theme in use', () => {
  const store = strip(read('src', 'store', 'activeTheme.ts'));
  const fn = /export async function applyThemeEverywhere[^]*?\n\}/.exec(store)?.[0] ?? '';
  assert.match(fn, /setStudioStyle\(theme\.iconStyle, theme\.id/);
  assert.match(fn, /applyWidgetTheme\(theme\)/);
  assert.match(fn, /AsyncStorage\.setItem\(ACTIVE_THEME_KEY/);
  assert.match(fn, /for \(const l of listeners\) l\(theme\.id\)/);
  // The bridge write itself stays in applyWidgetTheme (T125).
  assert.match(read('src', 'store', 'widgetTheme.ts'), /widgets\.setTheme\(/);
});

test('T184 the Icons, Widgets and wallpaper screens re-read the theme in use on focus', () => {
  const store = strip(read('src', 'store', 'activeTheme.ts'));
  const hook = /export function useActiveThemeId[^]*?\n\}/.exec(store)?.[0] ?? '';
  assert.match(hook, /useFocusEffect\(/);
  assert.match(hook, /loadActiveThemeId\(\)/);
  assert.match(hook, /listeners\.add\(/);
  // Icons: the style comes from useStudio, which reloads on every focus and hears every save.
  const studio = strip(read('src', 'store', 'studio.ts'));
  const useStudio = /export function useStudio\(\)[^]*?\n\}\n/.exec(studio)?.[0] ?? '';
  assert.match(useStudio, /useFocusEffect\(\s*useCallback\(\(\) => \{\s*reload\(\);/);
  assert.match(useStudio, /listeners\.add\(/);
  assert.match(strip(read('app', '(tabs)', 'icons.tsx')), /const \{ state, update \} = useStudio\(\);/);
  // Widgets: the theme in use (remote themes too), re-read on focus; a local pick resets.
  const widgets = strip(read('app', '(tabs)', 'widgets.tsx'));
  assert.match(widgets, /const activeId = useActiveThemeId\(\);/);
  assert.match(widgets, /useAnyTheme\(activeId\)/);
  assert.match(widgets, /pickAfterActiveChange\(prev, activeId, p\)/);
  assert.doesNotMatch(widgets, /getAnyTheme\(state\?\.themeId/);
  // Wallpaper maker: opened without a theme, it starts from the theme in use.
  const maker = strip(read('app', 'wallpaper.tsx'));
  assert.match(maker, /useActiveThemeId\(\)/);
  assert.match(maker, /startThemeId\(/);
});

test('T185 theme page: one "Use this theme" button and three separate entry points', () => {
  const d = strip(read('app', 'theme', '[id].tsx'));
  assert.match(d, /applyThemeEverywhere\(theme\)/);
  assert.match(d, /isThemeInUse\(activeId, theme\.id\)/);
  assert.match(d, /t\('theme\.use\.inUse'\) : t\('theme\.use\.cta'\)/);
  assert.match(d, /openPart\('wallpaper'\)/);
  assert.match(d, /openPart\('icons'\)/);
  assert.match(d, /openPart\('widgets'\)/);
  assert.match(d, /pathname: '\/widget-studio', params: \{ theme: theme\.id \}/);
  assert.match(d, /pathname: '\/theme\/\[id\]', params: \{ id: theme\.id, step: part \}/);
  // The one continuous Apply run is gone.
  assert.doesNotMatch(d, /CHECKLIST_ROWS|openSteps|checklistOpen/);
  assert.doesNotMatch(d, /t\('theme\.apply'\)/);
});

test('T185 wallpaper screen: Saved to Photos ✓ and the Save button always rendered', () => {
  const d = strip(read('app', 'theme', '[id].tsx'));
  assert.match(d, /wallpaperSaveView\(savedBefore \|\| saveState === 'saved', saving\)/);
  assert.match(d, /t\('theme\.save\.savedBadge'\)/);
  assert.match(d, /label=\{t\(`theme\.save\.\$\{saveView\.label\}`\)\}/);
  // The Save button is not behind a "not saved yet" condition.
  const at = d.indexOf('label={t(`theme.save.${saveView.label}`)}');
  const before = d.slice(d.lastIndexOf('{saveState', at), at);
  assert.doesNotMatch(before, /saveState === 'saved' \?\s*null|!saveView\.badge \?/);
  assert.match(d, /rememberWallpaperSaved\(theme\.id\)/);
  assert.match(d, /wasWallpaperSaved\(theme\.id\)/);
});

test('T185 strings exist in every locale', () => {
  for (const loc of ['en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ja', 'ko', 'zh-Hans', 'hi', 'ar']) {
    const s = read('src', 'i18n', 'ns', 'theme', `${loc}.ts`);
    for (const k of ['use: {', 'parts: {', 'savedBadge:', 'inUse:', 'widgetsSub:']) assert.ok(s.includes(k), `${loc} ${k}`);
    assert.match(s, /savedBadge: '[^']*✓'/, `${loc} badge has the tick`);
    assert.match(s, /inUse: '[^']*✓'/, `${loc} in use has the tick`);
  }
});
