// Guards for the repo scaffold: Expo Go-only dependencies, permission strings, routes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;

// PLAN §5: libraries that ship in Expo Go, plus pure-JS packages.
const EXPO_GO_OK = new Set([
  'expo', 'react', 'react-native', 'expo-router', 'expo-camera', 'expo-blur', 'expo-linear-gradient', 'expo-image-picker', 'expo-image-manipulator',
  'expo-file-system', 'expo-haptics', 'expo-keep-awake', 'react-native-gesture-handler', 'react-native-reanimated',
  'react-native-worklets', 'react-native-svg', '@react-native-async-storage/async-storage', '@expo/vector-icons',
  'expo-font', 'expo-constants', 'expo-linking', 'expo-splash-screen', 'expo-status-bar', 'expo-media-library',
  'react-native-safe-area-context', 'react-native-screens', 'expo-localization', 'expo-updates',
  // pure JS
  'jpeg-js', 'upng-js',
  // web renderer peer that SDK 57 installs alongside react (pure JS, unused on the phone)
  'react-dom', 'react-native-web',
]);

test('dependencies are Expo Go compatible (PLAN §5)', () => {
  for (const name of Object.keys(pkg.dependencies)) {
    // expo-iap: store builds only; loaded with a guarded require (src/plus/iapStore.ts) so Expo Go never crashes.
    const ok = EXPO_GO_OK.has(name) || name.startsWith('@expo-google-fonts/') || name === 'expo-iap';
    assert.ok(ok, `${name} is not on the Expo Go allowlist`);
  }
});

test('no analytics, ads or tracking packages', () => {
  const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ');
  assert.doesNotMatch(all, /analytics|firebase|amplitude|mixpanel|segment|admob|ads|sentry|appsflyer|adjust|revenuecat/i);
});

test('app.json names the app and has permission strings', () => {
  assert.equal(app.name, 'Linework');
  assert.equal(app.slug, 'linework');
  assert.ok(app.ios.infoPlist.NSCameraUsageDescription.length > 20);
  assert.ok(app.ios.infoPlist.NSPhotoLibraryUsageDescription.length > 20);
  assert.ok(app.android.permissions.includes('android.permission.CAMERA'));
});

test('every PLAN §3 route exists', () => {
  // T81: tab screens live in the (tabs) group (same URLs); full-screen stack routes stay at the app root.
  for (const r of ['_layout', 'prepare', 'trace', 'lightbox', 'plus']) {
    assert.ok(existsSync(join(root, 'app', `${r}.tsx`)), `app/${r}.tsx missing`);
  }
  for (const r of ['_layout', 'index', 'templates', 'drawings', 'settings']) {
    assert.ok(existsSync(join(root, 'app', '(tabs)', `${r}.tsx`)), `app/(tabs)/${r}.tsx missing`);
  }
});

test('no competitor names in app copy', () => {
  const text = readFileSync(join(root, 'app.json'), 'utf8');
  assert.doesNotMatch(text, /AR Drawing|Artrace|PicTrace|SketchAR/i);
});

test('trial kit scripts present', () => {
  assert.ok(existsSync(join(root, 'START_TRIAL.cmd')));
  assert.ok(existsSync(join(root, 'start-trial.sh')));
  assert.ok(pkg.devDependencies['@expo/ngrok'], '@expo/ngrok needed for --tunnel');
});

test('trial kit starts in Expo Go mode and no dev client before trial (oversight D2-2)', () => {
  const cmd = readFileSync(join(root, 'START_TRIAL.cmd'), 'utf8');
  const sh = readFileSync(join(root, 'start-trial.sh'), 'utf8');
  for (const s of [cmd, sh]) {
    assert.match(s, /npx expo install --fix/);
    assert.match(s, /npx expo start --go --tunnel/);
  }
  assert.equal(pkg.dependencies['expo-dev-client'], undefined);
});

// The owner's PC keeps its own START_TRIAL.cmd (fb-1017): the strict kit checks apply to the kit's own copy
// (recognised by its logged Expo bump) and always to start-trial.sh.
const kitCopies = () => {
  const cmd = readFileSync(join(root, 'START_TRIAL.cmd'), 'utf8');
  const sh = readFileSync(join(root, 'start-trial.sh'), 'utf8');
  return { cmd, sh, strict: /logged npx expo install expo@/.test(cmd) ? [cmd, sh] : [sh] };
};

test('trial kit bumps Expo before --fix and captures trial-log.txt (oversight D3-1, D4-1)', () => {
  const { cmd, strict } = kitCopies();
  for (const s of strict) {
    const latest = s.indexOf('npx expo install expo@latest');
    const fix = s.indexOf('npx expo install --fix');
    const start = s.indexOf('npx expo start --go --tunnel');
    assert.ok(latest >= 0, 'expo@latest step present');
    assert.ok(latest < fix && fix < start, 'order: expo@latest, --fix, start');
    assert.match(s, /trial-log\.txt/);
    assert.match(s, /logged npm install/);
    assert.match(s, /logged npx expo install expo@latest/);
    assert.match(s, /logged npx expo install --fix/);
  }
  if (strict.includes(cmd)) assert.match(cmd, /\r\n/, 'START_TRIAL.cmd keeps CRLF line endings');
  const trial = readFileSync(join(root, 'docs', 'TRIAL.md'), 'utf8');
  assert.match(trial, /trial-log\.txt/);
});

test('D7-2: TRIAL.md asks the black-screen fix as an explicit yes/no re-test question', () => {
  const trial = readFileSync(join(root, 'docs', 'TRIAL.md'), 'utf8');
  assert.match(trial, /## Re-test questions/);
  assert.match(trial, /Black screen fixed\?[^\n]*Yes \/ no/);
});

test('D12-1: TRIAL.md has one yes/no re-test question per visible polish item', () => {
  const trial = readFileSync(join(root, 'docs', 'TRIAL.md'), 'utf8');
  for (const item of ['Focus mode', 'Opacity bubble', 'Lock morph', 'Sketch reveal']) {
    assert.match(trial, new RegExp(`\\*\\*${item}:\\*\\*[^\\n]*Yes / no`));
  }
});

test('T38: release identity uses com.jared797.linework and declares no custom encryption', () => {
  assert.equal(app.ios.bundleIdentifier, 'com.jared797.linework');
  assert.equal(app.android.package, 'com.jared797.linework');
  assert.equal(app.ios.config?.usesNonExemptEncryption, false);
});

test('T38: eas.json has development / preview / production profiles on matching channels', () => {
  const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.match(eas.cli.version, />=\s*16/);
  const { development, preview, production } = eas.build;
  assert.equal(development.developmentClient, true);
  assert.equal(development.distribution, 'internal');
  assert.equal(development.channel, 'development');
  assert.equal(preview.distribution, 'internal');
  assert.equal(preview.channel, 'preview');
  assert.equal(production.autoIncrement, true);
  assert.equal(production.channel, 'production');
  assert.ok(eas.submit && eas.submit.production, 'submit.production profile present');
});

test('T38: Expo Go trial still works (no dev client dep, START_TRIAL keeps --go --tunnel, docs explain dev client)', () => {
  assert.equal(pkg.dependencies['expo-dev-client'], undefined);
  const cmd = readFileSync(join(root, 'START_TRIAL.cmd'), 'utf8');
  assert.match(cmd, /npx expo start --go --tunnel/);
  if (/logged npx expo install expo@/.test(cmd)) assert.match(cmd, /\r\n/, 'START_TRIAL.cmd keeps CRLF');
  const rel = readFileSync(join(root, 'docs', 'RELEASING.md'), 'utf8');
  assert.match(rel, /npx expo install expo-dev-client/);
  assert.match(rel, /TestFlight/);
});

test('D55-1: TRIAL.md asks "Does the app open?" first and START_TRIAL runs a logged non-blocking code check', () => {
  const trial = readFileSync(join(root, 'docs', 'TRIAL.md'), 'utf8');
  const q = trial.slice(trial.indexOf('## Re-test questions'));
  assert.match(q, /\n1\. \*\*Does the app open\?\*\*[^\n]*Yes \/ no[^\n]*trial-log\.txt/);
  const { cmd, strict } = kitCopies();
  for (const s of strict) {
    const fix = s.indexOf('logged npx expo install --fix');
    const tsc = s.indexOf('logged npx tsc --noEmit');
    const start = s.indexOf('npx expo start --go --tunnel');
    assert.ok(fix >= 0 && fix < tsc && tsc < start, 'order: --fix, tsc, start');
  }
  assert.doesNotMatch(cmd, /tsc --noEmit\r\nif errorlevel 1 goto failed/, 'code check never blocks the start');
});

test('D112-2: TESTFLIGHT_PRECHECK.cmd runs install, tsc and an iOS export into testflight-precheck.txt', () => {
  const cmd = readFileSync(join(root, 'TESTFLIGHT_PRECHECK.cmd'), 'utf8');
  assert.match(cmd, /\r\n/, 'TESTFLIGHT_PRECHECK.cmd keeps CRLF line endings');
  assert.match(cmd, /scripts\\testflight-precheck\.ps1/);
  const ps = readFileSync(join(root, 'scripts', 'testflight-precheck.ps1'), 'utf8');
  const steps = ps.slice(ps.indexOf('$steps = @('));
  assert.match(ps, /npm (ci|install)/);
  const i = steps.indexOf('cmd = $install');
  const t = steps.indexOf('npx tsc --noEmit');
  const e = steps.indexOf('npx expo export --platform ios');
  assert.ok(i >= 0 && i < t && t < e, 'order: install, tsc, export');
  assert.match(ps, /testflight-precheck\.txt/);
  assert.match(ps, /break/, 'stops at the first failed step');
  const ignore = readFileSync(join(root, '.gitignore'), 'utf8');
  assert.ok(ignore.includes('testflight-precheck.txt'));
  const checklist = readFileSync(join(root, 'docs', 'RELEASE_CHECKLIST.md'), 'utf8');
  assert.ok(checklist.indexOf('TESTFLIGHT_PRECHECK.cmd') < checklist.indexOf('TESTFLIGHT_LINEWORK.cmd'), 'checklist runs the pre-check first');
});

test('D65-1: VERIFY.cmd runs install, tsc, tests and an iOS export into verify-report.txt', () => {
  const cmd = readFileSync(join(root, 'VERIFY.cmd'), 'utf8');
  assert.match(cmd, /\r\n/, 'VERIFY.cmd keeps CRLF line endings');
  assert.match(cmd, /scripts\\verify\.ps1/);
  const ps = readFileSync(join(root, 'scripts', 'verify.ps1'), 'utf8');
  for (const step of [/npm (ci|install)/, /npx tsc --noEmit/, /npm test/, /npx expo export --platform ios --output-dir \.verify/]) {
    assert.match(ps, step);
  }
  assert.match(ps, /verify-report\.txt/);
  assert.match(ps, /First 40/, 'report keeps the first 40 error lines of each step');
  assert.match(ps, /exit \$code/, 'report records each exit code');
  const ignore = readFileSync(join(root, '.gitignore'), 'utf8');
  for (const p of ['.verify/', '.verify-logs/', 'verify-report.txt']) assert.ok(ignore.includes(p), p + ' ignored');
  const trial = readFileSync(join(root, 'docs', 'TRIAL.md'), 'utf8');
  assert.match(trial, /VERIFY\.cmd/);
});
