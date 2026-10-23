/**
 * Source scanners for i18n checks (owner-1016 R3). Pure TS, no fs: callers read files and pass text.
 *
 * - findHardcodedStrings: user-facing literals that should be catalogue keys (t('...')).
 * - findPhysicalDirections: left/right styles that should be start/end (or sit in NeverMirror).
 * - usesNeverMirror: whether a file keeps physical directions (src/ui/NeverMirror).
 *
 * These are heuristics on text, not a parser. Escape hatch: a line with an `// i18n-ignore` (or
 * `{/* i18n-ignore *\/}`) comment is never reported.
 */

export interface ScanHit {
  /** 1-based line number. */
  line: number;
  text: string;
}

const LETTER = /\p{L}/u;
const IGNORE = /(\/\/|\/\*)\s*i18n-ignore\b/;

/** Lines (1-based) carrying an i18n-ignore comment. */
function ignoredLines(src: string): Set<number> {
  const out = new Set<number>();
  src.split('\n').forEach((l, i) => {
    if (IGNORE.test(l)) out.add(i + 1);
  });
  return out;
}

/** Blank out a range keeping newlines, so offsets and line numbers stay valid. */
function blank(s: string): string {
  return s.replace(/[^\n]/g, ' ');
}

/**
 * Remove comments (block, JSX {/* *\/} and line comments) and import/export-from lines, keeping
 * offsets. A `//` right after ':' (URLs) or inside a quoted string on that line is not a comment.
 */
export function stripCode(src: string): string {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, blank);
  s = s
    .split('\n')
    .map((line) => {
      if (/^\s*import\b/.test(line) || /^\s*(export\b[^'"]*|\})\s*from\s*['"]/.test(line)) return blank(line);
      const at = lineCommentStart(line);
      return at < 0 ? line : line.slice(0, at) + blank(line.slice(at));
    })
    .join('\n');
  // multi-line imports: `import {\n a,\n b\n} from 'x';`
  s = s.replace(/^\s*import\b[\s\S]*?\bfrom\s*['"][^'"]*['"];?/gm, blank);
  return s;
}

function lineCommentStart(line: string): number {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && line[i + 1] === '/' && line[i - 1] !== ':') return i;
    // Only treat quotes as strings in code-like positions; an apostrophe in JSX text ("Don't")
    // follows a letter, so it does not open a string.
    if ((c === "'" || c === '"' || c === '`') && !/\p{L}/u.test(line[i - 1] ?? '')) quote = c;
  }
  return -1;
}

function lineAt(src: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

/** Visible text of a literal body: ${...} / {...} expressions and HTML entities removed. */
function visible(text: string): string {
  return text
    .replace(/\$\{[^}]*\}/g, '')
    .replace(/\{[^}]*\}/g, '')
    // a JSX text slice can start or end inside an expression: `)} {cond ? (`
    .replace(/\{[^}]*$/, '')
    .replace(/^[^{]*\}/, '')
    .replace(/&[a-z]+;|&#\d+;/gi, '');
}

function hasWords(text: string): boolean {
  return LETTER.test(visible(text));
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const STRING = /(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g;

/** Matching close paren for the '(' at `open`, skipping strings; -1 when unbalanced. */
function closeParen(s: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < s.length; i++) {
    const c = s[i]!;
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Characters a type parameter/argument list may contain (besides nested `<...>` and strings). */
const TYPE_CHAR = /[\w$\s,.|&[\]?:(){};*+-]/;
const MAX_GENERIC = 600;

/**
 * End index (the closing `>`) of the type parameter/argument list opening at `open`, or -1 when the
 * `<` does not open one: a `<` not preceded by an identifier, `/` (closing tag), `=` / `-` or
 * other non-type characters abort. `=>` inside (function types) does not close the list.
 */
function genericEnd(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length && i - open < MAX_GENERIC; i++) {
    const c = s[i]!;
    if (c === "'" || c === '"' || c === '`') {
      const close = s.indexOf(c, i + 1);
      if (close < 0 || s.slice(i, close).includes('\n')) return -1;
      i = close;
    } else if (c === '<') {
      // only another type argument list (`Array<Set<T>>`) may nest
      if (i !== open && !/[\w$]/.test(s[i - 1] ?? '')) return -1;
      depth++;
    } else if (c === '>') {
      if (s[i - 1] === '=') continue; // `(v: V) => void`
      depth--;
      if (depth === 0) return i;
    } else if (!TYPE_CHAR.test(c)) return -1;
  }
  return -1;
}

/**
 * Blank TypeScript type parameter/argument lists so the JSX text pass cannot read the code between
 * two of them as text: `f<V>(a: X<V>)`, `useState<Foo | null>(null)`, `Array<Set<T>>`,
 * `interface Choice<V extends string>`, and arrow generics `<T,>(x: T) =>` / `<T extends U>(x) =>`.
 * A generic `<` sits right after an identifier; a JSX tag never does except a nested tag glued to
 * text (`Press<B>`), which, if blanked, still leaves the outer text to report.
 */
export function blankGenerics(code: string): string {
  let out = '';
  let from = 0;
  for (let i = 0; i < code.length; i++) {
    if (code[i] !== '<') continue;
    const glued = /[\w$]/.test(code[i - 1] ?? '');
    const arrow = !glued && /^<\s*[A-Za-z_$][\w$]*\s*(,|extends\s)/.test(code.slice(i, i + 80));
    if (!glued && !arrow) continue;
    const end = genericEnd(code, i);
    if (end < 0) continue;
    if (arrow && !/^\s*\(/.test(code.slice(end + 1, end + 40))) continue;
    out += code.slice(from, i) + blank(code.slice(i, end + 1));
    from = end + 1;
    i = end;
  }
  return out + code.slice(from);
}

/** Text between `>` and `<` that looks like code (generics, comparisons, ternaries), not JSX text. */
function looksLikeCode(text: string): boolean {
  return (
    /[;=]|&&|\|\||=>/.test(text) ||
    /[\w$\])]\s*\(/.test(text) || // call: foo(
    /\)\s*:/.test(text) || // return type: <T>(v: T): Array<T>
    /\s[?:]\s*$/.test(text) || // `a > b ? <X/>`
    /^\s*[?:]/.test(text) ||
    (/^\s*[\w$.]+\s*$/.test(text) && /[.$]/.test(text)) // a > obj.max ... <
  );
}

/**
 * User-facing literals that are not catalogue keys:
 * - JSX text nodes with letters (expressions like {t('x')} alone are fine);
 * - string literals in accessibilityLabel= / accessibilityHint= / placeholder= / title= props;
 * - `title:` / `tabBarLabel:` / `headerTitle:` option literals;
 * - Alert.alert(...) literals (title, message, button text; `style: 'cancel'` is not copy).
 * Ignores comments, imports, glyph/number-only text ('›', '+', '−', '•', '42') and i18n-ignore lines.
 */
export function findHardcodedStrings(src: string): ScanHit[] {
  const code = stripCode(src);
  const ignored = ignoredLines(src);
  const hits = new Map<number, ScanHit>();
  const add = (index: number, text: string) => {
    const t = clean(text);
    if (!t || !hasWords(t)) return;
    const line = lineAt(code, index);
    if (ignored.has(line)) return;
    hits.set(index, { line, text: t });
  };

  // JSX text: `>` closing a tag (not `=>`), up to the next `<` that starts a tag.
  // Type parameter/argument lists are blanked first so `f<V>(a: X<V>)` is not read as JSX text.
  const typed = blankGenerics(code);
  const jsx = />([^<>]*)<(?=[/A-Za-z>])/g;
  for (let m = jsx.exec(typed); m; m = jsx.exec(typed)) {
    const before = typed[m.index - 1] ?? '';
    if (before === '=' || before === '-') continue;
    const body = m[1]!;
    if (looksLikeCode(body)) continue;
    const lead = body.length - body.trimStart().length;
    add(m.index + 1 + lead, body);
  }

  // Props: name="..." | name='...' | name={'...'} | name={`...`}
  const prop = /\b(accessibilityLabel|accessibilityHint|placeholder|title)\s*=\s*\{?\s*(['"`])((?:\\.|(?!\2)[^\\])*?)\2/g;
  for (let m = prop.exec(code); m; m = prop.exec(code)) add(m.index + m[0].indexOf(m[2]!), m[3]!);

  // Navigation / data options: title: '...', tabBarLabel: '...', headerTitle: '...'
  const opt = /\b(title|tabBarLabel|headerTitle)\s*:\s*(['"`])((?:\\.|(?!\2)[^\\])*?)\2/g;
  for (let m = opt.exec(code); m; m = opt.exec(code)) add(m.index + m[0].indexOf(m[2]!), m[3]!);

  // Alert.alert( ... ) literals
  const alert = /\bAlert\.alert\s*\(/g;
  for (let m = alert.exec(code); m; m = alert.exec(code)) {
    const open = m.index + m[0].length - 1;
    const close = closeParen(code, open);
    const args = code.slice(open + 1, close < 0 ? code.length : close);
    STRING.lastIndex = 0;
    for (let s = STRING.exec(args); s; s = STRING.exec(args)) {
      const head = args.slice(0, s.index);
      if (/\bstyle\s*:\s*$/.test(head)) continue; // style: 'cancel'
      if (/[\w$]\s*\(\s*$/.test(head)) continue; // t('key'), String('x')
      add(open + 1 + s.index, s[2]!);
    }
  }

  return [...hits.entries()].sort((a, b) => a[0] - b[0]).map(([, h]) => h);
}

const PHYSICAL =
  /\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeftWidth|borderRightWidth)\b|\b(left|right)\s*:|\btextAlign\s*:\s*['"](left|right)['"]/g;

/**
 * Physical left/right styles (marginLeft, paddingRight, left:, textAlign: 'left', ...). Outside the
 * remote's never-mirror controls these should be start/end so Arabic mirrors correctly.
 */
export function findPhysicalDirections(src: string): ScanHit[] {
  const code = stripCode(src);
  const ignored = ignoredLines(src);
  const out: ScanHit[] = [];
  PHYSICAL.lastIndex = 0;
  for (let m = PHYSICAL.exec(code); m; m = PHYSICAL.exec(code)) {
    const line = lineAt(code, m.index);
    if (!ignored.has(line)) out.push({ line, text: m[0] });
  }
  return out;
}

/** True when the file keeps physical directions via NeverMirror / NEVER_MIRROR_STYLE / direction: 'ltr'. */
export function usesNeverMirror(src: string): boolean {
  return /<NeverMirror\b|\bNEVER_MIRROR_STYLE\b|\bdirection\s*:\s*['"]ltr['"]/.test(stripCode(src));
}
