/**
 * Oversight D133-2 (OTA safety for cast-1024). A 1.0.0 binary that receives an OTA update, and
 * Expo Go, do not contain modules/media-server, modules/route-picker or expo-image-picker's native
 * side. So:
 *  1. nothing in app/, src/ or modules/ (outside the guarded adapters in src/native) imports or
 *     requires them, statically or dynamically;
 *  2. each adapter loads its module only through a require inside try/catch;
 *  3. the local Expo modules resolve their native half with requireOptionalNativeModule (returns
 *     null when absent), never requireNativeModule (throws);
 *  4. with no native module present (as here, and in Expo Go) the adapters report unavailable and
 *     their calls resolve instead of throwing, so the Cast tab falls back to its demo.
 * Pure TS + Node built-ins.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { hasMediaServer, loadMediaServer } from '../src/native/mediaServer';
import { hasRoutePicker, showRoutePicker } from '../src/native/routePicker';
import { hasMediaPicker, pickMediaDetailed } from '../src/native/mediaPicker';

const root = join(__dirname, '..');

const GUARDED: { spec: RegExp; adapter: string; label: string }[] = [
  { spec: /(^|\/)modules\/media-server(\/index)?$/, adapter: 'src/native/mediaServer.ts', label: 'media-server' },
  { spec: /(^|\/)modules\/route-picker(\/index)?$/, adapter: 'src/native/routePicker.ts', label: 'route-picker' },
  { spec: /^expo-image-picker(\/.*)?$/, adapter: 'src/native/mediaPicker.ts', label: 'expo-image-picker' },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'ios' || name === 'android' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = ['app', 'src', 'modules']
  .flatMap((d) => walk(join(root, d)))
  .map((p) => ({ rel: relative(root, p).split(sep).join('/'), src: readFileSync(p, 'utf8') }));

/** Every module specifier a file pulls in: import/export from, side-effect import, require(), import(). */
function specifiers(src: string): string[] {
  const out: string[] = [];
  const res = [
    /\b(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of res) for (let m = re.exec(src); m; m = re.exec(src)) out.push(m[1]);
  return out;
}

describe('cast native modules are only reached through guarded adapters (D133-2)', () => {
  it('scans app/, src/ and modules/', () => {
    const rels = files.map((f) => f.rel);
    expect(rels).toEqual(expect.arrayContaining(['src/native/mediaServer.ts', 'src/native/routePicker.ts', 'src/native/mediaPicker.ts', 'modules/media-server/index.ts', 'modules/route-picker/index.ts']));
    expect(files.length).toBeGreaterThan(50);
  });

  it('no file other than the adapter imports or requires a cast native module', () => {
    const offenders: string[] = [];
    for (const { rel, src } of files) {
      for (const s of specifiers(src)) {
        for (const g of GUARDED) {
          if (g.spec.test(s) && rel !== g.adapter) offenders.push(`${rel} -> ${s}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('each adapter loads its module with a require inside try/catch, inside a function', () => {
    for (const g of GUARDED) {
      const src = files.find((f) => f.rel === g.adapter)?.src ?? '';
      const staticSpecs = [/\b(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g]
        .flatMap((re) => [...src.matchAll(re)].map((m) => m[1]))
        .filter((spec) => g.spec.test(spec));
      expect({ adapter: g.adapter, staticSpecs }).toEqual({ adapter: g.adapter, staticSpecs: [] });
      const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
      let found = 0;
      for (let m = re.exec(src); m; m = re.exec(src)) {
        if (!g.spec.test(m[1])) continue;
        found += 1;
        const before = src.slice(0, m.index);
        const guarded = before.lastIndexOf('try {') > before.lastIndexOf('} catch');
        const lineStart = before.lastIndexOf('\n') + 1;
        expect({ adapter: g.adapter, guarded, indented: src.slice(lineStart, m.index).startsWith('  ') }).toEqual({ adapter: g.adapter, guarded: true, indented: true });
      }
      expect({ adapter: g.adapter, found }).toEqual({ adapter: g.adapter, found: 1 });
    }
  });

  it('local Expo modules use requireOptionalNativeModule, never requireNativeModule', () => {
    for (const rel of ['modules/media-server/index.ts', 'modules/route-picker/index.ts']) {
      const src = files.find((f) => f.rel === rel)?.src ?? '';
      expect({ rel, optional: /requireOptionalNativeModule\s*[<(]/.test(src), throwing: /\brequireNativeModule\s*[<(]/.test(src) }).toEqual({ rel, optional: true, throwing: false });
    }
  });

  it('without the native side the adapters report unavailable and never throw', async () => {
    expect(hasMediaServer()).toBe(false);
    expect(loadMediaServer().available).toBe(false);
    expect(hasRoutePicker()).toBe(false);
    expect(hasMediaPicker()).toBe(false);
    await expect(showRoutePicker()).resolves.toBe(false);
    await expect(pickMediaDetailed()).resolves.toEqual({ kind: 'unavailable' });
  });
});
