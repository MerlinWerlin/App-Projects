// Guard (owner request 16 Oct, R3): no hard-coded user-facing strings and no physical left/right
// styles in app/ and src/ui (+ src/plus UI). Every string goes through t() and the catalogue
// (docs/I18N.md); layouts use start/end so Arabic mirrors.
//
// A file not yet migrated carries the marker comment `// i18n-pending` and is skipped; the
// migration removes the marker. Escape hatches, per line: `// i18n-ignore` (a non-translatable
// literal such as the brand name) and `// rtl-ok` (a physical side that must not mirror, e.g.
// inside the never-mirrored Home/Lock Screen mocks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const DIRS = ['app', 'src/ui', 'src/plus'];

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) files(rel, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

/** Blank out comments (keeping line numbers) so commented text never counts. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p: string) => p + ' '.repeat(m.length - p.length));
}

/**
 * Blank out TypeScript type arguments (`useState<string | null>`, `useRef<Token>`,
 * `SharedValue<number>`, `Set<string>()`), keeping line numbers, so the code between two generics
 * never looks like JSX text. A type argument list starts with `<` straight after an identifier
 * (no space, not `</`) and must close (nesting allowed, `=>` ignored) within a short span.
 */
function blankGenerics(src: string): string {
  const out = src.split('');
  const opener = /[\w$]<(?=[\w${[('"])/g;
  for (const m of src.matchAll(opener)) {
    const start = (m.index ?? 0) + 1;
    if (out[start] !== '<') continue; // already blanked as part of an outer generic
    let depth = 0;
    let end = -1;
    for (let i = start; i < src.length && i < start + 300; i++) {
      const ch = src[i];
      if (ch === '<') depth++;
      else if (ch === '>' && src[i - 1] !== '=') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) continue;
    for (let i = start; i <= end; i++) if (out[i] !== '\n') out[i] = ' ';
  }
  return out.join('');
}

const STRING_PROP =
  /\b(label|title|hint|placeholder|accessibilityLabel|accessibilityHint|message|subtitle|body|description|caption|cta|text|tagline|heading|headerTitle|tabBarLabel|emptyText|confirmLabel|cancelLabel)\s*[:=]\s*\{?\s*(['"`])((?:(?!\2).)*[A-Za-z]{2,}(?:(?!\2).)*)\2/g;
const CALL = /\b(?:Alert\.alert|show|showToast|toast)\(\s*(['"`])((?:(?!\1).)*[A-Za-z]{2,}(?:(?!\1).)*)\1/g;
const JSX_TEXT = /[^=\s>]\s*>([^<>{}]*[A-Za-z]{2,}[^<>{}]*)</g;
const PHYSICAL = /\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeftWidth|borderRightWidth|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius)\b|textAlign:\s*['"](left|right)['"]/;

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split('\n').length;
}

type Finding = { file: string; line: number; text: string };

function scan(rel: string): { strings: Finding[]; physical: Finding[] } | null {
  const raw = readFileSync(join(root, rel), 'utf8');
  if (raw.includes('// i18n-pending')) return null;
  const rawLines = raw.split('\n');
  const src = stripComments(raw);
  const strings: Finding[] = [];
  const add = (index: number, text: string) => {
    const line = lineOf(src, index);
    if (rawLines[line - 1]?.includes('i18n-ignore')) return;
    strings.push({ file: rel, line, text: text.trim().slice(0, 60) });
  };
  for (const m of src.matchAll(STRING_PROP)) add(m.index ?? 0, m[3]);
  for (const m of src.matchAll(CALL)) add(m.index ?? 0, m[2]);
  if (rel.endsWith('.tsx')) for (const m of blankGenerics(src).matchAll(JSX_TEXT)) add((m.index ?? 0) + 2, m[1]);
  const physical: Finding[] = [];
  src.split('\n').forEach((l, i) => {
    if (PHYSICAL.test(l) && !rawLines[i].includes('rtl-ok')) physical.push({ file: rel, line: i + 1, text: l.trim().slice(0, 60) });
  });
  return { strings, physical };
}

const all = DIRS.flatMap((d) => files(d));
const scanned = all.map((f) => [f, scan(f)] as const);

test('no hard-coded user-facing strings in migrated UI files', () => {
  const found = scanned.flatMap(([, r]) => r?.strings ?? []);
  assert.deepEqual(found.map((f) => `${f.file}:${f.line} ${f.text}`), []);
});

test('migrated UI files use start/end instead of left/right', () => {
  const found = scanned.flatMap(([, r]) => r?.physical ?? []);
  assert.deepEqual(found.map((f) => `${f.file}:${f.line} ${f.text}`), []);
});

test('no UI file is left pending migration', () => {
  const pending = scanned.filter(([, r]) => r === null).map(([f]) => f);
  // T43 accept criterion: every UI file is migrated. New UI files must use t() from the start.
  assert.deepEqual(pending, []);
});

test('the detector itself catches the common shapes', () => {
  const sample = stripComments(`<Text>Hello there</Text>\n<Row label="Open settings" />\nshow('Saved it')\n// <Text>commented</Text>\n`);
  assert.equal([...sample.matchAll(JSX_TEXT)].length, 1);
  assert.equal([...sample.matchAll(STRING_PROP)].length, 1);
  assert.equal([...sample.matchAll(CALL)].length, 1);
  assert.ok(PHYSICAL.test("marginLeft: 8"));
  assert.ok(!PHYSICAL.test("marginStart: 8"));
});

test('TypeScript generics are not mistaken for JSX text', () => {
  const code = [
    'const [a, setA] = useState<string | null>(null);',
    'const [b, setB] = useState<ReadonlySet<string>>(() => new Set<string>());',
    'const r = useRef<() => void>(noop);',
    'const [c, setC] = useState<{ visible: boolean; reason: Reason }>({ visible: false });',
    'type Name = ComponentProps<typeof Feather>[\'name\'];',
    'const [d, setD] = useState<TipId[] | null>(null);',
  ].join('\n');
  assert.equal([...blankGenerics(stripComments(code)).matchAll(JSX_TEXT)].length, 0);
  assert.equal(blankGenerics(code).split('\n').length, code.split('\n').length);
  // Real JSX text right before a closing tag or next to a child element is still caught.
  const jsx = blankGenerics(stripComments('const [s, setS] = useState<number>(0);\nreturn <Text>Hello there</Text>;\n<View><Text>Bold<B>x</B></Text></View>'));
  assert.equal([...jsx.matchAll(JSX_TEXT)].length, 2);
});
