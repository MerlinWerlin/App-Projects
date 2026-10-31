// T126: icon profile served to Safari from the iPhone. Pure logic, the method switch, the
// adapter's never-throw shape (source guard: it imports React Native) and the native module's
// contract (source guard: Swift can't be compiled here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROFILE_MIME,
  PROFILE_SERVER_MODULE,
  PROFILE_SERVER_PATH,
  PROFILE_SERVER_TIMEOUT_S,
  isLoopbackHttpUrl,
  landingPageJson,
  parseServerStart,
  profileRoute,
} from './profileServer.ts';
import {
  SAFARI_PROFILE_STEPS,
  buildInstallProfiles,
  defaultInstallState,
  parseInstallState,
  profileStepCards,
  sanitizeInstallState,
  serializeInstallState,
} from './install.ts';
import {
  availableMethods,
  bulkSelectable,
  effectiveChoice,
  recommendedMethod,
  showMethodPicker,
} from './installMethods.ts';
import { buildProfile } from './mobileconfig.ts';
import { PROFILE_INSTALL_ENABLED } from '../config/install.ts';
import { en } from '../i18n/locales/en.ts';
import type { IconSpec } from './iconspec.ts';

const root = new URL('../../', import.meta.url).pathname;
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

// ---- constants shared with Swift ----

test('content type is the configuration profile MIME type, in JS and Swift', () => {
  assert.equal(PROFILE_MIME, 'application/x-apple-aspen-config');
  const swift = read('modules/glaze-profile-server/ios/GlazeProfileServerModule.swift');
  assert.ok(swift.includes(`"${PROFILE_MIME}"`), 'Swift serves the same Content-Type');
  assert.ok(swift.includes(`"${PROFILE_SERVER_PATH}"`), 'Swift serves the same path');
  assert.match(swift, /Content-Disposition: attachment/);
  assert.match(swift, /Name\("GlazeProfileServer"\)/);
  assert.equal(PROFILE_SERVER_MODULE, 'GlazeProfileServer');
});

test('native module binds loopback only, keeps background time and stops itself', () => {
  const swift = read('modules/glaze-profile-server/ios/GlazeProfileServerModule.swift');
  assert.match(swift, /import Network/);
  assert.match(swift, /NWListener\(using:/);
  assert.match(swift, /requiredLocalEndpoint = NWEndpoint\.hostPort\(host: \.ipv4\(\.loopback\)/);
  assert.match(swift, /beginBackgroundTask\(withName:/);
  assert.match(swift, /endBackgroundTask/);
  assert.match(swift, /graceSeconds/);
  assert.match(swift, /scheduleTimeout/);
  // No third-party hosts, no outbound requests.
  assert.ok(!/URLSession|https?:\/\/(?!127\.0\.0\.1)[a-z]/i.test(swift.replace(/\/\/.*$/gm, '')), 'no outbound URLs');
  assert.ok(PROFILE_SERVER_TIMEOUT_S >= 30 && PROFILE_SERVER_TIMEOUT_S <= 600);
});

test('T154: landing page asks Safari for the profile at once, keeps the Install button', () => {
  const swift = read('modules/glaze-profile-server/ios/GlazeProfileServerModule.swift');
  const page = /static func landingPage[\s\S]*?"""([\s\S]*?)"""/.exec(swift)?.[1] ?? '';
  assert.ok(page.length > 0, 'landing page template found');
  // Safari must fetch the profile in the first second, while Glaze is surely still running;
  // waiting for a tap races iOS ending Glaze's background time.
  assert.match(page, /<meta http-equiv="refresh" content="0;url=\\\(profilePath\)">/);
  assert.ok(page.indexOf('http-equiv="refresh"') < page.indexOf('</head>'), 'refresh sits in <head>');
  assert.match(page, /<a class="btn" href="\\\(profilePath\)">/, 'manual Install button stays');
  assert.ok(!/http-equiv="refresh" content="0;url=http/.test(page), 'relative URL: stays on 127.0.0.1');
});

test('module layout matches the other Glaze modules (apple only, podspec, wrapper)', () => {
  const dir = 'modules/glaze-profile-server';
  const cfg = JSON.parse(read(`${dir}/expo-module.config.json`)) as { platforms: string[]; apple: { modules: string[] } };
  assert.deepEqual(cfg.platforms, ['apple']);
  assert.deepEqual(cfg.apple.modules, ['GlazeProfileServerModule']);
  assert.ok(existsSync(join(root, dir, 'ios/GlazeProfileServer.podspec')));
  assert.match(read(`${dir}/ios/GlazeProfileServer.podspec`), /s\.frameworks\s*=\s*'Network'/);
  assert.match(read(`${dir}/index.ts`), /requireOptionalNativeModule/);
  // It sits in ./modules, which only native builds link (scripts/native-link.mjs).
  assert.match(read('scripts/native-link.mjs'), /NATIVE_DIR = '\.\/modules'/);
});

// ---- pure helpers ----

test('route: Safari with the server, share sheet without', () => {
  assert.equal(profileRoute(true), 'safari');
  assert.equal(profileRoute(false), 'share');
});

test('only loopback http URLs are accepted from the native side', () => {
  assert.ok(isLoopbackHttpUrl('http://127.0.0.1:52011/'));
  assert.ok(isLoopbackHttpUrl('http://localhost:50000/glaze.mobileconfig'));
  for (const bad of [
    'https://127.0.0.1:52011/',
    'http://192.168.1.4:52011/',
    'http://example.com:52011/',
    'http://127.0.0.1/',
    'http://127.0.0.1:80/',
    'http://127.0.0.1:99999/',
    'javascript:alert(1)',
    42,
    null,
  ]) {
    assert.equal(isLoopbackHttpUrl(bad), false, String(bad));
  }
});

test('parseServerStart validates and fills the profile URL', () => {
  assert.deepEqual(parseServerStart({ url: 'http://127.0.0.1:52011/', profileUrl: 'http://127.0.0.1:52011/glaze.mobileconfig', port: 52011 }), {
    url: 'http://127.0.0.1:52011/',
    profileUrl: 'http://127.0.0.1:52011/glaze.mobileconfig',
    port: 52011,
  });
  assert.equal(parseServerStart({ url: 'http://127.0.0.1:52011/', port: 52011 })?.profileUrl, 'http://127.0.0.1:52011/glaze.mobileconfig');
  assert.equal(parseServerStart({ url: 'http://10.0.0.2:52011/', port: 52011 }), null);
  assert.equal(parseServerStart({ url: 'http://127.0.0.1:52011/', port: 'x' }), null);
  assert.equal(parseServerStart(null), null);
  assert.equal(parseServerStart('http://127.0.0.1:52011/'), null);
});

test('landing page JSON is bounded and direction-safe', () => {
  const j = JSON.parse(landingPageJson({ lang: 'ar', dir: 'rtl', title: 'T'.repeat(500), body: 'b', button: 'Install' })) as Record<string, string>;
  assert.equal(j.dir, 'rtl');
  assert.equal(j.title.length, 120);
  assert.equal(j.button, 'Install');
  const k = JSON.parse(landingPageJson({ lang: '', dir: 'sideways' as never, title: '', body: '', button: '' })) as Record<string, string>;
  assert.equal(k.lang, 'en');
  assert.equal(k.dir, 'ltr');
});

// ---- adapter (imports React Native, so it is checked as source) ----

test('adapter uses requireOptionalNativeModule, guards every entry point and opens real Safari', () => {
  const src = read('src/native/profileServer.ts');
  assert.match(src, /requireOptionalNativeModule/);
  assert.match(src, /Platform\.OS !== 'ios'/);
  assert.match(src, /isExpoGo\(\)/);
  assert.match(src, /Linking\.openURL\(/);
  assert.ok(!/expo-web-browser|WebBrowser|SFSafari/.test(src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'no in-app browser');
  assert.ok(!/(from|require\()\s*['"][^'"]*glaze-profile-server/.test(src), 'adapter does not import the module wrapper');
  for (const fn of ['function loadNative', 'function status', 'function stop', 'async function serveAndOpen', 'function fetchCount']) {
    const at = src.indexOf(fn);
    assert.ok(at >= 0, fn);
    const body = src.slice(at, src.indexOf('\n}\n', at));
    assert.match(body, /try \{/, `${fn} has a try`);
    assert.match(body, /catch/, `${fn} catches`);
  }
  // Unavailable is a result, not an exception.
  assert.match(src, /kind: 'unavailable'/);
});

test('no app or src file imports the native module wrapper directly', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(name)) files.push(rel);
    }
  };
  walk('app');
  walk('src');
  for (const f of files) {
    assert.ok(!/(from|require\(|import\()\s*['"][^'"]*glaze-profile-server/.test(read(f)), `${f} imports the module directly`);
  }
});

test('install screen goes through the adapter, never an in-app browser, never src/plus', () => {
  const screen = read('app/install.tsx');
  assert.match(screen, /from '\.\.\/src\/native\/profileServer'/);
  assert.match(screen, /profileServer\.serveAndOpen\(/);
  assert.match(screen, /profileStepCards\(.*, route\)/);
  assert.match(screen, /choiceExplicit/);
  assert.ok(!/expo-web-browser|WebBrowser/.test(screen));
  assert.ok(!/src\/plus/.test(screen));
  assert.ok(!/src\/plus|\.\.\/plus/.test(read('src/native/profileServer.ts')));
});

// ---- the switch and method choice ----

test('PROFILE_INSTALL_ENABLED still governs visibility, whatever the server says', () => {
  for (const profileServer of [true, false]) {
    assert.deepEqual(availableMethods({ profileEnabled: false, profileCount: 4, profileServer }), ['shortcuts']);
    assert.equal(showMethodPicker({ profileEnabled: false, profileCount: 4, profileServer }), false);
    assert.equal(bulkSelectable({ profileEnabled: false, profileCount: 4, profileServer }), false);
    assert.equal(effectiveChoice('bulk', { profileEnabled: false, profileCount: 4, profileServer }), 'shortcuts');
    assert.equal(effectiveChoice('bulk', { profileEnabled: false, profileCount: 4, profileServer }, false), 'shortcuts');
  }
  assert.equal(typeof PROFILE_INSTALL_ENABLED, 'boolean');
  assert.match(read('app/install.tsx'), /profileEnabled: PROFILE_INSTALL_ENABLED/);
});

test('T183 (owner 1 Nov, supersedes 25 Oct): with or without the server, Shortcuts is recommended and the default; Bulk optional', () => {
  for (const profileServer of [true, false]) {
    const opts = { profileEnabled: true, profileCount: 5, profileServer };
    assert.deepEqual(availableMethods(opts), ['shortcuts', 'bulk']);
    assert.equal(recommendedMethod(opts), 'shortcuts');
    assert.equal(effectiveChoice('bulk', opts, false), 'shortcuts', 'an old Bulk default no longer wins');
    assert.equal(effectiveChoice('shortcuts', opts, false), 'shortcuts');
    assert.equal(effectiveChoice('bulk', opts, true), 'bulk', 'an explicit Bulk pick since the switch is kept');
    assert.equal(recommendedMethod({ ...opts, profileCount: 0 }), 'shortcuts');
    assert.deepEqual(availableMethods({ ...opts, profileCount: 0 }), ['shortcuts']);
  }
});

test('choiceExplicit persists only when set', () => {
  assert.equal('choiceExplicit' in defaultInstallState(), false);
  const s = { ...defaultInstallState(), choice: 'bulk' as const, choiceExplicit: true as const };
  assert.equal(parseInstallState(serializeInstallState(s)).choiceExplicit, true);
  assert.equal('choiceExplicit' in sanitizeInstallState({ choice: 'bulk', choiceExplicit: 'yes' }), false);
});

// ---- steps on screen ----

test('Safari route shows the four exact steps, in order, then the shared cards', () => {
  const cards = profileStepCards(1, 'safari');
  assert.deepEqual(cards.map((c) => c.id), ['safari', 'allow', 'settings', 'home', 'not-verified', 'hide-old', 'remove']);
  assert.deepEqual(cards.slice(0, 4).map((c) => c.body), [...SAFARI_PROFILE_STEPS]);
  // T156: Safari may ask for the download before Install is tapped (the page auto-requests it).
  assert.equal(SAFARI_PROFILE_STEPS[0], 'Safari opens the Glaze page and may ask to download the profile straight away. If it doesn’t, tap Install.');
  assert.equal(SAFARI_PROFILE_STEPS[1], 'Safari asks to allow a configuration profile download, sometimes before you tap Install: tap Allow, then Close.');
  assert.match(SAFARI_PROFILE_STEPS[2], /^Open Settings: tap “Profile Downloaded” near the top \(or General > VPN & Device Management\), tap Install, enter your passcode, Install\.$/);
  assert.equal(SAFARI_PROFILE_STEPS[3], 'Your icons appear on the Home Screen.');
  // The English catalogue the screen renders says the same.
  const c = en.install.safari.cards;
  assert.deepEqual([c.safari.body, c.allow.body, c.settings.body, c.home.body], [...SAFARI_PROFILE_STEPS]);
  // The share route keeps its own first steps.
  assert.deepEqual(profileStepCards(1).slice(0, 3).map((x) => x.id), ['save', 'open', 'install']);
  assert.deepEqual(profileStepCards(1, 'share').map((x) => x.id), profileStepCards(1).map((x) => x.id));
});

test('every Safari card id has catalogue keys on the screen', () => {
  const screen = read('app/install.tsx');
  for (const id of ['safari', 'allow', 'settings', 'home']) {
    assert.ok(screen.includes(`install.safari.cards.${id}.title`), id);
    assert.ok(screen.includes(`install.safari.cards.${id}.body`), id);
  }
});

// ---- the profile itself ----

/** Minimal well-formedness check: every tag closes in order, no stray text between tags. */
function assertBalanced(xml: string) {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*<!DOCTYPE[^>]*>\s*/, '');
  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) assert.equal(stack.pop(), name, `</${name}> closes the wrong tag`);
    else stack.push(name);
  }
  assert.deepEqual(stack, [], 'unclosed tags');
  assert.ok(!/&(?!(amp|lt|gt|quot|apos);)/.test(body), 'bare &');
}

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('profile: well-formed plist, Configuration wrapper, web clip payloads, unique UUIDs and identifiers', () => {
  const xml = buildProfile({
    themeName: 'Night & Day <test>',
    icons: [
      { label: 'Music', url: 'music:', pngBase64: PNG },
      { label: 'Notes', url: 'mobilenotes:', pngBase64: PNG },
      { label: 'Maps', url: 'maps:', pngBase64: PNG },
    ],
  });
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(xml, /<!DOCTYPE plist PUBLIC "-\/\/Apple\/\/DTD PLIST 1\.0\/\/EN"/);
  assertBalanced(xml);
  const types = [...xml.matchAll(/<key>PayloadType<\/key>\s*<string>([^<]+)<\/string>/g)].map((m) => m[1]);
  assert.deepEqual(types.sort(), ['Configuration', 'com.apple.webClip.managed', 'com.apple.webClip.managed', 'com.apple.webClip.managed']);
  const uuids = [...xml.matchAll(/<key>PayloadUUID<\/key>\s*<string>([^<]+)<\/string>/g)].map((m) => m[1]);
  assert.equal(uuids.length, 4);
  assert.equal(new Set(uuids).size, 4, 'UUIDs are unique');
  for (const u of uuids) assert.match(u, /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
  const ids = [...xml.matchAll(/<key>PayloadIdentifier<\/key>\s*<string>([^<]+)<\/string>/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, 4, 'PayloadIdentifiers are unique');
  for (const key of ['URL', 'Label', 'Icon', 'IsRemovable', 'FullScreen', 'Precomposed', 'PayloadVersion']) {
    assert.ok(xml.includes(`<key>${key}</key>`), key);
  }
  assert.equal((xml.match(/<key>IsRemovable<\/key>\s*<true\/>/g) ?? []).length, 3);
  assert.equal((xml.match(/<key>FullScreen<\/key>\s*<false\/>/g) ?? []).length, 3);
  assert.match(xml, /<key>PayloadRemovalDisallowed<\/key>\s*<false\/>/);
  const datas = [...xml.matchAll(/<data>([\s\S]*?)<\/data>/g)].map((m) => m[1].replace(/\s+/g, ''));
  assert.equal(datas.length, 3);
  for (const d of datas) {
    assert.match(d, /^[A-Za-z0-9+/]+={0,2}$/);
    assert.equal(Buffer.from(d, 'base64').subarray(1, 4).toString('latin1'), 'PNG', 'Icon is PNG data');
  }
  assert.ok(xml.includes('Night &amp; Day &lt;test&gt;'));
});

test('install profiles stay under the size limit and every split part is its own valid profile', () => {
  const specs = Array.from({ length: 6 }, (_, i) => ({ appId: `a${i}`, label: `App ${i}`, urlScheme: `app${i}:` })) as unknown as IconSpec[];
  const rendered = specs.map((s) => ({ appId: s.appId, pngBase64: PNG.repeat(1) }));
  const files = buildInstallProfiles(specs, rendered, 'Theme', { maxBytes: 3000 });
  assert.ok(files.length > 1);
  const all = new Set<string>();
  for (const f of files) {
    assertBalanced(f.xml);
    for (const m of f.xml.matchAll(/<key>PayloadUUID<\/key>\s*<string>([^<]+)<\/string>/g)) {
      assert.ok(!all.has(m[1]), 'UUIDs unique across parts');
      all.add(m[1]);
    }
  }
});
