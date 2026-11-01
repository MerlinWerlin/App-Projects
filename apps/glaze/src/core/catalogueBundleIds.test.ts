// T183 (owner 1 Nov): home-screen icons must open apps with no Safari hop. Guards: every catalogue
// bundle id is a well-formed, unique reverse-DNS id (null only when not known for certain, never
// guessed), every URL scheme is well-formed, the schemes Safari rejected on the owner's iPhone are
// gone, and the Shortcuts path (now the fallback, T202) uses the "Open App" action.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as installNs from '../i18n/ns/install/index.ts';
import { BUNDLE_ID_RE, CATALOGUE, URL_SCHEME_RE, entryFromRow, getById, type Row } from './catalogue.ts';
import { DEFAULT_INSTALL_METHOD, SHORTCUT_ACTION, defaultInstallState, shortcutSteps } from './install.ts';
import { availableMethods, effectiveChoice, recommendedMethod } from './installMethods.ts';

test('every catalogue entry carries a bundleId field: a well-formed reverse-DNS id or null', () => {
  for (const e of CATALOGUE) {
    assert.ok('bundleId' in e, `${e.id}: no bundleId field`);
    if (e.bundleId === null) continue;
    assert.equal(typeof e.bundleId, 'string', e.id);
    assert.match(e.bundleId, BUNDLE_ID_RE, `${e.id}: ${e.bundleId}`);
    assert.ok(e.bundleId.length <= 155, `${e.id}: bundle id too long`);
  }
});

test('bundle ids are unique (case-insensitive) and the common apps all have one', () => {
  const seen = new Map<string, string>();
  for (const e of CATALOGUE) {
    if (!e.bundleId) continue;
    const k = e.bundleId.toLowerCase();
    assert.ok(!seen.has(k), `${e.id} and ${seen.get(k)} share ${e.bundleId}`);
    seen.set(k, e.id);
  }
  // Every Apple system app in the catalogue is a com.apple.* id.
  for (const e of CATALOGUE.filter((x) => x.category === 'System')) {
    assert.ok(e.bundleId, `${e.id}: system app without a bundle id`);
    // Apple's own ids (the Apple Developer app's public id is developer.apple.wwdc-Release).
    assert.match(e.bundleId, /^(com\.apple\.|developer\.apple\.)/, e.id);
  }
  assert.ok(seen.size >= 200, `only ${seen.size} bundle ids`);
});

test('the owner 1 Nov apps have their exact public bundle ids', () => {
  const expect: Record<string, string> = {
    settings: 'com.apple.Preferences',
    notes: 'com.apple.mobilenotes',
    weather: 'com.apple.weather',
    youtube: 'com.google.ios.youtube',
    instagram: 'com.burbn.instagram',
    whatsapp: 'net.whatsapp.WhatsApp',
    spotify: 'com.spotify.client',
  };
  for (const [id, bundle] of Object.entries(expect)) assert.equal(getById(id)?.bundleId, bundle, id);
});

test('T218: main rows filled from Apple lookup carry their exact ids; fewer nulls remain', () => {
  const expect: Record<string, string> = {
    'royal-match': 'com.dreamgames.royalmatch',
    'monopoly-go': 'com.scopely.monopolygo',
    'google-meet': 'com.google.Tachyon',
    'google-classroom': 'com.google.Classroom',
    fortnite: 'com.epicgames.FortniteGame',
    wise: 'com.transferwise.Transferwise',
    ticktick: 'com.TickTick.task',
    accuweather: 'com.yourcompany.TestWithCustomTabs',
    'pokemon-tcg-pocket': 'jp.pokemon.pokemontcgp',
    dashlane: 'com.dashlane.dashlanephonefinal',
  };
  for (const [id, bundle] of Object.entries(expect)) assert.equal(getById(id)?.bundleId, bundle, id);
  // T218 (continued): looked up by numeric App Store id; Apple returned the row's app.
  const more: Record<string, string> = {
    'block-blast': 'com.blockpuzzle.us.ios',
    remini: 'com.bigwinepot.nwdn.international',
    ring: 'com.ring',
    vsco: 'co.visualsupply.cam',
    hinge: 'co.hinge.mobile.ios',
    'bbc-iplayer': 'uk.co.bbc.iplayer',
    commbank: 'au.com.commbank.commbank',
    shein: 'zzkko.com.ZZKKO',
  };
  for (const [id, bundle] of Object.entries(more)) assert.equal(getById(id)?.bundleId, bundle, id);
  // T218 (third pass): more rows looked up by App Store id (AU / GB / US / IN store).
  const third: Record<string, string> = {
    kayo: 'au.com.streamotion.kayo',
    '9now': 'au.com.ninemsn.jump-in',
    mygov: 'com.humanservices.myGov',
    'nhs-app': 'com.nhs.online',
    natwest: 'com.monitise.matm.Monitise-iPhone-NatWest-EN-GB',
    realestate: 'com.rea-group.reapa',
    stockx: 'com.Campless.Campless',
    swiggy: 'bundl.swiggy',
    jetstar: 'com.jetstar',
    session: 'com.loki-project.loki-messenger',
  };
  for (const [id, bundle] of Object.entries(third)) assert.equal(getById(id)?.bundleId, bundle, id);
  // Not filled: Cronometer's Apple id is "CRONOMETER-GOLD" (not reverse-DNS); the Medicare app was
  // retired and Real Racing 3 is no longer listed, so Apple's lookup returns nothing for them.
  for (const id of ['cronometer', 'medicare', 'real-racing-3']) assert.equal(getById(id)?.bundleId, null, id);
  // Apple's own ids that are not reverse-DNS (Pinterest is "pinterest", Runkeeper "RunKeeperPro")
  // fail BUNDLE_ID_RE, so those rows stay null.
  for (const id of ['pinterest', 'runkeeper']) assert.equal(getById(id)?.bundleId, null, id);
  const nulls = CATALOGUE.filter((e) => e.bundleId === null).length;
  assert.ok(nulls <= 18, `${nulls} entries without a bundle id`);
});

test('every non-null URL scheme is well-formed; the ones Safari rejected are gone', () => {
  for (const e of CATALOGUE) {
    if (e.urlScheme === null) {
      assert.equal(e.verified, false, `${e.id}: verified without a scheme`);
      continue;
    }
    assert.match(e.urlScheme, URL_SCHEME_RE, `${e.id}: ${e.urlScheme}`);
    assert.match(e.urlScheme, /^[a-z][a-z0-9+.-]*:(\/\/)?$/i, `${e.id}: ${e.urlScheme}`);
    assert.ok(!/^app-prefs:/i.test(e.urlScheme) && !/^prefs:/i.test(e.urlScheme), `${e.id}: private settings scheme`);
  }
  // Owner 1 Nov: "the address is invalid" for both. They now use Open App only.
  for (const id of ['settings', 'youtube']) {
    assert.equal(getById(id)?.urlScheme, null, id);
    assert.equal(getById(id)?.verified, false, id);
  }
});

test('entryFromRow (shared with other catalogue data files) keeps bundleId and drops verified without a scheme', () => {
  const row: Row = ['demo-app', 'Demo App', 'Utilities', null, true, 'box', ['demo'], 'com.example.demo'];
  const e = entryFromRow(row);
  assert.equal(e.bundleId, 'com.example.demo');
  assert.equal(e.verified, false);
  assert.ok(Object.isFrozen(e));
});

test('T202: install default is the profile; the Shortcuts fallback uses the Open App action', () => {
  assert.equal(DEFAULT_INSTALL_METHOD, 'bulk');
  assert.equal(defaultInstallState().choice, 'bulk');
  assert.equal(SHORTCUT_ACTION, 'Open App');
  const opts = { profileEnabled: true, profileCount: 10 };
  assert.equal(availableMethods(opts)[0], 'bulk');
  assert.equal(recommendedMethod(opts), 'bulk');
  assert.equal(effectiveChoice(defaultInstallState().choice, opts, false), 'bulk');
  // Apps without a link still go through Shortcuts.
  assert.equal(effectiveChoice(defaultInstallState().choice, { profileEnabled: true, profileCount: 0 }, false), 'shortcuts');
  const steps = shortcutSteps('Instagram', 'instagram://').join('\n');
  assert.match(steps, /"Open App"/);
  assert.doesNotMatch(steps, /Open URL|instagram:\/\//);
  // The screen never offers "Open URL" steps any more.
  const screen = readFileSync(new URL('../../app/install.tsx', import.meta.url), 'utf8');
  assert.ok(!screen.includes('install.steps.addOpenUrl') && !screen.includes('install.steps.pasteUrl'));
  assert.ok(screen.includes("t('install.steps.addOpenApp')"));
  // T193: the Open URL steps and the copy-link strings that went with them are gone from every locale.
  const locales = Object.entries(installNs) as [string, Record<string, Record<string, unknown>>][];
  assert.equal(locales.length, 11);
  for (const [loc, msgs] of locales) {
    for (const k of ['addOpenUrl', 'pasteUrl']) assert.ok(!(k in msgs.steps), `${loc}: install.steps.${k}`);
    for (const k of ['copy', 'copied', 'copyLink', 'linkCopied']) assert.ok(!(k in msgs.shortcuts), `${loc}: install.shortcuts.${k}`);
    assert.ok(!('copyFailed' in msgs.errors), `${loc}: install.errors.copyFailed`);
    assert.equal(typeof msgs.steps.addOpenApp, 'string', `${loc}: install.steps.addOpenApp kept`);
  }
  assert.doesNotMatch(screen, /install\.shortcuts\.(copy|copied|copyLink|linkCopied)\b|install\.errors\.copyFailed/);
  // T202: the Safari tap is stated plainly, with the count computed from the data.
  assert.ok(screen.includes("t('install.method.safariTapAll'"), 'the Safari-tap line is on screen');
});
