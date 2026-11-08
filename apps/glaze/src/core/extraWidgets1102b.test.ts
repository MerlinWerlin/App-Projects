// owner-1102b T277 + T278: source guards for the Moon, Word clock and Big clock widgets (Swift
// can't be compiled here). Pins the kinds, the families, theme use, the nested bundle and strings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const W = 'targets/widget';
const read = (f: string): string => readFileSync(`${W}/${f}`, 'utf8');
const code = (s: string): string => s.replace(/\/\/.*$/gm, '');
const moon = code(read('MoonWidget.swift'));
const clocks = code(read('ClockStyleWidgets.swift'));

const EXTRA_WIDGET_KINDS = Object.freeze(['GlazeMoon', 'GlazeWordClock', 'GlazeBigClock'] as const);

test('kinds, families and providers', () => {
  assert.match(moon, /struct MoonWidget: Widget \{\s*let kind = "GlazeMoon"/);
  assert.match(clocks, /struct WordClockWidget: Widget \{\s*let kind = "GlazeWordClock"/);
  assert.match(clocks, /struct BigClockWidget: Widget \{\s*let kind = "GlazeBigClock"/);
  for (const src of [moon, clocks]) {
    for (const m of src.matchAll(/\.supportedFamilies\(\[([^\]]*)\]\)/g)) {
      assert.match(m[1], /\.systemSmall/);
      assert.match(m[1], /\.systemLarge/);
    }
  }
  assert.match(moon, /provider: HourProvider\(\)/);
  assert.equal((clocks.match(/provider: MinuteProvider\(\)/g) ?? []).length, 2);
});

test('nested bundle is registered once in the main bundle', () => {
  assert.match(moon, /struct GlazeExtraWidgetsBundle: WidgetBundle \{[\s\S]*MoonWidget\(\)\s*WordClockWidget\(\)\s*BigClockWidget\(\)/);
  const main = code(read('GlazeWidgetsBundle.swift'));
  assert.equal((main.match(/^\s*GlazeExtraWidgetsBundle\(\)\.body\s*$/gm) ?? []).length, 1);
});

test('theme colours, font and background everywhere; never the theme name', () => {
  for (const [f, src] of [['MoonWidget.swift', moon], ['ClockStyleWidgets.swift', clocks]] as const) {
    assert.match(src, /\.containerBackground\(for: \.widget\) \{ GlazeBackground\(theme: t\) \}/, f);
    assert.match(src, /typeface\(size:/, f);
    assert.match(src, /accentColor/, f);
    assert.doesNotMatch(src, /\b(?:t|theme|entry\.theme)\.(?:name|themeId)\b/, `${f} shows the theme name`);
    assert.doesNotMatch(src, /Image\(systemName:/, `${f}: drawn, not an SF Symbol`);
    assert.doesNotMatch(src, /!\s*[.)\]]|\bas!|try!/, `${f}: no force unwraps`);
  }
  // The moon disc is drawn from the phase fraction in theme colours.
  assert.match(moon, /struct GlazeMoonLitShape: Shape/);
  assert.match(moon, /GlazeMoonDisc\(fraction: info\.fraction, theme: t\)/);
  assert.match(moon, /MoonPhase\.info\(at: entry\.date\)/);
  assert.match(moon, /MoonPhase\.daysToFull\(at: entry\.date\)/);
});

test('word clock: English phrase, digital fallback otherwise; big clock is StandBy-aware', () => {
  assert.match(clocks, /if WordClock\.supported \{/);
  assert.match(clocks, /WordClock\.lines\(at: entry\.date\)/);
  assert.match(clocks, /\} else \{\s*GlazeClockStyleDigits\(/);
  assert.match(clocks, /@Environment\(\\\.showsWidgetContainerBackground\)/);
});

test('every moon phase has a localised name and the Swift keys match moonPhase.ts labelKey', () => {
  for (const phase of ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent']) {
    assert.ok(moon.includes(`case .${phase}: return String(localized: "widgets.moon.${phase}"`), phase);
  }
  const en = read('en.lproj/Localizable.strings');
  for (const lit of ['Moon', 'Word clock', 'Big clock']) assert.ok(en.includes(`"${lit}" = `), lit);
});

test('docs list the new kinds', () => {
  const docs = readFileSync('docs/WIDGETS.md', 'utf8');
  for (const k of EXTRA_WIDGET_KINDS) assert.ok(docs.includes(`\`${k}\``), k);
});
