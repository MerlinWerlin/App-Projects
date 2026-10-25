// T146 (fb-1025 A, owner 25 Oct: the TestFlight widgets "just show the same line of widgets with
// the same colour scheme every time"). Swift can't be compiled here; these source guards pin the
// widget link check on every side: the extension records what it rendered, the bridge reports it,
// the adapter never throws and the Widgets tab line stays hidden in Expo Go.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WIDGET_LAST_READ_KEY } from './widgetLink.ts';
import { WIDGET_APP_GROUP } from './widgetTheme.ts';
import { en } from '../i18n/ns/tabs/en.ts';
import * as tabs from '../i18n/ns/tabs/index.ts';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
/** Source without // comments (Swift and TS). */
const code = (src: string): string =>
  src
    .split('\n')
    .map((l) => l.replace(/(^|[^:'"])\/\/.*$/, '$1'))
    .join('\n');

const STORE = 'targets/widget/ThemeStore.swift';
const BRIDGE = 'modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift';
const ADAPTER = 'src/native/widgets.ts';
const TAB = 'app/(tabs)/widgets.tsx';

test('extension: every theme load records {at, themeId, source} under glaze.widget.lastRead.v1', () => {
  const src = code(read(STORE));
  assert.ok(src.includes(`"${WIDGET_LAST_READ_KEY}"`), 'key literal');
  assert.ok(src.includes(`"${WIDGET_APP_GROUP}"`), 'App Group');
  const load = /static func load\(\) -> WidgetTheme \{([\s\S]*?)\n {2}\}/.exec(src);
  assert.ok(load, 'ThemeStore.load found');
  assert.match(load[1], /recordRead\(/, 'load() records the read');
  for (const source of ['"defaults"', '"file"', '"fallback"']) assert.ok(src.includes(source), source);
  const record = /func recordRead\([\s\S]*?\n {2}\}/.exec(src)?.[0] ?? '';
  assert.match(record, /UserDefaults\(suiteName: GlazeShared\.appGroup\)/);
  assert.match(record, /ISO8601DateFormatter\(\)/);
  assert.match(record, /"at":[\s\S]*"themeId":[\s\S]*"source":/);
  assert.match(record, /forKey: GlazeShared\.lastReadKey/);
  // Cheap, never throws: no bare `try` (only `try?`), no reload from inside the extension.
  assert.doesNotMatch(record, /\btry(?!\?)/);
  assert.doesNotMatch(record, /reloadAllTimelines|reloadTimelines/);
});

test('extension: the read record adds no visible text to any widget', () => {
  const src = code(read(STORE));
  assert.doesNotMatch(src, /Text\(/, 'ThemeStore draws no text');
});

test('bridge: linkStatus reports containerOk, themeStored, lastRead (read-only); setTheme unchanged', () => {
  const src = code(read(BRIDGE));
  assert.ok(src.includes(`"${WIDGET_LAST_READ_KEY}"`), 'key literal');
  const start = src.indexOf('AsyncFunction("linkStatus")');
  assert.ok(start > 0, 'linkStatus defined');
  const fn = src.slice(start, src.indexOf('AsyncFunction("clearPhoto")'));
  assert.match(fn, /containerURL\(forSecurityApplicationGroupIdentifier: appGroup\) != nil/);
  assert.match(fn, /"containerOk":/);
  assert.match(fn, /"themeStored":/);
  assert.match(fn, /"lastRead":/);
  assert.match(fn, /forKey: lastReadKey/);
  assert.doesNotMatch(fn, /\.set\(|write\(|reload/, 'linkStatus never writes or reloads');
  for (const name of ['setTheme', 'setWidgetSet', 'getHabits', 'setHabits', 'setPhoto', 'setSeamless', 'clearPhoto']) {
    assert.ok(src.includes(`AsyncFunction("${name}")`), `${name} kept`);
  }
});

test('adapter: linkStatus is optional on the native type, guarded, and never throws', () => {
  const src = read(ADAPTER);
  assert.match(src, /linkStatus\?\(\): Promise<unknown>;/, 'optional on NativeBridge (older builds)');
  assert.match(src, /linkStatus\(\): Promise<WidgetLinkResult>;/, 'on the adapter interface');
  assert.match(src, /^ {2}linkStatus,$/m, 'exported on widgets');
  const fn = /async function linkStatus\(\)[\s\S]*?\n\}/.exec(src)?.[0] ?? '';
  assert.match(fn, /await isAvailable\(\)/, 'Expo Go / Android detection first');
  assert.match(fn, /typeof mod\.linkStatus !== 'function'/, 'older bridge treated as unknown');
  assert.match(fn, /\} catch \{/, 'never throws');
  assert.match(fn, /NO_WIDGET_LINK/, 'available:false fallback');
  // loadNative still only requires setTheme + setPhoto, so builds without linkStatus keep working.
  assert.match(src, /typeof mod\.setTheme === 'function' && typeof mod\.setPhoto === 'function' \? mod : null/);
});

test('Widgets tab: link line is gated by widgetLinkVisible (hidden in Expo Go), checked on focus and after a pick', () => {
  const src = read(TAB);
  assert.match(src, /import \{ useWidgetLink \} from '\.\.\/\.\.\/src\/store\/widgetLink'/);
  assert.match(src, /const linkVerdict = useWidgetLink\(picked, pickNonce\)/);
  assert.match(src, /\{widgetLinkVisible\(linkVerdict\) \? \(/);
  const pick = /const pickTheme = \(id: string\) => \{([\s\S]*?)\n {2}\};/.exec(src);
  assert.ok(pick);
  assert.match(pick[1], /setPickNonce\(/);
  assert.match(src, /accessibilityLabel=\{t\('tabs\.widgetsTab\.link\.a11y'/);
  assert.doesNotMatch(code(src), /\bwithSpring\b|\.springify\(|\bBounceIn\b/);
  // No direct native calls from the screen: the store hook goes through the adapter.
  assert.doesNotMatch(src, /requireOptionalNativeModule|GlazeWidgetBridge/);

  const hook = read('src/store/widgetLink.ts');
  assert.match(hook, /from '\.\.\/native\/widgets'/);
  assert.match(hook, /useFocusEffect\(/);
  assert.match(hook, /setTimeout\(check, WIDGET_LINK_RECHECK_MS\)/);
  assert.match(hook, /clearTimeout\(id\)/);
});

test('core: expoGo and unknown verdicts draw nothing', async () => {
  const { widgetLinkVerdict, widgetLinkVisible, NO_WIDGET_LINK } = await import('./widgetLink.ts');
  assert.equal(widgetLinkVisible(widgetLinkVerdict(NO_WIDGET_LINK, null, new Date())), false);
});

test('i18n: every link message exists in all 11 locales with the {status} placeholder', () => {
  const keys = ['ok', 'noAppGroup', 'notReadYet', 'stale', 'wrongTheme', 'a11y'] as const;
  const all: Record<string, unknown> = { en, ...tabs };
  assert.equal(Object.keys(all).length, 11);
  for (const [loc, msgs] of Object.entries(all)) {
    const link = (msgs as { widgetsTab?: { link?: Record<string, string> } }).widgetsTab?.link;
    assert.ok(link, `${loc} has widgetsTab.link`);
    for (const k of keys) assert.ok(typeof link[k] === 'string' && link[k].length > 0, `${loc} link.${k}`);
    assert.ok(link.a11y.includes('{status}'), `${loc} a11y placeholder`);
    if (loc !== 'en') assert.notEqual(link.noAppGroup, en.widgetsTab.link.noAppGroup, `${loc} translated`);
  }
});
