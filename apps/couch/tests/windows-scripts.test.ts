/** Windows scripts in the trial kit (oversight D66-1): cmd.exe has no /dev/null. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const skip = new Set(['node_modules', '.git', '.expo', '.verify', 'dist']);

function windowsScripts(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) windowsScripts(p, out);
    else if (/\.(cmd|bat|ps1)$/i.test(name)) out.push(p);
  }
  return out;
}

describe('windows scripts', () => {
  const files = windowsScripts(root);

  it('finds the kit scripts', () => {
    const names = files.map((f) => f.slice(root.length + 1).replace(/\\/g, '/'));
    for (const n of ['START_TRIAL.cmd', 'VERIFY.cmd', 'PUSH_UPDATE.cmd', 'tools/verify.ps1']) {
      expect(names).toContain(n);
    }
  });

  it('never redirect to /dev/null (cmd.exe needs nul, PowerShell needs $null)', () => {
    for (const f of files) {
      expect({ file: f, bad: readFileSync(f, 'utf8').includes('/dev/null') }).toEqual({ file: f, bad: false });
    }
  });

  it('cmd scripts check for node with output sent to nul', () => {
    for (const f of files.filter((x) => /\.cmd$/i.test(x))) {
      const src = readFileSync(f, 'utf8');
      if (src.includes('where node')) expect(src).toContain('where node >nul 2>nul');
    }
  });
});
