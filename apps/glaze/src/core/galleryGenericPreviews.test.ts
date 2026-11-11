// Owner 2026-11-11 ("ok - make it generic - variations"): iOS keeps the Add Widget gallery's previews
// long after a theme swap and offers no way to refresh them, so the gallery never shows the theme.
// Every gallery preview (placeholder and isPreview snapshot) draws a fixed GallerySample, in a spread
// of palettes and drawn scenes; widgets on the Home Screen still read the current theme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const W = (f: string) => readFileSync(join(process.cwd(), 'targets', 'widget', f), 'utf8').replace(/\r\n/g, '\n');
const samples = W('GallerySamples.swift');

test('GallerySamples: bundled and fixed, never reads the theme or the App Group', () => {
  assert.doesNotMatch(samples.replace(/\/\/.*$/gm, ''), /ThemeStore|FileManager|UserDefaults|UIImage|WidgetArtStore|containerURL/);
  assert.equal((samples.match(/^\s*make\("/gm) ?? []).length, 6, 'six sample palettes');
  for (const scene of ['moon', 'sun', 'planet', 'waves', 'peaks', 'stars']) assert.ok(samples.includes(`private func ${scene}(`), scene);
  assert.match(samples, /static let idPrefix = "gallery-sample-"/);
  assert.match(samples, /var isGallerySample: Bool \{ themeId\.hasPrefix\(GallerySample\.idPrefix\) \}/);
});

test('every gallery snapshot and placeholder uses a sample, Home Screen snapshots keep the theme', () => {
  const cases: [string, RegExp[]][] = [
    ['ThemeGalleryWidget.swift', [/design: GallerySample\.design\(kind: kind\.rawValue\), preview: true/, /if context\.isPreview \{ return completion\(placeholder\(in: context\)\) \}/]],
    ['CalendarEventWidget.swift', [/theme: GallerySample\.theme\(4\)/, /context\.isPreview \? GallerySample\.theme\(4\) : ThemeStore\.load\(\)/]],
    ['WeatherWidget.swift', [/theme: GallerySample\.theme\(3\), report/, /context\.isPreview \? GallerySample\.theme\(3\) : ThemeStore\.load\(\)/]],
    ['LockAccessoryWidget.swift', [/LockBatteryEntry\(date: Date\(\), theme: GallerySample\.theme\(0\), percent: nil\)/, /if context\.isPreview \{ return completion\(LockBatteryEntry\(date: Date\(\), theme: GallerySample\.theme\(0\)/]],
    ['PhotoAlbumWidget.swift', [/theme: GallerySample\.theme\(5\), design: nil, photoRef: nil/, /if context\.isPreview \{ return completion\(placeholder\(in: context\)\) \}/]],
    ['HabitWidget.swift', [/theme: GallerySample\.theme\(variant\)/, /context\.isPreview \? placeholder\(in: context\) : entry\(Date\(\)\)/]],
    ['HabitStreakWidget.swift', [/theme: sample \? GallerySample\.theme\(2\) : ThemeStore\.load\(\)/]],
  ];
  for (const [f, res] of cases) for (const re of res) assert.match(W(f), re, f);
});

test('the gallery never reads saved designs or the person\'s photo', () => {
  assert.match(W('SavedWidgetView.swift'), /savedDesign\(kind: String, family: WidgetFamily, theme: WidgetTheme\) -> SavedWidgetDesign\? \{\n.*\n\s*if theme\.isGallerySample \{ return nil \}/);
  assert.match(W('PhotoWidget.swift'), /let photo = t\.isGallerySample \? nil : ThemeStore\.loadPhoto\(\)/);
});

test('the gallery shows variations: shared providers take a per-kind sample palette', () => {
  const used = new Set<string>();
  for (const f of ['CatalogueWidgets.swift', 'ClockStyleWidgets.swift', 'ClockWidget.swift', 'DateWidget.swift', 'QuoteWidget.swift', 'PhotoWidget.swift']) {
    for (const m of W(f).matchAll(/(?:Minute|Day|Hour)Provider\(sample: (\d+)\)/g)) used.add(m[1]);
  }
  assert.ok(used.size >= 5, `distinct palettes in the gallery: ${[...used].join(', ')}`);
});

test('gallery descriptions say the widget takes on the theme once added', () => {
  assert.match(W('ThemeGalleryWidget.swift'), /\.description\("Takes on your Glaze theme once added\."\)/);
  assert.match(W('ThemeArtWidgets.swift'), /\.description\("Shows your Glaze theme's art once added\."\)/);
});
