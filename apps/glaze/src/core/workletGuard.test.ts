// UI-thread worklet guard (T228, docs/CRASH_1101.md). TestFlight 1.0.1 (17) aborted (SIGABRT) when
// a JS error was thrown inside a reanimated gesture worklet: on iOS an uncaught throw on the UI
// runtime ends the app. This source guard keeps every UI-thread callback crash-proof:
//   1. Every RNGH gesture built WITHOUT .runOnJS(true) (so its callbacks run on the UI thread) and
//      every useAnimatedScrollHandler / useAnimatedReaction / useAnimatedGestureHandler callback
//      has a block body that starts with `try {` and has a `catch` that never rethrows.
//   2. Inside those callbacks and inside the file's own 'worklet' functions, a plain call is only
//      to a worklet declared in the same file, a worklet exported by an allow-listed
//      self-contained worklet module, or a reanimated / worklets / JS primitive. Anything else
//      must be handed over with runOnJS(fn)(...) (the callee then is not a call here).
//   3. The allow-listed worklet modules' 'worklet' functions take no default parameters, read no
//      module-level constants and only call worklets of the same module declared above them.
// A regex / brace-matching "AST-lite" scan: pragmatic, but it fails loudly if it finds nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CROP_RUBBER, MAX_ZOOM, MIN_ZOOM, ZOOM_STRETCH } from './photoCrop.ts';

const root = process.cwd();

/** Self-contained worklet modules whose exported 'worklet' functions UI-thread code may call. */
const WORKLET_MODULES: Record<string, string> = {
  'src/core/photoCrop.ts': 'crop maths for src/ui/PhotoCropEditor.tsx (tested in photoCrop.test.ts)',
};

/** Reanimated / worklets / language primitives callable on the UI runtime. */
const PRIMITIVES = new Set([
  'withTiming',
  'withDecay',
  'withSpring',
  'withDelay',
  'withSequence',
  'withRepeat',
  'cancelAnimation',
  'interpolate',
  'interpolateColor',
  'runOnJS',
  'scheduleOnRN',
  'String',
  'Number',
  'Boolean',
]);
/** Objects whose methods are safe on the UI runtime (Math.max, Number.isFinite, ...). */
const PRIMITIVE_OBJECTS = new Set(['Math', 'Number', 'String', 'Object', 'Array', 'JSON']);
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'void', 'await']);

const GESTURE_RE = /\bGesture\.(Pan|Pinch|Tap|LongPress|Fling|Rotation|Hover|Manual|Native|ForceTouch)\s*\(\s*\)/g;
const GESTURE_CALLBACKS = new Set([
  'onBegin',
  'onStart',
  'onUpdate',
  'onChange',
  'onEnd',
  'onFinalize',
  'onTouchesDown',
  'onTouchesMove',
  'onTouchesUp',
  'onTouchesCancelled',
]);
const HOOK_RE = /\b(useAnimatedScrollHandler|useAnimatedReaction|useAnimatedGestureHandler)\s*\(/g;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Drops block and line comments (a `//` after `:` or a quote, as in a URL, is kept). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\w])\/\/.*$/gm, '$1');
}

/** Index just past the string literal starting at i (quote char at src[i]). */
function skipString(src: string, i: number): number {
  const q = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== q) j += src[j] === '\\' ? 2 : 1;
  return j + 1;
}

/** Index of the bracket closing the one at `open` ((, [ or {), skipping strings. -1 if none. */
function matchClose(src: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(src, i) - 1;
      continue;
    }
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (stack.pop() !== ch) return -1;
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

type Callback = { where: string; body: string };

/** Block body ("{ ... }") of an arrow function whose `=>` is at `arrow`; null for an expression body. */
function arrowBody(src: string, arrow: number): string | null {
  let i = arrow + 2;
  while (/\s/.test(src[i])) i++;
  if (src[i] !== '{') return null;
  const end = matchClose(src, i);
  return end < 0 ? null : src.slice(i, end + 1);
}

/** Arrow functions that are direct arguments of a call whose args are src[open+1..close-1]
 * (also the values of an object literal argument, as in useAnimatedScrollHandler({ onScroll })). */
function topLevelArrows(src: string, open: number, close: number): number[] {
  const found: { at: number; depth: number }[] = [];
  let depth = 0;
  for (let i = open + 1; i < close; i++) {
    const ch = src[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(src, i) - 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === '=' && src[i + 1] === '>') found.push({ at: i, depth });
  }
  if (found.length === 0) return [];
  const min = Math.min(...found.map((f) => f.depth));
  return found.filter((f) => f.depth === min).map((f) => f.at);
}

/** The callbacks of every UI-thread gesture chain in the file (chains with .runOnJS(true) are skipped). */
function gestureCallbacks(src: string, file: string): Callback[] {
  const out: Callback[] = [];
  for (const m of src.matchAll(GESTURE_RE)) {
    let i = (m.index ?? 0) + m[0].length;
    const calls: { name: string; open: number; close: number }[] = [];
    for (;;) {
      const rest = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(src.slice(i));
      if (!rest) break;
      const open = i + rest[0].length - 1;
      const close = matchClose(src, open);
      assert.ok(close > 0, `${file}: unbalanced gesture chain at .${rest[1]}(`);
      calls.push({ name: rest[1], open, close });
      i = close + 1;
    }
    if (calls.some((c) => c.name === 'runOnJS' && /^\s*true\s*$/.test(src.slice(c.open + 1, c.close)))) continue;
    for (const c of calls) {
      if (!GESTURE_CALLBACKS.has(c.name)) continue;
      const arrows = topLevelArrows(src, c.open, c.close);
      const where = `${file}: Gesture.${m[1]}().${c.name}`;
      // A callback passed by name or with an expression body is reported by the try / catch test.
      const body = arrows.length === 1 ? arrowBody(src, arrows[0]) : null;
      out.push({ where, body: body ?? '' });
    }
  }
  return out;
}

/** The function arguments of every useAnimatedScrollHandler / useAnimatedReaction / ... call. */
function hookCallbacks(src: string, file: string): Callback[] {
  const out: Callback[] = [];
  for (const m of src.matchAll(HOOK_RE)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    const close = matchClose(src, open);
    assert.ok(close > 0, `${file}: unbalanced ${m[1]}(`);
    const arrows = topLevelArrows(src, open, close);
    assert.ok(arrows.length > 0, `${file}: ${m[1]} must be given inline arrow callbacks`);
    for (const a of arrows) {
      const where = `${file}: ${m[1]} callback`;
      out.push({ where, body: arrowBody(src, a) ?? '' });
    }
  }
  return out;
}

type WorkletFn = { name: string; params: string; body: string; at: number };

/** Functions in the file marked 'worklet' (function declarations and const arrows). */
function workletFns(src: string): WorkletFn[] {
  const out: WorkletFn[] = [];
  const res = [
    /(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\s*(\([^)]*\))\s*(?::[^{]*)?\{\s*['"]worklet['"]/g,
    /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]*?)?=>\s*\{\s*['"]worklet['"]/g,
  ];
  for (const re of res) {
    for (const m of src.matchAll(re)) {
      const at = m.index ?? 0;
      // The match ends at the 'worklet' directive; its body opens at the last `{` before it.
      const open = src.lastIndexOf('{', at + m[0].length - 1);
      const end = matchClose(src, open);
      assert.ok(end > 0, `unbalanced worklet ${m[1]}`);
      out.push({ name: m[1], params: m[2], body: src.slice(open, end + 1), at });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Plain calls `name(` and member calls `obj.name(` in a body. */
function callsIn(body: string): { plain: string[]; members: string[] } {
  const code = body.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
  const plain: string[] = [];
  const members: string[] = [];
  for (const m of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!KEYWORDS.has(m[1])) plain.push(m[1]);
  }
  for (const m of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g)) members.push(m[1]);
  return { plain, members };
}

/** Names a file imports from `module` (relative path without extension). */
function importsFrom(src: string, fromFile: string, moduleFile: string): string[] {
  const names: string[] = [];
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    const resolved = relative(root, join(root, fromFile, '..', spec)).replace(/\.tsx?$/, '');
    if (resolved !== moduleFile.replace(/\.tsx?$/, '')) continue;
    for (const part of m[1].split(',')) {
      const n = part.trim();
      if (!n || n.startsWith('type ')) continue;
      names.push(n.split(/\s+as\s+/).pop()!.trim());
    }
  }
  return names;
}

const files = [...walk(join(root, 'src')), ...walk(join(root, 'app'))].map((p) => relative(root, p));
const sources = new Map(files.map((f) => [f, stripComments(readFileSync(join(root, f), 'utf8'))]));
const moduleWorklets = new Map<string, Set<string>>();
for (const mod of Object.keys(WORKLET_MODULES)) {
  const src = sources.get(mod);
  assert.ok(src, `allow-listed worklet module ${mod} is missing`);
  moduleWorklets.set(mod, new Set(workletFns(src).map((f) => f.name)));
}

const uiFiles = files.filter((f) => {
  const src = sources.get(f)!;
  return gestureCallbacks(src, f).length > 0 || [...src.matchAll(HOOK_RE)].length > 0;
});

test('the guard finds the UI-thread code it is meant to check', () => {
  assert.ok(uiFiles.includes('src/ui/PhotoCropEditor.tsx'), 'PhotoCropEditor gestures run on the UI thread');
  assert.ok(uiFiles.includes('src/ui/LargeTitleHeader.tsx'));
  assert.ok(uiFiles.includes('app/(tabs)/themes.tsx'));
  // .runOnJS(true) gestures are JS-thread callbacks and are skipped.
  assert.equal(gestureCallbacks(sources.get('src/ui/ShowcaseGrid.tsx')!, 'ShowcaseGrid').length, 0);
  assert.equal(gestureCallbacks(sources.get('src/ui/PhotoCropEditor.tsx')!, 'PhotoCropEditor').length, 9);
});

test('every UI-thread gesture / scroll / reaction callback is wrapped in try { } catch and never rethrows', () => {
  const bad: string[] = [];
  for (const f of uiFiles) {
    const src = sources.get(f)!;
    for (const cb of [...gestureCallbacks(src, f), ...hookCallbacks(src, f)]) {
      if (!/^\{\s*try\s*\{/.test(cb.body)) {
        bad.push(`${cb.where}: needs an inline arrow with a block body that starts with try {`);
        continue;
      }
      const tryOpen = cb.body.indexOf('{', cb.body.indexOf('try'));
      const tryClose = matchClose(cb.body, tryOpen);
      const after = cb.body.slice(tryClose + 1);
      const c = /^\s*catch\s*(\([^)]*\))?\s*\{/.exec(after);
      if (!c) {
        bad.push(`${cb.where}: try needs a catch`);
        continue;
      }
      const catchOpen = tryClose + 1 + c[0].length - 1;
      const catchBody = cb.body.slice(catchOpen, matchClose(cb.body, catchOpen) + 1);
      if (/\bthrow\b/.test(catchBody)) bad.push(`${cb.where}: catch must not rethrow`);
      const rest = cb.body.slice(catchOpen + catchBody.length, -1);
      if (rest.trim() !== '') bad.push(`${cb.where}: nothing may run after the try / catch`);
    }
  }
  assert.deepEqual(bad, []);
});

test('UI-thread code only calls worklets, primitives, or runOnJS-wrapped functions', () => {
  const bad: string[] = [];
  for (const f of uiFiles) {
    const src = sources.get(f)!;
    const local = new Set(workletFns(src).map((w) => w.name));
    const imported = new Set<string>();
    for (const [mod, names] of moduleWorklets) {
      for (const n of importsFrom(src, f, mod)) if (names.has(n)) imported.add(n);
    }
    const bodies: Callback[] = [
      ...gestureCallbacks(src, f),
      ...hookCallbacks(src, f),
      ...workletFns(src).map((w) => ({ where: `${f}: worklet ${w.name}`, body: w.body })),
    ];
    for (const b of bodies) {
      const { plain, members } = callsIn(b.body);
      for (const n of plain) {
        if (!PRIMITIVES.has(n) && !local.has(n) && !imported.has(n)) bad.push(`${b.where} calls ${n}() (not a worklet; wrap in runOnJS)`);
      }
      for (const o of members) {
        if (/^[A-Z]/.test(o) && !PRIMITIVE_OBJECTS.has(o)) bad.push(`${b.where} calls ${o}.*() on the UI thread`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('allow-listed worklet modules: no default params, no module constants, only earlier worklets', () => {
  const bad: string[] = [];
  for (const mod of Object.keys(WORKLET_MODULES)) {
    const src = sources.get(mod)!;
    const fns = workletFns(src);
    const consts = [...src.matchAll(/^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    const allNonWorkletFns = [...src.matchAll(/^(?:export\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    const names = new Set(fns.map((w) => w.name));
    fns.forEach((w, i) => {
      if (/[^=!<>]=(?![=>])/.test(w.params)) bad.push(`${mod}: ${w.name} has a default parameter`);
      const text = w.params + w.body;
      for (const c of consts) if (new RegExp(`\\b${c}\\b`).test(text)) bad.push(`${mod}: ${w.name} reads module constant ${c}`);
      const earlier = new Set(fns.slice(0, i).map((e) => e.name));
      const { plain, members } = callsIn(w.body);
      for (const n of plain) {
        if (PRIMITIVES.has(n)) continue;
        if (!names.has(n)) bad.push(`${mod}: ${w.name} calls non-worklet ${n}()`);
        else if (!earlier.has(n)) bad.push(`${mod}: ${w.name} calls ${n}() declared below it`);
      }
      for (const o of members) if (/^[A-Z]/.test(o) && !PRIMITIVE_OBJECTS.has(o)) bad.push(`${mod}: ${w.name} calls ${o}.*()`);
      for (const n of allNonWorkletFns) {
        if (!names.has(n) && new RegExp(`\\b${n}\\b`).test(w.body)) bad.push(`${mod}: ${w.name} references non-worklet ${n}`);
      }
    });
    assert.ok(fns.length >= 8, `${mod}: expected its crop worklets`);
  }
  assert.deepEqual(bad, []);
});

test('photoCrop worklet literals equal the exported constants', () => {
  // cropZoomShown / cropSettle / rubberInto use these as literals (no captured module constants).
  assert.equal(MIN_ZOOM, 1);
  assert.equal(MAX_ZOOM, 5);
  assert.equal(CROP_RUBBER, 0.55);
  assert.equal(ZOOM_STRETCH, 0.5);
});

test('PhotoCropEditor mounts gestures only for usable sizes and guards withDecay', () => {
  const src = sources.get('src/ui/PhotoCropEditor.tsx')!;
  assert.match(src, /usable\s*\?\s*<LiveCropEditor[^>]*\/>\s*:\s*<StaticCropPreview/);
  assert.match(src, /isUsableSize\(image\) && isUsableSize\(frame\)/);
  assert.doesNotMatch(src.slice(src.indexOf('function StaticCropPreview'), src.indexOf('function LiveCropEditor')), /GestureDetector/);
  // Every withDecay sits behind a finite, ordered clamp and a finite velocity.
  for (const m of src.matchAll(/withDecay\(/g)) {
    const before = src.slice(Math.max(0, (m.index ?? 0) - 200), m.index);
    assert.match(before, /Number\.isFinite\(lo\) && Number\.isFinite\(hi\) && hi - lo >= 0\.5 && Number\.isFinite\(v\)/);
  }
});
