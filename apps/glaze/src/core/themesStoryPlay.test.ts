// T104 (owner feedback 22 Oct, G5 b–d): original game-inspired, movie-night and storybook themes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOTIFS, MOTIF_IDS, isMotifId, type MotifId } from './artwork.ts';
import { sha256Hex } from './bytes.ts';
import { isNew } from './categories.ts';
import { ALL_THEMES, PLUS_PACKS, PLUS_THEMES, getAnyTheme, packOf } from './plusThemes.ts';
import { THEME_CATEGORY_IDS, parsePackManifest, themeToData, themesFromPack } from './themePack.ts';
import { THEMES } from './themes.ts';
import {
  STORYPLAY_ADDED_AT,
  STORYPLAY_FREE_THEMES,
  STORYPLAY_PACK_ID,
  STORYPLAY_PLUS_THEMES,
  STORYPLAY_THEMES,
  storyPlayGroup,
} from './themesStoryPlay.ts';

/**
 * Third-party characters, franchises, films, games, studios and teams the owner's request brought
 * to mind. None may appear in a T104 theme's id, name, tagline or tags, nor in a motif name.
 */
const BANNED =
  /disney|pixar|dreamworks|marvel|\bdc\b|avenger|batman|superman|spider-?man|wonder woman|hulk|x-men|justice league|nintendo|mario|luigi|zelda|link\b|kirby|yoshi|pok[eé]mon|pikachu|sega|sonic|pac-?man|space invaders|galaga|tetris|minecraft|fortnite|roblox|stardew|harvest moon|animal crossing|final fantasy|dragon quest|skyrim|warcraft|witcher|halo\b|cyberpunk|tron\b|blade runner|star wars|star trek|jedi|godzilla|ghostbusters|gremlins|monsters,? inc|sulley|shrek|frozen|elsa|anna\b|cinderella|ariel|rapunzel|belle\b|moana|jasmine|snow white|sleeping beauty|tiana|mulan|peach|toothless|smaug|winnie|pooh|bambi|thumper|hedwig|robin hood|gran turismo|forza|need for speed|out ?run|pole position|ferrari|mclaren|formula ?1|\bf1\b|nascar|hello kitty|sanrio|barbie|ghibli|totoro|hogwarts|harry potter/i;

const COMPETITORS = /themify|icon themer|myscreen|screenkit|widgetsmith|intolive|loopy|lockio/i;

const T104_MOTIFS: MotifId[] = [
  'pixel-critter',
  'pixel-heart',
  'pixel-coin',
  'neon-grid',
  'sword-shield',
  'potion',
  'wheat',
  'barn',
  'chequered-flag',
  'speed-stripes',
  'trophy',
  'rocket',
  'rain-window',
  'blinds',
  'monster',
  'popcorn',
  'hero-emblem',
  'comic-burst',
  'castle',
  'crown',
  'gown',
  'dragon',
  'fox-face',
  'owl-face',
  'hedgehog',
];

test('T104: 13 new themes, 6 free (bundled) and 7 Plus in pack-storyplay-2026', () => {
  assert.equal(STORYPLAY_THEMES.length, 13);
  assert.equal(STORYPLAY_FREE_THEMES.length, 6);
  assert.equal(STORYPLAY_PLUS_THEMES.length, 7);
  for (const t of STORYPLAY_FREE_THEMES) {
    assert.equal(t.plus, false, `${t.id}: free themes are marked free (no Plus badge)`);
    assert.equal(t.packId, undefined, `${t.id}: free themes are bundled`);
    assert.ok(THEMES.includes(t), `${t.id} is in the free list`);
  }
  for (const t of STORYPLAY_PLUS_THEMES) {
    assert.equal(t.plus, true, t.id);
    assert.equal(t.packId, STORYPLAY_PACK_ID, t.id);
    assert.ok(PLUS_THEMES.includes(t), t.id);
    assert.ok(!THEMES.includes(t), `${t.id} is not in the free list`);
    assert.equal(packOf(t.id)?.id, STORYPLAY_PACK_ID);
  }
  assert.ok(PLUS_PACKS.some((p) => p.id === STORYPLAY_PACK_ID && p.themes.length === 7));
});

test('ids are unique, slug-like and new; every theme opens by id', () => {
  const ids = STORYPLAY_THEMES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of STORYPLAY_THEMES) {
    assert.match(t.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.equal(ALL_THEMES.filter((x) => x.id === t.id).length, 1, `${t.id} appears once`);
    assert.equal(getAnyTheme(t.id), t);
  }
  assert.equal(new Set(ALL_THEMES.map((t) => t.id)).size, ALL_THEMES.length);
  assert.equal(new Set(ALL_THEMES.map((t) => t.name)).size, ALL_THEMES.length);
});

test('every owner group (games, movie night, storybook) has themes and at least one free', () => {
  const groups = { games: 0, 'movie-night': 0, storybook: 0 };
  const free = { games: 0, 'movie-night': 0, storybook: 0 };
  for (const t of STORYPLAY_THEMES) {
    const g = storyPlayGroup(t.id);
    assert.ok(g, t.id);
    groups[g] += 1;
    if (!t.plus) free[g] += 1;
  }
  assert.deepEqual(groups, { games: 5, 'movie-night': 4, storybook: 4 });
  for (const g of Object.keys(free) as (keyof typeof free)[]) assert.ok(free[g] >= 1, `${g}: a free theme`);
  assert.equal(storyPlayGroup('strawberry-dessert'), undefined);
});

test('no third-party characters, franchises, films, games, studios or teams anywhere', () => {
  for (const t of STORYPLAY_THEMES) {
    const text = `${t.id} ${t.name} ${t.tagline} ${(t.tags ?? []).join(' ')}`;
    assert.ok(!BANNED.test(text), `${t.id}: ${text.match(BANNED)?.[0]}`);
    assert.ok(!COMPETITORS.test(text), t.id);
  }
  for (const id of T104_MOTIFS) assert.ok(!BANNED.test(`${id} ${MOTIFS[id].name}`), id);
  // The source file itself (ids, comments, copy) stays clean too.
  const src = readFileSync(new URL('./themesStoryPlay.ts', import.meta.url), 'utf8');
  assert.ok(!BANNED.test(src), `themesStoryPlay.ts: ${src.match(BANNED)?.[0]}`);
});

test('the new motifs are in the library and every theme only uses motifs that exist', () => {
  for (const id of T104_MOTIFS) assert.ok(isMotifId(id) && MOTIFS[id].id === id, id);
  for (const t of ALL_THEMES) {
    for (const m of [...t.art.motifs, ...t.art.stickers.map((s) => s.motif)]) {
      assert.ok(isMotifId(m) && MOTIFS[m].layers.length > 0, `${t.id}: motif ${m}`);
    }
  }
  // Each T104 theme leads with one of the new motifs, and every new motif is used.
  const used = new Set(STORYPLAY_THEMES.flatMap((t) => [...t.art.motifs, ...t.art.stickers.map((s) => s.motif)]));
  for (const t of STORYPLAY_THEMES) assert.ok(T104_MOTIFS.includes(t.art.motifs[0]), t.id);
  for (const id of T104_MOTIFS) assert.ok(used.has(id), `${id} is used by a theme`);
  assert.ok(MOTIF_IDS.length >= 61);
});

test('categories exist, tags are lower case, and the themes show as New from 22 Oct', () => {
  for (const t of STORYPLAY_THEMES) {
    assert.ok(t.categories && t.categories.length >= 1 && t.categories.length <= 3, t.id);
    for (const c of t.categories!) assert.ok(THEME_CATEGORY_IDS.includes(c), `${t.id}: ${c}`);
    assert.ok(t.tags && t.tags.length >= 3, t.id);
    for (const tag of t.tags!) assert.equal(tag, tag.toLowerCase(), `${t.id}: ${tag}`);
    assert.equal(t.addedAt, STORYPLAY_ADDED_AT);
    assert.equal(t.addedAt, '2026-10-22');
    assert.ok(isNew(t, '2026-10-22'), t.id);
  }
  // Search finds each group by its plain word.
  const tagged = (w: string) => STORYPLAY_THEMES.filter((t) => t.tags?.includes(w)).length;
  assert.equal(tagged('games'), 5);
  assert.equal(tagged('movie night'), 4);
  assert.equal(tagged('storybook'), 4);
});

test('the pack-storyplay-2026 fixture is current (rebuild with: node ops/build-pack.ts)', () => {
  const dir = join(process.cwd(), 'src', 'core', '__fixtures__', 'packs', STORYPLAY_PACK_ID);
  const r = parsePackManifest(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  assert.ok(r.ok, r.ok ? '' : r.errors.join('\n'));
  const m = r.value;
  assert.equal(m.id, STORYPLAY_PACK_ID);
  assert.equal(m.plus, true);
  assert.deepEqual(
    m.themes.map(({ thumbAsset: _t, ...d }) => d),
    STORYPLAY_PLUS_THEMES.map((t) => JSON.parse(JSON.stringify(themeToData(t)))),
  );
  for (const a of m.assets) {
    const bytes = readFileSync(join(dir, a.path));
    assert.equal(bytes.length, a.bytes, a.path);
    assert.equal(sha256Hex(bytes), a.sha256, a.path);
  }
  const themes = themesFromPack(m, (p) => readFileSync(join(dir, p)));
  assert.deepEqual(JSON.parse(JSON.stringify(themes)), JSON.parse(JSON.stringify(STORYPLAY_PLUS_THEMES)));
});
