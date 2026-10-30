// T170: the wider built-in catalogue and its exact name lookup (used by the "scan home screen"
// feature to map installed app names to catalogue entries).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE, CATEGORIES, byCategory, findAllByName, findByName, getById, normalize, search } from './catalogue.ts';
import { FEATHER_BRAND_GLYPHS, isKnownGlyph, resolveGlyph } from './glyphnames.ts';

const start = CATALOGUE.findIndex((e) => e.id === 'weibo');
const added = CATALOGUE.slice(start);

// The only schemes T170 adds: publicly documented by the app makers or long-standing public
// references. None is marked verified (test on device first).
const T170_SCHEMES: Record<string, string> = {
  weibo: 'sinaweibo://',
  vlc: 'vlc://',
  infuse: 'infuse://',
  ulysses: 'ulysses://',
  due: 'due://',
  'day-one': 'dayone://',
  omnifocus: 'omnifocus://',
  'spark-mail': 'readdle-spark://',
  'yahoo-mail': 'ymail://',
  wikipedia: 'wikipedia://',
  scriptable: 'scriptable://',
  'working-copy': 'working-copy://',
};

test('T170 adds 80+ apps across the owner\'s categories', () => {
  assert.ok(start > 0);
  assert.ok(added.length >= 80, `${added.length} added`);
  const cats = new Set(added.map((e) => e.category));
  for (const c of ['Social', 'Messaging', 'Photo & Design', 'Music & Audio', 'Video & TV', 'Travel & Transport', 'Shopping', 'Finance', 'Productivity', 'Health & Fitness', 'News & Reading', 'Games', 'Utilities']) {
    assert.ok(cats.has(c), `no new ${c} apps`);
  }
  for (const c of CATEGORIES) assert.ok(byCategory(c).length >= 10, `${c}: ${byCategory(c).length}`);
});

test('no duplicate ids or names across the whole catalogue', () => {
  const ids = CATALOGUE.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  const names = CATALOGUE.map((e) => normalize(e.name));
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dupes, []);
});

test('every entry has an original glyph that draws (never a brand logo, never the fallback)', () => {
  for (const e of CATALOGUE) {
    assert.ok(isKnownGlyph(e.glyph), `${e.id}: ${e.glyph}`);
    assert.ok(!FEATHER_BRAND_GLYPHS.includes(e.glyph), `${e.id}: brand glyph`);
    assert.equal(resolveGlyph(e.glyph).fallback, false, `${e.id}: fallback glyph`);
  }
});

test('schemes are well-formed; T170 schemes come only from the documented list and are unverified', () => {
  for (const e of CATALOGUE) {
    if (e.urlScheme === null) continue;
    assert.match(e.urlScheme, /^[A-Za-z][A-Za-z0-9+.-]*:(\/\/)?$/, `${e.id}: ${e.urlScheme}`);
  }
  for (const e of added) {
    assert.equal(e.verified, false, e.id);
    if (e.urlScheme !== null) assert.equal(T170_SCHEMES[e.id], e.urlScheme, `${e.id}: scheme not on the T170 list`);
  }
  for (const [id, scheme] of Object.entries(T170_SCHEMES)) assert.equal(getById(id)?.urlScheme, scheme, id);
});

test('new apps are searchable', () => {
  assert.equal(search('vlc')[0].id, 'vlc');
  assert.equal(search('amex')[0].id, 'american-express');
  assert.equal(search('figma')[0].id, 'figma');
  assert.equal(search('whatsapp')[0].id, 'whatsapp');
  assert.equal(search('pokemon')[0].id, 'pokemon-go');
});

test('findByName: exact names, any case, spacing and punctuation; aliases second; no fuzzy guesses', () => {
  assert.equal(findByName('Spotify')?.id, 'spotify');
  assert.equal(findByName('  youtube   MUSIC ')?.id, 'youtube-music');
  assert.equal(findByName('YouTubeMusic')?.id, 'youtube-music');
  assert.equal(findByName('Pokemon GO')?.id, 'pokemon-go');
  assert.equal(findByName('Lowe\'s')?.id, 'lowes');
  assert.equal(findByName('H&M')?.id, 'h-and-m');
  assert.equal(findByName('Twitter')?.id, 'x');
  assert.equal(findByName('Subway')?.id, 'subway-restaurants');
  assert.equal(findByName('Subway Surfers')?.id, 'subway-surfers');
  assert.equal(findByName('Spotfy'), undefined);
  assert.equal(findByName(''), undefined);
  assert.equal(findByName('   '), undefined);
  assert.equal(findByName(null), undefined);
  assert.equal(findByName('Bike Club'), undefined);
  // A catalogue name always wins over another app's alias.
  for (const e of CATALOGUE) assert.equal(findByName(e.name)?.id, e.id, e.name);
  assert.deepEqual(findAllByName(['Maps', 'nope', 'X']).map((e) => e?.id), ['maps', undefined, 'x']);
});
