// T173 premium UI, onboarding slice (docs/PREMIUM_UI.md §3.1): the Prism intro hands over to the Themes tab with no
// blank frame (T199: a dark full-screen scene that fades over the app), and the Themes first screen shows title, category bubbles and one editorial section start, with nothing
// else competing above it. Source guards (the screens are React Native, so they are read as text).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { darkV2, lightV2 } from './designV2.ts';
import { BRAND } from './introGlaze.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
/** Drop line and block comments so a comment never satisfies (or trips) a guard. */
const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('intro background is the dark app bg token in both appearances; the app keeps its own bg (T199)', () => {
  // T199 (owner-1101d #2): the intro is a full-screen dark scene in light and dark. It reads the dark `bg` token (no
  // copy of the hex) and the native splash uses the same colour, so the hand-over has no flash.
  assert.equal(BRAND.introBg, darkV2.bg);
  assert.equal(BRAND.light.bg, lightV2.bg);
  assert.equal(BRAND.dark.bg, darkV2.bg);
  const core = strip(read('src', 'core', 'introGlaze.ts'));
  assert.match(core, /introBg: darkV2\.bg/);
  assert.match(core, /bg: lightV2\.bg/);
});

test('intro sits on the dark bg token and fades over the app, which paints its own scheme token underneath', () => {
  const intro = strip(read('src', 'ui', 'IntroGlaze.tsx'));
  assert.match(intro, /import \{ paletteFor \} from '\.\.\/theme\/tokensV2'/);
  assert.match(intro, /const bg = paletteFor\('dark'\)\.bg;/);
  assert.match(intro, /StyleSheet\.absoluteFill, styles\.host, \{ backgroundColor: bg, opacity: fade \}/);
  assert.doesNotMatch(intro, /backgroundColor: c\.bg/, 'the host does not read a brand copy');

  // useColorsV2 is paletteFor(system scheme); the intro's `dark` comes from that same hook.
  const hook = read('src', 'theme', 'useTokens.ts');
  assert.match(hook, /return \{ c: paletteFor\(scheme\), scheme \}/);
  const layout = strip(read('app', '_layout.tsx'));
  assert.match(layout, /<IntroGlaze ready=\{ready\} dark=\{scheme === 'dark'\}/);
  assert.match(layout, /const \{ c, scheme \} = useColorsV2\(\);/);

  // Everything behind the hand-over paints c.bg: the root layout, the "/" redirect and the Themes tab.
  assert.match(layout, /backgroundColor: c\.bg/);
  assert.match(strip(read('app', 'index.tsx')), /backgroundColor: c\.bg/);
  assert.match(strip(read('app', '(tabs)', 'themes.tsx')), /<View style=\{\[styles\.root, \{ backgroundColor: c\.bg \}\]\}>/);

  // The native splash is the intro's first frame: the dark bg in both appearances (app.json, expo-splash-screen).
  const splash = JSON.parse(read('app.json')).expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')?.[1];
  assert.ok(splash, 'expo-splash-screen plugin config');
  assert.equal(splash.backgroundColor, darkV2.bg);
  assert.equal(splash.dark.backgroundColor, darkV2.bg);
});

// T177 (owner-1031): the first screen is the title, the gallery's quiet controls (Liked pills, search)
// and the New collection as the first editorial section (the first list row, src/core/gallery.ts); the
// category bubbles, story chips and seasonal banner left the tab, and the panels follow the gallery.
test('Themes first screen: title, quiet controls, then the New collection; extra rows sit below the gallery', () => {
  const src = strip(read('app', '(tabs)', 'themes.tsx'));
  const at = (s: string) => {
    const i = src.indexOf(s);
    assert.ok(i >= 0, `${s} is rendered`);
    return i;
  };
  const header = at('const listHeader = useMemo(');
  const footer = at('const listFooter = useMemo(');
  const title = at('<LargeTitle ');
  assert.ok(header < title && title < footer, 'the large title opens the list header');
  // Nothing loud between the title and the end of the header: only the language line, pills, search, a status line.
  const above = src.slice(title, footer);
  for (const loud of ['<CategoryBubbleRow', '<StoryChips', '<SeasonalBanner', '<LiveHeroCard', '<YourLookPanel', '<InsetGroup', '<SquircleCard']) {
    assert.ok(!above.includes(loud), `${loud} is not above the first section`);
  }
  assert.ok(title < at('<LanguageHintLine') && at('<LanguageHintLine') < at('<PillTabs ') && at('<PillTabs ') < at('<SearchField '));
  // The list's first rows are the New collection (gallery rows), and the panels are the list footer.
  assert.match(src, /data=\{rows\}/);
  assert.match(src, /ListHeaderComponent=\{listHeader\}/);
  assert.match(src, /ListFooterComponent=\{listFooter\}/);
  for (const later of ['<LiveHeroCardM ', '<YourLookPanelM ', '<InsetGroup ']) assert.ok(footer < at(later), `${later} after the gallery`);
});
