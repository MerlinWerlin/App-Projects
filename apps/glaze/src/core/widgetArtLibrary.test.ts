// T221: "My widget art" library index logic + source guards on the native side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  WIDGET_ART_DIR,
  WIDGET_ART_INDEX_FILE,
  WIDGET_ART_LIBRARY_CAP,
  WIDGET_ART_SOURCES,
  addPiece,
  emptyLibrary,
  isValidPieceId,
  listPieces,
  parseLibrary,
  photoPieceId,
  removePiece,
  serializeLibrary,
  themePieceId,
  type WidgetArtPiece,
} from './widgetArtLibrary.ts';
import { seamlessFileName } from './seamlessWidget.ts';

const read = (...p: string[]): string => readFileSync(join(process.cwd(), ...p), 'utf8');

const piece = (id: string, created: number, extra: Partial<WidgetArtPiece> = {}) => ({
  id,
  name: `Piece ${id}`,
  themeName: 'Cloud Atelier',
  themeId: 'cloud-atelier',
  source: 'theme' as const,
  created,
  aspect: 1,
  size: 'small' as const,
  ...extra,
});

test('add keeps every piece instead of overwriting (two pieces, same size)', () => {
  let lib = emptyLibrary();
  lib = addPiece(lib, piece('a', 1)).lib;
  const r = addPiece(lib, piece('b', 2));
  assert.equal(r.added, true);
  assert.deepEqual(listPieces(r.lib).map((p) => p.id), ['b', 'a']);
  assert.equal(r.lib.pieces[0].file, 'b.jpg');
});

test('dedupe by id: re-applying a piece refreshes it and moves it to the top', () => {
  let lib = addPiece(emptyLibrary(), piece('a', 1)).lib;
  lib = addPiece(lib, piece('b', 2)).lib;
  const r = addPiece(lib, piece('a', 3, { name: 'Paper boat · Small' }));
  assert.equal(r.added, false);
  assert.equal(r.lib.pieces.length, 2);
  assert.deepEqual(listPieces(r.lib).map((p) => p.id), ['a', 'b']);
  assert.equal(listPieces(r.lib)[0].name, 'Paper boat · Small');
});

test('cap: the oldest pieces are evicted, never the one just added', () => {
  let lib = emptyLibrary();
  for (let i = 0; i < 5; i++) lib = addPiece(lib, piece(`p${i}`, 10 + i), 3).lib;
  assert.deepEqual(listPieces(lib).map((p) => p.id), ['p4', 'p3', 'p2']);
  const r = addPiece(lib, piece('late', 1), 3);
  assert.deepEqual(r.evicted, ['p2']);
  assert.ok(r.lib.pieces.some((p) => p.id === 'late'));
  assert.equal(WIDGET_ART_LIBRARY_CAP, 40);
});

test('remove drops one piece; unknown ids are a no-op', () => {
  let lib = addPiece(emptyLibrary(), piece('a', 1)).lib;
  lib = addPiece(lib, piece('b', 2)).lib;
  assert.deepEqual(listPieces(removePiece(lib, 'a')).map((p) => p.id), ['b']);
  assert.equal(removePiece(lib, 'zzz').pieces.length, 2);
});

test('listing order: most recent first, ties by id', () => {
  let lib = emptyLibrary();
  lib = addPiece(lib, piece('c', 5)).lib;
  lib = addPiece(lib, piece('a', 9)).lib;
  lib = addPiece(lib, piece('b', 5)).lib;
  assert.deepEqual(listPieces(lib).map((p) => p.id), ['a', 'b', 'c']);
});

test('invalid pieces are refused; parse is tolerant and round-trips', () => {
  assert.equal(addPiece(emptyLibrary(), piece('../evil', 1)).added, false);
  assert.equal(addPiece(emptyLibrary(), piece('../evil', 1)).lib.pieces.length, 0);
  assert.deepEqual(parseLibrary(null), emptyLibrary());
  assert.deepEqual(parseLibrary('{nope'), emptyLibrary());
  assert.deepEqual(parseLibrary('{"v":2,"pieces":[]}'), emptyLibrary());
  let lib = addPiece(emptyLibrary(), piece('a', 1)).lib;
  lib = addPiece(lib, piece('p-x', 2, { source: 'photo', themeName: '', themeId: null, size: null })).lib;
  const back = parseLibrary(serializeLibrary(lib));
  assert.deepEqual(listPieces(back), listPieces(lib));
  // A hand-edited file name is ignored: the file is always <id>.jpg.
  const odd = parseLibrary(JSON.stringify({ v: 1, pieces: [{ id: 'a', file: '../../x', created: 1 }, { id: 'a', created: 0 }, 'junk'] }));
  assert.equal(odd.pieces.length, 1);
  assert.equal(odd.pieces[0].file, 'a.jpg');
});

test('ids: deterministic, bridge-safe, size-specific', () => {
  const a = themePieceId('cloud-atelier', 'art-2', 'medium');
  assert.equal(a, 't-cloud-atelier-art-2-medium');
  assert.notEqual(a, themePieceId('cloud-atelier', 'art-2', 'small'));
  assert.ok(isValidPieceId(themePieceId('x'.repeat(200), 'é/ü', 'large')));
  assert.equal(photoPieceId('file:///a.jpg'), photoPieceId('file:///a.jpg'));
  assert.notEqual(photoPieceId('file:///a.jpg'), photoPieceId('file:///b.jpg'));
  assert.ok(isValidPieceId(photoPieceId('file:///a.jpg')));
});

test('source files the bridge may copy match the files the bridge writes', () => {
  for (const s of ['small', 'medium', 'large'] as const) assert.ok((WIDGET_ART_SOURCES as readonly string[]).includes(seamlessFileName(s)));
  assert.ok((WIDGET_ART_SOURCES as readonly string[]).includes('widget-photo.jpg'));
});

test('bridge: library functions use the App Group, validate ids, prune and reload all timelines', () => {
  const bridge = read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift');
  assert.match(bridge, /private let appGroup = "group\.com\.jared797\.glaze"/);
  assert.match(bridge, new RegExp(`private let artDir = "${WIDGET_ART_DIR}"`));
  assert.match(bridge, new RegExp(`private let artIndexFile = "${WIDGET_ART_INDEX_FILE.replace('.', '\\.')}"`));
  for (const name of ['saveWidgetArtPiece', 'getWidgetArtLibrary', 'setWidgetArtIndex']) assert.ok(bridge.includes(`AsyncFunction("${name}")`), name);
  assert.match(bridge, /\^\[A-Za-z0-9_-\]\{1,64\}\$/);
  for (const f of WIDGET_ART_SOURCES) assert.ok(bridge.includes(`"${f}"`), f);
  const setIndex = bridge.slice(bridge.indexOf('AsyncFunction("setWidgetArtIndex")'));
  assert.match(setIndex.slice(0, 2500), /removeItem/);
  assert.match(setIndex.slice(0, 2500), /GlazeWidgetBridgeModule\.reloadWidgets\(\)\s*\n\s*return true/);
});

test('extension: Seamless widget is an iOS 17 AppIntentConfiguration with a WidgetArtEntity query', () => {
  const widget = read('targets', 'widget', 'SeamlessWidget.swift');
  const lib = read('targets', 'widget', 'WidgetArtLibrary.swift');
  assert.match(widget, /AppIntentConfiguration\(kind: kind, intent: ChooseWidgetArtIntent\.self, provider: ArtProvider\(\)\)/);
  assert.match(widget, /let kind = "GlazeSeamless"/, 'same kind, so widgets already on the Home Screen keep working');
  assert.match(widget, /\.systemExtraLarge/);
  assert.match(lib, /struct ChooseWidgetArtIntent: WidgetConfigurationIntent/);
  assert.match(lib, /struct WidgetArtEntity: AppEntity/);
  assert.match(lib, /struct WidgetArtQuery: EntityQuery/);
  assert.match(lib, /func entities\(for identifiers: \[WidgetArtEntity\.ID\]\) async throws -> \[WidgetArtEntity\]/);
  assert.match(lib, /func suggestedEntities\(\) async throws -> \[WidgetArtEntity\]/);
  assert.match(lib, /struct ArtProvider: AppIntentTimelineProvider/);
  assert.match(lib, /forSecurityApplicationGroupIdentifier: GlazeShared\.appGroup/);
  assert.match(lib, new RegExp(`"${WIDGET_ART_DIR}"`));
  // Newest first, like listPieces.
  assert.match(lib, /sorted \{ \$0\.created > \$1\.created/);
  // A chosen piece wins; with none (or a missing file) the last applied image per size shows.
  assert.match(widget, /WidgetArtStore\.load\(pieceID(, preferSize: SeamlessStore\.familyName\(family\))?\) \?\? SeamlessStore\.load\(family\)/);
  // No plain-white fallback anywhere in the art widget.
  assert.doesNotMatch(widget + lib, /Color\.white|\.white\b|UIColor\.white/);
  const bundle = read('targets', 'widget', 'GlazeWidgetsBundle.swift');
  assert.match(bundle, /SeamlessWidget\(\)/);
  const cfg = read('targets', 'widget', 'expo-target.config.js');
  assert.match(cfg, /deploymentTarget: '17\.0'/, 'AppIntentConfiguration needs iOS 17; lower it only with an if #available fallback');
});
