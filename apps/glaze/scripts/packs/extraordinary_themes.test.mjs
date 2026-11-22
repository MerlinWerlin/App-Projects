import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_ROOT } from './build_packs.mjs';
import { extraordinaryRegistrySource, loadExtraordinaryDirections, REGISTRY_FILE, validateNewIdentityPath } from './extraordinary_themes.mjs';

test('new native identity paths reject broken commands, unsupported instructions and out-of-canvas geometry', () => {
  validateNewIdentityPath('M 1 2 C 4 5 6 7 8 9 L 20 30 Q 4 5 6 7 Z');
  for (const path of ['M 1 2 C 3 4', 'M 1 2 A 3 4 5', 'M 1 2 L 900 1', 'M 1 2 Q ... 3', 'M 1 2 Z 3 4', 'M 1 2 <script>']) assert.throws(() => validateNewIdentityPath(path));
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
