import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_ROOT } from './build_packs.mjs';
import { assertExtraordinaryMinAppVersion, auditExtraordinaryBuild, EXTRAORDINARY_MIN_APP_VERSION, extraordinaryRegistrySource, loadExtraordinaryDirections, REGISTRY_FILE, validateNewIdentityPath, validateNewThemeBrowseCategory } from './extraordinary_themes.mjs';
import { BROWSE_CATEGORIES } from '../../src/core/themeBrowse.ts';
import { supportsApp } from '../../src/core/themePack.ts';

test('candidate identities require the first containing app release, independently of the current app version', () => {
  assert.equal(EXTRAORDINARY_MIN_APP_VERSION, '1.0.44');
  for (const minAppVersion of ['1.0.44', '1.0.45', '1.1.0', '2.0.0']) assert.doesNotThrow(() => assertExtraordinaryMinAppVersion({ minAppVersion }));
  for (const minAppVersion of ['1.0.43', '1.0.0', '0.9.99', '', 'invalid', null, undefined]) assert.throws(() => assertExtraordinaryMinAppVersion({ minAppVersion }), /at least 1\.0\.44/);
  assert.equal(supportsApp({ minAppVersion: EXTRAORDINARY_MIN_APP_VERSION }, '1.0.43'), false);
  assert.equal(supportsApp({ minAppVersion: EXTRAORDINARY_MIN_APP_VERSION }, '1.0.44'), true);
});

test('the actual candidate audit rejects a manifest advertising the already-released app without the identities', () => {
  const app = mkdtempSync(join(tmpdir(), 'glaze-identity-floor-'));
  try {
    const id = 'test-release-floor', folder = join(app, 'theme-sources', id), dir = join(app, 'dist');
    mkdirSync(folder, { recursive: true }); mkdirSync(join(app, 'src/core'), { recursive: true });
    mkdirSync(join(dir, 'art', id, 'v1'), { recursive: true });
    writeFileSync(join(app, 'app.json'), JSON.stringify({ expo: { version: '1.0.43' } }));
    writeFileSync(join(folder, 'meta.json'), JSON.stringify({ category: 'Nature' }));
    writeFileSync(join(folder, 'native-widget-identity.json'), JSON.stringify({ themeId: id, recipe: ['circle', 'floorSubject', 'floorDetail', 'bars', 'needle', 'trail', 'band'], art: { floorSubject: 'M 1 2 L 3 4', floorDetail: 'M 9 8 L 7 6' } }));
    writeFileSync(join(app, REGISTRY_FILE), extraordinaryRegistrySource(loadExtraordinaryDirections(app)));
    writeFileSync(join(dir, 'catalog.json'), JSON.stringify({ format: 'glaze-catalog', version: 1, generatedAt: '2026-11-22T00:00:00Z', packs: [{ id, name: 'Release Floor', packVersion: 1, plus: true, category: 'Nature', bytes: 100, manifest: `art/${id}/v1/manifest.json`, thumb: `art/${id}/v1/thumb.0000abcd.webp`, thumbhash: 'AbCd', palette: { bg: '#04182E', tile: '#0C2A40', glyph: '#E6FBFF', accent: '#5EE1D9', text: '#E9FAFF' }, tags: [], mood: 'calm', addedAt: '2026-11-22' }] }));
    // This is a fail-fast boundary: unsafe candidates must fail before any asset work.
    writeFileSync(join(dir, 'art', id, 'v1/manifest.json'), JSON.stringify({ minAppVersion: '1.0.43' }));
    assert.throws(() => auditExtraordinaryBuild({ app, dir }), /test-release-floor: minAppVersion must be at least 1\.0\.44/);
  } finally { rmSync(app, { recursive: true, force: true }); }
});

test('new themes keep recognized browse categories instead of silently falling into More', () => {
  for (const category of BROWSE_CATEGORIES) {
    assert.equal(validateNewThemeBrowseCategory(category.id), category.id);
    assert.equal(validateNewThemeBrowseCategory(category.name), category.id);
  }
  assert.equal(validateNewThemeBrowseCategory('  ABSTRACT and ART  '), 'abstract-art');
  assert.equal(validateNewThemeBrowseCategory('More'), 'more');
  for (const category of ['Art & Design', '', undefined, null]) assert.throws(() => validateNewThemeBrowseCategory(category));
});

test('new native identity paths reject broken commands, unsupported instructions and out-of-canvas geometry', () => {
  validateNewIdentityPath('M 1 2 C 4 5 6 7 8 9 L 20 30 Q 4 5 6 7 Z');
  for (const path of ['M 1 2 C 3 4', 'M 1 2 A 3 4 5', 'M 1 2 L 900 1', 'M 1 2 Q ... 3', 'M 1 2 Z 3 4', 'M 1 2 <script>', 'M 1 2 3 4']) assert.throws(() => validateNewIdentityPath(path));
});

test('new theme directions cannot overwrite published illustration keys or share new keys', () => {
  const root = mkdtempSync(join(tmpdir(), 'glaze-new-directions-'));
  const save = (id, subject = 'testNewSubject') => {
    const folder = join(root, 'theme-sources', id); mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'native-widget-identity.json'), JSON.stringify({ themeId: id, recipe: ['circle', subject, 'testNewDetail', 'bars', 'needle', 'trail', 'band'], art: { [subject]: 'M 1 2 L 3 4', testNewDetail: 'M 9 8 L 7 6' } }));
  };
  try {
    save('test-new-one'); assert.equal(loadExtraordinaryDirections(root).records.length, 1);
    save('test-new-two'); assert.throws(() => loadExtraordinaryDirections(root), /duplicate new illustration key/);
    rmSync(join(root, 'theme-sources/test-new-two'), { recursive: true });
    save('test-new-one', 'mountains'); assert.throws(() => loadExtraordinaryDirections(root), /overwrites an existing illustration/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('all committed new-theme directions match the actual generated native registry', () => {
  const d = loadExtraordinaryDirections();
  assert.ok(d.records.length >= 1);
  assert.equal(readFileSync(join(APP_ROOT, REGISTRY_FILE), 'utf8').replaceAll('\r\n', '\n'), extraordinaryRegistrySource(d));
  assert.equal(Object.keys(d.art).length, d.records.reduce((n, r) => n + Object.keys(r.descriptor.art).length, 0));
});
