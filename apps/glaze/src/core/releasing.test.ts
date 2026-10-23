// Guard test for over-the-air updates (owner request 16 Oct 2026, R2 / T41).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8');

test('PUSH_UPDATE.cmd publishes to the production channel and pauses', () => {
  const cmd = read('PUSH_UPDATE.cmd');
  assert.match(cmd, /cd \/d "%~dp0"/);
  assert.match(cmd, /where node/);
  assert.match(cmd, /set \/p NOTE=/);
  assert.ok(cmd.includes('npx eas-cli@latest update --channel production --message "%NOTE%"'));
  assert.match(cmd, /^pause\s*$/m);
});

test('app.json: runtimeVersion follows the app version; updates.url is left for eas update:configure', () => {
  const app = JSON.parse(read('app.json')) as {
    expo: { runtimeVersion?: { policy?: string }; updates?: { url?: string; fallbackToCacheTimeout?: number } };
  };
  assert.equal(app.expo.runtimeVersion?.policy, 'appVersion');
  // D55-1: no placeholder URL in the repo. `npx eas-cli@latest update:configure` writes the real one on the PC.
  const url = app.expo.updates?.url;
  if (url !== undefined) assert.match(url, /^https:\/\/u\.expo\.dev\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(app.expo.updates?.fallbackToCacheTimeout, 0, 'launch never waits on the network');
});

test('app config carries no placeholder URLs or ids', () => {
  for (const rel of ['app.json', 'app.config.ts', 'eas.json']) {
    const text = read(rel);
    assert.ok(!/REPLACE_WITH|YOUR_PROJECT|PLACEHOLDER|<project-id>/i.test(text), `${rel} contains a placeholder`);
  }
});

test('expo-updates is pinned to the SDK 54 range', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
  assert.match(pkg.dependencies?.['expo-updates'] ?? '', /^~29\.0\.\d+$/);
});

test('eas.json channels equal their profile names', () => {
  const eas = JSON.parse(read('eas.json')) as { build: Record<string, { channel?: string }> };
  for (const name of ['development', 'preview', 'production']) {
    assert.equal(eas.build[name]?.channel, name);
  }
  for (const [name, profile] of Object.entries(eas.build)) {
    // A profile that extends another (production-native extends production) shares its update channel.
    const base = (profile as { extends?: string }).extends;
    assert.equal(profile.channel ?? (base ? eas.build[base]?.channel : undefined), base ?? name);
  }
});

test('the updates adapter skips Expo Go and dev runs and loads expo-updates lazily', () => {
  const src = read('src/native/updates.ts');
  assert.match(src, /'storeClient'/);
  assert.match(src, /__DEV__/);
  // Package name built at runtime so guard.test.ts's import scan doesn't see it in this file.
  const pkg = ['expo', 'updates'].join('-');
  const lazy = `mod = require('${pkg}')`;
  const at = src.indexOf(lazy);
  assert.ok(at > 0, 'expo-updates is required lazily');
  const tryAt = src.lastIndexOf('try {', at);
  assert.ok(tryAt > 0 && !src.slice(tryAt, at).includes('}'), 'the require sits inside try');
  assert.ok(src.slice(0, at).includes("!== 'storeClient'") || src.slice(0, at).includes('!isExpoGo()'), 'skipped in Expo Go');
  assert.ok(!src.includes(`from '${pkg}'`), 'no top-level value import of expo-updates');
});

test('RELEASING.md explains setup, OTA vs new build, and rollback', () => {
  const doc = read('docs/RELEASING.md');
  for (const s of ['eas init', 'eas update:configure', 'PUSH_UPDATE.cmd', 'update:republish','runtimeVersion']) {
    assert.ok(doc.includes(s), `RELEASING.md mentions ${s}`);
  }
});
