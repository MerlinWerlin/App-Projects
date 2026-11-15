// Guard test: Glaze has no over-the-air updates (1.0.42, Apple Guideline 5.6). Every change ships as a
// new build through TestFlight and App Store review, as for Backspin, Couch, Cue, Linework and Satchel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
// Package name built at runtime so guard.test.ts's import scan doesn't see it in this file.
const UPDATES_PKG = ['expo', 'updates'].join('-');

test('expo-updates is not a dependency and is not in the lockfile', () => {
  const pkg = JSON.parse(read('package.json')) as Record<string, Record<string, string> | undefined>;
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.equal(pkg[field]?.[UPDATES_PKG], undefined, `${field} has no ${UPDATES_PKG}`);
  }
  const lock = JSON.parse(read('package-lock.json')) as { packages?: Record<string, unknown> };
  assert.ok(!Object.keys(lock.packages ?? {}).some((k) => k.endsWith(`node_modules/${UPDATES_PKG}`)), 'lockfile has no expo-updates');
});

test('app.json has no updates block or runtimeVersion', () => {
  const app = JSON.parse(read('app.json')) as { expo: Record<string, unknown> };
  assert.equal(app.expo.updates, undefined);
  assert.equal(app.expo.runtimeVersion, undefined);
  assert.ok(!read('app.json').includes('u.expo.dev'));
});

test('eas.json build profiles carry no update channels', () => {
  const eas = JSON.parse(read('eas.json')) as { build: Record<string, { channel?: string }> };
  for (const [name, profile] of Object.entries(eas.build)) assert.equal(profile.channel, undefined, `${name} has no channel`);
});

test('app config carries no placeholder URLs or ids', () => {
  for (const rel of ['app.json', 'app.config.ts', 'eas.json']) {
    const text = read(rel);
    assert.ok(!/REPLACE_WITH|YOUR_PROJECT|PLACEHOLDER|<project-id>/i.test(text), `${rel} contains a placeholder`);
  }
});

test('no update script and no code that loads expo-updates', () => {
  assert.ok(!existsSync(join(ROOT, 'PUSH_UPDATE.cmd')), 'PUSH_UPDATE.cmd is gone');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (/\.(tsx?|jsx?|mjs)$/.test(name) && !name.endsWith('.test.ts')) {
        const src = read(rel);
        if (src.includes(`'${UPDATES_PKG}'`) || src.includes(`"${UPDATES_PKG}"`) || src.includes('ExpoUpdates') || /\bUpdates\.\w+\(/.test(src)) offenders.push(rel);
      }
    }
  };
  for (const dir of ['app', 'src']) walk(dir);
  assert.deepEqual(offenders, []);
});

test('RELEASING.md says builds only, no over-the-air updates', () => {
  const doc = read('docs/RELEASING.md');
  assert.match(doc, /no over-the-air updates/i);
  assert.ok(!doc.includes('PUSH_UPDATE.cmd'));
});
