// Source scanners for the i18n / adaptive-layout rules in docs/I18N.md (owner request 16 Oct, R3). Pure TS, no
// dependencies: each function takes a file's text and returns findings, so src/i18n/scan.test.ts can run them over
// app/ and src/ui/ with node --test. The JSX reader is a small hand-written lexer (strings, templates, comments,
// regex literals, nested JSX); it is a heuristic, not a full TypeScript parser, but it is exact for the code style
// used in this repo.
//
// Escape hatches (write them as comments in the source):
//   // i18n-ignore            on a line (or alone on the line above): not a hard-coded UI string (check a)
//   // rtl-physical-ok        on a line (or alone on the line above): physical left/right is intended (check b/c);
//                             if that line opens a bracket, the whole bracketed block is covered (a style object)
//   // rtl-physical-ok:begin … // rtl-physical-ok:end   a whole region (e.g. the never-mirrored camera stack)
//   // expansion-ok           on a line: numberOfLines={1} / fixed height is intended (check d)
import { formatDuration, formatPercent, formatUnit, placeholders, pseudoText, type Catalog } from './core.ts';

export type Check = 'a' | 'b' | 'c' | 'd' | 'e';
export type Finding = { check: Check; rule: string; file: string; line: number; text: string };

/** Main screens for the RTL layout and text-expansion checks (repo-relative paths). */
export const MAIN_SCREENS: readonly string[] = [
  // T81: Home / Templates / My drawings / Settings live in the (tabs) group (URLs unchanged)
  'app/(tabs)/index.tsx',
  'app/(tabs)/templates.tsx',
  'app/prepare.tsx',
  'app/trace.tsx',
  'app/lightbox.tsx',
  'app/(tabs)/settings.tsx',
  'app/(tabs)/drawings.tsx',
  'app/(tabs)/_layout.tsx',
];
/** Screens that show the camera / traced image / outline and must wrap it in a never-mirrored (LTR) view. */
export const NEVER_MIRROR_SCREENS: readonly string[] = ['app/prepare.tsx', 'app/trace.tsx', 'app/lightbox.tsx'];

/** JSX props whose string value is shown or read aloud to the user. */
export const TEXT_PROPS: readonly string[] = [
  'accessibilityLabel',
  'accessibilityHint',
  'placeholder',
  'title',
  'label',
  'caption',
  'body',
  'text',
  'hint',
  'message',
  'subtitle',
  'description',
  'action',
  'actionLabel',
  'context',
  'heading',
];
/** Object keys whose string value is user-facing (Alert buttons, accessibilityActions, chip options...). */
const TEXT_KEYS =
  /\b(label|title|text|hint|message|caption|body|subtitle|description|accessibilityLabel|accessibilityHint|actionLabel)\s*:\s*$/;
/** Object keys whose string value is never user-facing even inside an Alert / toast call. */
const CODE_KEYS = /\b(style|role|variant|tone|icon|name|key|id|type|kind|mode|haptic|testID|accessibilityRole)\s*:\s*$/;
/** Calls whose string arguments are shown or announced. */
const TEXT_CALLS = /\b(Alert\.alert|announceForAccessibility|showToast|toast|show)\s*\(/g;
/** A catalogue key ('trace.lock', 'templates.category.') is not English. */
const KEY_RE = /^[a-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]*)+$/;
const TRANSLATE_CALL = /\b(t|tDynamic|i18n\.t)\s*\(\s*$/;
const COMPARISON = /(===|!==|==|!=)\s*$/;

// ---------------------------------------------------------------- lexer

export type Literal = { offset: number; end: number; value: string; template: boolean };
export type JsxText = { offset: number; text: string };
export type JsxAttr = { name: string; offset: number; kind: 'string' | 'expr' | 'bare'; value: string; valueOffset: number };
export type JsxElement = {
  tag: string;
  offset: number;
  end: number;
  attrs: JsxAttr[];
  childrenStart: number;
  childrenEnd: number;
};
export type JsxChildExpr = { offset: number; end: number };
export type Analysis = {
  src: string;
  /** Source with comments blanked (newlines kept, same length). */
  noComments: string;
  /** Source with comments, string/template/regex contents and JSX text blanked (quotes kept, same length). */
  bare: string;
  literals: Literal[];
  texts: JsxText[];
  elements: JsxElement[];
  childExprs: JsxChildExpr[];
  lineStarts: number[];
};

const WORD = /[A-Za-z0-9_$]/;
const KEYWORDS_BEFORE_EXPR = new Set([
  'return',
  'typeof',
  'case',
  'yield',
  'await',
  'else',
  'do',
  'in',
  'of',
  'default',
  'void',
  'delete',
  'new',
  'throw',
]);
const EXPR_START_PREV = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', ';', 'op', '+', '-', '*', '%', '~', '^']);

export function analyzeSource(src: string): Analysis {
  const n = src.length;
  const noComments = src.split('');
  const bare = src.split('');
  const literals: Literal[] = [];
  const texts: JsxText[] = [];
  const elements: JsxElement[] = [];
  const childExprs: JsxChildExpr[] = [];
  let i = 0;
  let prev = '';

  const blank = (arr: string[], from: number, to: number): void => {
    for (let k = from; k < to && k < n; k++) if (arr[k] !== '\n') arr[k] = ' ';
  };

  const skipWsComments = (): void => {
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        i++;
      } else if (c === '/' && src[i + 1] === '/') {
        const start = i;
        while (i < n && src[i] !== '\n') i++;
        blank(noComments, start, i);
        blank(bare, start, i);
      } else if (c === '/' && src[i + 1] === '*') {
        const start = i;
        const end = src.indexOf('*/', i + 2);
        i = end < 0 ? n : end + 2;
        blank(noComments, start, i);
        blank(bare, start, i);
      } else break;
    }
  };

  const readString = (): string => {
    const q = src[i];
    const start = i;
    i++;
    let value = '';
    while (i < n && src[i] !== q) {
      if (src[i] === '\\' && i + 1 < n) {
        value += src[i + 1];
        i += 2;
      } else if (src[i] === '\n') {
        break; // unterminated: stop at end of line
      } else {
        value += src[i];
        i++;
      }
    }
    i++;
    blank(bare, start + 1, i - 1);
    literals.push({ offset: start, end: i, value, template: false });
    return value;
  };

  const readTemplate = (): void => {
    const start = i;
    i++;
    let value = '';
    let segStart = i;
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') {
        value += src[i + 1] ?? '';
        i += 2;
      } else if (src[i] === '$' && src[i + 1] === '{') {
        blank(bare, segStart, i);
        value += ' ';
        i += 2;
        prev = '{';
        scanCode('}');
        segStart = i;
      } else {
        value += src[i];
        i++;
      }
    }
    blank(bare, segStart, i);
    i++;
    literals.push({ offset: start, end: i, value, template: true });
  };

  const readRegex = (): void => {
    const start = i;
    i++;
    let inClass = false;
    while (i < n && src[i] !== '\n') {
      const c = src[i];
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) break;
      i++;
    }
    i++;
    while (i < n && /[a-z]/.test(src[i])) i++;
    blank(bare, start + 1, i);
  };

  const readJsxText = (): void => {
    const start = i;
    while (i < n && src[i] !== '<' && src[i] !== '{') i++;
    const text = src.slice(start, i);
    blank(bare, start, i);
    if (text.trim()) texts.push({ offset: start, text });
  };

  const parseElement = (): void => {
    const start = i;
    i++; // <
    skipWsComments();
    let tag = '';
    while (i < n && /[A-Za-z0-9_$.:-]/.test(src[i])) tag += src[i++];
    if (src[i] === '<') {
      // Type arguments on a generic component: <Segmented<Mode> ...>
      let depth = 0;
      for (; i < n; i++) {
        if (src[i] === '<') depth++;
        else if (src[i] === '>' && --depth === 0) {
          i++;
          break;
        }
      }
    }
    const attrs: JsxAttr[] = [];
    let selfClosing = false;
    for (;;) {
      skipWsComments();
      if (i >= n) break;
      const c = src[i];
      if (c === '/' && src[i + 1] === '>') {
        i += 2;
        selfClosing = true;
        break;
      }
      if (c === '>') {
        i++;
        break;
      }
      if (c === '{') {
        i++;
        prev = '{';
        scanCode('}');
        continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        const nameOffset = i;
        let name = '';
        while (i < n && /[A-Za-z0-9_$:.-]/.test(src[i])) name += src[i++];
        skipWsComments();
        if (src[i] === '=') {
          i++;
          skipWsComments();
          const vc = src[i];
          if (vc === '"' || vc === "'") {
            const valueOffset = i;
            const value = readString();
            attrs.push({ name, offset: nameOffset, kind: 'string', value, valueOffset });
          } else if (vc === '{') {
            const valueOffset = i + 1;
            i++;
            prev = '{';
            scanCode('}');
            attrs.push({ name, offset: nameOffset, kind: 'expr', value: src.slice(valueOffset, i - 1), valueOffset });
          } else if (vc === '<') {
            parseElement();
          }
        } else {
          attrs.push({ name, offset: nameOffset, kind: 'bare', value: '', valueOffset: i });
        }
        continue;
      }
      i++; // unexpected character: skip it
    }
    const el: JsxElement = { tag, offset: start, end: i, attrs, childrenStart: i, childrenEnd: i };
    elements.push(el);
    if (selfClosing) return;
    for (;;) {
      if (i >= n) break;
      const c = src[i];
      if (c === '<' && src[i + 1] === '/') {
        el.childrenEnd = i;
        const close = src.indexOf('>', i);
        i = close < 0 ? n : close + 1;
        break;
      }
      if (c === '<') {
        parseElement();
      } else if (c === '{') {
        const exprStart = i + 1;
        i++;
        prev = '{';
        scanCode('}');
        childExprs.push({ offset: exprStart, end: i - 1 });
      } else {
        readJsxText();
      }
    }
    el.end = i;
  };

  /** Scans code until the unmatched `stop` bracket (consumed) or end of input. */
  const scanCode = (stop: string): void => {
    while (i < n) {
      skipWsComments();
      if (i >= n) return;
      const c = src[i];
      if (c === stop) {
        i++;
        return;
      }
      if (c === '}' || c === ')' || c === ']') {
        i++; // unbalanced closer: ignore
        prev = ')';
        continue;
      }
      if (c === '{') {
        i++;
        prev = '{';
        scanCode('}');
        prev = ')';
      } else if (c === '(') {
        i++;
        prev = '(';
        scanCode(')');
        prev = ')';
      } else if (c === '[') {
        i++;
        prev = '[';
        scanCode(']');
        prev = ')';
      } else if (c === '"' || c === "'") {
        readString();
        prev = 'v';
      } else if (c === '`') {
        readTemplate();
        prev = 'v';
      } else if (c === '/') {
        if (EXPR_START_PREV.has(prev)) {
          readRegex();
          prev = 'v';
        } else {
          i++;
          prev = 'op';
        }
      } else if (c === '<') {
        if (EXPR_START_PREV.has(prev) && /[A-Za-z>]/.test(src[i + 1] ?? '')) {
          parseElement();
          prev = 'v';
        } else {
          i++;
          prev = 'op';
        }
      } else if (c === '=' && src[i + 1] === '>') {
        i += 2;
        prev = 'op';
      } else if (WORD.test(c)) {
        let w = '';
        while (i < n && WORD.test(src[i])) w += src[i++];
        prev = KEYWORDS_BEFORE_EXPR.has(w) ? 'op' : 'v';
      } else {
        i++;
        // Operators allow an expression (JSX / regex) next; `.` and `>` (type-argument close) do not.
        prev = c === '.' || c === '>' ? '.' : EXPR_START_PREV.has(c) ? c : 'op';
      }
    }
  };

  // Top level: keep scanning until the end even if a stray closer appears.
  while (i < n) scanCode('\u0000');

  const lineStarts = [0];
  for (let k = 0; k < n; k++) if (src[k] === '\n') lineStarts.push(k + 1);
  return {
    src,
    noComments: noComments.join(''),
    bare: bare.join(''),
    literals,
    texts,
    elements,
    childExprs,
    lineStarts,
  };
}

export function lineOf(a: Analysis, offset: number): number {
  let lo = 0;
  let hi = a.lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (a.lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function lines(text: string): string[] {
  return text.split('\n');
}

/**
 * 1-based line numbers covered by a marker comment: the marker's own line; the next line when the marker sits
 * alone on its line; the whole bracketed block when the covered line opens one; and `marker:begin` … `marker:end`.
 */
export function exemptLines(a: Analysis, marker: string): Set<number> {
  const src = lines(a.src);
  const bare = lines(a.bare);
  const out = new Set<number>();
  let inRegion = false;
  for (let L = 0; L < src.length; L++) {
    const line = src[L];
    if (line.includes(`${marker}:begin`)) inRegion = true;
    if (inRegion) out.add(L + 1);
    if (line.includes(`${marker}:end`)) {
      inRegion = false;
      continue;
    }
    if (!line.includes(marker) || line.includes(`${marker}:begin`)) continue;
    out.add(L + 1);
    let R = L;
    if (!bare[L].trim() && L + 1 < src.length) {
      R = L + 1;
      out.add(R + 1);
    }
    let depth = 0;
    for (let k = R; k < bare.length; k++) {
      for (const ch of bare[k]) {
        if (ch === '{' || ch === '(' || ch === '[') depth++;
        else if (ch === '}' || ch === ')' || ch === ']') depth--;
      }
      out.add(k + 1);
      if (depth <= 0) break;
    }
  }
  return out;
}

function before(a: Analysis, offset: number, span = 80): string {
  return a.noComments.slice(Math.max(0, offset - span), offset);
}

function hasWords(v: string): boolean {
  const s = v.trim();
  return /\p{L}{2,}/u.test(s) && !KEY_RE.test(s);
}

/** Looks like English prose rather than a code value: has a space, or starts with a capital. */
function looksProse(v: string): boolean {
  const s = v.trim();
  return hasWords(s) && (/\s/.test(s) || /^\p{Lu}/u.test(s));
}

function short(v: string): string {
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length > 70 ? `${s.slice(0, 67)}...` : s;
}

function insideAny(offset: number, ranges: readonly { offset: number; end: number }[]): boolean {
  return ranges.some((r) => offset >= r.offset && offset < r.end);
}

/** A literal that is a t() key, a comparison operand, or the value of a code-only key is not UI text. */
function isCodeLiteral(a: Analysis, lit: Literal): boolean {
  const b = before(a, lit.offset);
  if (TRANSLATE_CALL.test(b) || COMPARISON.test(b) || CODE_KEYS.test(b)) return true;
  const after = a.noComments.slice(lit.end, lit.end + 6);
  if (/^\s*(===|!==|==|!=)/.test(after)) return true;
  return false;
}

// ---------------------------------------------------------------- check a: hard-coded UI strings

export function findHardcodedStrings(file: string, src: string, pre?: Analysis): Finding[] {
  const a = pre ?? analyzeSource(src);
  const ignore = exemptLines(a, 'i18n-ignore');
  const out: Finding[] = [];
  const seen = new Set<number>();
  const add = (rule: string, offset: number, text: string): void => {
    const line = lineOf(a, offset);
    if (ignore.has(line) || seen.has(offset)) return;
    seen.add(offset);
    out.push({ check: 'a', rule, file, line, text: short(text) });
  };

  // JSX text children.
  for (const t of a.texts) if (hasWords(t.text)) add('jsx-text', t.offset + (t.text.length - t.text.trimStart().length), t.text);

  const elementRanges = a.elements.map((e) => ({ offset: e.offset, end: e.end }));

  // Text props: string values, and string literals inside {expressions}.
  for (const el of a.elements) {
    for (const at of el.attrs) {
      if (!TEXT_PROPS.includes(at.name)) continue;
      if (at.kind === 'string') {
        if (hasWords(at.value)) add('prop', at.valueOffset, `${at.name}="${at.value}"`);
      } else if (at.kind === 'expr') {
        const end = at.valueOffset + at.value.length;
        for (const lit of a.literals) {
          if (lit.offset < at.valueOffset || lit.offset >= end) continue;
          if (isCodeLiteral(a, lit) || !hasWords(lit.value)) continue;
          // Literals inside nested JSX in the prop are judged by their own element.
          const nested = a.elements.some((e) => e !== el && e.offset >= at.valueOffset && e.end <= end && lit.offset >= e.offset && lit.offset < e.end);
          if (!nested) add('prop', lit.offset, `${at.name}={${lit.template ? '`' : "'"}${lit.value}...}`);
        }
      }
    }
  }

  // String literals directly inside JSX child expressions: <Text>{locked ? 'Locked' : 'Free'}</Text>.
  for (const ce of a.childExprs) {
    const nestedEls = elementRanges.filter((r) => r.offset >= ce.offset && r.end <= ce.end);
    for (const lit of a.literals) {
      if (lit.offset < ce.offset || lit.offset >= ce.end) continue;
      if (insideAny(lit.offset, nestedEls) || isCodeLiteral(a, lit)) continue;
      if (looksProse(lit.value)) add('jsx-text', lit.offset, lit.value);
    }
  }

  // Object keys with user-facing values: { label: 'Rotate left' }, { text: 'Cancel' }.
  for (const lit of a.literals) {
    if (!hasWords(lit.value)) continue;
    if (TEXT_KEYS.test(before(a, lit.offset))) add('object-label', lit.offset, lit.value);
  }

  // Alert.alert / announceForAccessibility / toast / show calls.
  TEXT_CALLS.lastIndex = 0;
  for (let m = TEXT_CALLS.exec(a.bare); m; m = TEXT_CALLS.exec(a.bare)) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let close = a.bare.length;
    for (let k = open; k < a.bare.length; k++) {
      const ch = a.bare[k];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) {
          close = k;
          break;
        }
      }
    }
    for (const lit of a.literals) {
      if (lit.offset <= open || lit.offset >= close) continue;
      if (isCodeLiteral(a, lit) || !looksProse(lit.value)) continue;
      add('call', lit.offset, `${m[1]}(${lit.template ? '`' : "'"}${lit.value}...)`);
    }
  }

  return out.sort((x, y) => x.line - y.line);
}

// ---------------------------------------------------------------- check b: physical direction styles

const PHYSICAL = /(?<![\w.$])(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft\w*|borderRight\w*|left|right)\s*:\s*([^,}\n]*)/g;

export function findPhysicalDirection(file: string, src: string, pre?: Analysis): Finding[] {
  const a = pre ?? analyzeSource(src);
  const ok = exemptLines(a, 'rtl-physical-ok');
  const out: Finding[] = [];
  const bareLines = lines(a.bare);
  const ncLines = lines(a.noComments);
  for (let L = 0; L < bareLines.length; L++) {
    if (ok.has(L + 1)) continue;
    const line = bareLines[L];
    if (/\bhitSlop\b/.test(line)) continue; // touch padding, not layout
    const hits: { key: string; value: string }[] = [];
    PHYSICAL.lastIndex = 0;
    for (let m = PHYSICAL.exec(line); m; m = PHYSICAL.exec(line)) {
      // Skip ternary branches (`a ? left : right`): the key must follow `{`, `,` or start a line.
      const pre2 = line.slice(0, m.index).trimEnd();
      if (pre2 && !/[{,(]$/.test(pre2)) continue;
      // Type members (`left: number;`) are not styles.
      if (/^(number|string|boolean|undefined|null)\b/.test(m[2].trim())) continue;
      hits.push({ key: m[1], value: m[2].trim() });
    }
    // Mirror-symmetric pairs on one line (left: 0, right: 0 / marginLeft: 8, marginRight: 8) are harmless.
    const pair = (k: string): string => k.replace('Left', 'Right').replace(/^left$/, 'right');
    const sym = new Set<string>();
    for (const h of hits) {
      const other = hits.find((o) => o.key === pair(h.key) && o.key !== h.key && o.value === h.value);
      if (other) {
        sym.add(h.key);
        sym.add(other.key);
      }
    }
    for (const h of hits) {
      if (!sym.has(h.key)) out.push({ check: 'b', rule: 'physical', file, line: L + 1, text: `${h.key}: ${short(h.value)}` });
    }
    const ta = /textAlign\s*:\s*['"](left|right)['"]/.exec(ncLines[L]);
    if (ta) out.push({ check: 'b', rule: 'text-align', file, line: L + 1, text: `textAlign: '${ta[1]}'` });
  }
  return out;
}

// ---------------------------------------------------------------- check c: RTL layout of main screens

const DIRECTIONAL_ICONS = new Set(['chevron-right', 'chevron-left', 'arrow-left', 'arrow-right']);

export function findRtlLayoutIssues(file: string, src: string, pre?: Analysis): Finding[] {
  const a = pre ?? analyzeSource(src);
  const ok = exemptLines(a, 'rtl-physical-ok');
  const out: Finding[] = [];
  for (const lit of a.literals) {
    if (lit.template || !DIRECTIONAL_ICONS.has(lit.value)) continue;
    const line = lineOf(a, lit.offset);
    if (ok.has(line)) continue;
    out.push({ check: 'c', rule: 'chevron', file, line, text: `'${lit.value}' (use forwardChevron()/backChevron())` });
  }
  if (NEVER_MIRROR_SCREENS.includes(file) && !/direction\s*:\s*['"]ltr['"]|\bNEVER_MIRROR\b/.test(a.noComments)) {
    out.push({
      check: 'c',
      rule: 'never-mirror',
      file,
      line: 1,
      text: "no direction: 'ltr' / NEVER_MIRROR wrapper around the camera / overlay / image",
    });
  }
  return out;
}

// ---------------------------------------------------------------- check d: text expansion

const BUTTONISH = /^(Pressable|PressableScale|TouchableOpacity|TouchableHighlight|Button|HeroButton|CameraButton|Animated\.View)$/;
const FIXED_HEIGHT = /(?<![A-Za-z])height\s*:\s*[\w.]/;

function styleBlock(a: Analysis, name: string): string | null {
  const re = new RegExp(`(?<![\\w.$])${name.replace(/[$]/g, '\\$')}\\s*:\\s*\\{`, 'g');
  const m = re.exec(a.bare);
  if (!m) return null;
  let depth = 0;
  for (let k = m.index + m[0].length - 1; k < a.bare.length; k++) {
    if (a.bare[k] === '{') depth++;
    else if (a.bare[k] === '}') {
      depth--;
      if (depth === 0) return a.bare.slice(m.index, k + 1);
    }
  }
  return null;
}

export function findExpansionRisks(file: string, src: string, pre?: Analysis): Finding[] {
  const a = pre ?? analyzeSource(src);
  const ok = exemptLines(a, 'expansion-ok');
  const out: Finding[] = [];
  for (const el of a.elements) {
    for (const at of el.attrs) {
      if (at.name === 'numberOfLines' && at.kind === 'expr' && at.value.trim() === '1') {
        const line = lineOf(a, at.offset);
        if (!ok.has(line)) out.push({ check: 'd', rule: 'number-of-lines', file, line, text: `<${el.tag} numberOfLines={1}> truncates longer translations` });
      }
    }
    if (!BUTTONISH.test(el.tag)) continue;
    const children = a.src.slice(el.childrenStart, el.childrenEnd);
    const hasText =
      /<Text\b|\bt\(/.test(children) || el.attrs.some((x) => ['title', 'label', 'caption', 'text'].includes(x.name));
    if (!hasText) continue;
    const style = el.attrs.find((x) => x.name === 'style' && x.kind === 'expr');
    if (!style) continue;
    let fixed = FIXED_HEIGHT.test(style.value) ? style.value : '';
    if (!fixed) {
      for (const m of style.value.matchAll(/\bstyles\.(\w+)/g)) {
        const block = styleBlock(a, m[1]);
        if (block && FIXED_HEIGHT.test(block)) {
          fixed = `styles.${m[1]}`;
          break;
        }
      }
    }
    if (!fixed) continue;
    const line = lineOf(a, style.offset);
    if (!ok.has(line)) out.push({ check: 'd', rule: 'fixed-height', file, line, text: `<${el.tag}> with text has a fixed height (${short(fixed)}); use minHeight` });
  }
  return out.sort((x, y) => x.line - y.line);
}

/** Every English message's pseudo-locale text is ≥ 1.4× as long and keeps the same placeholders. */
export function checkPseudoExpansion(catalog: Catalog): Finding[] {
  const out: Finding[] = [];
  for (const [key, m] of Object.entries(catalog)) {
    const forms = typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string');
    for (const form of forms) {
      const p = pseudoText(form);
      const len = [...form].length;
      if ([...p].length < Math.ceil(len * 1.4)) out.push({ check: 'd', rule: 'pseudo-length', file: 'src/i18n/en', line: 0, text: `${key}: "${p}"` });
      if (placeholders(p).join() !== placeholders(form).join())
        out.push({ check: 'd', rule: 'pseudo-placeholders', file: 'src/i18n/en', line: 0, text: `${key}: "${p}"` });
    }
  }
  return out;
}

// ---------------------------------------------------------------- check e: numbers stay left-to-right

const LRI = '⁦';
const PDI = '⁩';

/** Percentages, timers and units come out wrapped in Unicode LTR isolates for every locale. */
export function checkLtrIsolation(locales: readonly string[]): Finding[] {
  const out: Finding[] = [];
  for (const loc of locales) {
    const samples: [string, string][] = [
      ['formatPercent(0.42)', formatPercent(0.42, loc)],
      ['formatPercent(1)', formatPercent(1, loc)],
      ['formatDuration(65)', formatDuration(65, loc)],
      ['formatDuration(3725)', formatDuration(3725, loc)],
      ['formatUnit(25, centimeter)', formatUnit(25, 'centimeter', loc)],
    ];
    for (const [what, s] of samples) {
      const inner = s.slice(1, -1);
      if (!s.startsWith(LRI) || !s.endsWith(PDI) || inner.includes(LRI) || inner.includes(PDI)) {
        out.push({ check: 'e', rule: 'ltr-isolate', file: 'src/i18n/core.ts', line: 0, text: `${loc} ${what} = ${JSON.stringify(s)}` });
      }
    }
  }
  return out;
}

export function formatFinding(f: Finding): string {
  return `${f.file}${f.line ? `:${f.line}` : ''} [${f.check}.${f.rule}] ${f.text}`;
}
