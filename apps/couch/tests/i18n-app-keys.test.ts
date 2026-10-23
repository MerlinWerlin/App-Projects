/**
 * owner-1016 T48: screens under app/ take their copy from the English catalogue.
 * - every t('...') key (and every 'app.*' key literal) used in app/** exists in the catalogue;
 * - params passed as an object literal cover exactly the message's {placeholders} (count for plurals);
 *   keys ending in `Rich` are split around their placeholder by the screen and take no params;
 * - no app/ file imports Text from 'react-native' (the src/ui/Text wrapper adapts fonts per script).
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { en } from '../src/i18n/catalog';
import type { Msg } from '../src/i18n/catalog/types';

const root = join(__dirname, '..');
const appDir = join(root, 'app');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(appDir).map((p) => ({ file: relative(root, p), src: readFileSync(p, 'utf8') }));
const catalogue = en as unknown as Record<string, Msg>;

function placeholders(m: Msg): string[] {
  const texts = typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string');
  const set = new Set<string>();
  for (const text of texts) for (const match of text.matchAll(/\{(\w+)\}/g)) set.add(match[1] as string);
  if (typeof m !== 'string') set.add('count');
  return [...set].sort();
}

/** Names in a params object literal body like `name: tv.name, count` (nested calls stripped). */
function paramNames(body: string): string[] {
  let flat = body;
  let prev = '';
  while (prev !== flat) {
    prev = flat;
    flat = flat.replace(/\([^()]*\)/g, '');
  }
  return flat
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/^(\w+)/.exec(part)?.[1] ?? part))
    .sort();
}

describe('app/ screens use catalogue keys (owner-1016 T48)', () => {
  it('scans the app/ screens', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it("every t('...') key and 'app.*' literal exists in the English catalogue", () => {
    const missing: string[] = [];
    let used = 0;
    for (const { file, src } of files) {
      const keys = new Set<string>();
      for (const m of src.matchAll(/\bt\('([^']+)'/g)) keys.add(m[1] as string);
      for (const m of src.matchAll(/'(app\.[\w.]+)'/g)) keys.add(m[1] as string);
      for (const k of keys) {
        used += 1;
        if (!(k in catalogue)) missing.push(`${file}: ${k}`);
      }
    }
    expect(used).toBeGreaterThan(100);
    expect(missing).toEqual([]);
  });

  it('params match the message placeholders', () => {
    const bad: string[] = [];
    for (const { file, src } of files) {
      for (const m of src.matchAll(/\bt\('([^']+)'\s*(?:,\s*\{([^}]*)\})?\s*\)/g)) {
        const key = m[1] as string;
        const msg = catalogue[key];
        if (msg === undefined) continue; // reported by the test above
        const want = key.endsWith('Rich') ? [] : placeholders(msg);
        const got = m[2] === undefined ? [] : paramNames(m[2]);
        if (want.join(',') !== got.join(',')) bad.push(`${file}: ${key} wants {${want.join(', ')}} got {${got.join(', ')}}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('app.* catalogue entries are all used somewhere in app/', () => {
    const all = files.map((f) => f.src).join('\n');
    const unused = Object.keys(catalogue).filter((k) => k.startsWith('app.') && !all.includes(`'${k}'`));
    expect(unused).toEqual([]);
  });

  it("no app/ file imports Text from 'react-native'", () => {
    const offenders = files
      .filter(({ src }) =>
        [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'react-native'/g)].some((m) =>
          (m[1] as string).split(',').some((n) => n.trim() === 'Text'),
        ),
      )
      .map((f) => f.file);
    expect(offenders).toEqual([]);
  });
});
