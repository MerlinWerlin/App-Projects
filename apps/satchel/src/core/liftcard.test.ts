import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LIFT_CARD, liftCard, liftCardProblems, parseCardParam, showLiftAsk } from './liftcard.ts';
import { hasNonLatin, PHRASE_LANGS, type PhraseTable } from './phrases.ts';
import type { StepFreeTable } from './stepfree.ts';

const json = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const SF = json('../content/stepfree_lines.json') as StepFreeTable;
const PHRASES = json('../content/phrases.json') as PhraseTable;

test('content: every phrase language has the lift line, romanised for non-Latin scripts, all marked for a check', () => {
  assert.deepEqual(liftCardProblems(SF, PHRASES), []);
  for (const l of SF.languages) {
    const r = l.lines.liftAsk.roman;
    if (r) assert.ok(!hasNonLatin(r), `${l.code} roman is Latin`);
  }
  const broken: StepFreeTable = structuredClone(SF);
  const ja = broken.languages.find((l) => l.code === 'ja')!;
  ja.lines.liftAsk = { text: 'エレベーター', check: true };
  const de = broken.languages.find((l) => l.code === 'de')!;
  de.lines.liftAsk = { text: 'Aufzug?' };
  broken.languages = broken.languages.filter((l) => l.code !== 'id');
  const p = liftCardProblems(broken, PHRASES);
  assert.ok(p.includes('ja: lift line has no romanisation'));
  assert.ok(p.includes('de: lift line not marked for a native-speaker check'));
  assert.ok(p.includes('id: no lift line'));
});

test('the lift card in every phrase language: English, local text, roman only for non-Latin, flagged unchecked', () => {
  for (const lang of PHRASE_LANGS) {
    const c = liftCard(SF, PHRASES, lang);
    assert.ok(c, lang);
    assert.equal(c.english, 'Where is the lift (elevator)?');
    assert.ok(c.text.length > 0);
    assert.equal(c.check, true, `${lang}: never claims a native check`);
    const latin = PHRASES.languages.find((l) => l.code === lang)!.latin;
    assert.equal(c.roman === null, latin, lang);
  }
  assert.deepEqual(liftCard(SF, PHRASES, 'ja'), { lang: 'ja', english: 'Where is the lift (elevator)?', text: 'エレベーターはどこですか？', roman: 'Erebētā wa doko desu ka?', check: true });
});

test('a line without a check flag still shows as unchecked; a missing line gives no card', () => {
  const t: StepFreeTable = structuredClone(SF);
  t.languages.find((l) => l.code === 'fr')!.lines.liftAsk = { text: 'Où est l’ascenseur ?' };
  assert.equal(liftCard(t, PHRASES, 'fr')?.check, true);
  t.languages.find((l) => l.code === 'fr')!.lines.liftAsk = { text: '  ', check: true };
  assert.equal(liftCard(t, PHRASES, 'fr'), null);
});

test('phrase-card param: lift opens the lift card, phrase ids open the list, anything else is unknown', () => {
  assert.deepEqual(parseCardParam(LIFT_CARD), { kind: 'lift' });
  assert.deepEqual(parseCardParam(['lift', 'toilet']), { kind: 'lift' });
  assert.deepEqual(parseCardParam('toilet'), { kind: 'phrase', id: 'toilet' });
  assert.equal(parseCardParam('elevator'), null);
  assert.equal(parseCardParam(undefined), null);
  assert.equal(parseCardParam('__proto__'), null);
});

test('map offers "Ask for a lift" only while Lifts are on, with lifts loaded or access needs set', () => {
  assert.equal(showLiftAsk(false, 12, { needs: ['wheelchair'] }), false);
  assert.equal(showLiftAsk(true, 0, { needs: [] }), false);
  assert.equal(showLiftAsk(true, 0, null), false);
  assert.equal(showLiftAsk(true, 3, null), true);
  assert.equal(showLiftAsk(true, 0, { needs: ['pram'] }), true);
  assert.equal(showLiftAsk(true, 0, { needs: ['bogus' as never] }), false);
});
