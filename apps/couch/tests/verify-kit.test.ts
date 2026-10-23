/** PC verification kit (oversight D65-1): one double-click produces a pasteable report for T18. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const cmd = readFileSync(join(root, 'VERIFY.cmd'), 'utf8');
const ps = readFileSync(join(root, 'tools', 'verify.ps1'), 'utf8');
const ignore = readFileSync(join(root, '.gitignore'), 'utf8');

describe('verify kit', () => {
  it('VERIFY.cmd uses CRLF, checks node, runs the script and pauses', () => {
    expect(/[^\r]\n/.test(cmd)).toBe(false);
    const order = ['where node', 'tools\\verify.ps1', 'pause'];
    let at = -1;
    for (const step of order) {
      const i = cmd.indexOf(step, at + 1);
      expect(i).toBeGreaterThan(at);
      at = i;
    }
    expect(cmd).toContain('-ExecutionPolicy Bypass');
  });

  it('runs install, typecheck, tests and the iOS export in that order', () => {
    const order = ["'npm install'", 'expo install --fix', 'tsc --noEmit', 'npm test', 'expo export --platform ios --output-dir .verify'];
    let at = -1;
    for (const step of order) {
      const i = ps.indexOf(step, at + 1);
      expect(i).toBeGreaterThan(at);
      at = i;
    }
  });

  it('reports each exit code and at most 40 error lines, never stopping early', () => {
    expect(ps).toContain('verify-report.txt');
    expect(ps).toContain('$LASTEXITCODE');
    expect(ps).toContain('Select-Object -First 40');
    expect(ps).not.toMatch(/\bexit\s+\d|\bbreak\b|throw/);
  });

  it('is ASCII-only so Windows PowerShell 5.1 reads it without a BOM', () => {
    expect(/[^\x00-\x7f]/.test(ps)).toBe(false);
  });

  it('keeps report and export output out of git', () => {
    expect(ignore).toContain('.verify/');
    expect(ignore).toContain('verify-report.txt');
  });
});
