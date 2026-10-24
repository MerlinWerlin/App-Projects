/**
 * Native modules that need a dev build (react-native-udp, react-native-zeroconf) must only be loaded
 * through a guarded require so Expo Go never crashes. Pure TS + Node built-ins.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nativeCapabilities, loadUdpFactory, loadZeroconf } from '../src/native';
import { loadPersistentKv } from '../src/native/kv';
import { hasStoreReview, loadStoreReview } from '../src/native/storeReview';
import { hasMediaServer, loadMediaServer } from '../src/native/mediaServer';
import { hasWidgetBridge, loadWidgetBridge } from '../src/native/widgetBridge';
import { hasRoutePicker, showRoutePicker } from '../src/native/routePicker';
import { hasMediaPicker } from '../src/native/mediaPicker';

const nativeDir = join(__dirname, '..', 'src', 'native');
const NATIVE = [
  'react-native-udp',
  'react-native-zeroconf',
  '../../modules/ir-blaster',
  'expo-modules-core',
  '@react-native-async-storage/async-storage',
  'expo-network',
  'expo-store-review', // T75 (run 42)
  '../../modules/media-server', // T76 (casting; needs a dev build)
  '../../modules/widget-bridge', // T77 (Home Screen widget; needs a dev build)
  '../../modules/route-picker', // T92 (AirPlay route picker; iOS dev build only)
  'expo-image-picker', // cast-1024 T91 (Cast tab picker)
];
const sources = readdirSync(nativeDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ f, src: readFileSync(join(nativeDir, f), 'utf8') }));

describe('native module guard', () => {
  it('scans src/native', () => {
    expect(sources.map((s) => s.f).sort()).toEqual(expect.arrayContaining(['index.ts', 'kv.ts', 'mediaServer.ts', 'routePicker.ts', 'udp.ts', 'widgetBridge.ts', 'zeroconf.ts']));
  });

  it('has no static import of optional native modules', () => {
    for (const { f, src } of sources) {
      for (const mod of NATIVE) {
        const staticImport = new RegExp(`(^|\\n)\\s*(import|export)\\b[^;]*['"]${mod}['"]`);
        expect({ f, mod, staticImport: staticImport.test(src) }).toEqual({ f, mod, staticImport: false });
      }
    }
  });

  it('every require of a native module sits inside a try block', () => {
    for (const { f, src } of sources) {
      const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
      for (let m = re.exec(src); m; m = re.exec(src)) {
        const before = src.slice(0, m.index);
        const lastTry = before.lastIndexOf('try {');
        const lastCatch = before.lastIndexOf('} catch');
        expect({ f, mod: m[1], guarded: lastTry > lastCatch && lastTry >= 0 }).toEqual({ f, mod: m[1], guarded: true });
        // and not at top level: the require is indented inside a function
        const lineStart = before.lastIndexOf('\n') + 1;
        expect(src.slice(lineStart, m.index).startsWith('  ')).toBe(true);
      }
    }
  });

  it('src/core never imports src/native', () => {
    const coreDir = join(__dirname, '..', 'src', 'core');
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.ts') ? [join(d, e.name)] : [],
      );
    const offenders = walk(coreDir).filter((p) => /from\s+['"][^'"]*\/native(\/|['"])/.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('returns null / false when the modules are not installed', async () => {
    expect(nativeCapabilities()).toEqual({ udp: false, zeroconf: false });
    expect(loadUdpFactory()).toBeNull();
    expect(loadZeroconf()).toBeNull();
    expect(loadPersistentKv()).toBeNull();
    // T75 (run 42)
    expect(loadStoreReview()).toBeNull();
    expect(hasStoreReview()).toBe(false);
    // T76: casting's local file server
    expect(loadMediaServer().available).toBe(false);
    expect(hasMediaServer()).toBe(false);
    // cast-1024 T91: photo / video picker
    expect(hasMediaPicker()).toBe(false);
    // T77: Home Screen widget bridge
    expect(loadWidgetBridge().available).toBe(false);
    expect(hasWidgetBridge()).toBe(false);
    // T92: AirPlay route picker
    expect(hasRoutePicker()).toBe(false);
    await expect(showRoutePicker()).resolves.toBe(false);
  });
});
