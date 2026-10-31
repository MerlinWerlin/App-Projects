// T92: every EmptyState in app/ and src/ carries a spot illustration (`art`), every SpotKind has its file and its
// case in SpotArt, and the illustrations draw only from theme tokens, with their key marks reading at 3:1 (WCAG
// non-text contrast) on the card in light and dark. Reads the sources as text, so it runs under plain `node --test`.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { AA_LARGE, contrast } from '../../theme/contrast.ts';
import { dark, light, type Theme } from '../../theme/tokens.ts';

const root = new URL('../../..', import.meta.url).pathname;
const here = new URL('.', import.meta.url).pathname;

const tsxUnder = (d: string, out: string[] = []): string[] => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) tsxUnder(p, out);
    else if (f.endsWith('.tsx')) out.push(p);
  }
  return out;
};

/** Index of the '>' closing the JSX opening tag that starts at `i` (skips {expressions} and quoted strings). */
export function openingTagEnd(s: string, i: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (depth === 0 && (c === '"' || c === "'")) quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return j;
  }
  return -1;
}

/** Every `<EmptyState ...>` opening tag in a source text, with its line and its art kind (or null). */
export function emptyStates(s: string): { line: number; art: string | null }[] {
  const out: { line: number; art: string | null }[] = [];
  const re = /<EmptyState\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const end = openingTagEnd(s, m.index);
    const tag = s.slice(m.index, end < 0 ? undefined : end);
    const art = /\bart="(\w+)"/.exec(tag);
    out.push({ line: s.slice(0, m.index).split('\n').length, art: art ? art[1] : null });
  }
  return out;
}

const indexSrc = readFileSync(join(here, 'index.tsx'), 'utf8');
const KINDS = [...(/SPOT_KINDS[^=]*=\s*\[([^\]]*)\]/.exec(indexSrc)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]);

test('every EmptyState in app/ and src/ has a known illustration', () => {
  assert.ok(KINDS.length >= 9, KINDS.join());
  const bad: string[] = [];
  let n = 0;
  for (const f of [...tsxUnder(join(root, 'app')), ...tsxUnder(join(root, 'src'))]) {
    for (const e of emptyStates(readFileSync(f, 'utf8'))) {
      n++;
      if (!e.art || !KINDS.includes(e.art)) bad.push(`${f.replace(root, '')}:${e.line} art=${e.art ?? 'missing'}`);
    }
  }
  assert.ok(n >= 40, `only ${n} EmptyState uses found: is the scan broken?`);
  assert.deepEqual(bad, []);
});

test('the scanner sees through nested JSX and braces in props', () => {
  const src = 'a\n<EmptyState\n  title={t("x")}\n  action={<Button label=">" onPress={() => go({ a: 1 })} />}\n  art="compass"\n/>\n<EmptyState title="y" />';
  assert.deepEqual(emptyStates(src), [
    { line: 2, art: 'compass' },
    { line: 7, art: null },
  ]);
});

const FILE: Record<string, string> = {
  suitcase: 'Suitcase',
  mapPin: 'MapPin',
  compass: 'Compass',
  ticket: 'Ticket',
  magnifier: 'Magnifier',
  notebook: 'Notebook',
  coins: 'Coins',
  clock: 'Clock',
  lifebuoy: 'Lifebuoy',
};

test('every kind has an illustration file and a SpotArt case', () => {
  for (const k of KINDS) {
    const name = FILE[k];
    assert.ok(name, `no file name for ${k}`);
    assert.ok(existsSync(join(here, `${name}.tsx`)), `${name}.tsx`);
    // the last kind may be the default branch
    assert.ok(indexSrc.includes(`case '${k}':`) || indexSrc.includes(`return <${name} size={size} />;\n  }`), `SpotArt case ${k}`);
  }
});

// Washes, the page/card fill and hairlines are backgrounds; everything else is a mark that has to be seen.
const BACKGROUND = new Set(['card', 'paper', 'cardRaised', 'line', 'accentSoft', 'seaSoft', 'okSoft', 'dangerSoft', 'warnSoft', 'tealSoft', 'accentStrong']);

test('illustrations use theme tokens only, decorative frame, marks at 3:1 on the card in both themes', () => {
  const problems: string[] = [];
  for (const name of Object.values(FILE)) {
    const src = readFileSync(join(here, `${name}.tsx`), 'utf8');
    if (!src.includes('<SpotFrame')) problems.push(`${name}: not in SpotFrame (decorative wrapper)`);
    if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(src)) problems.push(`${name}: raw colour`);
    for (const m of src.matchAll(/(?:fill|stroke)="([^"]*)"/g)) if (m[1] !== 'none') problems.push(`${name}: literal colour ${m[1]}`);
    for (const m of src.matchAll(/theme\.(\w+)/g)) {
      const key = m[1] as keyof Theme;
      for (const th of [light, dark]) {
        const v = th[key];
        if (typeof v !== 'string') {
          problems.push(`${name}: theme.${key} is not a colour token`);
          continue;
        }
        if (!BACKGROUND.has(key) && contrast(v, th.card) < AA_LARGE) problems.push(`${name}: ${th.dark ? 'dark' : 'light'} ${key} on card ${contrast(v, th.card).toFixed(2)}`);
      }
    }
  }
  assert.deepEqual([...new Set(problems)], []);
});

test('the frame hides the art from screen readers', () => {
  const frame = readFileSync(join(here, 'frame.tsx'), 'utf8');
  assert.match(frame, /accessibilityElementsHidden/);
  assert.match(frame, /importantForAccessibility="no-hide-descendants"/);
});
