// Permanent i18n / adaptive-layout scanner tests (owner request 16 Oct, R3; rules in docs/I18N.md).
//
// ENFORCE = false: the source checks still run and print every finding as a test diagnostic, but do not fail.
// Flip ENFORCE (or one entry of ENFORCE_CHECK) to true once the string / start-end migration has merged.
// Set SCAN_VERBOSE=1 to list every finding instead of the first few per check.
// The pure checks (pseudo-locale expansion, LTR-isolated numbers) and the scanner self-tests always enforce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAIN_SCREENS,
  NEVER_MIRROR_SCREENS,
  analyzeSource,
  checkLtrIsolation,
  checkPseudoExpansion,
  findExpansionRisks,
  findHardcodedStrings,
  findPhysicalDirection,
  findRtlLayoutIssues,
  formatFinding,
  type Finding,
} from './scan.ts';
import { LOCALES, pseudoText } from './core.ts';
import { EN } from './catalogs.ts';

const ENFORCE = true;
/** Per-check switches; d (text-expansion layout heuristics) stays diagnostic-only by design. */
const ENFORCE_CHECK = { a: ENFORCE, b: ENFORCE, c: ENFORCE, d: false };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERBOSE = process.env.SCAN_VERBOSE === '1';
const SHOW = 25;

type Ctx = { diagnostic: (message: string) => void };

function walk(dir: string, re: RegExp, out: string[] = []): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs).sort()) {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) walk(relative(ROOT, p), re, out);
    else if (re.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) out.push(relative(ROOT, p).split('\\').join('/'));
  }
  return out;
}

/** UI sources: app/**\/*.tsx and src/ui/**\/*.tsx (plus src/ui hooks in .ts, which announce text too). */
const UI_FILES = [...walk('app', /\.tsx$/), ...walk('src/ui', /\.tsx?$/)];
const read = (f: string): string => readFileSync(join(ROOT, f), 'utf8');

function report(t: Ctx, name: string, findings: Finding[], enforce: boolean): void {
  t.diagnostic(`${name}: ${findings.length} finding(s)${enforce ? '' : ' (not enforced yet)'}`);
  const shown = VERBOSE || enforce ? findings : findings.slice(0, SHOW);
  for (const f of shown) t.diagnostic(formatFinding(f));
  if (shown.length < findings.length) t.diagnostic(`... ${findings.length - shown.length} more (SCAN_VERBOSE=1 lists all)`);
  if (enforce) assert.equal(findings.length, 0, `${name}: ${findings.length} finding(s), see diagnostics`);
}

function over(files: readonly string[], fn: (file: string, src: string) => Finding[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) if (existsSync(join(ROOT, f))) out.push(...fn(f, read(f)));
  return out;
}

// ---------------------------------------------------------------- repo checks

test('scan a: no hard-coded UI strings in app/ and src/ui/', (t) => {
  assert.ok(UI_FILES.length > 5, 'found the UI sources');
  report(t, 'a (hard-coded strings)', over(UI_FILES, findHardcodedStrings), ENFORCE_CHECK.a);
});

test('scan b: start/end instead of physical left/right styles', (t) => {
  report(t, 'b (physical direction)', over(UI_FILES, findPhysicalDirection), ENFORCE_CHECK.b);
});

test('scan c: RTL layout of the main screens (mirrored chevrons, never-mirrored camera/image)', (t) => {
  report(t, 'c (RTL layout)', over(MAIN_SCREENS, findRtlLayoutIssues), ENFORCE_CHECK.c);
});

test('scan d: text expansion risks on the main screens (diagnostic only)', (t) => {
  report(t, 'd (text expansion)', over(MAIN_SCREENS, findExpansionRisks), ENFORCE_CHECK.d);
});

test('d: every English message has a ≥ 1.4× pseudo-locale text with the same placeholders', () => {
  assert.ok(Object.keys(EN).length > 0);
  assert.deepEqual(checkPseudoExpansion(EN).map(formatFinding), []);
});

test('e: percentages, timers and units stay left-to-right isolated in every locale (Arabic included)', () => {
  assert.deepEqual(checkLtrIsolation(LOCALES.map((l) => l.code)).map(formatFinding), []);
  assert.deepEqual(checkLtrIsolation(['ar', 'ar-EG', 'he']).map(formatFinding), []);
});

test('main-screen lists point at real files', () => {
  for (const f of [...MAIN_SCREENS, ...NEVER_MIRROR_SCREENS]) assert.ok(existsSync(join(ROOT, f)), f);
});

// ---------------------------------------------------------------- scanner self-tests (fixtures)

const rules = (fs: Finding[]): string[] =>
  fs.map((f) => `${f.line}:${f.rule}`).sort((x, y) => x.localeCompare(y, 'en', { numeric: true }));

test('scanner a: finds JSX text, text props, labels, alerts and announcements', () => {
  const src = [
    "import { t } from '../src/i18n';", // 1
    'export function S({ n }: { n: number }) {', // 2
    '  const ok = n < 3 && n > 1;', // 3
    "  Alert.alert('Remove photo?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }]);", // 4
    "  AccessibilityInfo.announceForAccessibility(`Saved ${n} photos`);", // 5
    "  const actions = [{ name: 'increment', label: 'Make bigger' }];", // 6
    '  return (', // 7
    '    <View style={{ flex: 1 }}>', // 8
    '      <Text>Hello there</Text>', // 9
    "      <Text>{t('home.title')}</Text>", // 10
    "      <Button title=\"Go back\" icon=\"chevron-left\" accessibilityLabel={n ? 'Locked' : t('trace.free')} />", // 11
    "      <Text>{n === 1 ? 'One photo' : t('home.many', { count: n })}</Text>", // 12
    '      <Text>{n} %</Text>', // 13
    '      <Text>Linework</Text> {/* i18n-ignore */}', // 14
    '      <Segmented<Mode> options={[]} accessibilityLabel="Image style" />', // 15
    "      {mode === 'outline' ? <Text>×</Text> : null}", // 16
    '    </View>', // 17
    '  );', // 18
    '}', // 19
  ].join('\n');
  const found = rules(findHardcodedStrings('fixture.tsx', src));
  assert.deepEqual(found, [
    '4:call',
    '4:call',
    '4:object-label',
    '5:call',
    '6:object-label',
    '9:jsx-text',
    '11:prop',
    '11:prop',
    '12:jsx-text',
    '15:prop',
  ]);
});

test('scanner a: comments, regex literals and strings do not confuse the JSX reader', () => {
  const src = [
    '// <Text>Not code</Text>',
    "const re = /<Text>/g; const s = '<Text>Not JSX</Text>';",
    'const x = a < b ? 1 : 2; const y = useRef<View | null>(null);',
    'const el = () => <Text>{/* comment */}Real text</Text>;',
  ].join('\n');
  assert.deepEqual(rules(findHardcodedStrings('f.tsx', src)), ['4:jsx-text']);
  const a = analyzeSource(src);
  assert.equal(a.src.length, a.bare.length);
  assert.equal(a.src.length, a.noComments.length);
});

test('scanner b: flags physical keys and textAlign, skips symmetric pairs, types and marked regions', () => {
  const src = [
    'const s = StyleSheet.create({', // 1
    '  a: { marginLeft: 8, paddingRight: 4 },', // 2
    "  b: { textAlign: 'left', marginStart: 8 },", // 3
    '  c: { left: 0, right: 0 },', // 4
    '  d: { // rtl-physical-ok', // 5
    '    left: 10,', // 6
    '  },', // 7
    '  e: { right: 2 },', // 8
    '});', // 9
    'type P = { left: number; right: number };', // 10
    '// rtl-physical-ok:begin', // 11
    'const camera = { left: x };', // 12
    '// rtl-physical-ok:end', // 13
    'const z = cond ? left : right;', // 14
    '<Pressable hitSlop={{ left: 8, right: 12 }} />', // 15
  ].join('\n');
  assert.deepEqual(rules(findPhysicalDirection('f.tsx', src)), ['2:physical', '2:physical', '3:text-align', '8:physical']);
});

test('scanner c: hard-coded chevrons and a missing never-mirror wrapper', () => {
  const bad = "<CameraButton icon=\"chevron-left\" />\n<Feather name={'arrow-right'} />";
  assert.deepEqual(rules(findRtlLayoutIssues('app/trace.tsx', bad)), ['1:chevron', '1:never-mirror', '2:chevron']);
  const good = '<Feather name={forwardChevron()} />\n<View style={NEVER_MIRROR}><CameraView /></View>';
  assert.deepEqual(findRtlLayoutIssues('app/trace.tsx', good), []);
  const ltr = "<View style={{ direction: 'ltr' }} />";
  assert.deepEqual(findRtlLayoutIssues('app/lightbox.tsx', ltr), []);
  assert.deepEqual(findRtlLayoutIssues('app/settings.tsx', ''), []);
});

test('scanner d: numberOfLines={1} and fixed-height pressables with text', () => {
  const src = [
    'const x = (<>', // 0 (line 1)
    '<Text numberOfLines={1}>{label}</Text>', // 1
    '<Pressable style={{ height: 44 }}><Text>{t(\'x.y\')}</Text></Pressable>', // 2
    '<Pressable style={{ minHeight: 48 }}><Text>{label}</Text></Pressable>', // 3
    '<Pressable style={styles.btn}><Text>{label}</Text></Pressable>', // 4
    '<Pressable style={{ height: 44 }}><Feather name="x" /></Pressable>', // 5
    '<Text numberOfLines={1}>{label}</Text> // expansion-ok', // 6
    '</>);',
    'const styles = StyleSheet.create({ btn: { height: 40, lineHeight: 20 } });',
  ].join('\n');
  // Fixture lines are shifted by one (the fragment opener is line 1).
  assert.deepEqual(rules(findExpansionRisks('f.tsx', src)), ['2:number-of-lines', '3:fixed-height', '5:fixed-height']);
});

test('pseudo text sanity: placeholders survive, 40% longer', () => {
  const p = pseudoText('Lock {name}');
  assert.ok(p.includes('{name}'));
  assert.ok(p.length >= Math.ceil('Lock {name}'.length * 1.4));
});
