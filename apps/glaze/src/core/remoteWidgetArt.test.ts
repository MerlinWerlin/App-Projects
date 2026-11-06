
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { PACK_BASE_URL } from '../config/packs.ts';
import { parseRemoteArtManifest } from './packCatalog.ts';
import { downloadRemoteWidgetArt, packRequest, type Transport } from './packDownloader.ts';
import { localWidgetArtOptions, remoteWidgetArtOptions, resolveRemoteWidgetArtRef } from './remoteWidgetArt.ts';
import { remoteThemeFromManifest } from './themeArtResume.ts';
import { commitThemeArt, type PlannedThemePiece } from './themeArtSync.ts';
import { emptyLibrary } from './widgetArtLibrary.ts';
import { widgetOptionSections } from './widgetOptions.ts';

const fixture = (file: string) => readFileSync(new URL('./__fixtures__/alpine-widget-art-v3/' + file, import.meta.url));
const ref = { id: 'alpine-starlight', packVersion: 3, release: 'glaze-packs-v2' };
const editionIds = ['copper-eclipse', 'hero-large', 'hero-medium', 'hero-small', 'jupiter-polar', 'saturn-rings', 'silver-moon', 'spiral-galaxy'];
const sizes = ['small', 'medium', 'large'] as const;
const editionError = (requests: string[]) =>
  requests.find(url => url.includes('__widget-copper-eclipse.'))?.split('__').at(-1) + ': offline asset';

test('missing in-memory catalogue restores the production release and preserves a tagged fallback', async () => {
  const untagged = { id: ref.id, packVersion: ref.packVersion };
  let current: typeof ref | null = null;
  const lookup = () => current;
  assert.deepEqual(await resolveRemoteWidgetArtRef(lookup, ref, async () => assert.fail('unneeded lookup'), true), ref);
  assert.equal(await resolveRemoteWidgetArtRef(lookup, untagged, async () => {}, true), null);
  const newer = { ...ref, packVersion: 6, release: 'glaze-packs-v11' };
  assert.deepEqual(await resolveRemoteWidgetArtRef(lookup, untagged, async () => { current = newer; }, true), newer);
});

test('a stalled art response can be aborted without requesting the next piece', async () => {
  const controller = new AbortController();
  const requests: string[] = [];
  const files = new Map<string, Uint8Array>();
  let reachedArt!: () => void;
  const readingArt = new Promise<void>(resolve => { reachedArt = resolve; });
  let requestSignal: AbortSignal | undefined;
  const transport: Transport = {
    async fetchRange(url, _start, signal) {
      requests.push(url);
      const bytes = url.endsWith('__manifest.json') ? fixture('manifest.json') : null;
      const chunks = (async function* () {
        if (bytes) yield bytes;
        else {
          requestSignal = signal;
          reachedArt();
          await new Promise<void>(resolve => signal?.addEventListener('abort', () => resolve()));
        }
      })();
      return { offset: 0, chunks };
    },
    async readFile(path) { return files.get(path) ?? null; },
    async remove(path) { files.delete(path); },
    async writeAppend(path, chunk) { files.set(path, chunk); },
  };
  const result = downloadRemoteWidgetArt(transport, PACK_BASE_URL, ref, controller.signal);
  await readingArt;
  controller.abort();
  await assert.rejects(result, { code: 'cancelled' });
  assert.equal(requestSignal?.aborted, true);
  assert.equal(requests.length, 2, 'only the manifest and stalled piece were requested');
});

test('network timeout releases the caller and aborts the transport', async () => {
  let signal: AbortSignal | undefined;
  await assert.rejects(packRequest(current => {
    signal = current;
    return new Promise<never>(() => {});
  }, undefined, 15), /download timed out/);
  assert.equal(signal?.aborted, true);
});

test('real Alpine v3 art previews and composes every size with an empty wallpaper pack store', { timeout: 10000 }, async () => {
  const parsed = parseRemoteArtManifest(JSON.parse(fixture('manifest.json').toString('utf8')), ref.id);
  assert.ok(parsed.ok);
  const theme = remoteThemeFromManifest(parsed.value);
  assert.ok(theme);
  const requests: string[] = [];
  const cache = new Map<string, Buffer>();
  let moonOffline = true;
  const transport: Transport = {
    async fetchRange(url, start) {
      assert.equal(start, 0);
      requests.push(url);
      const prefix = '/glaze-packs-v2/art__alpine-starlight__v3__';
      assert.ok(url.includes(prefix), url);
      const name = url.split(prefix)[1];
      assert.doesNotMatch(name, /^(wallpaper|thumb|widget-themed-live-clock|widget-live-clock)/);
      if (moonOffline && name.startsWith('widget-copper-eclipse.')) throw Error('offline asset');
      const bytes = fixture(name);
      return { offset: 0, chunks: (async function* () { yield bytes; })() };
    },
    async readFile(path) { return cache.get(path) ?? null; },
    async remove(path) { cache.delete(path); },
    async writeAppend(path, chunk) { cache.set(path, Buffer.concat([cache.get(path) ?? Buffer.alloc(0), chunk])); },
  };
  const storage = new Map<string, string>();
  let lib = emptyLibrary();
  const composed: { id: string; kind: string }[] = [];
  let previews: ReturnType<typeof localWidgetArtOptions> = [];
  const result = { ok: true, available: true };
  const injected = {
    storage: {
      async getItem(key: string) { return storage.get(key) ?? null; },
      async setItem(key: string, value: string) { storage.set(key, value); },
      async removeItem(key: string) { storage.delete(key); },
    },
    async art() {
      const art = await downloadRemoteWidgetArt(transport, PACK_BASE_URL, ref);
      previews = localWidgetArtOptions(remoteWidgetArtOptions(art.manifest), path => art.files.get(path) ?? null);
      return { options: previews, expectedOptions: remoteWidgetArtOptions(art.manifest), missing: art.missing, lastError: art.lastError };
    },
    widgets: {
      async artLibrary() { return { ...result, pieces: lib.pieces }; },
      async designVersion() { return 99; },
      async composeArtPiece(piece: { id: string; kind: string; artUri?: string }) {
        if (piece.kind !== 'design') {
          assert.equal(piece.kind, 'art', 'heroes use the theme background without a wallpaper pack');
          assert.ok(piece.artUri && cache.has(piece.artUri));
        }
        composed.push(piece);
        return result;
      },
      async commitThemeArt(id: string, planned: PlannedThemePiece[], ready: string[]) {
        lib = commitThemeArt(lib, id, planned, ready, 1).lib;
        return result;
      },
    },
  };
  const global = globalThis as typeof globalThis & { glazeWidgetArtTest?: typeof injected };
  global.glazeWidgetArtTest = injected;
  const modules: Record<string, string> = {
    '@react-native-async-storage/async-storage': 'export default globalThis.glazeWidgetArtTest.storage',
    '../i18n': 'export const t = key => key',
    '../native/packs': 'export const getPackState = () => ({ remoteArt: {} }), remoteArtFileUri = () => null, remoteWidgetArtOnDevice = globalThis.glazeWidgetArtTest.art',
    '../native/widgets': 'export const widgets = globalThis.glazeWidgetArtTest.widgets',
    '../ui/artPackSources': 'export const artPackHero = () => null, artPackWallpaper = () => null',
    '../ui/seamlessSetup': 'export const existingLocalFile = async uri => uri, localAssetUri = async () => null, seamlessDeviceHere = () => ({ px: { w: 1170, h: 2532 }, scale: 3, small: 474, medium: 1014, large: 1062 })',
    './countdownArtTargets': 'export const loadCountdownArtTargets = async () => ({})',
  };
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      const store = context.parentURL?.endsWith('/src/store/themeWidgetArt.ts');
      if (store && Object.hasOwn(modules, specifier)) {
        return { url: 'data:text/javascript,' + encodeURIComponent(modules[specifier]), shortCircuit: true };
      }
      return next(store && specifier.startsWith('.') ? specifier + '.ts' : specifier, context);
    },
  });
  try {
    const store = '../store/themeWidgetArt.ts';
    const { syncThemeWidgetArt, pendingThemeWidgetArt, themeWidgetArtDiagnostics } = await import(store);
    const pause = async () => {};
    const first = await syncThemeWidgetArt(theme, { yieldBetween: pause });
    assert.equal(first.ok, false);
    assert.equal(first.failed, 1);
    assert.deepEqual(themeWidgetArtDiagnostics(ref.id), {
      themeId: ref.id, planned: 24, composed: 21, failed: 0, missing: 3,
      lastError: editionError(requests),
    });
    assert.equal(await pendingThemeWidgetArt(), ref.id);
    assert.equal(previews.length, 7);
    assert.equal(composed.filter(p => p.kind === 'art').length, 21);

    requests.length = 0;
    moonOffline = false;
    const second = await syncThemeWidgetArt(theme, { yieldBetween: pause });
    assert.equal(second.ok, true);
    assert.deepEqual(themeWidgetArtDiagnostics(ref.id), {
      themeId: ref.id, planned: 24, composed: 24, failed: 0, missing: 0, lastError: null,
    });
    assert.equal(await pendingThemeWidgetArt(), null);
    assert.equal(requests.length, 1, 'retry requests only the pending file');
    assert.match(requests[0], /__widget-copper-eclipse\./);
    assert.equal(composed.filter(p => p.kind === 'art').length, 24);
    for (const size of sizes) {
      const shown = widgetOptionSections(previews.map(item => item.option), size).flatMap(group => group.options.map(o => o.id));
      assert.deepEqual(shown.sort(), editionIds);
      assert.equal(lib.pieces.filter(p => p.size === size && !p.live?.design).length, 8);
    }
  } finally {
    hooks.deregister();
    delete global.glazeWidgetArtTest;
  }
});
