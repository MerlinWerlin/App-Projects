// Guards for the app shell: every t('literal') key exists, every route hides its raw name,
// and the app config keeps the settings shipping depends on.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { en } from './i18n/en.ts';

const root = new URL('..', import.meta.url).pathname;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) && !n.endsWith('.test.ts') ? [p] : [];
  });
}

test('every literal string key used in the UI exists in en.ts', () => {
  const missing: string[] = [];
  for (const f of [...files(join(root, 'app')), ...files(join(root, 'src'))]) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\('([a-zA-Z0-9_.-]+)'/g)) {
      if (!(m[1]! in en)) missing.push(`${f.replace(root, '')}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('template keys used by screens all exist', () => {
  const groups: Record<string, string[]> = {
    rarity: ['common', 'uncommon', 'rare', 'shimmer', 'mythic'],
    stage: ['0', '1', '2'],
    mood: ['joyful', 'happy', 'okay', 'sleepy'],
    branch: ['swift', 'scholarly', 'cozy'],
    care: ['feed', 'pet', 'play'],
    trait: ['sleepy', 'bold', 'curious', 'gentle', 'cheeky', 'proud', 'shy', 'bouncy'],
    element: ['leaf', 'tide', 'ember', 'stone', 'spark', 'dream'],
    region: ['oceania', 'uk-ie', 'north-america', 'europe', 'japan', 'se-asia', 'wilds'],
    part: ['ears', 'tail', 'marking', 'topper'],
  };
  for (const [g, ids] of Object.entries(groups)) for (const id of ids) assert.ok(`${g}.${id}` in en, `${g}.${id}`);
});

test('no route can flash its raw name: root stack and tabs hide headers', () => {
  const rootLayout = readFileSync(join(root, 'app/_layout.tsx'), 'utf8');
  const tabs = readFileSync(join(root, 'app/(tabs)/_layout.tsx'), 'utf8');
  assert.match(rootLayout, /headerShown: false/);
  assert.match(rootLayout, /preventAutoHideAsync/);
  assert.match(tabs, /headerShown: false/);
});

test('app config keeps what shipping needs', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  assert.equal(app.ios.bundleIdentifier, 'com.jared797.roamlings');
  assert.deepEqual(app.runtimeVersion, { policy: 'appVersion' });
  assert.equal(app.ios.config.usesNonExemptEncryption, false);
  assert.ok(app.ios.infoPlist.NSMotionUsageDescription);
  const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
  assert.equal(eas.build.production.channel, 'production');
});
