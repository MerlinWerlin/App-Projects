// Architecture guards (ops/CONVENTIONS.md):
// 1. src/core stays pure: no React Native / Expo imports, relative imports end in .ts.
// 2. Free paths never read the Plus entitlement: nothing under src/core, src/native, src/render,
//    app/install* or app/(tabs)/icons* imports src/plus, and only src/plus imports the entitlement.
// 3. expo-file-system only through src/native/fs.ts. 4. Only the phone mocks use v1 tokens (T84).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Tests run from the repo root (npm test / node --test).
const root = process.cwd();

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const re = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const out: string[] = [];
  for (const m of src.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

test('src/core has no React Native or Expo imports', () => {
  for (const f of walk(join(root, 'src', 'core'))) {
    for (const spec of importsOf(f)) {
      assert.ok(!/^(react|react-native|expo|@expo|@react-native)/.test(spec), `${f} imports ${spec}`);
    }
  }
});

test('src/core relative imports end in .ts so Node runs them directly', () => {
  for (const f of walk(join(root, 'src', 'core'))) {
    for (const spec of importsOf(f)) {
      if (spec.startsWith('.')) assert.ok(spec.endsWith('.ts'), `${f} imports ${spec} without .ts`);
    }
  }
});

test('free paths never import src/plus', () => {
  const appDir = join(root, 'app');
  const free = [
    ...walk(join(root, 'src', 'core')),
    ...walk(join(root, 'src', 'native')),
    ...walk(join(root, 'src', 'render')),
    ...walk(appDir).filter((f) => {
      const rel = f.slice(appDir.length + 1).replace(/\\/g, '/');
      return rel.startsWith('install') || rel.startsWith('(tabs)/icons');
    }),
  ];
  assert.ok(free.length > 0, 'expected some free-path files');
  for (const f of free) {
    for (const spec of importsOf(f)) {
      assert.ok(!/(^|\/)plus(\/|$)/.test(spec), `${f} imports ${spec}`);
    }
  }
});

test('only src/plus imports the Plus entitlement', () => {
  const plusDir = join(root, 'src', 'plus');
  const files = [...walk(join(root, 'src')), ...walk(join(root, 'app'))].filter((f) => !f.startsWith(plusDir));
  for (const f of files) {
    for (const spec of importsOf(f)) {
      assert.ok(!/(^|\/)plus\/entitlement$/.test(spec), `${f} imports ${spec}`);
    }
  }
});

// 3. Oversight D5-1: expo-file-system (incl. /legacy) is reached only through src/native/fs.ts,
//    so an SDK bump that drops /legacy is a one-file fix.
test('only src/native/fs.ts imports expo-file-system', () => {
  const adapter = join(root, 'src', 'native', 'fs.ts');
  assert.ok(existsSync(adapter), 'expected the src/native/fs.ts adapter');
  const files = [...walk(join(root, 'app')), ...walk(join(root, 'src'))];
  for (const f of files) {
    if (f === adapter) continue;
    for (const spec of importsOf(f)) {
      assert.ok(!spec.startsWith('expo-file-system'), `${f} imports ${spec}; use src/native/fs.ts`);
    }
  }
  assert.ok(importsOf(adapter).some((s) => s.startsWith('expo-file-system')), 'adapter should wrap expo-file-system');
});

// 4. Design v2 migration (T84): the v1 tokens (src/theme/tokens.ts) are imported only by the phone
//    mocks, which keep the brand fonts for their artwork; everything else is on tokensV2. The
//    legacy Button is gone (PillButton / SheenButton replace it).
const V1_TOKEN_MOCKS = ['HomeMock.tsx', 'LockMock.tsx', 'PhoneFrame.tsx', 'WidgetPreview.tsx', 'CatalogueWidgetPreview.tsx'].map((n) =>
  join(root, 'src', 'ui', n),
);

test('only the phone mocks import the v1 theme tokens', () => {
  const themeDir = join(root, 'src', 'theme');
  const files = [...walk(join(root, 'app')), ...walk(join(root, 'src'))].filter((f) => !/\.test\.tsx?$/.test(f));
  assert.ok(files.length > 0, 'expected app and src files');
  for (const f of files) {
    if (f === join(themeDir, 'tokens.ts')) continue;
    const v1 = importsOf(f).some((s) => /(^|\/)theme\/tokens(\.ts)?$/.test(s) || (f.startsWith(themeDir) && /^\.\/tokens(\.ts)?$/.test(s)));
    if (v1) assert.ok(V1_TOKEN_MOCKS.includes(f), `${f} imports the v1 tokens; use src/theme/tokensV2`);
  }
});

test('the legacy Button is deleted and nothing imports it', () => {
  assert.ok(!existsSync(join(root, 'src', 'ui', 'Button.tsx')), 'src/ui/Button.tsx should be gone; use PillButton');
  for (const f of [...walk(join(root, 'app')), ...walk(join(root, 'src'))]) {
    for (const spec of importsOf(f)) {
      assert.ok(!/(^|\/)ui\/Button$|^\.\/Button$/.test(spec), `${f} imports ${spec}; use PillButton`);
    }
  }
});

test('i18nLayout no longer ships the v1 localizedType helper', () => {
  const src = readFileSync(join(root, 'src', 'ui', 'i18nLayout.ts'), 'utf8');
  assert.ok(!/export function localizedType\(/.test(src), 'localizedType is v1; use localizedTypeV2 or textV2 + textStyleFor');
});
