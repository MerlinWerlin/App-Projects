import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { troubles } from '../i18n/en/troubles.ts';
import { displayRow, type EmergencyRow } from './emergency.ts';
import type { EmergencyCard } from './model.ts';
import { PHRASE_IDS } from './phrases.ts';
import {
  checkTable,
  cleanNumbers,
  cleanProgress,
  emergencyNumber,
  findGuide,
  groupNumbers,
  GUIDANCE_KEY,
  guideKeys,
  guidesInProgress,
  hasNumberErrors,
  IMPORTANT_NUMBERS_KEY,
  isTicked,
  MAX_STEPS,
  MIN_STEPS,
  NUMBER_GROUPS,
  numbersIn,
  parseAction,
  progressOf,
  removeNumber,
  resetGuide,
  resolveAction,
  stepActions,
  toggleStep,
  upsertNumber,
  validateNumber,
  type ImportantNumber,
  type TroubleContext,
  type TroubleGuide,
  type TroubleTable,
} from './troubles.ts';

const TABLE = JSON.parse(readFileSync(new URL('../content/troubles.json', import.meta.url), 'utf8')) as TroubleTable;
const PHRASES = JSON.parse(readFileSync(new URL('../content/phrases.json', import.meta.url), 'utf8')) as { phrases: { id: string; en: string }[] };
const has = (k: string) => Object.prototype.hasOwnProperty.call(en, k);

const row = (over: Partial<EmergencyRow> = {}): EmergencyRow => ({
  iso2: 'JP',
  country: 'Japan',
  general: null,
  police: '110',
  ambulance: '119',
  fire: '119',
  tourist_police: null,
  source_url: null,
  source_checked: null,
  confidence: 'high',
  ...over,
});

const EMPTY: EmergencyCard = { contacts: [] };
const ctx = (over: Partial<TroubleContext> = {}): TroubleContext => ({ row: null, card: EMPTY, numbers: [], docs: [], hotel: null, phraseIds: PHRASE_IDS, ...over });
const guide = (id: string) => {
  const g = findGuide(TABLE, id);
  assert.ok(g, id);
  return g;
};

// ------------------------------------------------------------------ content

test('content: the eight guides the owner asked for, in order', () => {
  assert.deepEqual(
    TABLE.guides.map((g) => g.id),
    ['passport', 'card', 'phone', 'theft', 'flight', 'bag', 'medical', 'scam'],
  );
});

test('content: every guide has 5 or more steps (and at most 9)', () => {
  for (const g of TABLE.guides) {
    assert.ok(g.steps.length >= MIN_STEPS, `${g.id}: ${g.steps.length} steps`);
    assert.ok(g.steps.length <= MAX_STEPS, `${g.id}: ${g.steps.length} steps`);
  }
  assert.equal(MIN_STEPS, 5);
});

test('content: the table passes its own check (ids, tones, actions, phrases that exist)', () => {
  assert.deepEqual(checkTable(TABLE, PHRASE_IDS), []);
});

test('content: every step title and body key exists in the en strings', () => {
  for (const g of TABLE.guides) for (const k of guideKeys(g)) assert.ok(has(k), `missing ${k}`);
});

test('content: every guide shows the general guidance line', () => {
  assert.equal(en[GUIDANCE_KEY as keyof typeof en], 'General guidance — check with local authorities, your bank or your insurer.');
  for (const g of TABLE.guides) assert.ok(guideKeys(g).includes(GUIDANCE_KEY), g.id);
  // ...and the guide screen renders it unconditionally, above the steps.
  const screen = readFileSync(new URL('../../app/trouble/[id].tsx', import.meta.url), 'utf8');
  assert.match(screen, /t\(GUIDANCE_KEY\b|t\('trouble\.guidance'\)/);
});

test('content: no unused trouble.step / trouble.guide strings (every string belongs to a step in the JSON)', () => {
  const used = new Set(TABLE.guides.flatMap(guideKeys));
  for (const k of Object.keys(troubles)) if (/^trouble\.(step|guide)\./.test(k)) assert.ok(used.has(k), `unused ${k}`);
});

test('content: guide text has no prices, digits, currency signs or web links', () => {
  for (const [k, v] of Object.entries(troubles)) {
    if (!/^trouble\.(step|guide)\./.test(k)) continue;
    assert.doesNotMatch(v, /\d/, k);
    assert.doesNotMatch(v, /[$€£¥₹₩฿]/, k);
    assert.doesNotMatch(v, /https?:|www\./i, k);
  }
});

test('content: no step promises a legal outcome ("you are entitled", "by law", "guaranteed")', () => {
  for (const [k, v] of Object.entries(troubles)) assert.doesNotMatch(v, /entitled|by law|legally|guarantee|compensation of/i, k);
});

test('content: every trouble.* key is prefixed and step bodies stay concise', () => {
  for (const [k, v] of Object.entries(troubles)) {
    assert.ok(k.startsWith('trouble.'), k);
    assert.ok(v.trim().length > 0, k);
    if (k.endsWith('.title') && k.startsWith('trouble.step.')) assert.ok(v.length <= 60, `${k} too long`);
    if (k.endsWith('.body') && k.startsWith('trouble.step.')) assert.ok(v.length <= 220, `${k} too long`);
  }
});

test('content: phrase actions point at phrases that really exist (none invented)', () => {
  const ids = new Set(PHRASES.phrases.map((p) => p.id));
  const used = TABLE.guides.flatMap((g) => g.steps.flatMap((s) => s.actions)).filter((a) => a.startsWith('phrase:'));
  assert.ok(used.includes('phrase:police'));
  for (const a of used) {
    const id = a.slice('phrase:'.length);
    assert.ok(ids.has(id), a);
    assert.ok(has(`trouble.act.phrase.${id}`), `label for ${a}`);
  }
  assert.equal(PHRASES.phrases.find((p) => p.id === 'police')?.en, 'Please call the police.');
});

test('content: every number group and setup has its label', () => {
  for (const g of NUMBER_GROUPS) {
    assert.ok(has(`trouble.group.${g}`), g);
    assert.ok(has(`trouble.groupOne.${g}`), g);
  }
  for (const s of ['police', 'ambulance', 'general']) assert.ok(has(`trouble.act.emergency.${s}`), s);
});

test('content: the guides use the actions the brief asks for', () => {
  const all = new Set(TABLE.guides.flatMap((g) => g.steps.flatMap((s) => s.actions)));
  for (const a of ['call:police', 'call:ambulance', 'insurer', 'numbers:cardBlock', 'numbers:embassy', 'numbers:airline', 'numbers:accommodation', 'vault:passport', 'hotel', 'phrase:police'])
    assert.ok(all.has(a), a);
});

// ------------------------------------------------------------------ parsing and checks

test('parseAction: known forms parse, everything else is null', () => {
  assert.deepEqual(parseAction('call:police'), { type: 'call', service: 'police' });
  assert.deepEqual(parseAction('numbers:embassy'), { type: 'numbers', group: 'embassy' });
  assert.deepEqual(parseAction('vault:passport'), { type: 'vault', kind: 'passport' });
  assert.deepEqual(parseAction('phrase:police'), { type: 'phrase', phrase: 'police' });
  assert.deepEqual(parseAction('insurer'), { type: 'insurer' });
  assert.deepEqual(parseAction('hotel'), { type: 'hotel' });
  assert.deepEqual(parseAction('help'), { type: 'help' });
  assert.deepEqual(parseAction('contact'), { type: 'contact' });
  for (const bad of ['', 'call', 'call:fire', 'numbers:bank', 'vault:diary', 'phrase:', 'phrase:a-b', 'insurer:x', 'hotel:x', 'nope', 'call:police:x'])
    assert.equal(parseAction(bad), null, bad);
});

test('checkTable: reports bad ids, step counts, unknown actions, missing phrases and duplicates', () => {
  const bad: TroubleTable = {
    version: 1,
    guides: [
      { id: 'a', icon: 'x', tone: 'sea', steps: [{ id: 's', actions: ['call:fire', 'phrase:dance'] }] },
      { id: 'a', icon: 'Bad Icon', tone: 'pink' as never, steps: Array.from({ length: 10 }, (_, i) => ({ id: `s${'abcdefghij'[i]}`, actions: [] })) },
    ],
  };
  const out = checkTable(bad, PHRASE_IDS);
  assert.ok(out.includes('guide a: 1 steps'));
  assert.ok(out.includes('step a.s: unknown action call:fire'));
  assert.ok(out.includes('step a.s: no phrase dance'));
  assert.ok(out.includes('guide a: duplicate'));
  assert.ok(out.includes('guide a: unknown tone pink'));
  assert.ok(out.includes('guide a: bad icon Bad Icon'));
  assert.ok(out.includes('guide a: 10 steps'));
});

test('findGuide: by id, null for unknown or missing', () => {
  assert.equal(findGuide(TABLE, 'bag')?.id, 'bag');
  assert.equal(findGuide(TABLE, 'nope'), null);
  assert.equal(findGuide(TABLE, undefined), null);
  assert.equal(findGuide(TABLE, ''), null);
});

// ------------------------------------------------------------------ progress

test('progress: tick, untick, guide order, start over', () => {
  const g = guide('card');
  let p = {};
  p = toggleStep(p, g, 'police');
  p = toggleStep(p, g, 'block');
  assert.deepEqual(p, { card: ['block', 'police'] });
  assert.ok(isTicked(p, 'card', 'block'));
  assert.ok(!isTicked(p, 'card', 'others'));
  assert.deepEqual(progressOf(g, p), { done: 2, total: 7, fraction: 2 / 7, state: 'started', nextStep: 'others' });
  p = toggleStep(p, g, 'block');
  assert.deepEqual(p, { card: ['police'] });
  p = toggleStep(p, g, 'police');
  assert.deepEqual(p, {});
  assert.equal(progressOf(g, p).state, 'new');
  assert.equal(progressOf(g, p).nextStep, 'block');
});

test('progress: unknown step ids are ignored', () => {
  const g = guide('card');
  const p = { card: ['block'] };
  assert.equal(toggleStep(p, g, 'fly'), p);
});

test('progress: all done', () => {
  const g = guide('bag');
  let p = {};
  for (const s of g.steps) p = toggleStep(p, g, s.id);
  const pr = progressOf(g, p);
  assert.equal(pr.state, 'done');
  assert.equal(pr.fraction, 1);
  assert.equal(pr.nextStep, null);
});

test('resetGuide clears one guide only and keeps the object when nothing to clear', () => {
  const p = { card: ['block'], bag: ['desk'] };
  assert.deepEqual(resetGuide(p, 'card'), { bag: ['desk'] });
  assert.equal(resetGuide(p, 'phone'), p);
});

test('cleanProgress drops unknown guides, unknown steps, non-arrays and junk', () => {
  assert.deepEqual(cleanProgress(null, TABLE), {});
  assert.deepEqual(cleanProgress([], TABLE), {});
  assert.deepEqual(cleanProgress('x', TABLE), {});
  assert.deepEqual(cleanProgress({ card: ['police', 'zzz', 'block', 'block'], nope: ['x'], bag: 'desk', phone: [] }, TABLE), { card: ['block', 'police'] });
});

test('guidesInProgress counts started guides only (not finished ones)', () => {
  const bag = guide('bag');
  let p = { card: ['block'], phone: ['ring'] } as Record<string, string[]>;
  for (const s of bag.steps) p = toggleStep(p, bag, s.id);
  assert.equal(guidesInProgress(TABLE, p), 2);
  assert.equal(guidesInProgress(TABLE, {}), 0);
});

// ------------------------------------------------------------------ important numbers

const N = (id: string, group: ImportantNumber['group'], label = id, phone = '+44 20 7946 0000'): ImportantNumber => ({ id, group, label, phone });

test('cleanNumbers: keeps valid rows, drops junk, defaults unknown groups to other', () => {
  const out = cleanNumbers([
    N('a', 'cardBlock', 'Bank'),
    { id: 'b', group: 'weird', label: ' Taxi ', phone: '+1 555 0100' },
    { id: 'c', group: 'airline', label: '', phone: '+1 555 0100' },
    { id: 'd', group: 'airline', label: 'No phone', phone: 'abc' },
    { id: 'a', group: 'airline', label: 'Dupe', phone: '+1 555 0100' },
    null,
    'x',
    { group: 'airline', label: 'No id', phone: '+1 555 0100' },
  ]);
  assert.deepEqual(out, [N('a', 'cardBlock', 'Bank'), { id: 'b', group: 'other', label: 'Taxi', phone: '+1 555 0100' }]);
  assert.deepEqual(cleanNumbers('nope'), []);
  assert.deepEqual(cleanNumbers(undefined), []);
});

test('validateNumber: label and phone required, phone must be a plain dialable number', () => {
  assert.deepEqual(validateNumber('', ''), { label: 'required', phone: 'required' });
  assert.deepEqual(validateNumber('Bank', '+44 (0)20 7946-0000'), {});
  assert.deepEqual(validateNumber('Bank', 'call me'), { phone: 'invalid' });
  assert.deepEqual(validateNumber('Bank', '+44 20 7946 0000 ext 2'), { phone: 'invalid' });
  assert.deepEqual(validateNumber('Bank', '*#06#'), { phone: 'invalid' });
  assert.deepEqual(validateNumber('x'.repeat(61), '123'), { label: 'tooLong' });
  assert.ok(hasNumberErrors(validateNumber('', '1')));
  assert.ok(!hasNumberErrors(validateNumber('Embassy', '+81 3 0000 0000')));
});

test('upsertNumber adds, edits in place (trimmed); removeNumber deletes', () => {
  let list: ImportantNumber[] = [];
  list = upsertNumber(list, N('a', 'airline'));
  list = upsertNumber(list, N('b', 'embassy'));
  list = upsertNumber(list, { id: 'a', group: 'airline', label: '  Airline desk ', phone: ' +1 555 ' });
  assert.deepEqual(list.map((n) => [n.id, n.label, n.phone]), [
    ['a', 'Airline desk', '+1 555'],
    ['b', 'b', '+44 20 7946 0000'],
  ]);
  assert.deepEqual(removeNumber(list, 'a').map((n) => n.id), ['b']);
  assert.deepEqual(removeNumber(list, 'zz').length, 2);
});

test('groupNumbers: fixed group order, empty groups left out, add order kept', () => {
  const list = [N('o', 'other'), N('a1', 'airline'), N('c', 'cardBlock'), N('a2', 'airline')];
  assert.deepEqual(
    groupNumbers(list).map((g) => [g.group, g.numbers.map((n) => n.id)]),
    [
      ['cardBlock', ['c']],
      ['airline', ['a1', 'a2']],
      ['other', ['o']],
    ],
  );
  assert.deepEqual(groupNumbers([]), []);
  assert.deepEqual(numbersIn(list, 'embassy'), []);
});

test('important numbers never go in a trip file: separate key, and tripfile never reads it', () => {
  assert.equal(IMPORTANT_NUMBERS_KEY, 'satchel.importantNumbers.v1');
  const tripfile = readFileSync(new URL('./tripfile.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(tripfile, /importantNumbers|IMPORTANT_NUMBERS_KEY|troubles/);
  const exporter = readFileSync(new URL('../ui/TripExport.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(exporter, /importantNumbers|IMPORTANT_NUMBERS_KEY|troubles/);
});

// ------------------------------------------------------------------ actions

test('emergencyNumber: own line, else the general number, else the 112 fallback', () => {
  const jp = displayRow(row());
  assert.deepEqual(emergencyNumber(jp, 'police'), { number: '110', fallback: false });
  assert.deepEqual(emergencyNumber(jp, 'ambulance'), { number: '119', fallback: false });
  assert.deepEqual(emergencyNumber(jp, 'general'), { number: '110', fallback: false });
  const eu = displayRow(row({ iso2: 'FR', country: 'France', general: '112', police: null, ambulance: '15', fire: null }));
  assert.deepEqual(emergencyNumber(eu, 'police'), { number: '112', fallback: false });
  assert.deepEqual(emergencyNumber(eu, 'ambulance'), { number: '15', fallback: false });
  assert.deepEqual(emergencyNumber(eu, 'general'), { number: '112', fallback: false });
  const none = displayRow(row({ police: null, ambulance: null, fire: null }));
  assert.deepEqual(emergencyNumber(none, 'police'), { number: '112', fallback: true });
});

test('resolveAction call: needs a country, else offers to choose one', () => {
  assert.deepEqual(resolveAction({ type: 'call', service: 'police' }, ctx()), [{ type: 'setup', need: 'country' }]);
  assert.deepEqual(resolveAction({ type: 'call', service: 'police' }, ctx({ row: displayRow(row()) })), [{ type: 'emergency', service: 'police', number: '110', fallback: false }]);
});

test('resolveAction insurer: uses the emergency card phone; blank or undialable asks to add it', () => {
  assert.deepEqual(resolveAction({ type: 'insurer' }, ctx()), [{ type: 'setup', need: 'card' }]);
  assert.deepEqual(resolveAction({ type: 'insurer' }, ctx({ card: { contacts: [], insurer: 'X', insurerPhone: 'n/a' } })), [{ type: 'setup', need: 'card' }]);
  assert.deepEqual(resolveAction({ type: 'insurer' }, ctx({ card: { contacts: [], insurer: ' Acme ', insurerPhone: ' +44 1 ' } })), [{ type: 'insurer', name: 'Acme', number: '+44 1' }]);
  assert.deepEqual(resolveAction({ type: 'insurer' }, ctx({ card: { contacts: [], insurerPhone: '+44 1' } })), [{ type: 'insurer', name: '', number: '+44 1' }]);
});

test('resolveAction contact: every dialable emergency contact', () => {
  const card: EmergencyCard = { contacts: [{ id: 'c1', name: 'Sam', phone: '+1 555' }, { id: 'c2', name: 'Bad', phone: 'x' }] };
  assert.deepEqual(resolveAction({ type: 'contact' }, ctx({ card })), [{ type: 'contact', id: 'c1', name: 'Sam', number: '+1 555' }]);
  assert.deepEqual(resolveAction({ type: 'contact' }, ctx()), [{ type: 'setup', need: 'card' }]);
});

test('resolveAction numbers: each number of the group, else a link to add one', () => {
  const numbers = [N('e1', 'embassy', 'Embassy'), N('a1', 'airline', 'Airline'), N('e2', 'embassy', 'Consulate')];
  assert.deepEqual(
    resolveAction({ type: 'numbers', group: 'embassy' }, ctx({ numbers })).map((r) => (r.type === 'number' ? r.label : r.type)),
    ['Embassy', 'Consulate'],
  );
  assert.deepEqual(resolveAction({ type: 'numbers', group: 'cardBlock' }, ctx({ numbers })), [{ type: 'setup', need: 'numbers', group: 'cardBlock' }]);
});

test('resolveAction vault: first document of the kind, else a link to the vault', () => {
  const docs = [
    { id: 'v', kind: 'visa' as const, label: 'Visa' },
    { id: 'p1', kind: 'passport' as const, label: 'My passport' },
    { id: 'p2', kind: 'passport' as const, label: 'Old passport' },
  ];
  assert.deepEqual(resolveAction({ type: 'vault', kind: 'passport' }, ctx({ docs })), [{ type: 'doc', id: 'p1', kind: 'passport', label: 'My passport' }]);
  assert.deepEqual(resolveAction({ type: 'vault', kind: 'licence' }, ctx({ docs })), [{ type: 'setup', need: 'vault', kind: 'licence' }]);
});

test('resolveAction hotel and phrase: shown only when they exist (never an empty card or an invented phrase)', () => {
  assert.deepEqual(resolveAction({ type: 'hotel' }, ctx()), []);
  assert.deepEqual(resolveAction({ type: 'hotel' }, ctx({ hotel: { id: 'h', name: 'Inn' } })), [{ type: 'hotel', id: 'h', name: 'Inn' }]);
  assert.deepEqual(resolveAction({ type: 'phrase', phrase: 'police' }, ctx()), [{ type: 'phrase', phrase: 'police' }]);
  assert.deepEqual(resolveAction({ type: 'phrase', phrase: 'police' }, ctx({ phraseIds: ['toilet'] })), []);
  assert.deepEqual(resolveAction({ type: 'help' }, ctx()), [{ type: 'help' }]);
});

test('stepActions: in listed order, unknown actions skipped, repeated set-up links shown once', () => {
  const step = { id: 's', actions: ['insurer', 'bogus', 'contact', 'phrase:police', 'hotel'] };
  assert.deepEqual(stepActions(step, ctx()), [{ type: 'setup', need: 'card' }, { type: 'phrase', phrase: 'police' }]);
  const full = ctx({ card: { contacts: [{ id: 'c', name: 'Kim', phone: '+1 2' }], insurerPhone: '+1 3' }, hotel: { id: 'h', name: 'Inn' } });
  assert.deepEqual(
    stepActions(step, full).map((r) => r.type),
    ['insurer', 'contact', 'phrase', 'hotel'],
  );
});

test('every step of every guide resolves without throwing, with and without saved data', () => {
  const full = ctx({
    row: displayRow(row()),
    card: { contacts: [{ id: 'c', name: 'Kim', phone: '+1 2' }], insurer: 'Ins', insurerPhone: '+1 3' },
    numbers: NUMBER_GROUPS.map((g) => N(g, g)),
    docs: [
      { id: 'p', kind: 'passport', label: 'Passport' },
      { id: 'l', kind: 'licence', label: 'Licence' },
    ],
    hotel: { id: 'h', name: 'Inn' },
  });
  for (const g of TABLE.guides as TroubleGuide[]) {
    for (const s of g.steps) {
      assert.ok(Array.isArray(stepActions(s, ctx())));
      const out = stepActions(s, full);
      assert.equal(out.filter((r) => r.type === 'setup').length, 0, `${g.id}.${s.id} still asks for set-up`);
      assert.equal(out.length >= s.actions.length, true, `${g.id}.${s.id}`);
    }
  }
});
