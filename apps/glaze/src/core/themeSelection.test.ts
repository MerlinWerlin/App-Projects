import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { ACTIVE_THEME_KEY } from './activeTheme.ts';
import { THEMES } from './themes.ts';
import { ACTIVE_WIDGET_THEME_KEY } from './widgetTheme.ts';

test('A → B → A keeps the selected theme, persisted theme and WidgetKit write in tap order', { timeout: 5000 }, async () => {
  const [a, b] = THEMES;
  const writes: string[] = [];
  const values = new Map<string, string>();
  const savedId = (key: string) => JSON.parse(values.get(key) ?? '{}').themeId;
  let releaseB!: () => void;
  let announceB!: () => void;
  const wait = new Promise<void>(resolve => { releaseB = resolve; });
  const started = new Promise<void>(resolve => { announceB = resolve; });
  const mock = {
    storage: {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => { values.set(key, value); },
      multiSet: async (pairs: [string, string][]) => { for (const pair of pairs) values.set(...pair); },
    },
    icons: async (theme: { id: string }) => {
      if (theme.id === b.id) await wait;
    },
    write: async (theme: { themeId: string }) => {
      writes.push(theme.themeId);
      if (theme.themeId === b.id) announceB();
      return { available: true, ok: true };
    },
  };
  const injected = globalThis as typeof globalThis & { glazeThemeTest?: typeof mock };
  injected.glazeThemeTest = mock;
  const modules: Record<string, string> = {
    '@react-native-async-storage/async-storage': 'export default globalThis.glazeThemeTest.storage',
    'expo-router': 'export const useFocusEffect = () => {}',
    'react': 'export const useCallback = () => {}, useEffect = () => {}, useRef = () => {}, useState = () => {}',
    '../native/packs': 'export const syncPackClockFace = () => {}, refreshCatalog = async () => {}',
    '../native/widgets': 'export const widgets = { setTheme: globalThis.glazeThemeTest.write }',
    './studio': 'export const applyThemeIcons = globalThis.glazeThemeTest.icons; export const loadStudio = async () => ({ themeId: null })',
    './themeLookup': 'export const findAnyThemeById = async () => null',
    './deferredWork': 'export const registerDeferred = () => {}, requestDeferred = () => {}, DEFERRED_STEPS = { widgetTheme: "widgetTheme" }',
    './themeWidgetArt': 'export const supersedeThemeWidgetArt = () => {}, syncThemeWidgetArt = async () => ({ ok: true })',
  };
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      const store = /\/src\/store\/(?:activeTheme|widgetTheme)\.ts$/.test(context.parentURL ?? '');
      if (store && Object.hasOwn(modules, specifier)) {
        return { url: 'data:text/javascript,' + encodeURIComponent(modules[specifier]), shortCircuit: true };
      }
      if (store && specifier.startsWith('.') && !specifier.endsWith('.ts')) {
        return next(specifier + '.ts', context);
      }
      return next(specifier, context);
    },
  });
  try {
    // Node resolves these with the hooks above; the Node-only TS project need not compile RN.
    const activeStore = '../store/activeTheme.ts';
    const widgetStore = '../store/widgetTheme.ts';
    const { applyThemeEverywhere, loadActiveThemeId } = await import(activeStore);
    const { applyWidgetTheme, pushStoredWidgetTheme } = await import(widgetStore);
    await applyThemeEverywhere(a);
    assert.equal(await loadActiveThemeId(), a.id);
    assert.equal(savedId(ACTIVE_THEME_KEY), a.id);
    assert.equal(savedId(ACTIVE_WIDGET_THEME_KEY), a.id);

    const swapToB = applyThemeEverywhere(b);
    await started;
    const restore = pushStoredWidgetTheme();
    const lateWallpaper = applyWidgetTheme(a);
    const swapBackToA = applyThemeEverywhere(a);
    await Promise.all([restore, lateWallpaper, swapBackToA]);
    assert.deepEqual(writes, [a.id, b.id, b.id, a.id], 'native writes finish even while B icon work is blocked');
    releaseB();
    await swapToB;
    await Promise.all([applyThemeEverywhere(b), applyThemeEverywhere(a)]);
    assert.deepEqual(writes.slice(-2), [b.id, a.id]);
    assert.equal(await loadActiveThemeId(), a.id);
    assert.equal(savedId(ACTIVE_THEME_KEY), a.id);
    assert.equal(savedId(ACTIVE_WIDGET_THEME_KEY), a.id);
  } finally {
    hooks.deregister();
    delete injected.glazeThemeTest;
  }
});
