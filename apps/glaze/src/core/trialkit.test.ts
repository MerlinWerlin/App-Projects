// Guard test for the owner's trial kit (oversight D2-3, D3-2, D3-3): the Expo Go trial must
// install without native tooling, open in Expo Go, and leave a log the owner can paste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Run from the repo root (npm test / node --test src/core).
const read = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8');

test('START_TRIAL.cmd starts Expo Go over a tunnel and logs install output', () => {
  const cmd = read('START_TRIAL.cmd');
  assert.match(cmd, /npx expo start --go --tunnel/);
  assert.match(cmd, /trial-log\.txt/);
  assert.match(cmd, /:logged "npm install"/);
  assert.match(cmd, /:logged "npx expo install --fix"/);
});

test('start-trial.sh mirrors the Windows kit', () => {
  const sh = read('start-trial.sh');
  assert.match(sh, /npx expo start --go --tunnel/);
  assert.match(sh, /trial-log\.txt/);
});

test('trial install carries no native-only packages', () => {
  const pkg = JSON.parse(read('package.json')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of ['@bacons/apple-targets', 'expo-dev-client']) {
    assert.equal(all[name], undefined, `${name} must stay out of package.json until native verification`);
  }
  for (const [name, range] of Object.entries(all)) {
    assert.ok(!range.startsWith('>') && range !== '*' && range !== 'latest', `${name} has an unbounded range`);
  }
});

test('Windows scripts are checked out with CRLF', () => {
  assert.match(read('.gitattributes'), /\*\.cmd\s+text\s+eol=crlf/);
});

test('react-native-svg is pinned to the SDK patch range (oversight D13-1)', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
  assert.match(pkg.dependencies?.['react-native-svg'] ?? '', /^~15\.12\.\d+$/);
});

test('D72-1: kits install expo-blur + expo-linear-gradient right after the SDK bump, and package.json lists both', () => {
  for (const f of ['START_TRIAL.cmd', 'start-trial.sh', 'TSC_REPORT.cmd']) {
    const s = read(f);
    assert.match(s, /npx expo install expo-blur expo-linear-gradient/, f);
  }
  for (const f of ['START_TRIAL.cmd', 'start-trial.sh']) {
    const s = read(f);
    assert.ok(s.indexOf('expo install expo@latest') < s.indexOf('expo install expo-blur'), f);
  }
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
  assert.ok(pkg.dependencies?.['expo-blur'], 'expo-blur listed');
  assert.ok(pkg.dependencies?.['expo-linear-gradient'], 'expo-linear-gradient listed');
  const glass = read('src/ui/GlassBar.tsx');
  assert.match(glass, /from 'expo-blur'/);
  assert.match(glass, /solidOnly \? null : <BlurView/);
});

test('D110-1: the kit names the commit it was built from and START_TRIAL prints it first', () => {
  assert.match(read('.gitattributes'), /^KIT_VERSION\.txt\s+export-subst$/m);
  const stamp = read('KIT_VERSION.txt');
  assert.match(stamp, /Built from commit: \$Format:%h\$/);
  assert.match(stamp, /Includes up to: fb-1023/);
  const cmd = read('START_TRIAL.cmd');
  assert.ok(cmd.indexOf('type KIT_VERSION.txt') > 0, 'cmd prints the stamp');
  assert.ok(cmd.indexOf('type KIT_VERSION.txt') < cmd.indexOf('npm install'), 'stamp printed before install');
  assert.match(read('start-trial.sh'), /cat KIT_VERSION\.txt/);
  assert.match(read('README.md'), /Built from commit/);
  assert.match(read('docs/TRIAL.md'), /Built from commit/);
  assert.match(read('ops/render_status.py'), /trial_kit_commit/);
});
