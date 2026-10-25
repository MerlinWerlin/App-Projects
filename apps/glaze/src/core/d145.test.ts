// Oversight D145-1 / D145-2 (owner rejection of run 113 + themed-widget go/no-go, 25 Oct).
// Source guards: the cloud can't compile the native build.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const GROUP = 'group.com.jared797.glaze';
const KEY = 'com.apple.security.application-groups';

test('D145-1: Glaze Plus shows the owner price A$2.99, one-time', () => {
  const ent = read('src', 'plus', 'entitlement.ts');
  assert.match(ent, /export const PLUS_PRICE = 'A\$2\.99';/);
  assert.doesNotMatch(ent, /7\.99|4\.99/);
});

test('D145-1: Unlock in a test build says plainly it cannot be bought yet and nothing was charged', () => {
  const en = read('src', 'i18n', 'ns', 'plus', 'en.ts');
  assert.match(en, /unavailable: "?'?You can\\?'t buy Glaze Plus in this test version\. Buying opens with the App Store release\. Nothing was charged\./);
});

test('D145-2: the App Group is applied to the app on every native build, not only when the widget tool is present', () => {
  const piece = JSON.parse(read('native-plugins', 'appgroup.json')) as { plugins?: unknown[]; entitlements: Record<string, string[]> };
  assert.equal(piece.plugins, undefined, 'no plugin, so app.config.ts never skips it');
  assert.deepEqual(piece.entitlements[KEY], [GROUP]);
  const widgets = JSON.parse(read('native-plugins', 'widgets.json')) as { entitlements: Record<string, string[]> };
  assert.deepEqual(widgets.entitlements[KEY], [GROUP]);
});

test('D145-2: the widget extension uses the same App Group as the app, and both sides use one key', () => {
  const target = read('targets', 'widget', 'expo-target.config.js');
  assert.match(target, new RegExp(`const APP_GROUP = '${GROUP.replace(/\./g, '\\.')}'`));
  assert.match(target, /'com\.apple\.security\.application-groups':/);
  assert.match(read('targets', 'widget', 'ThemeStore.swift'), new RegExp(`appGroup = "${GROUP.replace(/\./g, '\\.')}"`));
  assert.match(read('src', 'core', 'widgetTheme.ts'), new RegExp(`WIDGET_APP_GROUP = '${GROUP.replace(/\./g, '\\.')}'`));
});

test('D145-2: a native build without the widget tool fails loudly instead of shipping without widgets', () => {
  const hook = read('scripts', 'eas-native-deps.js');
  assert.match(hook, /process\.exit\(1\)/);
  assert.match(hook, /require\.resolve\('@bacons\/apple-targets\/package\.json'/);
  assert.match(read('app.config.ts'), /console\.error\(`\[glaze\] WARNING native piece skipped/);
  // Hard rule: the widget tool stays out of package.json (added on Expo's servers by the hook).
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  assert.equal(pkg.dependencies?.['@bacons/apple-targets'], undefined);
  assert.equal(pkg.devDependencies?.['@bacons/apple-targets'], undefined);
});
