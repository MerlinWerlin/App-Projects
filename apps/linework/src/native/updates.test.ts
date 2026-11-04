// T39 guards for over-the-air updates. Reads files as text only (no React Native at test time).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));

test('T39: runtimeVersion follows the app version', () => {
  assert.deepEqual(app.runtimeVersion, { policy: 'appVersion' });
});

test('T39: updates check on load without blocking startup', () => {
  assert.equal(app.updates.enabled, true);
  assert.equal(app.updates.checkAutomatically, 'ON_LOAD');
  assert.equal(app.updates.fallbackToCacheTimeout, 0);
  assert.ok(pkg.dependencies['expo-updates'], 'expo-updates listed');
  // The project id / updates.url is created by the owner (eas init / update:configure); never invented here.
  if (app.updates.url !== undefined) assert.match(app.updates.url, /^https:\/\/u\.expo\.dev\/[0-9a-f-]{36}$/);
});

test('T39: updates.ts loads expo-updates lazily inside try/catch, never at top level', () => {
  const src = read('src', 'native', 'updates.ts');
  assert.doesNotMatch(src, /^\s*import[^\n]*['"]expo-updates['"]/m, 'no static import of expo-updates');
  assert.doesNotMatch(src, /import\(\s*['"]expo-updates['"]\s*\)/, 'no dynamic import()');
  const at = src.indexOf("require('expo-updates')");
  assert.ok(at > 0, 'lazy require present');
  const tryAt = src.lastIndexOf('try {', at);
  const fnAt = src.lastIndexOf('function ', at);
  assert.ok(tryAt > fnAt && fnAt >= 0, 'require sits inside a function, within a try block');
  assert.doesNotMatch(src, /^\s*import[^\n]*['"]expo-constants['"]/m, 'expo-constants also lazy');
});

test('T39: updates.ts exports the adapter API and guards Expo Go / dev / reload', () => {
  const src = read('src', 'native', 'updates.ts');
  assert.match(src, /export async function checkForUpdateQuietly\(\)/);
  assert.match(src, /export async function reloadApp\(\)/);
  assert.match(src, /isEnabled/);
  assert.match(src, /__DEV__/);
  assert.match(src, /storeClient/);
  assert.match(src, /appOwnership === 'expo'/);
  assert.match(src, /fetchUpdateAsync/);
  assert.match(src, /DevSettings\.reload\(\)/);
  // The quiet check downloads only; it must never reload mid-session.
  const start = src.indexOf('export async function checkForUpdateQuietly');
  const end = /\r?\n}\r?\n/.exec(src.slice(start));
  assert.ok(end, 'quiet update function has a closing brace');
  const body = src.slice(start, start + end.index);
  assert.doesNotMatch(body, /reloadAsync|DevSettings/);
});

test('T39: PUSH_UPDATE.cmd sends to production with a note, CRLF, pauses', () => {
  const cmd = read('PUSH_UPDATE.cmd');
  assert.match(cmd, /\r\n/);
  assert.doesNotMatch(cmd.replace(/\r\n/g, ''), /\n/, 'every line ends in CRLF');
  assert.match(cmd, /cd \/d "%~dp0"/);
  assert.match(cmd, /where node/);
  assert.match(cmd, /set \/p NOTE=Short note for this update: /);
  assert.match(cmd, /if "%NOTE%"=="" set "NOTE=/);
  assert.match(cmd, /call npx eas-cli@latest update --channel production --message "%NOTE%"/);
  assert.match(cmd, /errorlevel 1/);
  assert.match(cmd, /\r\npause\r\n$/);
  assert.match(read('.gitattributes'), /\*\.cmd -text/);
});

test('T39: RELEASING.md explains setup, OTA vs new build and channels', () => {
  const rel = read('docs', 'RELEASING.md');
  for (const s of ['eas-cli@latest login', 'eas-cli@latest init', 'update:configure', 'build -p ios --profile production', 'submit -p ios', 'PUSH_UPDATE.cmd', 'appVersion', 'expo-dev-client']) {
    assert.ok(rel.includes(s), `RELEASING.md mentions ${s}`);
  }
  for (const ch of ['development', 'preview', 'production']) assert.match(rel, new RegExp('`' + ch + '`'));
  assert.match(rel, /icon/i);
  assert.match(rel, /permission/i);
});
