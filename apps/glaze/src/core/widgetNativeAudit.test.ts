// T136 (oversight D133-2): one native TestFlight build carries widgets (A), the profile server (B)
// and the Live Photo work (C), so a Swift compile error costs a whole build. Swift can't be
// compiled here; these source guards pin the fixes from docs/NATIVE_AUDIT_1024.md so they can't
// silently regress, and check that each native piece stays independent and switchable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WIDGET_APP_GROUP, WIDGET_THEME_FILE, WIDGET_THEME_KEY } from './widgetTheme.ts';
import { PROFILE_MIME, PROFILE_SERVER_PATH } from './profileServer.ts';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const WIDGET_DIR = 'targets/widget';
const widgetSwift = (): string[] => readdirSync(join(ROOT, WIDGET_DIR)).filter((f) => f.endsWith('.swift'));
const BRIDGE = 'modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift';
const SERVER = 'modules/glaze-profile-server/ios/GlazeProfileServerModule.swift';

/** Swift source without // comments. */
function code(src: string): string {
  return src
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
}

/** Top-level type / function names declared in a Swift file (column 0 declarations). */
function topLevelNames(src: string): string[] {
  const out: string[] = [];
  const re = /^(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|private|fileprivate|internal|final)\s+)*(?:struct|enum|class|actor|protocol|func|typealias)\s+([A-Za-z_]\w*)/gm;
  for (const m of code(src).matchAll(re)) out.push(m[1]);
  return out;
}

// ---- A: one App Group, key and file name on every side ----

test('app, extension, bridge and plugin use the identical App Group, theme key and file', () => {
  assert.equal(WIDGET_APP_GROUP, 'group.com.jared797.glaze');
  const store = read(`${WIDGET_DIR}/ThemeStore.swift`);
  const bridge = read(BRIDGE);
  for (const [label, src] of [
    ['ThemeStore.swift', store],
    ['bridge', bridge],
  ] as const) {
    assert.ok(src.includes(`"${WIDGET_APP_GROUP}"`), `${label} App Group`);
    assert.ok(src.includes(`"${WIDGET_THEME_KEY}"`), `${label} theme key`);
    assert.ok(src.includes(`"${WIDGET_THEME_FILE}"`), `${label} theme file`);
  }
  const plugin = JSON.parse(read('native-plugins/widgets.json')) as { entitlements: Record<string, string[]> };
  assert.deepEqual(plugin.entitlements['com.apple.security.application-groups'], [WIDGET_APP_GROUP]);
  const target = read(`${WIDGET_DIR}/expo-target.config.js`);
  assert.match(target, /'com\.apple\.security\.application-groups'/);
  assert.ok(target.includes(`'${WIDGET_APP_GROUP}'`), 'extension fallback group');
  assert.match(target, /deploymentTarget: '17\.0'/, 'containerBackground / Button(intent:) need iOS 17');
});

test('bridge writes the theme to UserDefaults and theme.json, then reloads every timeline', () => {
  const src = code(read(BRIDGE));
  const fn = src.slice(src.indexOf('AsyncFunction("setTheme")'), src.indexOf('AsyncFunction("setWidgetSet")'));
  assert.match(fn, /UserDefaults\(suiteName: appGroup\)/);
  assert.match(fn, /defaults\.set\(json, forKey: themeKey\)/);
  assert.match(fn, /containerURL\(forSecurityApplicationGroupIdentifier: appGroup\)/);
  assert.match(fn, /appendingPathComponent\(themeFile\)/);
  assert.match(fn, /reloadWidgets\(\)/);
  assert.match(src, /WidgetCenter\.shared\.reloadAllTimelines\(\)/);
});

// ---- extension compile-safety guards ----

test('no duplicate top-level type names across the extension target', () => {
  const seen = new Map<string, string>();
  for (const f of widgetSwift()) {
    for (const name of topLevelNames(read(`${WIDGET_DIR}/${f}`))) {
      assert.ok(!seen.has(name), `${name} declared in both ${seen.get(name)} and ${f}`);
      seen.set(name, f);
    }
  }
  assert.ok(seen.has('WidgetTheme') && seen.has('GlazeEntry') && seen.has('GlazeBackground'));
});

test('extension imports only system frameworks (never ExpoModulesCore or a Glaze pod)', () => {
  for (const f of widgetSwift()) {
    for (const m of read(`${WIDGET_DIR}/${f}`).matchAll(/^import\s+(\w+)/gm)) {
      assert.ok(['SwiftUI', 'WidgetKit', 'Foundation', 'UIKit', 'AppIntents'].includes(m[1]), `${f} imports ${m[1]}`);
    }
  }
});

test('widget bundle: every Widget is registered once and no builder block exceeds 9 entries', () => {
  const bundle = code(read(`${WIDGET_DIR}/GlazeWidgetsBundle.swift`));
  const widgets: string[] = [];
  for (const f of widgetSwift()) {
    for (const m of code(read(`${WIDGET_DIR}/${f}`)).matchAll(/struct\s+(\w+)\s*:\s*Widget\s*\{/g)) widgets.push(m[1]);
  }
  assert.ok(widgets.length >= 10);
  for (const w of widgets) {
    const hits = bundle.match(new RegExp(`^\\s*${w}\\(\\)\\s*$`, 'gm')) ?? [];
    assert.equal(hits.length, 1, `${w} registered exactly once`);
  }
  // Each `var body: some Widget { ... }` block: count entry lines.
  const blocks = bundle.split(/var body: some Widget \{/).slice(1);
  assert.ok(blocks.length >= 2, 'habit widgets live in a nested bundle');
  for (const b of blocks) {
    const body = b.slice(0, b.indexOf('\n  }'));
    const entries = body.split('\n').filter((l) => /^\s*\w+\(\)(\.body)?\s*$/.test(l));
    assert.ok(entries.length <= 9, `bundle block has ${entries.length} entries`);
  }
  assert.match(bundle, /GlazeHabitWidgetsBundle\(\)\.body/);
  assert.equal((bundle.match(/@main/g) ?? []).length, 1);
});

test('every widget view sets containerBackground(for: .widget); placeholders read the theme', () => {
  for (const f of ['ClockWidget.swift', 'DateWidget.swift', 'QuoteWidget.swift', 'PhotoWidget.swift', 'SeamlessWidget.swift', 'HabitWidget.swift', 'LockAccessoryWidget.swift']) {
    assert.match(read(`${WIDGET_DIR}/${f}`), /\.containerBackground\(for: \.widget\)/, f);
  }
  const providers = code(read(`${WIDGET_DIR}/Providers.swift`)) + code(read(`${WIDGET_DIR}/HabitWidget.swift`));
  assert.doesNotMatch(providers, /theme: \.fallback/, 'no provider pins the built-in default');
  const store = read(`${WIDGET_DIR}/ThemeStore.swift`);
  assert.match(store, /return \.fallback/, 'fallback only after UserDefaults and theme.json');
  assert.doesNotMatch(store, /var bg: \[String\] = \["#F/i, 'fallback background is not near-white');
});

// ---- native modules: argument counts, podspecs, independence ----

test('AsyncFunction / Function closures stay within the ExpoModulesCore 8-argument limit', () => {
  for (const rel of [BRIDGE, SERVER]) {
    const src = code(read(rel));
    for (const m of src.matchAll(/(?:Async)?Function\("(\w+)"\)\s*\{\s*\(([^)]*)\)/g)) {
      const args = m[2].trim() === '' ? 0 : m[2].split(',').length;
      assert.ok(args <= 8, `${rel} ${m[1]} takes ${args} arguments`);
    }
  }
});

test('each Glaze module is its own pod and links on its own', () => {
  for (const [dir, mod, pod] of [
    ['modules/glaze-widget-bridge', 'GlazeWidgetBridgeModule', 'GlazeWidgetBridge'],
    ['modules/glaze-profile-server', 'GlazeProfileServerModule', 'GlazeProfileServer'],
  ] as const) {
    const cfg = JSON.parse(read(`${dir}/expo-module.config.json`)) as { platforms: string[]; apple: { modules: string[] } };
    assert.deepEqual(cfg.apple.modules, [mod]);
    assert.ok(existsSync(join(ROOT, dir, `ios/${pod}.podspec`)), `${pod}.podspec`);
    const spec = read(`${dir}/ios/${pod}.podspec`);
    assert.match(spec, new RegExp(`s\\.name\\s*=\\s*'${pod}'`));
    assert.match(spec, /s\.dependency 'ExpoModulesCore'/);
    // Only ExpoModulesCore: no module depends on another Glaze pod.
    assert.equal((spec.match(/s\.dependency/g) ?? []).length, 1, `${pod} depends only on ExpoModulesCore`);
  }
  const bridge = code(read(BRIDGE));
  const server = code(read(SERVER));
  assert.doesNotMatch(bridge, /GlazeLoopbackServer|GlazeProfileServer|GlazeLivelock|GlazeLivePhoto/);
  assert.doesNotMatch(server, /GlazeWidgetBridge|GlazeLivelock|GlazeLivePhoto|WidgetCenter/);
});

// ---- B: profile server compile + behaviour guards ----

test('profile server: no type shares the pod/module name; mixed dictionary is typed', () => {
  const src = code(read(SERVER));
  assert.doesNotMatch(src, /(class|struct|enum)\s+GlazeProfileServer\s*[{:]/, 'type named like the module');
  assert.match(src, /final class GlazeLoopbackServer \{/);
  assert.match(src, /let payload: \[String: Any\] = \[/);
  assert.match(src, /promise\.resolve\(payload\)/);
  assert.match(src, /promise\.reject\("ERR_GLAZE_PROFILE_SERVER", error\.localizedDescription\)/);
});

test('profile server: start() always settles (ready, failure, waiting, stop, newer start)', () => {
  const src = code(read(SERVER));
  assert.match(src, /private var pending: \(\(Result<GlazeProfileServerInfo, Error>\) -> Void\)\?/);
  assert.match(src, /private func finish\(_ result: Result<GlazeProfileServerInfo, Error>\)/);
  assert.match(src, /self\.finish\(\.success\(GlazeProfileServerInfo\(/);
  assert.match(src, /finish\(\.failure\(GlazeProfileServerError\.listenFailed\(why\)\)\)/);
  assert.match(src, /private func stopLocked\(\) \{\s*\n\s*finish\(\.failure\(GlazeProfileServerError\.stopped\)\)/);
  assert.match(src, /case \.failed\(let error\), \.waiting\(let error\):/);
  assert.doesNotMatch(src, /completion: completion\)/, 'no stray completion threading left');
});

test('profile server: Network API forms, loopback, content type, main-thread UIKit', () => {
  const src = code(read(SERVER));
  assert.match(src, /NWParameters\(tls: nil, tcp: NWProtocolTCP\.Options\(\)\)/);
  assert.match(src, /try NWListener\(using: params\)/);
  assert.match(src, /NWEndpoint\.hostPort\(host: \.ipv4\(\.loopback\), port: nwPort\)/);
  assert.match(src, /conn\.receive\(minimumIncompleteLength: 1, maximumLength: /);
  assert.match(src, /contentContext: \.finalMessage, isComplete: true, completion: \.contentProcessed/);
  assert.ok(src.includes(`"${PROFILE_MIME}"`) && src.includes(`"${PROFILE_SERVER_PATH}"`));
  // Every UIApplication call sits in begin/endBackgroundTask, whose bodies hop to the main queue
  // (the expiration handler is called on main by iOS).
  const start = src.indexOf('private func beginBackgroundTask()');
  const end = src.indexOf('static func readProfile');
  assert.ok(start > 0 && end > start);
  const outside = src.slice(0, start) + src.slice(end);
  assert.doesNotMatch(outside, /UIApplication/, 'UIApplication only in the background-task helpers');
  for (const fn of ['private func beginBackgroundTask() {', 'private func endBackgroundTask() {']) {
    const at = src.indexOf(fn);
    assert.match(src.slice(at + fn.length, at + fn.length + 60), /^\s*DispatchQueue\.main\.async \{/, fn);
  }
  assert.match(read('modules/glaze-profile-server/ios/GlazeProfileServer.podspec'), /s\.frameworks\s*=\s*'Network', 'UIKit'/);
});

// ---- switches documented ----

test('docs: audit log and per-piece switch-off notes exist', () => {
  const audit = read('docs/NATIVE_AUDIT_1024.md');
  for (const f of ['GlazeWidgetsBundle.swift', 'ThemeStore.swift', 'GlazeWidgetBridgeModule.swift', 'GlazeProfileServerModule.swift', 'VERIFY']) {
    assert.ok(audit.includes(f), `audit mentions ${f}`);
  }
  const releasing = read('docs/RELEASING.md');
  assert.match(releasing, /## \d+\. Native pieces/);
  for (const piece of ['native-plugins/widgets.json', 'modules/glaze-widget-bridge', 'modules/glaze-profile-server']) {
    assert.ok(releasing.includes(piece), `switch-off for ${piece}`);
  }
});
