// T125: widgets follow the chosen theme. Source guards over the WidgetKit extension (read as text,
// it cannot be compiled here), the bridge and the app's theme-apply call sites, plus the pure rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { relativeLuminance } from './colour.ts';
import { THEMES } from './themes.ts';
import {
  ACTIVE_WIDGET_THEME_KEY,
  DEFAULT_WIDGET_THEME,
  PALE_ACCENT_MIX,
  PALE_BG_LUMINANCE,
  WIDGET_APP_GROUP,
  WIDGET_THEME_FILE,
  WIDGET_THEME_KEY,
  launchWidgetTheme,
  serializeWidgetTheme,
  widgetBackgroundStops,
  widgetThemeFrom,
} from './widgetTheme.ts';

const ROOT = process.cwd();
const WIDGET_DIR = join(ROOT, 'targets/widget');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const swiftFiles = (): string[] => readdirSync(WIDGET_DIR).filter((f) => f.endsWith('.swift'));
const NOW = new Date('2026-10-24T10:00:00.000Z');

/** Swift source without // comments, so guards look only at code. */
function code(src: string): string {
  return src
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
}

test('no widget renders the theme name', () => {
  for (const f of swiftFiles()) {
    const src = code(readFileSync(join(WIDGET_DIR, f), 'utf8'));
    assert.doesNotMatch(src, /\b(t|theme|entry\.theme)\.name\b/, `${f} renders the theme name`);
  }
});

test('every provider placeholder reads the stored theme, never the built-in fallback', () => {
  const providers = code(read('targets/widget/Providers.swift'));
  const placeholders = providers.match(/func placeholder\(in context: Context\) -> GlazeEntry \{[^}]*\}/g) ?? [];
  assert.equal(placeholders.length, 4);
  for (const p of placeholders) {
    assert.match(p, /ThemeStore\.load\(\)/);
    assert.doesNotMatch(p, /\.fallback/);
  }
  const snapshots = providers.match(/func getSnapshot\([^]*?\n {2}\}/g) ?? [];
  assert.equal(snapshots.length, 4);
  for (const s of snapshots) assert.match(s, /ThemeStore\.load\(\)/);
  for (const f of swiftFiles().filter((n) => n !== 'ThemeStore.swift')) {
    const src = code(readFileSync(join(WIDGET_DIR, f), 'utf8'));
    assert.doesNotMatch(src, /theme:\s*\.fallback/, `${f} uses the fallback theme directly`);
  }
});

test('every Home Screen widget paints the theme background through containerBackground', () => {
  for (const f of ['ClockWidget.swift', 'DateWidget.swift', 'QuoteWidget.swift', 'PhotoWidget.swift', 'HabitWidget.swift']) {
    const src = code(read(`targets/widget/${f}`));
    assert.match(src, /\.containerBackground\(for: \.widget\)/, f);
    assert.match(src, /GlazeBackground\(theme: t\)/, `${f} has no themed background`);
    assert.match(src, /t\.(inkColor|accentColor)/, `${f} has no themed ink/accent`);
  }
  // The shared background uses the pale-aware stops.
  assert.match(code(read('targets/widget/ThemeStore.swift')), /colors: theme\.backgroundColors/);
});

/** Pull a `var <name>: <Type> = <value>` default out of ThemeStore.swift's WidgetTheme. */
function swiftDefault(src: string, name: string): string {
  const m = new RegExp(`var ${name}: [^=]+= (.+)`).exec(src);
  assert.ok(m, `no default for ${name}`);
  return m[1].trim();
}

test('TS DEFAULT_WIDGET_THEME matches the Swift fallback exactly', () => {
  const src = read('targets/widget/ThemeStore.swift');
  const d = DEFAULT_WIDGET_THEME;
  assert.equal(swiftDefault(src, 'themeId'), JSON.stringify(d.themeId));
  assert.equal(swiftDefault(src, 'name'), JSON.stringify(d.name));
  assert.equal(swiftDefault(src, 'bg'), `[${d.bg.map((c) => JSON.stringify(c)).join(', ')}]`);
  assert.equal(swiftDefault(src, 'surface'), JSON.stringify(d.surface));
  assert.equal(swiftDefault(src, 'accent'), JSON.stringify(d.accent));
  assert.equal(swiftDefault(src, 'ink'), JSON.stringify(d.ink));
  assert.equal(swiftDefault(src, 'style'), `.${d.style}`);
  assert.equal(swiftDefault(src, 'font'), `.${d.font}`);
  assert.match(src, new RegExp(`static let paleLuminance: Double = ${PALE_BG_LUMINANCE}\\b`));
  assert.match(src, new RegExp(`static let paleAccentMix: Double = ${PALE_ACCENT_MIX}\\b`));
});

test('the default widget theme is a Glaze gradient, never near-white', () => {
  const d = DEFAULT_WIDGET_THEME;
  assert.equal(d.bg.length, 2);
  for (const c of d.bg) assert.ok(relativeLuminance(c) < 0.35, `${c} is too light for the default`);
  assert.ok(relativeLuminance(d.ink) > 0.8, 'default ink must be light on the dark gradient');
  for (const c of widgetBackgroundStops(d)) assert.ok(relativeLuminance(c) < 0.5);
});

test('pale themes get an accent-tinted background; others keep their own colours', () => {
  for (const theme of THEMES) {
    const w = widgetThemeFrom(theme, NOW);
    const stops = widgetBackgroundStops(w);
    assert.equal(stops.length, 2, theme.id);
    assert.equal(stops[0], w.bg[0]);
    const pale = w.bg.every((c) => relativeLuminance(c) >= PALE_BG_LUMINANCE);
    if (pale) {
      assert.notEqual(stops[1], w.bg[w.bg.length - 1], `${theme.id}: pale bg should take on the accent`);
      assert.ok(relativeLuminance(stops[1]) < relativeLuminance(w.bg[w.bg.length - 1]), theme.id);
    } else {
      assert.equal(stops[1], w.bg[w.bg.length - 1], theme.id);
    }
  }
  // A white-on-white pastel never stays white.
  const [, last] = widgetBackgroundStops({ bg: ['#FFF4F1', '#FFFFFF'], accent: '#E0475B' });
  assert.ok(relativeLuminance(last) < 0.7, last);
});

test('launchWidgetTheme: fresh build by id, else stored JSON, else the studio theme, else nothing', () => {
  const theme = THEMES[2];
  const lookup = (id: string) => THEMES.find((t) => t.id === id);
  const stored = serializeWidgetTheme({ ...widgetThemeFrom(theme, new Date(0)), accent: '#123456' });
  assert.deepEqual(launchWidgetTheme(stored, lookup, null, NOW), widgetThemeFrom(theme, NOW));
  const custom = serializeWidgetTheme({ ...DEFAULT_WIDGET_THEME, themeId: 'gone', accent: '#123456' });
  assert.equal(launchWidgetTheme(custom, lookup, THEMES[0].id, NOW)?.accent, '#123456');
  assert.deepEqual(launchWidgetTheme(null, lookup, THEMES[1].id, NOW), widgetThemeFrom(THEMES[1], NOW));
  assert.deepEqual(launchWidgetTheme('not json', lookup, THEMES[1].id, NOW), widgetThemeFrom(THEMES[1], NOW));
  assert.equal(launchWidgetTheme(null, lookup, null, NOW), null);
  assert.equal(launchWidgetTheme(null, lookup, 'nope', NOW), null);
  assert.notEqual(ACTIVE_WIDGET_THEME_KEY, WIDGET_THEME_KEY);
});

test('bridge and extension agree on suite, key and file, and the bridge reloads timelines', () => {
  const bridge = read('modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift');
  const store = read('targets/widget/ThemeStore.swift');
  for (const src of [bridge, store]) {
    assert.ok(src.includes(`"${WIDGET_APP_GROUP}"`));
    assert.ok(src.includes(`"${WIDGET_THEME_KEY}"`));
    assert.ok(src.includes(`"${WIDGET_THEME_FILE}"`));
  }
  const setTheme = /AsyncFunction\("setTheme"\)[^]*?\n {4}\}/.exec(bridge)?.[0] ?? '';
  assert.match(setTheme, /forKey: themeKey/);
  assert.match(setTheme, /themeFile/);
  assert.match(setTheme, /reloadWidgets\(\)/);
  assert.match(bridge, /WidgetCenter\.shared\.reloadAllTimelines\(\)/);
  assert.match(code(store), /GlazeShared\.themeFile/);
});

test('the app writes the theme on every apply path and once at launch', () => {
  const layout = read('app/_layout.tsx');
  assert.match(layout, /syncWidgetThemeAtLaunch\(\)/);
  const store = read('src/store/widgetTheme.ts');
  assert.match(store, /widgets\.setTheme\(/);
  assert.match(store, /AsyncStorage\.setItem\(ACTIVE_WIDGET_THEME_KEY/);

  const detail = read('app/theme/[id].tsx');
  const save = /const onSaveWallpaper = async \(\) => \{[^]*?\n {2}\};/.exec(detail)?.[0] ?? '';
  assert.match(save, /applyWidgetTheme\(theme\)/, 'wallpaper save must apply the widget theme');
  const useStyle = /const onUseStyle = async \([^)]*\) => \{[^]*?\n {2}\};/.exec(detail)?.[0] ?? '';
  assert.match(useStyle, /applyWidgetTheme\(theme\)/);
  // T184 / T185: "Use this theme" (the old widgets step is gone) writes the widget theme through
  // applyThemeEverywhere, which calls applyWidgetTheme.
  const putInUse = /const putInUse = async \(\) => \{[^]*?\n {2}\};/.exec(detail)?.[0] ?? '';
  assert.match(putInUse, /applyThemeEverywhere\(theme\)/);
  assert.match(read('src/store/activeTheme.ts'), /const widgets = await applyWidgetTheme\(theme\);/);

  const maker = read('app/wallpaper.tsx');
  const onSave = /const onSave = async \(\) => \{[^]*?\n {2}\};/.exec(maker)?.[0] ?? '';
  assert.match(onSave, /applyWidgetTheme\(anyTheme\)/);
  const onPair = /const onSavePair = async \(\) => \{[^]*?\n {2}\};/.exec(maker)?.[0] ?? '';
  assert.match(onPair, /applyWidgetTheme\(anyTheme\)/);

  assert.match(read('app/widget-studio.tsx'), /await applyWidgetTheme\(theme\)/);
  // Nothing in the app writes the theme behind the store's back (so the launch re-write stays current).
  for (const f of ['app/theme/[id].tsx', 'app/wallpaper.tsx', 'app/widget-studio.tsx']) {
    assert.doesNotMatch(read(f), /widgets\.setTheme\(/, f);
  }
});
