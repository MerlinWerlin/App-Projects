import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import ts from 'typescript';

const detail = readFileSync('app/theme/[id].tsx', 'utf8');

// Execute the actual screen's event handlers, replacing Photos/navigation/store boundaries.
// This catches hidden apply calls, rather than asserting only that the four labels exist.
function handler(name: string, scope: Record<string, unknown>) {
  const start = detail.indexOf(`  const ${name} = `);
  assert.ok(start > 0);
  const end = detail.indexOf('\n  };', start) + '\n  };'.length;
  const code = ts.transpileModule(`${detail.slice(start, end)}\nmodule.exports = ${name};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: undefined as unknown };
  new Script(code).runInNewContext({ module, console, ...scope });
  return module.exports as (...args: unknown[]) => Promise<unknown>;
}

const nothing = () => undefined;
const theme = { id: 'B', wallpaper: { kind: 'gradient' } };
function forbiddenApply() { throw new Error('Preview or wallpaper-only action changed the active theme'); }

test('view widgets and view icons route to B without changing active theme A', async () => {
  const routes: unknown[] = [];
  const open = handler('openPart', {
    theme, remoteArt: null, locked: false, lockFor: { current: '' }, setLockOpen: nothing,
    router: { push: (route: unknown) => routes.push(route) },
    applyWidgetTheme: forbiddenApply, applyThemeEverywhere: forbiddenApply,
  });
  await open('widgets', false);
  await open('icons', false);
  assert.equal(JSON.stringify(routes), JSON.stringify([
    { pathname: '/theme/[id]', params: { id: 'B', step: 'widgets' } },
    { pathname: '/theme/[id]', params: { id: 'B', step: 'icons' } },
  ]));
});

test('Add the wallpaper saves B and records its checklist without publishing B as the widget theme', async () => {
  const saved: unknown[] = [], checked: unknown[] = [];
  const save = handler('onSaveWallpaper', {
    wallSource: 'theme', theme, size: { width: 1179, height: 2556 }, remoteArt: null,
    photo: null, artPack: null, spacePhoto: {}, remoteWallpaperUri: null,
    saver: { save: async (wallpaper: unknown) => { saved.push(wallpaper); return { ok: true }; } },
    setSavedFrom: nothing, setSaveWhy: nothing, setSaveState: nothing, setSavedBefore: nothing,
    haptic: nothing, AccessibilityInfo: { announceForAccessibility: nothing }, t: (key: string) => key,
    rememberWallpaperSaved: (id: string) => checked.push(id), tickStoredChecklist: nothing,
    applyWidgetTheme: forbiddenApply, applyThemeEverywhere: forbiddenApply,
  });
  assert.equal(await save(), true);
  assert.equal(saved[0], theme.wallpaper);
  assert.deepEqual(checked, ['B']);
});

test('icon-only setup changes the icon export style without publishing B to widgets', async () => {
  const applied: unknown[] = [], navigated: unknown[] = [];
  const use = handler('onUseStyle', {
    styleBusy: false, theme, setStyleBusy: nothing, setStyleError: nothing,
    applyThemeIcons: async (value: unknown) => { applied.push(value); }, averageColour: nothing,
    studio: { reload: async () => undefined }, tickStoredChecklist: nothing,
    requestDeferred: nothing, DEFERRED_STEPS: { installedProbe: 'probe' },
    router: { navigate: (route: unknown) => navigated.push(route) },
    applyWidgetTheme: forbiddenApply, applyThemeEverywhere: forbiddenApply,
  });
  await use('/install');
  assert.equal(applied[0], theme);
  assert.deepEqual(navigated, ['/install']);
});

// Owner 2026-11-08 ("swapping themes is no longer swapping it across to widgets"): choosing a theme
// swaps the widgets whichever action follows, and a declined or failed wallpaper save never blocks it.
const selectScope = (events: string[], focus = { current: 1 }) => ({
  themeFocus: focus, theme, setUseError: nothing, haptic: nothing, playApply: nothing,
  AccessibilityInfo: { announceForAccessibility: nothing }, t: (key: string) => key, console,
  applyThemeEverywhere: async (value: typeof theme) => { events.push(value.id); return { icons: true, widgets: true }; },
});

test('Use everything publishes B first, then saves the wallpaper, then opens its icon setup', async () => {
  const events: string[] = [];
  const select = handler('selectTheme', selectScope(events));
  const use = handler('putInUse', {
    usePending: { current: false }, locked: false, themeFocus: { current: 1 }, theme,
    setThemeChoiceOpen: nothing, setUseBusy: nothing, setUseError: nothing, selectTheme: select,
    onSaveWallpaper: async () => { events.push('wallpaper'); return true; },
    toast: { show: nothing }, t: (key: string) => key,
    // Owner 2026-11-14: the walkthrough the first time, then the install screen, every time.
    openIconSetup: async () => { events.push('icons'); },
  });
  await use();
  assert.deepEqual(events, ['B', 'wallpaper', 'icons']);
});

test('Use everything still swaps the widgets when the wallpaper save is declined', async () => {
  const events: string[] = [], notes: unknown[] = [];
  const select = handler('selectTheme', selectScope(events));
  const use = handler('putInUse', {
    usePending: { current: false }, locked: false, themeFocus: { current: 1 }, theme,
    setThemeChoiceOpen: nothing, setUseBusy: nothing, setUseError: nothing, selectTheme: select,
    onSaveWallpaper: async () => false, toast: { show: (m: unknown) => notes.push(m) }, t: (key: string) => key,
    openIconSetup: async () => undefined,
  });
  await use();
  assert.deepEqual(events, ['B']);
  assert.equal(notes.length, 1);
});

test('a theme screen the person already left publishes nothing', async () => {
  const events: string[] = [];
  const focus = { current: 2 };
  const select = handler('selectTheme', selectScope(events, focus));
  assert.equal(await select(1), false);
  assert.deepEqual(events, []);
});

test('each theme choice puts an unlocked theme that is not in use on the widgets', async () => {
  const events: string[] = [];
  const select = handler('selectTheme', selectScope(events));
  const pick = (scope: Record<string, unknown>) => handler('ensureSelected', {
    usePending: { current: false }, setUseError: nothing, selectTheme: select, ...scope,
  });
  pick({ locked: false, inUse: false })();
  pick({ locked: false, inUse: true })();
  pick({ locked: true, inUse: false })();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(events, ['B']);
});

test('Use this theme opens the choices and swaps the widgets at once', async () => {
  const events: string[] = [];
  let open = false;
  const select = handler('selectTheme', selectScope(events));
  const use = handler('onUseTheme', {
    setThemeChoiceOpen: (v: boolean) => { open = v; }, locked: false, inUse: false,
    usePending: { current: false }, setUseError: nothing, selectTheme: select,
  });
  use();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(open, true);
  assert.deepEqual(events, ['B']);
});
