/**
 * owner-1016 R3 (T49): copy in src/ui and src/state lives in the catalogue.
 * - every message-key literal ('ui.*', 'app.*', 'core.*') used there exists in the English catalogue;
 * - only src/ui/Text.tsx imports Text from 'react-native' (everything else uses the script-aware
 *   drop-in from src/ui/Text).
 * Node built-ins only (Jest and Bun).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { en } from '../src/i18n/catalog';
import { uiEn } from '../src/i18n/catalog/en/ui';

const root = join(__dirname, '..');
const DIRS = ['src/ui', 'src/state'];

function files(p: string): string[] {
  if (!existsSync(p)) return [];
  if (statSync(p).isFile()) return /\.(ts|tsx)$/.test(p) ? [p] : [];
  return readdirSync(p).flatMap((n) => files(join(p, n)));
}

const sources = DIRS.flatMap((d) => files(join(root, d))).map((p) => ({
  path: relative(root, p),
  src: readFileSync(p, 'utf8'),
}));

const KEY_RE = /['"`]((?:ui|app|core)\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)['"`]/g;

describe('src/ui + src/state copy', () => {
  it('finds the sources', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it('every message key used exists in the English catalogue', () => {
    const missing: string[] = [];
    let used = 0;
    for (const { path, src } of sources) {
      for (const m of src.matchAll(KEY_RE)) {
        used += 1;
        const key = m[1]!;
        if (!Object.prototype.hasOwnProperty.call(en, key)) missing.push(`${path}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
    expect(used).toBeGreaterThan(50);
  });

  it("ui catalogue keys are 'ui.<area>.<name>'", () => {
    for (const k of Object.keys(uiEn)) expect(k).toMatch(/^ui\.[a-z][A-Za-z0-9]*\.[A-Za-z0-9_.]+$/);
  });

  it("only src/ui/Text.tsx imports Text from 'react-native'", () => {
    const offenders: string[] = [];
    const re = /import\s*\{([^}]*)\}\s*from\s*'react-native'/g;
    for (const { path, src } of sources) {
      if (path === join('src', 'ui', 'Text.tsx')) continue;
      for (const m of src.matchAll(re)) {
        if (/(^|[\s,])Text(\s+as\s+\w+)?\s*(,|$)/.test(m[1]!)) offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });
});
