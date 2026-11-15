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

test('view icons routes to B without changing active theme A; view widgets goes through openWidgetsTab', async () => {
  const routes: unknown[] = [];
  const tabs: unknown[] = [];
  const open = handler('openPart', {
    theme, remoteArt: null, locked: false, lockFor: { current: '' }, setLockOpen: nothing,
    router: { push: (route: unknown) => routes.push(route) },
    // 1.0.39: View widgets opens the real Widgets tab (with the theme put in use first).
    openWidgetsTab: async (checkLock: boolean) => { tabs.push(checkLock); },
    applyWidgetTheme: forbiddenApply, applyThemeEverywhere: forbiddenApply,
  });
  await open('widgets', false);
  await open('icons', false);
  assert.deepEqual(tabs, [false]);
  assert.equal(JSON.stringify(routes), JSON.stringify([{ pathname: '/theme/[id]', params: { id: 'B', step: 'icons' } }]));
});

test('View widgets with this theme: puts a theme not in use in use, then opens the Widgets tab', async () => {
  for (const inUse of [false, true]) {
    const events: string[] = [];
    const go = handler('openWidgetsTab', {
      setThemeChoiceOpen: nothing, locked: false, inUse, lockFor: { current: '' }, setLockOpen: nothing,
      selectTheme: async () => { events.push('select'); return true; },
      router: { navigate: (route: string) => events.push(route) },
    });
    await go();
    assert.deepEqual(events, inUse ? ['/widgets'] : ['select', '/widgets'], String(inUse));
  }
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
  // 1.0.39: a bundled / already downloaded theme (no pack download before the apply).
  remoteArt: null, pack: { usable: true, download: async () => 'ok' }, locked: false,
  themeFocus: focus, theme, setUseError: nothing, haptic: nothing, playApply: nothing,
  AccessibilityInfo: { announceForAccessibility: nothing }, t: (key: string) => key, console,
  applyThemeEverywhere: async (value: typeof theme) => { events.push(value.id); return { icons: true, widgets: true }; },
});

test('"Use this theme?" accepted publishes B, then shows the next-steps checklist (no wallpaper save, no icon jump)', async () => {
  const events: string[] = [];
  const opened: boolean[] = [];
  const select = handler('selectTheme', selectScope(events));
  const use = handler('putInUse', {
    usePending: { current: false }, locked: false, themeFocus: { current: 1 }, theme,
    setThemeChoiceOpen: (v: boolean) => opened.push(v), setUseBusy: nothing, setUseError: nothing, selectTheme: select,
    onSaveWallpaper: async () => { events.push('wallpaper'); return true; },
    openIconSetup: async () => { events.push('icons'); },
    console,
  });
  await use();
  assert.deepEqual(events, ['B']);
  assert.deepEqual(opened, [true]);
});

test('a failed apply shows the calm error and no checklist', async () => {
  const opened: boolean[] = [];
  let error = false;
  const use = handler('putInUse', {
    usePending: { current: false }, locked: false, themeFocus: { current: 1 }, theme,
    setThemeChoiceOpen: (v: boolean) => opened.push(v), setUseBusy: nothing, setUseError: (v: boolean) => { error = v || error; },
    selectTheme: async () => { throw new Error('bridge'); }, console: { warn: nothing },
  });
  await use();
  assert.deepEqual(opened, []);
  assert.equal(error, true);
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

test('the bar button: not in use, it applies at once; in use, it reopens the next steps', async () => {
  const events: string[] = [];
  let open = false;
  const select = handler('selectTheme', selectScope(events));
  const put = handler('putInUse', {
    usePending: { current: false }, locked: false, themeFocus: { current: 1 }, theme,
    setThemeChoiceOpen: (v: boolean) => { open = v; }, setUseBusy: nothing, setUseError: nothing, selectTheme: select, console,
  });
  handler('onUseTheme', { inUse: false, putInUse: put, setThemeChoiceOpen: (v: boolean) => { open = v; } })();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(open, true);
  assert.deepEqual(events, ['B']);
  open = false;
  handler('onUseTheme', { inUse: true, putInUse: put, setThemeChoiceOpen: (v: boolean) => { open = v; } })();
  assert.equal(open, true);
  assert.deepEqual(events, ['B'], 'already in use: nothing applied again');
});

// 1.0.39 (owner TestFlight 1.0.37: "when I hit use the theme, it doesn't do anything because I haven't
// hit use everything"): a pack theme not on the phone is downloaded BEFORE the apply, so the widget-art
// sync the apply starts finds its pieces; offline, the theme is still applied.
test('choosing a pack theme downloads its pack first, then applies it; a failed download still applies', async () => {
  for (const outcome of ['ok', 'throws'] as const) {
    const events: string[] = [];
    const select = handler('selectTheme', {
      ...selectScope(events),
      remoteArt: { id: 'B' },
      pack: {
        usable: false,
        download: async () => {
          events.push('download');
          if (outcome === 'throws') throw new Error('offline');
          return 'ok';
        },
      },
    });
    assert.equal(await select(), true);
    assert.deepEqual(events, ['download', 'B'], outcome);
  }
  // Left for another theme during the download: nothing is applied.
  const events: string[] = [];
  const focus = { current: 1 };
  const select = handler('selectTheme', {
    ...selectScope(events, focus),
    remoteArt: { id: 'B' },
    pack: { usable: false, download: async () => { focus.current = 2; return 'ok'; } },
  });
  assert.equal(await select(), false);
  assert.deepEqual(events, []);
});
