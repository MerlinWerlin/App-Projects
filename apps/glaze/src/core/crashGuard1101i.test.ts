// T264 (owner-1101i #2, docs/CRASH_1101I.md): crash hardening guards, read from source text.
// - every tab screen and the theme detail is wrapped in its own error boundary (calm card + Retry);
// - every AppState 'change' handler in app/ and src/ is try-wrapped (return-to-app never throws);
// - "Use this theme" catches, and the theme listeners / deferred requests cannot stop each other;
// - no `try!`, `fatalError(` or `as!` in the native Swift (modules/*/ios, targets/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (...p: string[]): string => readFileSync(join(root, ...p), 'utf8');

/** Blank out comments so commented code never counts. */
function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

function walk(dir: string, match: (name: string) => boolean, out: string[] = []): string[] {
  const abs = join(root, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, match, out);
    else if (match(name)) out.push(rel);
  }
  return out;
}

/** The text of the call starting at `start` (an index just after its opening paren), up to its close. */
function callBody(src: string, start: number): string {
  let depth = 1;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return src.slice(start, i);
    }
  }
  return src.slice(start);
}

const SCREENS: readonly (readonly [string[], string])[] = [
  [['app', '(tabs)', 'themes.tsx'], 'ThemesScreen'],
  [['app', '(tabs)', 'icons.tsx'], 'IconsScreen'],
  [['app', '(tabs)', 'widgets.tsx'], 'WidgetsTab'],
  [['app', '(tabs)', 'wallpapers.tsx'], 'WallpapersTab'],
  [['app', '(tabs)', 'settings.tsx'], 'SettingsScreen'],
  [['app', 'theme', '[id].tsx'], 'ThemeDetailScreen'],
];

test('T264: every tab screen and the theme detail fail on their own (error boundary + Retry)', () => {
  for (const [path, name] of SCREENS) {
    const src = strip(read(...path));
    const where = path.join('/');
    assert.match(src, /import \{ withScreenBoundary \} from '\.\.\/\.\.\/src\/ui\/ScreenBoundary';/, where);
    assert.match(src, new RegExp(`export default withScreenBoundary\\(${name}, '[a-z]+'\\);`), where);
    assert.doesNotMatch(src, /export default function/, `${where}: the default export is the bounded screen`);
    assert.equal((src.match(/export default/g) ?? []).length, 1, where);
  }
});

test('T264: the screen boundary shows a calm card, Retry remounts the screen by key', () => {
  const src = strip(read('src', 'ui', 'ScreenBoundary.tsx'));
  assert.match(src, /<ErrorBoundary\b[^>]*fallback=\{fallback\}/);
  assert.match(src, /<Screen key=\{epoch\} \{\.\.\.props\} \/>/);
  assert.match(src, /setEpoch\(\(e\) => e \+ 1\);\s*reset\(\);/);
  assert.match(src, /t\('ui\.error\.screenTitle'\)/);
  assert.match(src, /t\('ui\.error\.screenBody'\)/);
  assert.match(src, /label=\{t\('ui\.error\.retry'\)\}/);
  assert.match(src, /accessibilityLabel=\{t\('ui\.error\.retry'\)\}/);
  assert.match(src, /accessibilityRole="header"/);
  // Tokens only (no raw hex colours).
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/);
});

test('T264: the boundary strings exist in every locale of the ui namespace', () => {
  const dir = join('src', 'i18n', 'ns', 'ui');
  const locales = readdirSync(join(root, dir)).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  assert.ok(locales.length >= 11, 'en + 10 translations');
  for (const f of locales) {
    const src = read(dir, f);
    for (const key of ['screenTitle', 'screenBody', 'retry']) assert.match(src, new RegExp(`\\b${key}: '`), `${f}: ui.error.${key}`);
  }
});

test('T264: every AppState change handler in app/ and src/ is try-wrapped', () => {
  const files = [...walk('app', (n) => /\.tsx?$/.test(n)), ...walk('src', (n) => /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n))];
  let seen = 0;
  for (const f of files) {
    const src = strip(read(f));
    const re = /AppState\.addEventListener\(/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      seen++;
      const body = callBody(src, m.index + m[0].length);
      assert.match(body, /try \{[\s\S]*\} catch/, `${f}: AppState handler is try-wrapped`);
      assert.doesNotMatch(body, /\bvoid [a-zA-Z]+\(/, `${f}: no bare void promise in an AppState handler (use .catch)`);
    }
  }
  assert.ok(seen >= 3, 'the known handlers were found');
});

test('T264: "Use this theme" catches; listeners and deferred requests cannot stop each other', () => {
  const detail = strip(read('app', 'theme', '[id].tsx'));
  const put = detail.slice(detail.indexOf('const putInUse = async'), detail.indexOf('const onUseTheme'));
  assert.match(put, /await applyThemeEverywhere\(theme\)/);
  assert.match(put, /\} catch \(e\) \{[\s\S]*setUseError\(true\)/);
  assert.match(put, /\} finally \{\s*setUseBusy\(false\);/);
  assert.doesNotMatch(detail, /void putInUse\(\)/);
  const store = strip(read('src', 'store', 'activeTheme.ts'));
  const apply = store.slice(store.indexOf('export async function applyThemeEverywhere'), store.indexOf('async function themeArtStep'));
  assert.match(apply, /for \(const l of \[\.\.\.listeners\]\) \{\s*try \{\s*l\(theme\.id\);/);
  assert.match(apply, /try \{\s*requestDeferred\(DEFERRED_STEPS\.widgetTheme\)/);
  const queue = strip(read('src', 'core', 'deferredWork.ts'));
  assert.doesNotMatch(queue, /void drain\(\)/, 'a drain never rejects unhandled');
});

test('T264: Themes tab guards keys, sizes and the pull-to-refresh promise', () => {
  const src = strip(read('app', '(tabs)', 'themes.tsx'));
  assert.match(src, /const rowKey = \(row: Row, index: number\): string =>/);
  assert.match(src, /const themeKey = \(theme: GalleryTheme, index: number\): string =>/);
  assert.match(src, /const width = finitePos\(win\.width, FALLBACK_W\);/);
  assert.match(src, /if \(!item\) return null;/);
  assert.match(src, /if \(mounted\.current\) setRefreshing\(false\);/);
});

test('T264: no try!, fatalError( or as! in the native Swift', () => {
  const swift = [...walk('modules', (n) => n.endsWith('.swift')), ...walk('targets', (n) => n.endsWith('.swift'))];
  assert.ok(swift.length > 0, 'Swift sources found');
  for (const f of swift) {
    const src = strip(read(f));
    assert.doesNotMatch(src, /\btry!/, `${f}: try!`);
    assert.doesNotMatch(src, /\bfatalError\(/, `${f}: fatalError(`);
    assert.doesNotMatch(src, /\bas! /, `${f}: as!`);
  }
});
