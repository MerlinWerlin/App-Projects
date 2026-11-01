// T198 (owner-1101d #1): pets, Island pets and every Live Activity / Dynamic Island feature were cut
// (parked in docs/future/pets-game). This guard keeps them out: no Pets tab or screen, no pet module,
// no ActivityKit anywhere native, no NSSupportsLiveActivities in any config source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TAB_ORDER } from './tabNav.ts';

const root = process.cwd();

function walk(dir: string, exts: readonly string[]): string[] {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(abs, name);
    if (statSync(p).isDirectory()) out.push(...walk(relative(root, p), exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(relative(root, p));
  }
  return out;
}

test('no Pets tab, pets screen, pet module or pet core logic', () => {
  assert.ok(!(TAB_ORDER as readonly string[]).includes('pets'));
  for (const p of [
    'app/(tabs)/pets.tsx',
    'app/pets.tsx',
    'src/core/petLife.ts',
    'src/core/islandPets.ts',
    'src/store/pets.ts',
    'src/native/islandPets.ts',
    'src/ui/IslandPetArt.tsx',
    'src/i18n/pets.ts',
    'modules/glaze-island-pets',
    'native-plugins/island-pets.json',
    'scripts/island-pets-contract.mjs',
  ]) {
    assert.ok(!existsSync(join(root, p)), `${p} should be gone (T198)`);
  }
  const tabs = readFileSync(join(root, 'app', '(tabs)', '_layout.tsx'), 'utf8');
  assert.doesNotMatch(tabs, /name="pets"/);
});

test('nothing imports pet code or links to /pets', () => {
  for (const f of [...walk('app', ['.ts', '.tsx']), ...walk('src', ['.ts', '.tsx'])]) {
    if (f.endsWith('noPets.test.ts')) continue;
    const s = readFileSync(join(root, f), 'utf8');
    assert.doesNotMatch(s, /petLife|islandPets|IslandPet|store\/pets|i18n\/pets|PET_COPY|['"`]\/pets['"`]|syncIslandPet/, f);
  }
});

test('no Live Activities: no NSSupportsLiveActivities, no ActivityKit', () => {
  const config = ['app.config.ts', 'app.json', ...walk('native-plugins', ['.json']), ...walk('targets', ['.js', '.json', '.plist'])];
  for (const f of config) {
    if (!existsSync(join(root, f))) continue;
    assert.doesNotMatch(readFileSync(join(root, f), 'utf8'), /NSSupportsLiveActivities|ActivityKit/, f);
  }
  for (const f of [...walk('targets', ['.swift']), ...walk('modules', ['.swift'])]) {
    const s = readFileSync(join(root, f), 'utf8');
    assert.doesNotMatch(s, /\bimport\s+ActivityKit\b|ActivityConfiguration|ActivityAttributes|DynamicIsland/, f);
  }
});
