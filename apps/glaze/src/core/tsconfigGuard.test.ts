// fb-1017-tsc (D64-2): the whole-project typecheck on the owner's PC uses TypeScript 6, where
// `baseUrl` is deprecated; nothing imports through it, so it stays out of tsconfig. TSC_REPORT.cmd
// lets the owner send the real error list back (it is the only source of truth for the full tsc).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Tests run from the repo root (npm test / node --test).
const root = process.cwd();

test('tsconfig has no deprecated baseUrl and keeps native targets out of the app typecheck', () => {
  const cfg = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8')) as {
    compilerOptions: Record<string, unknown>;
    exclude: string[];
  };
  assert.equal('baseUrl' in cfg.compilerOptions, false);
  assert.equal(cfg.compilerOptions.strict, true);
  for (const dir of ['node_modules', 'targets', 'native-plugins']) assert.ok(cfg.exclude.includes(dir), dir);
});

test('TSC_REPORT.cmd writes tsc-report.txt (git-ignored) with the TS 6 deprecation flag', () => {
  const cmd = readFileSync(join(root, 'TSC_REPORT.cmd'), 'utf8');
  assert.match(cmd, /npx tsc --noEmit --ignoreDeprecations 6\.0 >> tsc-report\.txt 2>&1/);
  // D65-1: one paste covers T49 too, so the report also runs the iOS bundle check.
  assert.match(cmd, /npx expo export --platform ios[^\r\n]*>> tsc-report\.txt 2>&1/);
  assert.match(cmd, /pause/);
  assert.match(readFileSync(join(root, '.gitignore'), 'utf8'), /^tsc-report\.txt$/m);
});

// D66-1: cmd.exe cannot open /dev/null, so `where node >/dev/null` fails and the script would say
// Node is missing. Every Windows script must use `nul`.
test('no Windows .cmd script redirects to /dev/null', () => {
  const cmds = readdirSync(root).filter((f) => f.toLowerCase().endsWith('.cmd'));
  assert.ok(cmds.includes('TSC_REPORT.cmd'));
  for (const f of cmds) {
    const body = readFileSync(join(root, f), 'utf8');
    assert.equal(body.includes('/dev/null'), false, f);
    assert.match(body, /\r\n/, `${f} keeps CRLF line endings`);
  }
});
