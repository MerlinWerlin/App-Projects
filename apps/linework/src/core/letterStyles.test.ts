// Letters (owner 24 Oct 2026): one template per character in many styles, grouped by style tiles on Templates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { TEMPLATES } from './templates.ts';
import { LETTER_STYLES, inLetterStyle, letterStyleCounts, letterStyleOf, letterStyleSample } from './letterStyles.ts';
import { CATALOGS } from '../i18n/catalogs.ts';
import { LOCALES } from '../i18n/core.ts';

const LETTERS = TEMPLATES.filter((t) => t.id.startsWith('char-'));
const STYLES = LETTER_STYLES.filter((s) => s !== 'words');
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

test('there are hundreds of letters in at least 12 styles, all in the Letters category', () => {
  assert.ok(LETTERS.length >= 500, `${LETTERS.length}`);
  assert.ok(STYLES.length >= 12);
  for (const t of LETTERS) {
    assert.equal(t.category, 'lettering', t.id);
    assert.ok(STYLES.includes(letterStyleOf(t) as (typeof STYLES)[number]), t.id);
    assert.ok(t.paths.length >= 1, t.id);
  }
});

test('ids are unique across the whole catalogue', () => {
  const ids = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every style has a full A to Z', () => {
  for (const s of STYLES) {
    for (const ch of UPPER) {
      assert.ok(TEMPLATES.some((t) => t.id === `char-${s}-${ch.toLowerCase()}`), `${s} ${ch}`);
    }
  }
});

test('styles with small letters have a full a to z', () => {
  for (const s of STYLES) {
    const small = LETTERS.filter((t) => t.id.startsWith(`char-${s}-`) && t.id.endsWith('-small'));
    if (small.length) assert.equal(small.length, 26, s);
  }
});

test('every letter has a name in every locale', () => {
  for (const l of LOCALES) {
    const cat = CATALOGS[l.code] as Readonly<Record<string, unknown>>;
    const bad = LETTERS.filter((t) => {
      const v = cat[`templates.name.${t.id}`];
      return typeof v !== 'string' || v.trim() === '';
    }).map((t) => t.id);
    assert.deepEqual(bad, [], l.code);
    for (const s of LETTER_STYLES) assert.equal(typeof cat[`templates.letterStyle.${s}`], 'string', `${l.code} ${s}`);
  }
});

test('style counts, filtering and samples', () => {
  const lettering = TEMPLATES.filter((t) => t.category === 'lettering');
  const counts = letterStyleCounts(lettering);
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), lettering.length);
  assert.ok(counts.words > 0, 'the older words and phrases sheets stay');
  assert.equal(inLetterStyle(lettering, 'pixel').length, counts.pixel);
  assert.equal(inLetterStyle(lettering, null).length, lettering.length);
  assert.equal(letterStyleSample(lettering, 'bubble')?.id, 'char-bubble-a');
  assert.equal(letterStyleOf({ category: 'flowers', tags: ['style-bubble'] }), null);
});

test('every font used has a credit and a licence text', () => {
  const credits = readFileSync(new URL('../../docs/THIRD_PARTY.md', import.meta.url), 'utf8');
  for (const s of STYLES) {
    const row = credits.split('\n').find((line) => line.includes(`\`style-${s}\``));
    assert.ok(row, `no credit row for ${s}`);
    const file = row.match(/`(docs\/licences\/[^`]+)`/)?.[1];
    assert.ok(file && existsSync(new URL(`../../${file}`, import.meta.url)), `licence text for ${s}`);
    assert.ok(/SIL Open Font License 1\.1|Apache License 2\.0/.test(row), `${s} licence`);
  }
});
