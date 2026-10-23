// Guard test for the owner's release identity (owner request 16 Oct 2026, R1): the repo must
// match the owner's PC copy exactly so TestFlight builds from either place are the same app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

const BUNDLE_ID = 'com.jared797.glaze';
const APP_GROUP = 'group.com.jared797.glaze';

test('app.json carries the owner bundle id, Android package and encryption flag', () => {
  const app = JSON.parse(read('app.json')) as {
    expo: { ios: { bundleIdentifier: string; config?: { usesNonExemptEncryption?: boolean } }; android: { package: string } };
  };
  assert.equal(app.expo.ios.bundleIdentifier, BUNDLE_ID);
  assert.equal(app.expo.android.package, BUNDLE_ID);
  assert.equal(app.expo.ios.config?.usesNonExemptEncryption, false);
});

test('eas.json has development, preview and production profiles', () => {
  const eas = JSON.parse(read('eas.json')) as { build: Record<string, Record<string, unknown>> };
  const { development, preview, production } = eas.build;
  assert.equal(development.developmentClient, true);
  assert.equal(development.distribution, 'internal');
  assert.equal(preview.distribution, 'internal');
  assert.equal(production.autoIncrement, true);
  for (const [name, profile] of Object.entries({ development, preview, production })) {
    assert.equal(profile.channel, name, `${name} profile publishes to the ${name} update channel`);
  }
  for (const [name, profile] of Object.entries({ development, preview })) {
    assert.deepEqual(profile.env, { GLAZE_NATIVE: '1' }, `${name} profile turns on the native pieces`);
  }
  // Owner TestFlight fix 24 Oct 2026: the first TestFlight build matches the Expo Go app the owner tested
  // (native pieces off, Glaze's own uncompiled modules not linked). production-native turns them on later.
  assert.deepEqual(production.env, { GLAZE_NATIVE: '0' });
  const native = eas.build['production-native'] as Record<string, unknown>;
  assert.equal(native.extends, 'production');
  assert.deepEqual(native.env, { GLAZE_NATIVE: '1' });
});

test('first TestFlight build links none of Glaze\'s own native modules (modules-off)', () => {
  const pkg = JSON.parse(read('package.json')) as { expo?: { autolinking?: { nativeModulesDir?: string } } };
  assert.equal(pkg.expo?.autolinking?.nativeModulesDir, './modules-off');
  assert.ok(read('modules-off/README.md').includes('production-native'));
});

test('App Group is the owner group everywhere it is declared', () => {
  for (const rel of [
    'native-plugins/widgets.json',
    'targets/widget/expo-target.config.js',
    'targets/widget/ThemeStore.swift',
    'modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift',
    'src/core/widgetTheme.ts',
  ]) {
    assert.ok(read(rel).includes(APP_GROUP), `${rel} uses ${APP_GROUP}`);
  }
});

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(join(root, dir))) {
    if (['node_modules', '.git', '.expo', '.claude'].includes(name) || (dir === '.' && ['ios', 'android'].includes(name))) continue;
    const rel = dir === '.' ? name : `${dir}/${name}`;
    const st = statSync(join(root, rel));
    if (st.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx|js|json|swift|kt|xml|gradle|plist|md)$/.test(name)) out.push(rel);
  }
  return out;
}

test('no old placeholder ids remain in code, config or docs', () => {
  const old = /\bgroup\.app\.glaze\b|\bapp\.glaze\.ios\b|\bapp\.glaze\.android\b(?!module)/;
  const skip = new Set(['ops/RUNLOG.md', 'ops/DECISIONS.md', 'src/core/release.test.ts', 'docs/OWNER_1016.md']);
  for (const rel of walk('.', [])) {
    if (skip.has(rel)) continue;
    assert.ok(!old.test(read(rel)), `${rel} still mentions a placeholder id`);
  }
});

test('the Expo Go trial kit still works after the identity change', () => {
  assert.match(read('START_TRIAL.cmd'), /npx expo start --go --tunnel/);
});
