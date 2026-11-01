// Guards for the app shell: every t('literal') key exists, every data-driven key exists, routes hide their
// raw names, and the app config keeps the settings shipping depends on.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PALETTES } from './core/palettes.ts';
import { en } from './i18n/en.ts';
import { SCENES } from './scenes/index.ts';

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

test('every scene, level, theme and palette has its words', () => {
  for (const s of SCENES) {
    for (const k of [`scene.${s.id}.title`, `scene.${s.id}.blurb`, `theme.${s.theme}`]) assert.ok(k in en, k);
    for (const l of s.levels) assert.ok(`scene.${s.id}.level.${l.id}` in en, `scene.${s.id}.level.${l.id}`);
  }
  for (const p of PALETTES) assert.ok(`palette.${p.id}` in en, p.id);
});

test('no UI text is hard-coded in screens (Text children are t()/tx() or data)', () => {
  const bad: string[] = [];
  for (const f of [...files(join(root, 'app')), ...files(join(root, 'src/ui'))]) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/<Text[^>]*>\s*([A-Za-z][A-Za-z ,.'!?]{2,})\s*</g)) bad.push(`${f.replace(root, '')}: ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});

test('no route can flash its raw name: root stack hides headers and holds the splash', () => {
  const rootLayout = readFileSync(join(root, 'app/_layout.tsx'), 'utf8');
  assert.match(rootLayout, /headerShown: false/);
  assert.match(rootLayout, /preventAutoHideAsync/);
});

test('filters start off and the language line is on first launch only', () => {
  const gallery = readFileSync(join(root, 'app/index.tsx'), 'utf8');
  assert.match(gallery, /useState<Filter>\('all'\)/);
  const store = readFileSync(join(root, 'src/store/settings.ts'), 'utf8');
  assert.match(store, /langLineDone: false/);
  assert.match(store, /langLineDone: settings\.langLineDone \|\| settings\.launches >= 1/);
});

test('app config keeps what shipping needs', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  assert.equal(app.ios.bundleIdentifier, 'com.jared797.hollowhue');
  assert.equal(app.ios.supportsTablet, true);
  assert.deepEqual(app.runtimeVersion, { policy: 'appVersion' });
  assert.equal(app.ios.config.usesNonExemptEncryption, false);
  assert.equal(app.ios.privacyManifests.NSPrivacyTracking, false);
  const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
  assert.equal(eas.build.production.channel, 'production');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.ok(!('expo-iap' in pkg.dependencies), 'no purchases in phase 1');
});
