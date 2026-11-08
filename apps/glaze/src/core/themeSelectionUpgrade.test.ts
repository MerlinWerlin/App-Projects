import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import ts from 'typescript';
import * as activeCore from './activeTheme.ts';
import * as widgetCore from './widgetTheme.ts';
import * as galleryCore from './widgetGalleryTheme.ts';
import { THEMES, type Theme } from './themes.ts';
import { DEFERRED_STEPS } from './deferredWork.ts';

// Execute the actual stores. Only platform boundaries are replaced: AsyncStorage, the native
// bridge, React hooks and the separate icon/art workers. Delayed reads model an upgraded phone.
function loadStore(file: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(`src/store/${file}.ts`, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Script(code, { filename: file }).runInNewContext({
    module, exports: module.exports, console, __DEV__: false, setTimeout, clearTimeout,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected platform dependency: ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

type Writer = {
  applyWidgetTheme(theme: Theme): Promise<boolean>;
  pushStoredWidgetTheme(): Promise<boolean>;
};
type Selection = {
  applyThemeEverywhere(theme: Theme): Promise<{ icons: boolean; widgets: boolean }>;
  loadActiveThemeId(): Promise<string | null>;
};
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 1));
const A = THEMES[0], B = THEMES[1];

function phone(options: { slowIcons?: Promise<void> } = {}) {
  const values = new Map<string, string>([
    [activeCore.ACTIVE_THEME_KEY, activeCore.serializeActiveTheme({ themeId: A.id, at: 1 })],
    // Deliberately stale widget state, as on a phone upgraded through earlier releases.
    [widgetCore.ACTIVE_WIDGET_THEME_KEY, widgetCore.serializeWidgetTheme(galleryCore.widgetGalleryTheme(B))],
  ]);
  const storage = {
    async getItem(key: string) { const old = values.get(key) ?? null; await pause(); return old; },
    async setItem(key: string, value: string) { await pause(); values.set(key, value); },
    async multiSet(entries: string[][]) {
      await pause();
      for (const [key, value] of entries) values.set(key, value);
    },
  };
  const published: string[] = [], composed: string[] = [];
  const steps = new Map<string, { run(arg?: unknown): Promise<void> }>();
  const deferred = {
    DEFERRED_STEPS,
    requestDeferred() {},
    registerDeferred(name: string, step: { run(arg?: unknown): Promise<void> }) { steps.set(name, step); },
  };
  const native = { async setTheme(theme: { themeId: string }) {
    await pause(); published.push(theme.themeId); return { available: true, ok: true };
  } };
  const lookup = { findAnyThemeById: async (id: string) => [A, B].find(theme => theme.id === id) ?? null };
  const iconQueue = activeCore.createThemeWriteQueue();
  let iconTheme = A.id;
  const studio = {
    loadStudio: async () => ({ themeId: iconTheme }),
    applyThemeIcons: (theme: Theme) => iconQueue(async () => {
      if (options.slowIcons) await options.slowIcons;
      await pause(); iconTheme = theme.id;
    }),
  };
  const writer = loadStore('widgetTheme', {
    '@react-native-async-storage/async-storage': storage,
    '../core/activeTheme': activeCore, '../core/themes': { THEMES },
    '../core/widgetGalleryTheme': galleryCore, '../core/widgetTheme': widgetCore,
    '../native/widgets': { widgets: native }, './studio': studio,
    './themeLookup': lookup, './deferredWork': deferred,
  }) as Writer;
  const selection = loadStore('activeTheme', {
    '@react-native-async-storage/async-storage': storage,
    'expo-router': {}, react: {}, '../core/activeTheme': activeCore,
    '../core/deferredWork': { DEFERRED_STEPS },
    '../core/designedWidgets': { DESIGNED_WIDGET_CAPABILITY: 1 },
    '../core/themeArtResume': { themeArtResumePlan: () => ({ kind: 'none' }) },
    '../core/wallpaper': { averageColour: () => '#000000' },
    '../native/widgets': { widgets: native }, './deferredWork': deferred,
    './studio': studio, './themeLookup': lookup, './widgetTheme': writer,
    './themeWidgetArt': {
      supersedeThemeWidgetArt() {},
      async syncThemeWidgetArt(theme: Theme) { composed.push(theme.id); return { available: true, ok: true }; },
    },
  }) as Selection;
  async function art(oldArgument: Theme) {
    await steps.get(DEFERRED_STEPS.themeArt)!.run(oldArgument);
  }
  async function matches(theme: Theme) {
    assert.equal(await selection.loadActiveThemeId(), theme.id);
    assert.equal(activeCore.parseActiveTheme(values.get(activeCore.ACTIVE_THEME_KEY))?.themeId, theme.id);
    assert.equal(widgetCore.parseWidgetTheme(values.get(widgetCore.ACTIVE_WIDGET_THEME_KEY))?.themeId, theme.id);
    assert.equal(published.at(-1), theme.id);
    assert.equal(iconTheme, theme.id);
  }
  return { writer, selection, art, matches, published, composed };
}

test('upgraded phone: A → B → A publishes the chosen theme and art at every step', async () => {
  const p = phone();
  for (const [theme, stale] of [[A, B], [B, A], [A, B]]) {
    await p.selection.applyThemeEverywhere(theme);
    // A deferred job can retain an earlier argument from before the app was upgraded.
    await p.art(stale);
    await p.matches(theme);
    assert.equal(p.composed.at(-1), theme.id);
  }
});

test('overlapping selections and late preview writes still end on the last explicit A', async () => {
  const p = phone();
  const work = [A, B, A].map(theme => p.selection.applyThemeEverywhere(theme));
  work.push(p.writer.applyWidgetTheme(B).then(() => ({ icons: true, widgets: true })));
  await Promise.all(work);
  await p.writer.pushStoredWidgetTheme();
  await p.art(B);
  await p.matches(A);
  assert.equal(p.composed.at(-1), A.id);
});

test('a launch restore reading old widget state cannot overwrite a later explicit selection', async () => {
  const p = phone();
  await Promise.all([p.writer.pushStoredWidgetTheme(), p.selection.applyThemeEverywhere(B)]);
  await p.writer.applyWidgetTheme(A);
  await p.writer.pushStoredWidgetTheme();
  await p.matches(B);
});

test('Clock/Battery/Calendar publication does not wait for slow icon work', async () => {
  let finishIcons!: () => void;
  const p = phone({ slowIcons: new Promise<void>(resolve => { finishIcons = resolve; }) });
  const applying = p.selection.applyThemeEverywhere(B);
  try {
    const deadline = Date.now() + 500;
    while (!p.published.length && Date.now() < deadline) await pause();
    assert.equal(p.published.at(-1), B.id);
    assert.equal(p.composed.length, 0);
  } finally { finishIcons(); }
  await applying;
  await p.matches(B);
});
