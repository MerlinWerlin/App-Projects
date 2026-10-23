/**
 * Offline UI type-check (oversight D75-1). In the cloud there is no node_modules, so app/ and
 * src/ui are type-checked against the hand-written stubs in scripts/tsc-stubs via
 * scripts/tsconfig.ui.json. On the PC (node_modules present) the real `npx tsc --noEmit`
 * is the authority and this harness is skipped, because the stubs would clash with real types.
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

function findTsc(): string | null {
  try {
    const out = execSync('command -v tsc', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out || null;
  } catch {
    return null;
  }
}

describe('offline UI type-check harness', () => {
  it('keeps the stubs out of the real tsconfig', () => {
    const main = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8')) as { exclude: string[] };
    expect(main.exclude).toContain('scripts/tsc-stubs');
  });

  it('is strict and covers app/ and src/', () => {
    const ui = JSON.parse(readFileSync(join(root, 'scripts/tsconfig.ui.json'), 'utf8')) as {
      compilerOptions: Record<string, unknown>;
      include: string[];
    };
    expect(ui.compilerOptions.strict).toBe(true);
    expect(ui.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(ui.include).toEqual(expect.arrayContaining(['../app/**/*.tsx', '../src/**/*.tsx']));
  });

  const tsc = existsSync(join(root, 'node_modules')) ? null : findTsc();
  (tsc ? it : it.skip)(
    'type-checks app/ and src/ cleanly against the stubs',
    () => {
      let output = '';
      try {
        execFileSync(tsc as string, ['-p', join(root, 'scripts/tsconfig.ui.json')], {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string };
        output = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() || String(err);
      }
      expect(output).toBe('');
    },
    120_000,
  );
});
