// Glaze 1.0.42: first App Store review. Guards for the review fixes: generic widget art names,
// privacy manifests, camera / microphone strings, debug rows, support address comment, store docs.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { optionName, widgetOptionsFromV1, widgetOptionsOfPack, type WidgetOption } from './widgetOptions.ts';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');
const GENERIC = /^Art \d+$/;

type Manifest = { id: string; name?: string; version: number; widgets?: unknown; assets: { path: string; role: string; width: number; height: number }[]; meta?: { name?: string } };

/** Every name a piece can show (EN catalogue strings for keys), as the Widgets tab and My widget art do. */
function shownName(option: WidgetOption, all: readonly WidgetOption[], themeName: string): string {
  const n = optionName(option, all, themeName);
  if ('text' in n) return n.text;
  assert.notEqual(n.key, 'tabs.widgetsTab.art.numbered', `${themeName}/${option.id} falls back to "Art n"`);
  return n.key;
}

function checkPack(where: string, m: Manifest, bad: string[]) {
  const themeName = m.meta?.name ?? m.name ?? m.id;
  const options = widgetOptionsOfPack({ version: m.version, widgets: m.widgets, assets: m.assets });
  for (const o of options) {
    if (o.label !== null && GENERIC.test(o.label)) bad.push(`${where}/${o.id}: label "${o.label}"`);
    const n = optionName(o, options, themeName);
    if ('key' in n && n.key === 'tabs.widgetsTab.art.numbered') bad.push(`${where}/${o.id}: no title`);
    if ('text' in n && GENERIC.test(n.text)) bad.push(`${where}/${o.id}: "${n.text}"`);
  }
}

test('1.0.42: no bundled or catalogue artwork is titled "Art n"', () => {
  const bad: string[] = [];
  // Bundled starter packs (the free themes that work offline).
  const gen = read('src', 'generated', 'starterPacks.ts');
  const starters = [...gen.matchAll(/manifest: (\{.*\}) as RemoteArtManifest/g)].map((x) => JSON.parse(x[1]) as Manifest);
  assert.ok(starters.length >= 9, 'starter packs found');
  for (const m of starters) checkPack(`starter ${m.id}`, m, bad);
  // The R2 catalogue (scripts/packs/artwork-baseline: the published manifests, newest version per theme).
  const base = join(ROOT, 'scripts', 'packs', 'artwork-baseline', 'art');
  const ids = readdirSync(base);
  assert.ok(ids.length >= 130, 'catalogue manifests found');
  for (const id of ids) {
    const versions = readdirSync(join(base, id)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    const file = join(base, id, versions[versions.length - 1], 'manifest.json');
    checkPack(`catalogue ${id}`, JSON.parse(readFileSync(file, 'utf8')) as Manifest, bad);
  }
  // Bundled art-pack themes (themes/<id>): their artwork options plus the derived heroes.
  for (const id of readdirSync(join(ROOT, 'themes'))) {
    const dir = join(ROOT, 'themes', id);
    const themeName = (JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as { name: string }).name;
    const heroes = widgetOptionsFromV1(
      (['small', 'medium', 'large'] as const)
        .filter((s) => existsSync(join(dir, `widget-${s}.png`)))
        .map((s) => ({ path: `widget-${s}.png`, role: `widget-${s}`, width: 1, height: 1 })),
    );
    const extra = existsSync(join(dir, 'artwork-options.json'))
      ? (JSON.parse(readFileSync(join(dir, 'artwork-options.json'), 'utf8')) as { id: string; label?: string }[])
      : [];
    for (const e of extra) {
      if (!e.label || GENERIC.test(e.label)) bad.push(`themes/${id}/${e.id}: label "${e.label ?? ''}"`);
    }
    for (const h of heroes) {
      const name = shownName(h, heroes, themeName);
      if (GENERIC.test(name)) bad.push(`themes/${id}/${h.id}: "${name}"`);
    }
  }
  assert.deepEqual(bad, []);
});

test('1.0.42: the Cobalt Caravan and Cloud Atelier hero pieces are named after their theme', () => {
  const gen = read('src', 'generated', 'starterPacks.ts');
  for (const [id, name] of [['cobalt-caravan', 'Cobalt Caravan'], ['cloud-atelier', 'Cloud Atelier']]) {
    const raw = [...gen.matchAll(/manifest: (\{.*\}) as RemoteArtManifest/g)].map((x) => JSON.parse(x[1]) as Manifest).find((m) => m.id === id);
    assert.ok(raw, id);
    const options = widgetOptionsOfPack({ version: raw.version, widgets: raw.widgets, assets: raw.assets });
    const hero = options.find((o) => o.id === 'hero-small');
    assert.ok(hero, `${id} hero-small`);
    assert.deepEqual(optionName(hero, options, name), { text: name });
  }
  // The names the app saves to My widget art and shows in the menu pass the theme name.
  assert.match(read('src', 'store', 'themeWidgetArt.ts'), /optionName\(option, options, theme\.name\)/);
  assert.match(read('src', 'ui', 'ThemeWidgetArt.tsx'), /optionName\(pickedItem\.option, options\.map\(\(o\) => o\.option\), theme\.name\)/);
  assert.match(read('src', 'ui', 'WidgetArtMenu.tsx'), /optionName\(o, all, themeName\)/);
  // New packs carry the label themselves.
  assert.match(read('scripts', 'packs', 'build_packs.mjs'), /encodeWidgetEditions\(encoder, editions, heroAssets, heroLabel = null\)/);
});

type PrivacyEntry = { NSPrivacyAccessedAPIType: string; NSPrivacyAccessedAPITypeReasons: string[] };
const REASONS: Record<string, string[]> = {
  NSPrivacyAccessedAPICategoryUserDefaults: ['CA92.1', '1C8F.1'],
  NSPrivacyAccessedAPICategoryFileTimestamp: ['C617.1'],
};

test('1.0.42: the app privacy manifest (app.json ios.privacyManifests)', () => {
  const app = JSON.parse(read('app.json')) as { expo: { ios: { privacyManifests?: Record<string, unknown> } } };
  const pm = app.expo.ios.privacyManifests;
  assert.ok(pm, 'ios.privacyManifests');
  assert.equal(pm.NSPrivacyTracking, false);
  assert.deepEqual(pm.NSPrivacyTrackingDomains, []);
  assert.deepEqual(pm.NSPrivacyCollectedDataTypes, []);
  const got = Object.fromEntries((pm.NSPrivacyAccessedAPITypes as PrivacyEntry[]).map((e) => [e.NSPrivacyAccessedAPIType, e.NSPrivacyAccessedAPITypeReasons]));
  assert.deepEqual(got, REASONS);
});

test('1.0.42: the widget extension has the same privacy manifest, inside the synced target folder', () => {
  const xml = read('targets', 'widget', 'PrivacyInfo.xcprivacy');
  assert.match(xml, /<key>NSPrivacyTracking<\/key>\s*<false\/>/);
  assert.match(xml, /<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/);
  assert.match(xml, /<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/);
  for (const [type, reasons] of Object.entries(REASONS)) {
    const at = xml.indexOf(`<string>${type}</string>`);
    assert.ok(at > 0, type);
    const block = xml.slice(at, xml.indexOf('</dict>', at));
    for (const r of reasons) assert.ok(block.includes(`<string>${r}</string>`), `${type} ${r}`);
  }
  // The native CI build checks the file really lands in GlazeWidgets.appex (and the app's own manifest).
  const ci = readFileSync(join(ROOT, '..', '..', '.github', 'workflows', 'glaze-native-simulator-app.yml'), 'utf8');
  assert.match(ci, /PrivacyInfo\.xcprivacy/);
  assert.match(ci, /PlugIns\/GlazeWidgets\.appex'\)/);
});

test('1.0.42: no camera or microphone usage strings (nothing uses the camera)', () => {
  const app = JSON.parse(read('app.json')) as { expo: { plugins: unknown[]; ios: { infoPlist: Record<string, unknown> } } };
  const picker = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker') as [string, Record<string, unknown>];
  assert.equal(picker[1].cameraPermission, false);
  assert.equal(picker[1].microphonePermission, false);
  assert.equal(app.expo.ios.infoPlist.NSCameraUsageDescription, undefined);
  assert.equal(app.expo.ios.infoPlist.NSMicrophoneUsageDescription, undefined);
  for (const dir of ['app', 'src']) {
    const walk = (d: string): string[] =>
      readdirSync(join(ROOT, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : /\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts') ? [join(d, e.name)] : []));
    for (const f of walk(dir)) assert.doesNotMatch(read(f), /launchCameraAsync|requestCameraPermissionsAsync|expo-camera/, f);
  }
});

test('1.0.42: Settings shows the Startup and Widget diagnostics rows only in development', () => {
  const s = read('app', '(tabs)', 'settings.tsx');
  assert.match(s, /\{__DEV__ \? <StartupRow \/> : null\}/);
  assert.match(s, /\{__DEV__ \? <WidgetDiagnosticsRow \/> : null\}/);
  assert.doesNotMatch(s, /^\s*<(StartupRow|WidgetDiagnosticsRow) \/>/m);
  assert.doesNotMatch(s, /UpdateRow|checkForUpdate/, 'no Check for updates row (no over-the-air updates)');
});

test('1.0.42: the support address comment has no TODO; stale purchase comments fixed', () => {
  assert.doesNotMatch(read('src', 'config', 'feedback.ts'), /TODO/);
  const swift = read('modules', 'glaze-store', 'ios', 'GlazeStoreModule.swift');
  assert.doesNotMatch(swift.slice(0, 1200), /one non-consumable|NOT YET COMPILED/);
  assert.match(swift.slice(0, 400), /yearly auto-renewable subscription/);
  assert.doesNotMatch(read('src', 'plus', 'usePackAccess.ts'), /One-time Glaze Plus; no subscriptions/);
});

test('1.0.42: store docs match the yearly subscription and carry review notes', () => {
  const store = read('docs', 'STORE.md');
  assert.match(store, /store\/LISTING\.md/);
  assert.doesNotMatch(store, /one-time unlock/i);
  const sub = read('store', 'SUBSCRIPTION.md');
  const at = sub.indexOf('## Review notes');
  assert.ok(at >= 0, 'Review notes section');
  const notes = sub.slice(at);
  for (const re of [/generated on the (iPhone|device)/i, /web clips/i, /Not Verified/, /Settings/, /Shortcuts/, /images and JSON/i, /never code|no (executable )?code/i, /no account|no sign-in/i, /com\.jared797\.glaze\.yearly/, /10 (premium )?themes are free|ten (premium )?themes are free/i]) {
    assert.match(notes, re);
  }
});
