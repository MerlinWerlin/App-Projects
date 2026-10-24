import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertTerms, detectTerms, searchStitches } from './terms.ts';
import { checkCount, findCountIssues, parsePattern, stepLabel } from './pattern.ts';
import {
  amigurumiShape,
  estimateYarn,
  evenly,
  foundationChain,
  hatCrownDiameterCm,
  hookLabel,
  incRoundsForDiameter,
  rescale,
  shapeToText,
  stitchesForWidth,
} from './calc.ts';
import {
  bump,
  dueReminders,
  formatClock,
  formatDuration,
  fromBackup,
  mergeData,
  newCounter,
  newProject,
  parseData,
  serializeData,
  setValue,
  sortProjects,
  startTimer,
  stopTimer,
  timeWorked,
  toBackup,
} from './model.ts';

test('US -> UK converts each stitch once (no chain reaction)', () => {
  assert.equal(convertTerms('sc, hdc, dc, tr', 'US', 'UK'), 'dc, htr, tr, dtr');
  assert.equal(convertTerms('Rnd 3: [sc, inc] x6 (18)', 'US', 'UK'), 'Rnd 3: [dc, inc] x6 (18)');
  assert.equal(convertTerms('sc2tog, skip 1, sl st to join', 'US', 'UK'), 'dc2tog, miss 1, ss to join');
  assert.equal(convertTerms('Single crochet then double crochet', 'US', 'UK'), 'Double crochet then treble crochet');
  assert.equal(convertTerms('half double crochet', 'US', 'UK'), 'half treble crochet');
});

test('UK -> US converts back', () => {
  assert.equal(convertTerms('dc, htr, tr, dtr', 'UK', 'US'), 'sc, hdc, dc, tr');
  assert.equal(convertTerms('ss to join, miss 2, yrh', 'UK', 'US'), 'sl st to join, skip 2, yo');
  assert.equal(convertTerms('Double crochet', 'UK', 'US'), 'Single crochet');
});

test('conversion leaves other words alone', () => {
  const s = 'dec, inc, scissors, stuff, decrease, trim, you';
  assert.equal(convertTerms(s, 'US', 'UK'), s);
  assert.equal(convertTerms('DC', 'US', 'UK'), 'TR');
});

test('detect terms', () => {
  assert.equal(detectTerms('Rnd 2: [sc, inc] x6'), 'US');
  assert.equal(detectTerms('Row 1: htr in each st, ss to join'), 'UK');
  assert.equal(detectTerms('ch 10'), 'unknown');
});

test('stitch search', () => {
  assert.equal(searchStitches('htr')[0].us, 'hdc');
  assert.ok(searchStitches('magic').some((s) => s.us === 'MR'));
});

const AMI = `Cute bear
Materials: DK yarn, 3 mm hook

HEAD
Rnd 1: 6 sc in MR (6)
Rnd 2: inc x6 (12)
Rnd 3: [sc, inc] x6 (18)
Rnds 4-6: sc in each st around (18)
Stuff firmly.
Rnd 7: [sc, dec] x6 (12)

EARS (make 2):
R1: 6 sc in MR (6)
R2: [sc, inc] x3 (9)
Fasten off.`;

test('parse pattern: sections, ranges, notes, counts', () => {
  const p = parsePattern(AMI);
  assert.deepEqual(p.sections, ['Head', 'Ears (make 2)']);
  assert.equal(p.steps.length, 9);
  assert.equal(p.steps[3].n, 4);
  assert.deepEqual(p.steps[5].of, { k: 3, total: 3 });
  assert.equal(stepLabel(p.steps[4]), 'Rnd 5 · 2 of 3');
  assert.deepEqual(p.steps[6].notes, ['Stuff firmly.']);
  assert.equal(p.steps[6].count, 12);
  assert.equal(p.steps[7].section, p.sections[1]);
  assert.ok(p.intro.some((l) => l.startsWith('Materials')));
  assert.deepEqual(p.outro, ['Fasten off.']);
});

test('parse rows and odd labels', () => {
  const p = parsePattern('Row 1 (RS): ch 1, sc across. (20 sts)\nRow 2. ch 3, dc across – 20 sts\nRows 3, 5 and 7: repeat row 1');
  assert.equal(p.steps.length, 5);
  assert.equal(p.steps[0].kind, 'row');
  assert.equal(p.steps[0].count, 20);
  assert.equal(p.steps[1].count, 20);
  assert.equal(p.steps[4].n, 7);
});

test('parse never throws on junk', () => {
  const p = parsePattern('hello\n\n\nworld');
  assert.equal(p.steps.length, 0);
  assert.deepEqual(p.intro, ['hello', 'world']);
});

test('count check', () => {
  assert.deepEqual(checkCount('6 sc in MR (6)'), { made: 6, used: 0 });
  assert.deepEqual(checkCount('inc x6 (12)', 6), { made: 12, used: 6 });
  assert.deepEqual(checkCount('[sc, inc] x6 (18)', 12), { made: 18, used: 12 });
  assert.deepEqual(checkCount('(sc 2, inc) 6 times', 18), { made: 24, used: 18 });
  assert.deepEqual(checkCount('sc in each st around (24)', 24), { made: 24, used: 24 });
  assert.deepEqual(checkCount('[sc 2, dec] x6', 24), { made: 18, used: 24 });
  assert.deepEqual(checkCount('sc 3, inc, sc 3', 7), { made: 8, used: 7 });
  assert.equal(checkCount('ch 3, dc in each st', 10), undefined);
});

test('finds a wrong stitch count', () => {
  const p = parsePattern('Rnd 1: 6 sc in MR (6)\nRnd 2: inc x6 (12)\nRnd 3: [sc, inc] x6 (20)\nRnd 4: [sc 2, inc] x6 (24)');
  const issues = findCountIssues(p.steps);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].i, 2);
  assert.equal(issues[0].got, 18);
});

test('evenly increase/decrease', () => {
  assert.equal(evenly(12, 18)?.text, '[sc, inc] x6');
  assert.equal(evenly(18, 24)?.text, '[sc 2, inc] x6');
  assert.equal(evenly(24, 18)?.text, '[sc 2, dec] x6');
  const odd = evenly(20, 27)!;
  assert.equal(odd.groups.reduce((a, b) => a + b, 0) + 7, 20);
  assert.equal(evenly(10, 25), null);
  assert.equal(evenly(10, 4), null);
  assert.equal(evenly(10, 10)?.change, 0);
});

test('amigurumi ball stitch counts are consistent', () => {
  const rounds = amigurumiShape({ incRounds: 6 });
  assert.equal(rounds[0].count, 6);
  assert.equal(Math.max(...rounds.map((r) => r.count)), 36);
  assert.equal(rounds[rounds.length - 1].count, 6);
  // Every round's instruction makes the stated count from the previous round.
  let prev: number | undefined;
  for (const r of rounds) {
    const c = checkCount(r.text, prev);
    assert.ok(c, `countable: ${r.text}`);
    assert.equal(c!.made, r.count, `round ${r.n}: ${r.text}`);
    if (prev != null) assert.equal(c!.used, prev, `uses round ${r.n}`);
    prev = r.count;
  }
  assert.ok(shapeToText(rounds).includes('Rnd 7: sc in each st around (36)'));
});

test('gauge helpers', () => {
  assert.equal(stitchesForWidth(50, 18, 10), 90);
  assert.equal(rescale(60, 20, 18), 54);
  assert.equal(foundationChain(30, 'dc'), 33);
  assert.equal(hatCrownDiameterCm(56), 17);
  assert.equal(incRoundsForDiameter(6, 20), 6);
  assert.equal(hookLabel(5), '5.0 mm (US H-8)');
});

test('yarn estimate', () => {
  const e = estimateYarn(127, 152, 4, 'sc', 200);
  assert.ok(e.metres > 1200 && e.metres < 2000, String(e.metres));
  assert.ok(e.balls! >= 8);
});

test('counter repeat wraps and bumps parent, undo restores', () => {
  const rep = newCounter('Repeats');
  const rows = newCounter('Stripe', { every: 3, parentId: rep.id });
  let cs = [rep, rows];
  const seq: string[] = [];
  for (let i = 0; i < 7; i++) {
    cs = bump(cs, rows.id, 1);
    seq.push(`${cs[1].value}/${cs[0].value}`);
  }
  assert.deepEqual(seq, ['1/0', '2/0', '3/1', '1/1', '2/1', '3/2', '1/2']);
  for (let i = 0; i < 7; i++) cs = bump(cs, rows.id, -1);
  assert.equal(cs[1].value, 0);
  assert.equal(cs[0].value, 0);
  cs = bump(cs, rows.id, -1);
  assert.equal(cs[1].value, 0);
  assert.equal(setValue(cs, rows.id, 99)[1].value, 3);
});

test('reminders', () => {
  const r = [{ id: 'a', from: 4, every: 4, text: 'decrease' }, { id: 'b', from: 1, every: 2, until: 5, text: 'colour' }];
  assert.deepEqual(dueReminders(r, 8).map((x) => x.id), ['a']);
  assert.deepEqual(dueReminders(r, 5).map((x) => x.id), ['b']);
  assert.deepEqual(dueReminders(r, 7).map((x) => x.id), []);
});

test('timer', () => {
  let p = newProject('x', 0);
  p = startTimer(p, 1000);
  assert.equal(timeWorked(p, 61000), 60000);
  p = stopTimer(p, 121000);
  assert.equal(p.timeMs, 120000);
  assert.equal(formatDuration(3_900_000), '1 h 05 min');
  assert.equal(formatClock(65_000), '1:05');
});

test('data round-trips and tolerates junk', () => {
  const p = newProject('Bear', 1);
  const d = { v: 1 as const, projects: [p], yarns: [] };
  assert.deepEqual(parseData(serializeData(d)).projects[0].name, 'Bear');
  assert.deepEqual(parseData('{bad').projects, []);
  assert.deepEqual(parseData(JSON.stringify({ projects: [{ nope: 1 }, { id: 'x', counters: 'no' }] })).projects.length, 1);
  const back = fromBackup(toBackup(d));
  assert.equal(back?.projects[0].id, p.id);
  assert.equal(fromBackup('{"data":{}}'), null);
  const merged = mergeData(d, { v: 1, projects: [{ ...p, name: 'Bear 2', updatedAt: 5 }], yarns: [] });
  assert.equal(merged.projects.length, 1);
  assert.equal(merged.projects[0].name, 'Bear 2');
});

test('sort puts pinned, then active, newest first', () => {
  const a = { ...newProject('a', 1), status: 'finished' as const };
  const b = { ...newProject('b', 2) };
  const c = { ...newProject('c', 3), pinned: true, status: 'planned' as const };
  assert.deepEqual(sortProjects([a, b, c]).map((p) => p.name), ['c', 'b', 'a']);
});

test('the bundled sample pattern parses cleanly with correct counts', async () => {
  const { SAMPLE_BALL } = await import('../content/samples.ts');
  const p = parsePattern(SAMPLE_BALL.text);
  assert.deepEqual(p.sections, ['Body', 'Leaf (make 2)']);
  assert.equal(p.steps.filter((s) => s.section === 'Body').length, 14);
  assert.deepEqual(findCountIssues(p.steps), []);
});

test('every bundled free pattern verifies on every round', async () => {
  const { SAMPLES_EXTRA } = await import('../content/samplesExtra.ts');
  assert.ok(SAMPLES_EXTRA.length >= 5);
  for (const s of SAMPLES_EXTRA) {
    const p = parsePattern(s.text);
    assert.deepEqual(findCountIssues(p.steps), [], s.name);
    let prev: number | undefined;
    let sec = '';
    for (const st of p.steps) {
      if (st.section !== sec) {
        prev = undefined;
        sec = st.section;
      }
      const c = checkCount(st.text, prev);
      assert.ok(c, `${s.name}: uncountable "${st.text}"`);
      prev = c!.made;
    }
  }
});

test('translations keep placeholders and plural bars', async () => {
  const { en } = await import('../i18n/en.ts');
  for (const code of ['es', 'fr', 'de', 'pt', 'it', 'nl']) {
    const mod = (await import(`../i18n/${code}.ts`)) as Record<string, Record<string, string>>;
    const cat = mod[code];
    assert.ok(Object.keys(cat).length > 300, code);
    for (const [k, v] of Object.entries(cat)) {
      const src = (en as Record<string, string>)[k];
      assert.ok(src, `${code}: unknown key ${k}`);
      const ph = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
      assert.equal(ph(v), ph(src), `${code} ${k}`);
    }
  }
});
