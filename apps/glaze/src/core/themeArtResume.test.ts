// T260: the deferred 'themeArt' step resumed on the next launch (no Theme in memory) looks the theme
// in use up by id and runs the full T252 sync; only an unknown theme falls back to replaceThemeArt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isArtPackTheme } from './artPack.ts';
import type { RemoteArtManifest } from './packCatalog.ts';
import { isRemoteArtTheme } from './remoteCatalog.ts';
import { downloadedThemeSource, findThemeById, remoteThemeFromManifest, themeArtResumePlan } from './themeArtResume.ts';
import type { PackCacheIndex } from './themePack.ts';

const read = (...p: string[]): string => readFileSync(join(process.cwd(), ...p), 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\w])\/\/.*$/gm, '$1');

type T = { id: string; from: string };

test('findThemeById: first finder that knows the id wins, in order', async () => {
  const calls: string[] = [];
  const a = (id: string) => {
    calls.push('a');
    return id === 'x' ? { id, from: 'a' } : undefined;
  };
  const b = async (id: string) => {
    calls.push('b');
    return { id, from: 'b' };
  };
  assert.deepEqual(await findThemeById<T>('x', [a, b]), { id: 'x', from: 'a' });
  assert.deepEqual(calls, ['a'], 'later finders are not run once one finds it');
  assert.deepEqual(await findThemeById<T>('y', [a, b]), { id: 'y', from: 'b' });
});

test('findThemeById never rejects: throwing / rejecting finders are skipped', async () => {
  const boom = () => {
    throw new Error('boom');
  };
  const reject = () => Promise.reject(new Error('nope'));
  const ok = (id: string) => ({ id, from: 'ok' });
  assert.deepEqual(await findThemeById<T>('z', [boom, reject, ok]), { id: 'z', from: 'ok' });
  assert.equal(await findThemeById<T>('z', [boom, reject]), null);
});

test('findThemeById: blank id or a finder returning another theme (a fallback) is not a hit', async () => {
  const fallback = () => ({ id: 'starter', from: 'fallback' });
  assert.equal(await findThemeById<T>('gone', [fallback]), null);
  assert.equal(await findThemeById<T>('', [fallback]), null);
  assert.equal(await findThemeById<T>(null, [fallback]), null);
  assert.equal(await findThemeById<T>(undefined, [fallback]), null);
});

test('themeArtResumePlan: found = full sync; unknown = replace by id; no theme in use = nothing', () => {
  const theme = { id: 'firefly' };
  assert.deepEqual(themeArtResumePlan('firefly', theme), { kind: 'sync', theme });
  assert.deepEqual(themeArtResumePlan('firefly', null), { kind: 'replace', themeId: 'firefly' });
  assert.deepEqual(themeArtResumePlan('firefly', { id: 'other' }), { kind: 'replace', themeId: 'firefly' });
  assert.deepEqual(themeArtResumePlan(null, theme), { kind: 'none' });
  assert.deepEqual(themeArtResumePlan('', null), { kind: 'none' });
});

test('downloadedThemeSource: a remote art pack by its id, theme packs by their themeIds', () => {
  const index: PackCacheIndex = {
    version: 1,
    packs: [
      { id: 'moonlit', name: 'Moonlit', version: 1, bytes: 1, themeIds: ['moonlit'], downloadedAt: '2026-10-01T00:00:00Z' },
      { id: 'retro-pack', name: 'Retro', version: 1, bytes: 1, themeIds: ['arcade', 'vhs'], downloadedAt: '2026-10-01T00:00:00Z' },
    ],
  };
  assert.deepEqual(downloadedThemeSource(index, 'moonlit'), { remoteArt: true, packs: [] });
  assert.deepEqual(downloadedThemeSource(index, 'vhs'), { remoteArt: false, packs: ['retro-pack'] });
  assert.deepEqual(downloadedThemeSource(index, 'nope'), { remoteArt: false, packs: [] });
  assert.deepEqual(downloadedThemeSource(null, 'x'), { remoteArt: false, packs: [] });
});

test('remoteThemeFromManifest: a remote art theme syncThemeWidgetArt can use, with no URL made', () => {
  const m = {
    format: 'glaze-art-pack',
    version: 2,
    id: 'firefly-grove',
    packVersion: 3,
    name: 'Firefly Grove',
    plus: false,
    minAppVersion: '1.0.0',
    palette: { bg: '#101820', tile: '#203040', glyph: '#F0E68C', accent: '#FFD700', text: '#FFFFFF' },
    meta: { name: 'Firefly Grove', mood: 'calm', tags: ['night'], credits: '', licence: 'original', generator: '', prompt: '', category: 'Nature' },
    thumbhash: 'abc=',
    assets: [],
    totalBytes: 1234,
    widgets: [],
  } as unknown as RemoteArtManifest;
  const t = remoteThemeFromManifest(m);
  assert.equal(t.id, 'firefly-grove');
  assert.equal(t.name, 'Firefly Grove');
  assert.ok(isRemoteArtTheme(t), 'routes to the downloaded-pack branch of themeArt()');
  assert.ok(isArtPackTheme(t));
  assert.equal(t.remoteArt.packId, 'firefly-grove');
  assert.equal(t.remoteArt.thumbUrl, null);
  assert.equal(typeof t.palette.bg, 'string');
});

test('wiring: the resumed themeArt step looks the theme up and runs the full sync, replace-by-id only as fallback', () => {
  const store = strip(read('src', 'store', 'activeTheme.ts'));
  const at = store.indexOf('async function themeArtStep(');
  assert.ok(at > 0);
  const step = store.slice(at, store.indexOf('registerDeferred(DEFERRED_STEPS.themeArt', at));
  assert.match(step, /await findAnyThemeById\(id\)/);
  assert.match(step, /themeArtResumePlan\(id, found\)/);
  assert.match(step, /syncThemeWidgetArt\(theme\)/);
  assert.match(step, /nativeWidgets\.replaceThemeArt\(fallbackId\)/);
  // The lookup sits in try/catch (never throws at launch).
  assert.match(step, /try \{\s*found = await findAnyThemeById\(id\);\s*\} catch \{/);
  // One sync call site: the found theme goes through the same path as an in-memory one.
  assert.equal(step.match(/syncThemeWidgetArt\(/g)?.length, 1);

  const lookup = strip(read('src', 'store', 'themeLookup.ts'));
  // Reuses the app's lookups, bundled first; never fetches the catalogue.
  assert.match(lookup, /getAnyTheme\(id\)/);
  assert.match(lookup, /catalogPack\(id\)/);
  assert.match(lookup, /remoteArtOnDevice\(id\)/);
  assert.match(lookup, /packThemesOnDevice\(packId\)/);
  assert.match(lookup, /findThemeById<Theme>\(id, \[bundled, catalogue, downloaded\]\)/);
  assert.doesNotMatch(lookup, /refreshCatalog|fetch\(/);
  // Only the deferred step uses it (never the launch path).
  assert.doesNotMatch(strip(read('app', '_layout.tsx')), /themeLookup|findAnyThemeById/);
  assert.doesNotMatch(strip(read('src', 'store', 'launchWork.ts')), /findAnyThemeById/);
});
