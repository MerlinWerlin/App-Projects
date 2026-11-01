// T252 (owner-1101h #3): applying a theme adds ALL its widget art to "My widget art", removes the
// previous theme's auto-added art (own photos stay), idempotent, and a widget whose piece went is
// remapped to the new theme's piece in the same slot. Plus source guards on the Swift order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { commitThemeArt, piecesToCompose, planThemePieces, type PlannedThemePiece } from './themeArtSync.ts';
import {
  emptyLibrary,
  listPieces,
  parseLibrary,
  pickerPieces,
  replaceThemeArt,
  resolveWidgetPiece,
  serializeLibrary,
  themePieceId,
  addPiece,
  type WidgetArtIndex,
  type WidgetArtPiece,
} from './widgetArtLibrary.ts';
import type { WidgetOption } from './widgetOptions.ts';

const read = (...p: string[]): string => readFileSync(join(process.cwd(), ...p), 'utf8');
const strip = (s: string): string => s.replace(/\/\/.*$/gm, '');

const opt = (id: string, sizes: WidgetOption['sizes'], extra: Partial<WidgetOption> = {}): WidgetOption => ({
  id,
  kind: 'art',
  image: `${id}.png`,
  sizes,
  fit: 'fit',
  background: 'theme',
  label: id,
  width: sizes[0] === 'medium' ? 1092 : 510,
  height: 510,
  derived: false,
  ...extra,
});

const plan = (themeId: string, options: WidgetOption[]): PlannedThemePiece[] =>
  planThemePieces({ themeId, themeName: themeId.toUpperCase(), options, name: (o, s) => `${o.id} · ${s}` });

const photo = (id: string, created: number): WidgetArtPiece => ({
  id,
  name: 'My photo',
  themeName: '',
  themeId: null,
  source: 'photo',
  file: `${id}.jpg`,
  created,
  aspect: 1,
  size: null,
});

/** Apply a theme the way syncThemeWidgetArt does, every image made. */
const apply = (lib: WidgetArtIndex, themeId: string, options: WidgetOption[], now: number) => {
  const planned = plan(themeId, options);
  const todo = piecesToCompose(lib, planned);
  return commitThemeArt(lib, themeId, planned, todo.map((p) => p.id), now);
};

const A = [opt('moon', ['small', 'large']), opt('stars', ['small']), opt('wide', ['medium'])];
const B = [opt('lamp', ['small']), opt('fern', ['small']), opt('pond', ['medium']), opt('grove', ['large'])];

test('plan: one piece per option per own size, slots in shelf order per size, deterministic', () => {
  const p = plan('alpine', A);
  assert.deepEqual(
    p.map((x) => [x.id, x.size, x.slot]),
    [
      [themePieceId('alpine', 'moon', 'small'), 'small', 0],
      [themePieceId('alpine', 'stars', 'small'), 'small', 1],
      [themePieceId('alpine', 'wide', 'medium'), 'medium', 0],
      [themePieceId('alpine', 'moon', 'large'), 'large', 0],
    ],
  );
  assert.ok(p.every((x) => x.source === 'theme' && x.themeId === 'alpine' && x.themeName === 'ALPINE'));
  assert.deepEqual(plan('alpine', A), p);
  assert.deepEqual(plan('alpine', []), []);
});

test('plan: over the cap keeps the first slots of every size', () => {
  const many = Array.from({ length: 30 }, (_, i) => opt(`s${i}`, ['small']));
  const p = planThemePieces({ themeId: 't', themeName: 'T', options: [...many, opt('m', ['medium'])], name: () => 'x', cap: 5 });
  assert.equal(p.length, 5);
  assert.ok(p.some((x) => x.size === 'medium'), 'the one medium piece survives the cap');
});

test('auto-add ALL: applying a theme lists every one of its pieces, current theme recorded', () => {
  const r = apply(emptyLibrary(), 'alpine', A, 1000);
  assert.equal(r.lib.pieces.length, 4);
  assert.equal(r.lib.currentThemeId, 'alpine');
  assert.deepEqual(r.remove, []);
  // Library order (newest first) follows the plan order.
  assert.deepEqual(listPieces(r.lib).map((x) => x.id), plan('alpine', A).map((x) => x.id));
  assert.ok(r.lib.pieces.every((x) => x.file === `${x.id}.jpg`));
});

test('replace previous: the old theme\'s auto pieces go (retired with size + slot), own photos stay', () => {
  const first = apply(addPiece(emptyLibrary(), photo('p-1', 5)).lib, 'alpine', A, 1000).lib;
  const r = apply(first, 'firefly', B, 2000);
  const ids = r.lib.pieces.map((x) => x.id);
  assert.ok(ids.includes('p-1'), 'own photo stays');
  assert.equal(r.lib.pieces.filter((x) => x.themeId === 'alpine').length, 0);
  assert.equal(r.lib.pieces.filter((x) => x.themeId === 'firefly').length, 4);
  assert.deepEqual([...r.remove].sort(), plan('alpine', A).map((x) => x.id).sort());
  assert.deepEqual(r.lib.retired?.[themePieceId('alpine', 'stars', 'small')], { size: 'small', slot: 1 });
  assert.equal(r.lib.currentThemeId, 'firefly');
  // Survives the index.json round trip the bridge stores.
  const back = parseLibrary(serializeLibrary(r.lib));
  assert.deepEqual(back.retired, r.lib.retired);
  assert.deepEqual(back.pieces.map((x) => x.slot), listPieces(r.lib).map((x) => x.slot));
});

test('keeps a hand-made piece of the current theme (My widget art > medium of a piece)', () => {
  let lib = apply(emptyLibrary(), 'alpine', A, 1000).lib;
  const extra = { id: themePieceId('alpine', 'stars', 'medium'), name: 'stars · medium', themeName: 'ALPINE', themeId: 'alpine', source: 'theme' as const, created: 1500, aspect: 2, size: 'medium' as const };
  lib = addPiece(lib, extra).lib;
  const again = apply(lib, 'alpine', A, 3000);
  assert.ok(again.lib.pieces.some((x) => x.id === extra.id));
  assert.deepEqual(again.remove, []);
});

test('idempotent re-run: same index, nothing to compose the second time', () => {
  const once = apply(addPiece(emptyLibrary(), photo('p-1', 5)).lib, 'alpine', A, 1000).lib;
  assert.deepEqual(piecesToCompose(once, plan('alpine', A)), []);
  const twice = apply(once, 'alpine', A, 9999).lib;
  assert.equal(serializeLibrary(twice), serializeLibrary(once));
  // Swap, then the same swap again (e.g. after an interrupted run): same result.
  const swapped = apply(once, 'firefly', B, 2000).lib;
  assert.equal(serializeLibrary(apply(swapped, 'firefly', B, 5000).lib), serializeLibrary(swapped));
});

test('interrupted run: pieces whose image was not made are left out; the re-run completes it', () => {
  const start = apply(emptyLibrary(), 'alpine', A, 1000).lib;
  const planned = plan('firefly', B);
  const todo = piecesToCompose(start, planned);
  // Only the first two images were made before the app was killed / a copy failed.
  const partial = commitThemeArt(start, 'firefly', planned, todo.slice(0, 2).map((p) => p.id), 2000).lib;
  assert.equal(partial.pieces.length, 2, 'only finished pieces are listed (the bridge prunes the rest)');
  assert.deepEqual(piecesToCompose(partial, planned).map((p) => p.id), todo.slice(2).map((p) => p.id), 'skips the pieces already present');
  const done = apply(partial, 'firefly', B, 3000).lib;
  assert.equal(done.pieces.length, 4);
  // Not committed at all (killed before the index write): the old index is untouched and consistent.
  assert.deepEqual(piecesToCompose(start, planned).length, 4);
});

test('removed-piece fallback: same slot of the current theme, else same size, else first; null keeps the old behaviour', () => {
  const alpine = apply(addPiece(emptyLibrary(), photo('p-1', 5)).lib, 'alpine', A, 1000).lib;
  const lib = apply(alpine, 'firefly', B, 2000).lib;
  const f = (o: string, s: 'small' | 'medium' | 'large') => themePieceId('firefly', o, s);
  // A small widget that showed Alpine's 2nd small piece now shows Firefly's 2nd small piece.
  assert.equal(resolveWidgetPiece(lib, themePieceId('alpine', 'stars', 'small'), 'small'), f('fern', 'small'));
  assert.equal(resolveWidgetPiece(lib, themePieceId('alpine', 'moon', 'small'), 'small'), f('lamp', 'small'));
  assert.equal(resolveWidgetPiece(lib, themePieceId('alpine', 'wide', 'medium'), 'medium'), f('pond', 'medium'));
  // No slot match for the size: that size's first piece.
  const three = apply(lib, 'one', [opt('solo', ['small']), opt('wide', ['medium'])], 3000).lib;
  assert.equal(resolveWidgetPiece(three, f('fern', 'small'), 'small'), themePieceId('one', 'solo', 'small'));
  // No piece of that size at all: the current theme's first piece (never blank).
  assert.equal(resolveWidgetPiece(three, f('grove', 'large'), 'large'), themePieceId('one', 'solo', 'small'));
  // Unknown widget size: the retired piece's own size.
  assert.equal(resolveWidgetPiece(lib, themePieceId('alpine', 'wide', 'medium'), null), f('pond', 'medium'));
  // A piece that is still there is itself; own photos are never remapped.
  assert.equal(resolveWidgetPiece(lib, 'p-1', 'small'), 'p-1');
  // No choice, bad id, or nothing to map to: null (last applied image, else the theme background).
  assert.equal(resolveWidgetPiece(lib, null, 'small'), null);
  assert.equal(resolveWidgetPiece(lib, '../x', 'small'), null);
  assert.equal(resolveWidgetPiece(apply(lib, 'plain', [], 4000).lib, f('fern', 'small'), 'small'), null);
});

test('picker: current theme first (size, slot), then the rest newest first', () => {
  const lib = apply(addPiece(emptyLibrary(), photo('p-1', 99999)).lib, 'alpine', A, 1000).lib;
  const order = pickerPieces(lib).map((x) => x.id);
  assert.deepEqual(order, [...plan('alpine', A).map((x) => x.id), 'p-1']);
});

test('replaceThemeArt (the T238 path) also remembers what it removed', () => {
  const lib = apply(emptyLibrary(), 'alpine', A, 1000).lib;
  const r = replaceThemeArt(lib, 'firefly');
  assert.equal(r.lib.pieces.length, 0);
  assert.equal(Object.keys(r.lib.retired ?? {}).length, 4);
  // A re-added id is no longer retired.
  const back = apply(r.lib, 'alpine', A, 2000).lib;
  assert.equal(back.retired, undefined);
});

test('re-applying a piece by hand keeps its slot', () => {
  const lib = apply(emptyLibrary(), 'alpine', A, 1000).lib;
  const id = themePieceId('alpine', 'stars', 'small');
  const r = addPiece(lib, { id, name: 'n', themeName: 'ALPINE', themeId: 'alpine', source: 'theme', created: 5000, aspect: 1, size: 'small' });
  assert.equal(r.lib.pieces.find((x) => x.id === id)?.slot, 1);
});

// ---------------------------------------------------------------- source guards

test('bridge: index written BEFORE reloadAllTimelines; compose functions never reload; prune after write', () => {
  const bridge = strip(read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift'));
  const at = bridge.indexOf('AsyncFunction("setWidgetArtIndex")');
  const fn = bridge.slice(at, bridge.indexOf('AsyncFunction(', at + 10) > 0 ? bridge.indexOf('AsyncFunction(', at + 10) : bridge.indexOf('private static func validArtId'));
  const write = fn.indexOf('try data.write(to: dir.appendingPathComponent(artIndexFile), options: .atomic)');
  const prune = fn.indexOf('removeItem(at: dir.appendingPathComponent(name))');
  const invalidate = fn.indexOf('invalidateConfigurationRecommendations()');
  const reload = fn.indexOf('GlazeWidgetBridgeModule.reloadWidgets()');
  assert.ok(write > 0 && prune > write && invalidate > prune && reload > invalidate, `order write ${write} < prune ${prune} < invalidate ${invalidate} < reload ${reload}`);
  // A failed index write returns before any reload.
  assert.match(fn.slice(0, reload), /\} catch \{\s*return false\s*\}/);
  for (const name of ['composeWidgetArtPiece', 'composeSeamlessPiece']) {
    const s = bridge.indexOf(`AsyncFunction("${name}")`);
    assert.ok(s > 0, name);
    const next = bridge.indexOf('AsyncFunction(', s + 10);
    const body = bridge.slice(s, next > 0 ? next : bridge.indexOf('private static func validArtId'));
    assert.doesNotMatch(body, /reloadWidgets|reloadAllTimelines|reloadTimelines/, `${name} must not reload before the index write`);
    assert.doesNotMatch(body, /artIndexFile/, `${name} never writes the index`);
    assert.match(body, /skipIfPresent && FileManager\.default\.fileExists/, `${name} skips a piece already on disk`);
    assert.match(body, /options: \.atomic/, `${name} writes atomically (no half-written piece)`);
    assert.match(body, /autoreleasepool/, `${name} frees its images per piece`);
  }
  // The shared compose helpers are used by both the per-size write and the library pieces.
  assert.equal((bridge.match(/composeArtImage\(/g) ?? []).length >= 3, true);
  assert.equal((bridge.match(/composeSeamlessImage\(/g) ?? []).length >= 3, true);
});

test('extension: the entity query reads the fresh index from disk every time (no static cache) and remaps removed pieces', () => {
  const lib = strip(read('targets', 'widget', 'WidgetArtLibrary.swift'));
  // No stored statics holding pieces / an index / entities.
  assert.doesNotMatch(lib, /static (var|let) (\w*[cC]ache\w*|records|entities|pieces|snapshot|library|lastIndex)\b/);
  // The only stored statics are constant names and the AppIntents metadata.
  for (const m of lib.matchAll(/static (?:var|let) (\w+)/g)) {
    assert.ok(['dirName', 'indexName', 'typeDisplayRepresentation', 'defaultQuery', 'title', 'caseDisplayRepresentations', 'sizeOrder'].includes(m[1]), `unexpected static ${m[1]}`);
  }
  assert.doesNotMatch(lib, /lazy var/);
  const store = lib.slice(lib.indexOf('enum WidgetArtStore'), lib.indexOf('struct WidgetArtEntity'));
  assert.match(store, /static func snapshot\(\) -> WidgetArtSnapshot \{/);
  assert.match(store, /Data\(contentsOf: dir\.appendingPathComponent\(indexName\)\)/);
  const query = lib.slice(lib.indexOf('struct WidgetArtQuery'), lib.indexOf('struct ChooseWidgetArtIntent'));
  assert.equal((query.match(/WidgetArtStore\.snapshot\(\)/g) ?? []).length, 2, 'entities(for:) and suggestedEntities() each read the index');
  assert.match(query, /snap\.resolve\(id, preferSize: nil\)/, 'a removed piece resolves to its replacement');
  assert.match(query, /snap\.pickerRecords\(\)/, 'current theme first');
  // The timeline uses the resolved piece for the widget's own size, read fresh per timeline.
  const provider = lib.slice(lib.indexOf('struct ArtProvider'));
  assert.match(provider, /WidgetArtStore\.resolvedID\(configuration\.art\?\.id, family: context\.family\)/);
  // The mirror of resolveWidgetPiece / byShelf / pickerPieces.
  assert.match(store, /"retired"/);
  assert.match(store, /"slot"/);
  assert.match(store, /"currentThemeId"/);
});

test('wiring: theme apply calls syncThemeWidgetArt (non-blocking), the store makes pieces then commits once', () => {
  const apply = strip(read('src', 'store', 'activeTheme.ts'));
  assert.match(apply, /syncThemeWidgetArt\(theme\)/);
  const store = strip(read('src', 'store', 'themeWidgetArt.ts'));
  assert.match(store, /export function syncThemeWidgetArt\(theme: Theme/);
  const run = store.slice(store.indexOf('async function runSync('), store.indexOf('function plan('));
  const compose = run.indexOf('await composeOne(');
  const commit = run.indexOf('widgets.commitThemeArt(');
  assert.ok(compose > 0 && commit > compose, 'pieces first, then the one index write');
  assert.equal((store.match(/widgets\.commitThemeArt\(/g) ?? []).length, 1, 'exactly one index write per run');
  assert.match(store.slice(store.indexOf('async function composeOne(')), /widgets\.composeArtPiece\(\{ id: piece\.id, kind: 'seamless'/);
  assert.match(store.slice(store.indexOf('async function composeOne(')), /widgets\.composeArtPiece\(\{ id: piece\.id, kind: 'art'/);
  assert.match(store, /r === 'not-built'/, 'older bridge without compose: the commit still replaces the old theme\'s art');
  assert.match(store, /if \(!current\.available\) return NONE;/, 'Expo Go / Android: nothing runs');
  assert.match(store, /if \(stale\(\)\)/, 'a newer apply supersedes before the index write');
  // T250 merge: the sync runs inside the deferred 'themeArt' step, never awaited by applyThemeEverywhere.
  assert.match(apply, /requestDeferred\(DEFERRED_STEPS\.themeArt, theme\)/, 'never blocks the apply');
  const applyFn = apply.slice(apply.indexOf('export async function applyThemeEverywhere('), apply.indexOf('async function themeArtStep('));
  assert.doesNotMatch(applyFn, /syncThemeWidgetArt\(/, 'not called inline in applyThemeEverywhere');
  const adapter = strip(read('src', 'native', 'widgets.ts'));
  assert.match(adapter, /typeof mod\.composeWidgetArtPiece !== 'function'/);
  assert.match(adapter, /commitThemeArt\(lib, themeId, planned, ready, Date\.now\(\)\)/);
  assert.match(adapter, /artQueue/, 'index edits are serialised');
});
