/**
 * Every TV control is free: no control path may import src/plus, and src/plus never drives a TV.
 * Uses only Node built-ins so it runs under Jest (and Bun) without extra deps.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(__dirname, '..');
const guarded = ['src/core', 'src/ui/remote', 'app/(tabs)', 'src/state/session.tsx'];

function files(p: string): string[] {
  if (!existsSync(p)) return [];
  if (statSync(p).isFile()) return /\.(ts|tsx)$/.test(p) ? [p] : [];
  return readdirSync(p).flatMap((n) => files(join(p, n)));
}

/** Module specifiers from import/export-from, dynamic import() and require(). */
function specifiers(src: string): string[] {
  const out: string[] = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) out.push(m[1]!);
  return out;
}

const isPlus = (s: string) => /(^|\/)plus(\/|$)/.test(s);
/** Drivers, the driver interface, sessions and transports: anything that can send keys to a TV. */
const isControl = (s: string) =>
  /(^|\/)(drivers?|session|transport|lanWss|udp|ir|wol)(\/|$)/.test(s) || /(^|\/)core\/drivers\//.test(s);

describe('Couch Plus guard', () => {
  const all = guarded.flatMap((g) => files(join(root, g)));

  it('scans every guarded path', () => {
    for (const g of guarded) expect(files(join(root, g)).length).toBeGreaterThan(0);
  });

  it('no control path imports src/plus', () => {
    const offenders = all.filter((f) => specifiers(readFileSync(f, 'utf8')).some(isPlus));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it('the specifier scan catches plus imports', () => {
    expect(specifiers("import { canUse } from '../../plus/entitlement';").some(isPlus)).toBe(true);
    expect(specifiers("const p = require('../plus');").some(isPlus)).toBe(true);
    expect(specifiers("await import('../src/plus/state')").some(isPlus)).toBe(true);
    expect(specifiers("import { x } from './plusOne';").some(isPlus)).toBe(false);
  });

  it('src/plus never imports a driver, session or transport, and never sends keys', () => {
    const plus = files(join(root, 'src/plus'));
    expect(plus.length).toBeGreaterThan(0);
    const importers = plus.filter((f) => specifiers(readFileSync(f, 'utf8')).some(isControl));
    expect(importers.map((f) => relative(root, f))).toEqual([]);
    const senders = plus.filter((f) => !f.endsWith('.test.ts') && /\bsendKey\b|\bsendText\b|\blaunchApp\b/.test(readFileSync(f, 'utf8')));
    expect(senders.map((f) => relative(root, f))).toEqual([]);
  });

  it('no store billing package is installed (purchases are stubbed)', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>;
    const deps = Object.keys({ ...pkg['dependencies'], ...pkg['devDependencies'] });
    const billing = deps.filter((d) => /purchases|iap|billing|storekit|revenuecat/i.test(d));
    expect(billing).toEqual([]);
  });

  it('src/core has no React Native imports', () => {
    const core = files(join(root, 'src/core'));
    const offenders = core.filter((f) => /from\s+['"](react-native|expo)/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });
});
