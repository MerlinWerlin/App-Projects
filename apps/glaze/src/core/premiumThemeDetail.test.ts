// T173 premium UI, §3.3 Theme detail (docs/PREMIUM_UI.md, run 183): source guards for the slice:
// editorial blocks (eyebrow + title) in the planned order, strings in every locale, the hero phone
// with the quiet Home / Lock pill under it, one primary pill in the glass bar, expo-image for the
// wallpaper art, and a Dynamic Type cap on every Text on the theme detail path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const DETAIL_PATH = ['app', 'theme', '[id].tsx'];
const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ja', 'ko', 'zh-Hans', 'hi', 'ar'];

test('theme detail reads as editorial blocks: Icons, Widgets, Wallpaper, Credits', () => {
  const d = strip(read(...DETAIL_PATH));
  // (Plain substring checks: an import-shaped regex here would trip guard.test.ts's import scan.)
  assert.ok(d.includes(' SectionHeader, SquircleCard }'), 'SectionHeader comes from src/ui/v2');
  const order = ['icons', 'widgets', 'wallpaper', 'credits'].map((k) => d.indexOf(`t('theme.section.${k}.eyebrow')`));
  for (const at of order) assert.ok(at > 0, 'every block has its eyebrow');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'blocks in the planned order');
  // T200: no "What's inside" block (its palette moved to the widgets block).
  assert.ok(!d.includes("theme.section.inside"), "no What's inside block");
  assert.ok(!d.includes("t('theme.iconStyle')") && !d.includes('theme.summary.') && !d.includes("t('theme.widgets.line'"), 'no style summary');
  assert.equal((d.match(/<SectionHeader\b/g) ?? []).length, 4);
  // Credits only when there is something to credit.
  assert.match(d, /\{hasCredits \? \(/);
});

test('T200: "Set it up" is a bold title1 section header with a subtitle, above the three entry cards', () => {
  const d = strip(read(...DETAIL_PATH));
  const at = d.indexOf("t('theme.parts.title')");
  const cards = d.indexOf("title={t('theme.parts.wallpaper')}");
  assert.ok(at > 0 && cards > at, 'header comes before the cards');
  const head = d.slice(d.lastIndexOf('<View style={styles.setUpHead}', at), cards);
  assert.match(head, /accessibilityRole="header"/);
  assert.match(head, /ts\('title1'\)/, 'title1 from the type tokens (larger than a section title2)');
  assert.match(head, /styles\.setUpTitle/);
  assert.match(head, /t\('theme\.parts\.subtitle'\)/);
  assert.match(d, /setUpTitle: \{ fontWeight: '800' \}/);
  assert.ok(!d.includes('theme.parts.eyebrow'));
});

test('T200: the palette is shown in the matching-widgets block with its caption', () => {
  const d = strip(read(...DETAIL_PATH));
  assert.match(d, /<WidgetPreviews theme=\{theme\} palette=\{palette\} \/>/);
  const fn = d.slice(d.indexOf('function WidgetPreviews('), d.indexOf('const WIDGET_PREVIEW_W'));
  assert.match(fn, /palette\.map\(/);
  assert.match(fn, /t\('theme\.a11y\.swatch', \{ name, hex \}\)/);
  assert.match(fn, /t\('theme\.widgetPreviews\.palette'\)/);
});

test('every locale has the theme detail section strings (and none of the retired ones)', () => {
  for (const loc of LOCALES) {
    const src = read('src', 'i18n', 'ns', 'theme', `${loc}.ts`);
    const block = /\n {2}section: \{\n([\s\S]*?)\n {2}\},\n/.exec(src)?.[1] ?? '';
    for (const k of ['icons: { eyebrow:', 'widgets: { eyebrow:', 'wallpaper: { eyebrow:', 'credits: { eyebrow:']) {
      assert.ok(block.includes(k), `${loc}: theme.section ${k}`);
    }
    assert.ok(!block.includes('inside:'), `${loc}: theme.section.inside retired`);
    const parts = /\n {2}parts: \{\n([\s\S]*?)\n {2}\},\n/.exec(src)?.[1] ?? '';
    assert.match(parts, /^ {4}title: '/m, `${loc}: parts.title`);
    assert.match(parts, /^ {4}subtitle: '/m, `${loc}: parts.subtitle`);
    assert.doesNotMatch(parts, /^ {4}eyebrow:/m, `${loc}: parts.eyebrow retired`);
    assert.match(src, /\n {4}palette: '[^']+',\n/, `${loc}: widgetPreviews.palette caption`);
    assert.doesNotMatch(src, /\n {2}(summary|iconStyle|widgets): /, `${loc}: retired summary / iconStyle / widgets line`);
  }
});

test('theme detail hero: phone centred on a soft surface, quiet Home / Lock pill under it, timed cross-fade', () => {
  const d = strip(read(...DETAIL_PATH));
  const start = d.indexOf('<SquircleCard size="large" elevation="card"');
  assert.ok(start > 0, 'hero card on the soft card surface');
  const hero = d.slice(start, d.indexOf('</SquircleCard>', start));
  assert.ok(hero.indexOf('<Segmented<PreviewMode>') > hero.indexOf('styles.phone'), 'toggle sits under the phone');
  assert.match(d, /modeToggle: \{ alignSelf: 'center' \}/);
  assert.match(d, /withTiming\(mode === 'home' \? 1 : 0, \{\s*duration: reduced \? durations\.fast : durations\.base,\s*easing: easeOutCurve/);
  assert.doesNotMatch(d, /withSpring|ActivityIndicator/);
});

test('theme detail glass bar holds one primary (filled) pill', () => {
  const d = strip(read(...DETAIL_PATH));
  const bar = d.slice(d.indexOf('<GlassBar material="chrome"'), d.indexOf('</GlassBar>'));
  const pills = [...bar.matchAll(/<PillButton\b[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.ok(pills.length >= 1);
  assert.equal(pills.filter((p) => !/variant=/.test(p)).length, 1, 'exactly one default (filled) pill');
  assert.ok(pills.every((p) => !/variant="(filled|tinted)"/.test(p)), 'no second loud pill');
});

test('theme detail draws its wallpaper art with expo-image (RN Image only for getSize)', () => {
  const d = strip(read(...DETAIL_PATH));
  assert.ok(d.includes('{ Image as ExpoImage }') && d.includes("'expo" + "-image'"), 'expo-image Image aliased as ExpoImage');
  assert.equal((d.match(/<Image\b/g) ?? []).length, 0, 'no RN <Image> element');
  assert.ok((d.match(/<ExpoImage\b[^>]*contentFit="cover"/g) ?? []).length >= 2);
});

test('every Text on the theme detail path carries a Dynamic Type cap', () => {
  for (const f of [
    DETAIL_PATH,
    ['src', 'ui', 'ShapePicker.tsx'],
    ['src', 'ui', 'ThemeOverrideRow.tsx'],
    ['src', 'ui', 'Segmented.tsx'],
    ['src', 'ui', 'PillButton.tsx'],
  ]) {
    const src = strip(read(...f));
    const tags = [...src.matchAll(/<(Text|TextInput)\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(tags.length > 0, f.join('/'));
    const uncapped = tags.filter((t) => !/maxFontSizeMultiplier=/.test(t));
    assert.deepEqual(uncapped, [], `${f.join('/')}: Text without maxFontSizeMultiplier`);
  }
});

test('T173 §3.3: apply waits show a skeleton of the result (icon tiles while the style renders, a wallpaper while it saves)', () => {
  const d = strip(read(...DETAIL_PATH));
  assert.match(d, /\{styleBusy \? <IconGridSkeleton\b/, 'icon style render shows icon-tile skeletons');
  assert.match(d, /\{saver\.saving \|\| photoSaver\.saving \? \(\s*<Skeleton\b[^>]*PHONE_ASPECT/, 'wallpaper save shows a phone-shaped skeleton');
});

test('T210: "Set it up" entry points are three lifted, art-led cards on the 16 pt rhythm (no ruled inset group)', () => {
  const d = strip(read(...DETAIL_PATH));
  const at = d.indexOf("t('theme.parts.title')");
  const end = d.indexOf("step === 'wallpaper' ? (", at);
  assert.ok(at > 0 && end > at);
  const block = d.slice(at, end);
  assert.ok(!block.includes('<InsetGroup') && !block.includes('<InsetRow'), 'no inset group under Set it up');
  assert.match(block, /<View style=\{styles\.parts\}>/);
  assert.equal((block.match(/<PartCard\b/g) ?? []).length, 3);
  for (const [part, art] of [['wallpaper', 'PartWallpaperArt'], ['icons', 'PartIconsArt'], ['widgets', 'PartWidgetArt']]) {
    assert.ok(block.includes(`title={t('theme.parts.${part}')}`), part);
    assert.ok(block.includes(`onPress={() => openPart('${part}')}`), part);
    assert.ok(block.includes(`art={<${art} `), `${part} leads with ${art}`);
  }
  assert.match(block, /status=\{savedBefore \? t\('theme\.save\.savedBadge'\) : null\}/, 'the wallpaper card says Saved to Photos once saved');
  assert.match(d, /parts: \{ gap: editorialV2\.cardGap \}/);
  const card = d.slice(d.indexOf('function PartCard('), d.indexOf('function PartWallpaperArt('));
  assert.match(card, /tone=\{scheme === 'dark' \? 'raised' : 'surface'\}\s+outline=\{false\}/, 'lifts by surface, no hairline');
  assert.match(card, /haptic="select"/);
  assert.match(card, /accessibilityLabel=\{label\}/);
  assert.match(card, /accessibilityElementsHidden\s+importantForAccessibility="no-hide-descendants"/, 'the art is decorative');
  assert.match(d, /partRow: \{[^}]*minHeight: sizeV2\.touch/);
  // The art comes from the theme itself (palette and its own icons), never a stock picture.
  const art = d.slice(d.indexOf('function PartWallpaperArt('), d.indexOf('const styles = StyleSheet.create'));
  assert.match(art, /theme\.palette\.bg/);
  assert.match(art, /<IconCanvas key=\{.+?\} spec=\{s\} size=\{PART_ICON\} morph=\{false\} \/>/);
  assert.match(art, /theme\.palette\.surface/);
  assert.doesNotMatch(art, /withSpring|withTiming|Animated\./, 'the thumbnails never move');
});
