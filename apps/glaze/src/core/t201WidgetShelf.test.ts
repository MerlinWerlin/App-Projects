// T201 (owner-1101d #4) source guards: one shelf order on every widgets screen, practical pieces on
// the theme page's Widgets screen, apply → App Group write → reloadAllTimelines, and no crop of art
// in the JS previews or the Swift widget / bridge. The pure ordering itself is tested in
// widgetOptions.test.ts (widgetShelf, optionsForSize).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('the menu both screens share orders by widgetShelf (practical kinds, then art)', () => {
  const opts = read('src', 'core', 'widgetOptions.ts');
  assert.match(opts, /export function widgetShelf</);
  assert.match(opts, /export function widgetOptionSections[\s\S]*?widgetShelf\(options, size\)/);
  assert.match(opts, /export function selectedOption[\s\S]*?shelfOptions\(options, size\)/);
  const menu = strip(read('src', 'ui', 'WidgetArtMenu.tsx'));
  assert.match(menu, /widgetOptionSections\(/);
  const art = strip(read('src', 'ui', 'ThemeWidgetArt.tsx'));
  assert.match(art, /<WidgetArtMenu\b/);
  assert.match(art, /selectedOption\(/);
});

test('theme page > Widgets: practical + art (ThemeWidgetArt) first, then the standard set; overview keeps the standard teaser', () => {
  const d = strip(read('app', 'theme', '[id].tsx'));
  // The Widgets card opens the theme's own widgets step (it used to jump straight to Widget Studio,
  // which only had the standard types, while the overview showed the art: no practical pieces).
  assert.match(d, /router\.push\(\{ pathname: '\/theme\/\[id\]', params: \{ id: theme\.id, step: part \} \}\)/);
  const shelf = d.indexOf("{step === 'widgets' ? <ThemeWidgetsShelf theme={theme} /> : null}");
  const seamless = d.indexOf("{step === 'widgets' && artPack ? <SeamlessCard");
  const standard = d.indexOf("{overview || step === 'widgets' ? (");
  assert.ok(shelf > 0 && seamless > shelf && standard > seamless, 'practical + art, then seamless art, then standard');
  assert.ok(d.slice(standard).indexOf('<WidgetPreviews theme={theme} palette={palette} />') > 0);
  const fn = d.slice(d.indexOf('function ThemeWidgetsShelf('), d.indexOf('const WIDGET_PREVIEW_W'));
  assert.match(fn, /<ThemeWidgetArt theme=\{theme\} size=\{size\} width=\{width\} \/>/);
  assert.match(fn, /<Segmented<HomeOptionSize>/, 'pick the Home Screen size here');
  assert.match(d, /step === 'widgets'\s*\? t\('theme\.parts\.widgets'\)/);
});

test('Widgets tab: the theme widget menu (practical, art) sits above the standard grid', () => {
  const tab = strip(read('app', '(tabs)', 'widgets.tsx'));
  const head = tab.slice(tab.indexOf('const header = ('), tab.indexOf('return (\n    <LargeTitleFlatList'));
  assert.match(head, /<ThemeWidgetArt theme=\{gridTheme\} size=\{size\}/);
  // The grid rows (standard widget types in the theme palette) are the list data, after the header.
  assert.match(tab, /header=\{header\}\s*\n\s*data=\{rows\}/);
});

test('apply → App Group write → reload: ThemeWidgetArt → adapter → bridge → reloadAllTimelines', () => {
  const art = strip(read('src', 'ui', 'ThemeWidgetArt.tsx'));
  const onUse = art.slice(art.indexOf('const onUse = async'), art.indexOf('const liveHref'));
  assert.match(onUse, /widgets\.isAvailable\(\)/);
  assert.match(onUse, /widgets\.setWidgetArt\(/);
  assert.match(onUse, /await seamless\(artUri\)/);
  assert.match(art, /widgets\.setSeamless\(/);
  const adapter = read('src', 'native', 'widgets.ts');
  assert.match(adapter, /m\.setWidgetArt\?\.\(input\.artUri,/);
  assert.match(adapter, /m\.setSeamless\?\.\(\s*input\.wallpaperUri,/);
  const bridge = read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift');
  assert.match(bridge, /private static func reloadWidgets\(\) \{\s*if #available\(iOS 14\.0, \*\) \{\s*WidgetCenter\.shared\.reloadAllTimelines\(\)/);
  const fns = ['setTheme', 'setWidgetSet', 'setSeamless', 'setWidgetArt'];
  for (const name of fns) {
    const at = bridge.indexOf(`AsyncFunction("${name}")`);
    assert.ok(at > 0, name);
    const next = bridge.indexOf('AsyncFunction(', at + 10);
    const body = bridge.slice(at, next > 0 ? next : undefined);
    assert.match(body, /containerURL\(forSecurityApplicationGroupIdentifier: appGroup\)/, `${name} writes into the App Group`);
    assert.match(body, /\.write\(to: container\.appendingPathComponent\(/, `${name} writes a file`);
    assert.match(body, /GlazeWidgetBridgeModule\.reloadWidgets\(\)\s*\n\s*return true/, `${name} reloads all timelines after the write`);
  }
  // Widget Studio saves through the same bridge (setTheme via applyWidgetTheme, then setWidgetSet).
  const studio = read('app', 'widget-studio.tsx');
  assert.match(studio, /await applyWidgetTheme\(theme\)/);
  assert.match(studio, /widgets\.setWidgetSet\(/);
});

test('no crop of art: JS previews contain; Swift widget pins both layers; the bridge fits (min scale)', () => {
  const menu = read('src', 'ui', 'WidgetArtMenu.tsx');
  assert.match(menu, /<ExpoImage source=\{source\} style=\{artStyle\} contentFit="contain"/);
  const preview = read('src', 'ui', 'SeamlessWidgetPreview.tsx');
  assert.match(preview, /<ExpoImage source=\{hero\}[^>]*contentFit="contain"/);
  const art = read('src', 'ui', 'ThemeWidgetArt.tsx');
  assert.match(art, /fit: placeArt\(\{ w: option\.width, h: option\.height \}, px, option\.fit\)\.mode/, 'fill only when placeArt allows it');

  const widget = read('targets', 'widget', 'SeamlessWidget.swift');
  // Every aspect-fill in the Seamless widget is the blurred background, clipped to the widget size.
  const fills = [...widget.matchAll(/\.scaledToFill\(\)([\s\S]{0,200})/g)];
  assert.ok(fills.length >= 1);
  for (const f of fills) {
    assert.match(f[1], /^\s*\.frame\(width: geo\.size\.width, height: geo\.size\.height\)\s*\.clipped\(\)\s*\.blur\(radius:/);
  }
  assert.match(widget, /\.scaledToFit\(\)\s*\.frame\(width: geo\.size\.width, height: geo\.size\.height\)/);
  assert.doesNotMatch(widget, /aspectRatio\(contentMode: \.fill\)/);

  const bridge = read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift');
  const setArt = bridge.slice(bridge.indexOf('AsyncFunction("setWidgetArt")'), bridge.indexOf('AsyncFunction("linkStatus")'));
  // The only aspect-fill (max scale) is the blurred background copy; the art is min-scale fitted,
  // or drawn edge to edge only for fit "fill" (which JS sends only when the aspects already match).
  assert.equal((setArt.match(/let s = max\(/g) ?? []).length, 1);
  assert.match(setArt, /let s = max\(target\.width \/ blurred\.size\.width, target\.height \/ blurred\.size\.height\)/);
  assert.match(setArt, /let s = min\(box\.width \/ art\.size\.width, box\.height \/ art\.size\.height\)/);
  const setSeam = bridge.slice(bridge.indexOf('AsyncFunction("setSeamless")'), bridge.indexOf('AsyncFunction("setWidgetArt")'));
  assert.match(setSeam, /let s = min\(box\.width \/ hero\.size\.width, box\.height \/ hero\.size\.height\)/);
  assert.doesNotMatch(setSeam, /max\(box/);
});
