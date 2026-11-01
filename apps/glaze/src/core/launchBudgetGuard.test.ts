// T250 (owner-1101h #1) launch-budget guard. After "Use this theme" (Firefly Grove) and coming back
// into Glaze the app froze, took long to start and crashed. The heavy work (installed-app probe,
// widget art index, App Group write + timeline reload, pack restore / verification, pack updates)
// must never sit on the launch path or inside applyThemeEverywhere: it goes through the deferred
// queue (src/store/deferredWork.ts, steps registered in src/store/launchWork.ts). Source guard, in
// the style of the other *Guard tests, plus the probe throttle maths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DEFERRED_STEPS } from './deferredWork.ts';
import { PROBE_CHUNK, PROBE_INTERVAL_MS, parseProbeLastRun, probeDue, schemesToQuery } from './installedProbe.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\w])\/\/.*$/gm, '$1');

/** The heavy calls that must never be awaited / started directly on the launch path or in apply. */
const HEAVY = [
  /\brunInstalledProbe\w*\(/,
  /\bprobeSchemes\(/,
  /\breplaceThemeArt\(/,
  /\bmigrateArtLibrary\(/,
  /\baddToArtLibrary\(/,
  /\brestoreDownloadedPacks\(/,
  /\brestorePackMotifs\(/,
  /\bremoteArtOnDevice\(/,
  /\bloadRemoteArt\w*\(/,
  /\brunPackUpdates\(/,
  /\bverifyAsset\(/,
  /\bsha256Hex\(/,
  /\bapplyWidgetTheme\(/,
  /\bpushStoredWidgetTheme\(/,
  /\bsyncWidgetThemeAtLaunch\(/,
  /\bwidgets\.setTheme\(/,
  /\bsetWidgetArtIndex\(/,
];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

function fnBody(src: string, header: RegExp): string {
  const m = header.exec(src);
  assert.ok(m, `found ${header}`);
  const open = src.indexOf('{', m.index + m[0].length - 1);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error('unbalanced');
}

test('app/_layout.tsx runs nothing heavy at module load or launch: it only starts the deferred launch work', () => {
  const layout = strip(read('app', '_layout.tsx'));
  for (const re of HEAVY) assert.doesNotMatch(layout, re, `app/_layout.tsx must not call ${re}`);
  assert.doesNotMatch(layout, /from '[^']*(native\/packs|store\/installedProbe|store\/widgetTheme|native\/widgets)'/);
  assert.match(layout, /import \{ startLaunchWork \} from '\.\.\/src\/store\/launchWork';/);
  assert.match(layout, /useEffect\(\(\) => \{\s*startLaunchWork\(\);\s*\}, \[\]\);/);
  // Module scope: only the splash calls (no pack restore at import time any more).
  const moduleScope = layout.slice(0, layout.indexOf('export function ErrorBoundary'));
  const calls = [...moduleScope.matchAll(/^([A-Za-z_][\w.]*)\(/gm)].map((m) => m[1]);
  assert.deepEqual(calls, ['SplashScreen.preventAutoHideAsync']);
});

test('applyThemeEverywhere returns after the essential writes; heavy follow-ups are queued, never awaited', () => {
  const store = strip(read('src', 'store', 'activeTheme.ts'));
  const fn = fnBody(store, /export async function applyThemeEverywhere\(theme: Theme\): Promise<ApplyResult> \{/);
  for (const re of HEAVY) assert.doesNotMatch(fn, re, `applyThemeEverywhere must not call ${re}`);
  // The essential state: icon style, remembered widget theme, theme in use, listeners.
  assert.match(fn, /await applyThemeIcons\(theme, /);
  assert.match(fn, /await rememberWidgetTheme\(theme\)/);
  assert.match(fn, /AsyncStorage\.setItem\(ACTIVE_THEME_KEY/);
  // Queued after the theme in use is stored (the steps read it back when resumed next launch).
  const stored = fn.indexOf('ACTIVE_THEME_KEY');
  for (const step of ['widgetTheme', 'themeArt', 'installedProbe']) {
    const at = fn.search(new RegExp(`requestDeferred\\(DEFERRED_STEPS\\.${step}\\b`));
    assert.ok(at > stored, `${step} is requested after the essential write`);
  }
  assert.doesNotMatch(fn, /await requestDeferred/);
  // The heavy art call lives in the step the queue runs.
  const step = fnBody(store, /async function themeArtStep\(arg: unknown\): Promise<void> \{/);
  assert.match(step, /nativeWidgets\.replaceThemeArt\(/);
  assert.match(store, /registerDeferred\(DEFERRED_STEPS\.themeArt, \{[^}]*run: themeArtStep/);
});

test('every deferred step is registered before the queue starts, and it starts after the first screen', () => {
  const launch = strip(read('src', 'store', 'launchWork.ts'));
  const active = strip(read('src', 'store', 'activeTheme.ts'));
  for (const name of Object.values(DEFERRED_STEPS)) {
    const re = new RegExp(`registerDeferred\\(DEFERRED_STEPS\\.${name},`);
    assert.ok(re.test(launch) || re.test(active), `${name} is registered`);
  }
  // activeTheme.ts registers 'themeArt' at import, so launchWork imports it before anything starts.
  assert.match(launch, /^import '\.\/activeTheme';$/m);
  const start = fnBody(launch, /export function startLaunchWork\(\): void \{/);
  assert.match(start, /whenFirstScreen\(/);
  assert.match(start, /startDeferred/);
  assert.match(start, /requestDeferred\(DEFERRED_STEPS\.packRestore\)/);
  assert.match(start, /requestDeferred\(DEFERRED_STEPS\.widgetTheme\)/);
  assert.match(start, /requestDeferred\(DEFERRED_STEPS\.installedProbe, reason\)/);
  assert.match(start, /const reason: ProbeReason = 'launch';/);
  for (const re of HEAVY) assert.doesNotMatch(start, re, `startLaunchWork must only queue (${re})`);
  // The queue yields to interactions between steps (capped, so it can never stall).
  const q = strip(read('src', 'store', 'deferredWork.ts'));
  assert.match(q, /InteractionManager\.runAfterInteractions\(/);
  assert.match(q, /yieldTurn: yieldToUi/);
});

test('installed-app probe: throttled to once a day on launch, chunked, and only ever started by the queue', () => {
  const store = strip(read('src', 'store', 'installedProbe.ts'));
  assert.match(store, /probeDue\(last, Date\.now\(\), reason\)/);
  assert.match(store, /chunked\(schemesToQuery\(\), PROBE_CHUNK\)/);
  assert.match(store, /if \(i > 0\) await yieldToUi\(\);/);
  assert.doesNotMatch(store, /probeSchemes\(schemesToQuery\(\)\)/, 'never all schemes in one go');
  assert.doesNotMatch(store, /runInstalledProbeOnLaunch/);
  // Nobody outside the store and the queue's step calls it.
  for (const f of [...walk(join(root, 'app')), ...walk(join(root, 'src'))]) {
    const rel = relative(root, f);
    if (rel === join('src', 'store', 'installedProbe.ts')) continue;
    const src = strip(readFileSync(f, 'utf8'));
    assert.doesNotMatch(src, /\brunInstalledProbe\(/, `${rel} must request DEFERRED_STEPS.installedProbe instead`);
    if (rel !== join('src', 'store', 'launchWork.ts')) assert.doesNotMatch(src, /\brunInstalledProbeStep\(/, rel);
  }
  // Theme apply and icon install ask for one probe each.
  assert.match(strip(read('app', 'theme', '[id].tsx')), /requestDeferred\(DEFERRED_STEPS\.installedProbe, 'apply'\)/);
  assert.match(strip(read('app', 'install.tsx')), /requestDeferred\(DEFERRED_STEPS\.installedProbe, 'install'\)/);
});

test('probe throttle maths: 24 h on launch, always after an apply / install', () => {
  assert.equal(PROBE_INTERVAL_MS, 24 * 60 * 60 * 1000);
  assert.ok(PROBE_CHUNK >= 1 && PROBE_CHUNK <= 10);
  assert.ok(schemesToQuery().length > PROBE_CHUNK, 'more than one chunk today, so the yield matters');
  const now = 1_800_000_000_000;
  assert.equal(probeDue(null, now, 'launch'), true);
  assert.equal(probeDue(now - 60_000, now, 'launch'), false);
  assert.equal(probeDue(now - PROBE_INTERVAL_MS + 1, now, 'launch'), false);
  assert.equal(probeDue(now - PROBE_INTERVAL_MS, now, 'launch'), true);
  assert.equal(probeDue(now + 60_000, now, 'launch'), true, 'clock moved back: probe');
  assert.equal(probeDue(now - 60_000, now, 'apply'), true);
  assert.equal(probeDue(now - 60_000, now, 'install'), true);
  assert.equal(parseProbeLastRun('123'), 123);
  assert.equal(parseProbeLastRun('junk'), null);
  assert.equal(parseProbeLastRun(null), null);
});

test('downloaded packs: no re-hash on first read, restore yields per pack, updates go through the queue', () => {
  const packs = strip(read('src', 'native', 'packs.ts'));
  const onDevice = fnBody(packs, /export function remoteArtOnDevice\(id: string\): Promise<RemoteArtManifest \| null> \{/);
  assert.match(onDevice, /loadRemoteArtQuick\(deviceTransport, id\)/);
  assert.doesNotMatch(onDevice, /\bloadRemoteArt\(/);
  assert.match(packs, /async size\(rel\) \{\s*const info = await fs\.getInfoAsync\(uri\(rel\)\);/);
  const restore = fnBody(packs, /export function restoreDownloadedPacks\(\): Promise<void> \{/);
  assert.match(restore, /restorePackMotifs\(deviceTransport, state\.index, \(_t, id\) => packContentOnDevice\(id\), nextTick\)/);
  const refresh = fnBody(packs, /export function refreshCatalog\(force = false\): Promise<void> \{/);
  assert.doesNotMatch(refresh, /runPackUpdates\(/);
  assert.match(refresh, /schedulePackUpdates\(\)/);
  assert.match(strip(read('src', 'store', 'launchWork.ts')), /setPackUpdateScheduler\(\(\) => requestDeferred\(DEFERRED_STEPS\.packUpdates\)\)/);
});

test('foreground (AppState active) handlers never start heavy work directly', () => {
  let seen = 0;
  for (const f of [...walk(join(root, 'app')), ...walk(join(root, 'src'))]) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/AppState\.addEventListener\('change',/g)) {
      seen++;
      const body = src.slice(m.index, m.index + 400);
      for (const re of HEAVY) assert.doesNotMatch(body, re, `${relative(root, f)}: foreground handler calls ${re}`);
    }
  }
  assert.ok(seen >= 2, 'found the AppState handlers');
});
