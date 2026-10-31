// T91 (owner-1031 D): the owner's standing rule is timed transitions only, never bounce or springs. This scans every
// .ts / .tsx file under app/ and src/ for spring and bounce animation APIs (React Native Animated, Reanimated,
// LayoutAnimation presets, Easing curves that overshoot, spring physics configs). Use src/theme/motion.ts helpers
// (timed, fadeIn, fadeOut, useFadeRise) instead.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

// Built from parts so this file never matches itself.
const API = (s: string) => new RegExp(s);
export const BANNED: { name: string; re: RegExp }[] = [
  { name: 'Animated.spring', re: API('Animated\\s*\\.\\s*' + 'spring\\b') },
  { name: 'withSpring (Reanimated)', re: API('\\bwith' + 'Spring\\b') },
  { name: 'Easing.bounce', re: API('Easing\\s*\\.\\s*' + 'bounce\\b') },
  { name: 'Easing.elastic', re: API('Easing\\s*\\.\\s*' + 'elastic\\b') },
  { name: 'Easing.back (overshoot)', re: API('Easing\\s*\\.\\s*' + 'back\\b') },
  { name: 'LayoutAnimation spring', re: API('LayoutAnimation\\s*\\.\\s*(' + 'spring\\b|Presets\\s*\\.\\s*spring\\b|Types\\s*\\.\\s*spring\\b)') },
  { name: "LayoutAnimation type 'spring'", re: API("type\\s*:\\s*['\"]" + "spring['\"]") },
  { name: 'springDamping', re: API('\\bspring' + 'Damping\\b') },
  { name: 'spring physics (stiffness / damping config)', re: API('\\b(stiff' + 'ness|damp' + 'ing)\\s*:') },
  { name: 'Reanimated spring layout (springify)', re: API('\\.spring' + 'ify\\s*\\(') },
];

/** The offending `file:line api` entries in one source text (comments are skipped). */
export function springUses(rel: string, text: string): string[] {
  const out: string[] = [];
  text.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const code = line.replace(/\/\/.*$/, '');
    for (const b of BANNED) if (b.re.test(code)) out.push(`${rel}:${i + 1} ${b.name}`);
  });
  return out;
}

const root = new URL('../..', import.meta.url).pathname;
const self = new URL(import.meta.url).pathname;
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f) && p !== self) files.push(p);
  }
};
walk(join(root, 'app'));
walk(join(root, 'src'));

test('no spring or bounce animation API anywhere in app/ or src/ (timed transitions only)', () => {
  assert.ok(files.length > 100, `scanned ${files.length} files`);
  const hits = files.flatMap((f) => springUses(relative(root, f), readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});

test('the scanner catches each banned API and ignores comments and timed code', () => {
  const bad = [
    'Animated.spring(v, { toValue: 1 }).start();',
    'x.value = withSpring(1);',
    'easing: Easing.bounce,',
    'easing: Easing.elastic(2),',
    'easing: Easing.back(1.5),',
    'LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);',
    'LayoutAnimation.spring();',
    "update: { type: 'spring', springDamping: 0.7 },",
    'const cfg = { damping: 18, stiffness: 180 };',
    'entering={FadeIn.springify()}',
  ];
  for (const l of bad) assert.ok(springUses('x.ts', l).length > 0, l);
  const fine = [
    '// no Animated.spring here, timed only',
    ' * Easing.bounce is banned',
    'Animated.timing(v, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true });',
    "LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);",
    "const label = t('trip.springBreak');",
  ];
  for (const l of fine) assert.deepEqual(springUses('x.ts', l), [], l);
});

test('motion.ts exports no spring config any more', () => {
  // Read as text: motion.ts imports react-native, which node cannot load offline.
  const src = readFileSync(new URL('./motion.ts', import.meta.url), 'utf8');
  assert.ok(!/export const spring\b/.test(src));
  assert.match(src, /Animated\.timing/);
});
