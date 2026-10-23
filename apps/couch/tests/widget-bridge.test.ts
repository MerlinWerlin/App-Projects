/**
 * T77: src/native/widgetBridge.ts wraps a native module (modules/widget-bridge) that only exists in a
 * dev build. Without it (Expo Go, tests) the app gets a no-op bridge; with a fake module the wrapper
 * forwards calls and swallows native errors. Also checks the Plus boundary for the widget code.
 * Pure TS + fakes; nothing here touched a real phone, widget or TV.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UNAVAILABLE_WIDGET_BRIDGE } from '../src/core/widget/bridge';
import { _setWidgetBridgeDeps, hasWidgetBridge, loadWidgetBridge, type WidgetBridgeModule } from '../src/native/widgetBridge';

const root = join(__dirname, '..');

describe('widget bridge (native wrapper)', () => {
  afterEach(() => _setWidgetBridgeDeps());

  it('is unavailable and harmless without the module', async () => {
    const b = loadWidgetBridge();
    expect(b).toBe(UNAVAILABLE_WIDGET_BRIDGE);
    expect(b.available).toBe(false);
    expect(hasWidgetBridge()).toBe(false);
    await expect(b.setSnapshot('{}')).resolves.toBeUndefined();
    await expect(b.reloadTimelines()).resolves.toBeUndefined();
  });

  it('forwards to the native module when present', async () => {
    const calls: string[] = [];
    const mod: WidgetBridgeModule = {
      setSnapshot: async (json) => {
        calls.push(`set:${json}`);
      },
      reloadTimelines: async () => {
        calls.push('reload');
      },
    };
    _setWidgetBridgeDeps({ loadModule: () => mod });
    const b = loadWidgetBridge();
    expect(b.available).toBe(true);
    expect(hasWidgetBridge()).toBe(true);
    await b.setSnapshot('{"v":1}');
    await b.reloadTimelines();
    expect(calls).toEqual(['set:{"v":1}', 'reload']);
  });

  it('swallows native failures', async () => {
    _setWidgetBridgeDeps({
      loadModule: () => ({
        setSnapshot: () => Promise.reject(new Error('no app group')),
        reloadTimelines: () => Promise.reject(new Error('no widget')),
      }),
    });
    const b = loadWidgetBridge();
    await expect(b.setSnapshot('{}')).resolves.toBeUndefined();
    await expect(b.reloadTimelines()).resolves.toBeUndefined();
  });

  it('falls back when the loader throws', () => {
    _setWidgetBridgeDeps({
      loadModule: () => {
        throw new Error('native crash');
      },
    });
    expect(loadWidgetBridge()).toBe(UNAVAILABLE_WIDGET_BRIDGE);
  });

  it('the link handler never reads Couch Plus; only the hook does, via src/plus', () => {
    const handler = readFileSync(join(root, 'src/ui/widget/linkHandler.ts'), 'utf8');
    expect(handler).not.toMatch(/from\s+['"][^'"]*\/plus(\/|['"])/);
    const core = ['actions', 'links', 'tapGate', 'snapshot', 'bridge', 'index'].map((f) =>
      readFileSync(join(root, `src/core/widget/${f}.ts`), 'utf8'),
    );
    for (const src of core) expect(src).not.toMatch(/\/plus(\/|['"])/);
    const hook = readFileSync(join(root, 'src/ui/widget/useWidgetLinks.ts'), 'utf8');
    const plusImports = [...hook.matchAll(/from\s+['"]([^'"]*\/plus\/[^'"]*)['"]/g)].map((m) => m[1]);
    expect(plusImports).toEqual(['../../plus/state']);
  });
});
