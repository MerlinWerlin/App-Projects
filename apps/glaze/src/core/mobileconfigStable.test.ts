// T194 / T202: with an install id, every Glaze profile has ONE stable top-level PayloadIdentifier
// and PayloadUUID, and each web clip's PayloadIdentifier / PayloadUUID derive only from the install
// id + the app (never the theme, the position or the time), so a new theme's profile replaces the
// previous one in iOS and its web clips are updated in place instead of added. Tests run on the
// generated XML. Without an install id the old behaviour is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GLAZE_UUID_NAMESPACE,
  UUID_NAMESPACE_DNS,
  appPayloadKey,
  buildProfile,
  buildProfiles,
  estimateIconBytes,
  isValidInstallId,
  makeInstallId,
  sha1,
  stableProfileIdentifier,
  stableProfileUuid,
  stableUuid,
  stableWebClipIds,
  uuidV5,
  type WebClipIcon,
} from './mobileconfig.ts';
import { buildInstallProfiles, opensViaSafariTap, safariTapCount } from './install.ts';
import { utf8Encode } from './bytes.ts';

const PNG = 'iVBORw0KGgo=';
const icon = (label: string, key = label.toLowerCase(), url = `${label.toLowerCase()}:`): WebClipIcon => ({
  label,
  url,
  pngBase64: PNG,
  key,
});
const ID = 'a1b2c3d4e5f60718';
const OTHER_ID = 'ffffeeee00001111';
const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
const UUID_V5_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-5[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/;

/** Every <string> after a key, in document order (web clips first, the top level last). */
function values(xml: string, key: string): string[] {
  const re = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`, 'g');
  return [...xml.matchAll(re)].map((m) => m[1]);
}
const topLevel = (xml: string, key: string): string => values(xml, key).at(-1)!;
const clips = (xml: string, key: string): string[] => values(xml, key).slice(0, -1);
/** Web clip ids keyed by the clip's Label (so order does not matter). */
function clipIdsByLabel(xml: string): Map<string, { id: string; uuid: string }> {
  const labels = values(xml, 'Label'); // only web clips have a Label
  const ids = clips(xml, 'PayloadIdentifier');
  const uuids = clips(xml, 'PayloadUUID');
  return new Map(labels.map((l, i) => [l, { id: ids[i], uuid: uuids[i] }]));
}

// ---- hashing / UUID format ----

test('sha1 and uuidV5 match the published known answers', () => {
  const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  assert.equal(hex(sha1(utf8Encode('abc'))), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(hex(sha1(utf8Encode(''))), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
  assert.equal(
    hex(sha1(utf8Encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))),
    '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
  );
  // RFC 4122 / Python uuid.uuid5(NAMESPACE_DNS, 'www.example.com').
  assert.equal(uuidV5('www.example.com', UUID_NAMESPACE_DNS), '2ED6657D-E927-568B-95E1-2665A8AEA6A2');
  assert.match(GLAZE_UUID_NAMESPACE, UUID_V5_RE);
});

test('makeInstallId gives a valid 16-hex id; validation rejects junk', () => {
  const id = makeInstallId();
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.ok(isValidInstallId(id));
  assert.notEqual(makeInstallId(), id);
  for (const bad of ['', 'ABC123DEF', 'a.b', 'short', 'x'.repeat(33), null, 42]) assert.equal(isValidInstallId(bad), false, String(bad));
});

test('stableUuid is deterministic, 8-4-4-4-12 upper-case hex (v5) and differs per seed', () => {
  const a = stableUuid('x:1:0');
  assert.equal(stableUuid('x:1:0'), a);
  assert.match(a, UUID_RE);
  assert.match(a, UUID_V5_RE);
  const many = new Set(Array.from({ length: 500 }, (_, i) => stableUuid(`${ID}:${i}`)));
  assert.equal(many.size, 500);
});

test('appPayloadKey keeps catalogue ids / bundle ids and cleans anything else', () => {
  assert.equal(appPayloadKey('spotify'), 'spotify');
  assert.equal(appPayloadKey('com.spotify.client'), 'com.spotify.client');
  assert.equal(appPayloadKey('My App!'), 'my-app');
  assert.equal(appPayloadKey('instagram://'), 'instagram');
  assert.equal(appPayloadKey('…'), 'app');
  assert.ok(appPayloadKey('x'.repeat(200)).length <= 60);
});

// ---- the bug: a new theme must replace the old profile and its web clips ----

test('two themes for the same install: identical top-level PayloadIdentifier and PayloadUUID', () => {
  const apps = [icon('Music'), icon('Maps'), icon('Mail')];
  const a = buildProfile({ themeName: 'Plum Glaze', icons: apps, installId: ID });
  const b = buildProfile({ themeName: 'Sea Salt', icons: apps.map((i) => ({ ...i, pngBase64: 'QUFB' })), installId: ID });
  assert.equal(topLevel(a, 'PayloadIdentifier'), `com.jared797.glaze.icons.${ID}`);
  assert.equal(topLevel(b, 'PayloadIdentifier'), topLevel(a, 'PayloadIdentifier'));
  assert.equal(topLevel(a, 'PayloadUUID'), stableProfileUuid(ID));
  assert.equal(topLevel(b, 'PayloadUUID'), topLevel(a, 'PayloadUUID'));
  assert.match(topLevel(a, 'PayloadUUID'), UUID_V5_RE);
  // Building the same theme twice (a later time) changes nothing either.
  const again = buildProfile({ themeName: 'Plum Glaze', icons: apps, installId: ID });
  assert.equal(again, a);
});

test('two themes for the same install: identical per-app web clip identifiers and UUIDs', () => {
  const apps = [icon('Music'), icon('Maps'), icon('Mail')];
  const a = buildProfile({ themeName: 'Plum Glaze', icons: apps, installId: ID });
  const b = buildProfile({ themeName: 'Sea Salt', icons: apps.map((i) => ({ ...i, pngBase64: 'QUFB' })), installId: ID });
  assert.deepEqual(clips(a, 'PayloadIdentifier'), [
    `com.jared797.glaze.icons.${ID}.webclip.music`,
    `com.jared797.glaze.icons.${ID}.webclip.maps`,
    `com.jared797.glaze.icons.${ID}.webclip.mail`,
  ]);
  assert.deepEqual(clips(b, 'PayloadIdentifier'), clips(a, 'PayloadIdentifier'));
  assert.deepEqual(clips(b, 'PayloadUUID'), clips(a, 'PayloadUUID'));
  for (const u of clips(a, 'PayloadUUID')) assert.match(u, UUID_V5_RE);
  assert.equal(new Set(clips(a, 'PayloadUUID')).size, 3);
  assert.deepEqual(clips(a, 'PayloadUUID')[0], stableWebClipIds(ID, 'music').uuid);
});

test('a web clip id follows the app, not its position or the theme', () => {
  const a = buildProfile({ themeName: 'Plumtheme', icons: [icon('Music'), icon('Maps'), icon('Mail')], installId: ID });
  const b = buildProfile({ themeName: 'Seatheme', icons: [icon('Mail'), icon('Music')], installId: ID });
  const ia = clipIdsByLabel(a);
  const ib = clipIdsByLabel(b);
  assert.equal(ia.size, 3);
  assert.deepEqual(ib.get('Music'), ia.get('Music'));
  assert.deepEqual(ib.get('Mail'), ia.get('Mail'));
  // Neither the theme nor a slot number appears in any payload identifier.
  for (const id of values(a, 'PayloadIdentifier')) assert.doesNotMatch(id, /theme|slot/i);
});

test('different installs get different identifiers and UUIDs everywhere', () => {
  const apps = [icon('Music'), icon('Maps')];
  const a = buildProfile({ themeName: 'T', icons: apps, installId: ID });
  const b = buildProfile({ themeName: 'T', icons: apps, installId: OTHER_ID });
  assert.notEqual(topLevel(a, 'PayloadIdentifier'), topLevel(b, 'PayloadIdentifier'));
  assert.notEqual(topLevel(a, 'PayloadUUID'), topLevel(b, 'PayloadUUID'));
  const ua = clips(a, 'PayloadUUID');
  const ub = clips(b, 'PayloadUUID');
  for (let i = 0; i < ua.length; i++) assert.notEqual(ua[i], ub[i]);
  const ia = clips(a, 'PayloadIdentifier');
  const ib = clips(b, 'PayloadIdentifier');
  for (let i = 0; i < ia.length; i++) assert.notEqual(ia[i], ib[i]);
});

test('removal is allowed and the top-level names do not depend on the theme for matching', () => {
  const xml = buildProfile({ themeName: 'Plum', icons: [icon('Music')], installId: ID });
  assert.match(xml, /<key>PayloadRemovalDisallowed<\/key>\s*<false\/>/);
  assert.match(xml, /<key>IsRemovable<\/key>\s*<true\/>/);
  assert.equal(topLevel(xml, 'PayloadOrganization'), 'Glaze');
  assert.equal(topLevel(xml, 'PayloadType'), 'Configuration');
  // The display name says which theme is installed (iOS matches by PayloadIdentifier, not this).
  assert.match(topLevel(xml, 'PayloadDisplayName'), /^Glaze icons – Plum$/);
});

test('the same app twice in one set still gets unique, stable payload ids', () => {
  const xml = buildProfile({ themeName: 'T', icons: [icon('Music'), icon('Music')], installId: ID });
  const ids = clips(xml, 'PayloadIdentifier');
  assert.equal(new Set(ids).size, 2);
  assert.equal(ids[1], `com.jared797.glaze.icons.${ID}.webclip.music.dup2`);
  assert.equal(buildProfile({ themeName: 'U', icons: [icon('Music'), icon('Music')], installId: ID }).includes(ids[1]), true);
});

test('without a key the URL keys the clip (still per app, never the position)', () => {
  const noKey = (label: string): WebClipIcon => ({ label, url: `${label.toLowerCase()}:`, pngBase64: PNG });
  const a = buildProfile({ themeName: 'A', icons: [noKey('Music'), noKey('Maps')], installId: ID });
  const b = buildProfile({ themeName: 'B', icons: [noKey('Maps')], installId: ID });
  assert.equal(clips(b, 'PayloadUUID')[0], clips(a, 'PayloadUUID')[1]);
});

test('split sets: part 1 on the base identifier, later parts their own stable identifier and UUID', () => {
  const icons = Array.from({ length: 6 }, (_, i) => ({ ...icon(`App${i}`), pngBase64: 'A'.repeat(2000) }));
  const files = buildProfiles({ themeName: 'Big', icons, maxBytes: 7000, installId: ID });
  assert.ok(files.length > 1);
  const ids = files.map((f) => topLevel(f.xml, 'PayloadIdentifier'));
  assert.equal(ids[0], stableProfileIdentifier(ID));
  assert.equal(ids[1], `com.jared797.glaze.icons.${ID}.part2`);
  assert.equal(new Set(ids).size, files.length);
  const uuids = files.map((f) => topLevel(f.xml, 'PayloadUUID'));
  assert.equal(new Set(uuids).size, files.length);
  const allClipUuids = files.flatMap((f) => clips(f.xml, 'PayloadUUID'));
  assert.equal(new Set(allClipUuids).size, allClipUuids.length);
  const again = buildProfiles({ themeName: 'Other', icons, maxBytes: 7000, installId: ID });
  assert.deepEqual(again.map((f) => topLevel(f.xml, 'PayloadIdentifier')), ids);
  assert.deepEqual(again.map((f) => topLevel(f.xml, 'PayloadUUID')), uuids);
  assert.deepEqual(again.flatMap((f) => clips(f.xml, 'PayloadUUID')), allClipUuids);
});

test('no install id: identifiers stay random per build (old behaviour)', () => {
  const a = buildProfile({ themeName: 'Plum', icons: [icon('Music')] });
  const b = buildProfile({ themeName: 'Plum', icons: [icon('Music')] });
  assert.match(topLevel(a, 'PayloadIdentifier'), /^com\.jared797\.glaze\.icons\.plum\.[0-9A-F-]{36}$/);
  assert.notEqual(topLevel(a, 'PayloadIdentifier'), topLevel(b, 'PayloadIdentifier'));
  const c = buildProfile({ themeName: 'Plum', icons: [icon('Music')], installId: 'not valid!' });
  assert.match(topLevel(c, 'PayloadIdentifier'), /\.plum\./);
});

test('the size estimate still covers a stable-id clip, even with a long app key', () => {
  const long = icon('Music', 'com.example.' + 'x'.repeat(120));
  const xml = buildProfile({ themeName: 'T', icons: [long], installId: 'z'.repeat(32) });
  const empty = buildProfile({ themeName: 'T', icons: [], installId: 'z'.repeat(32) });
  assert.ok(estimateIconBytes(long) >= xml.length - empty.length);
});

test('buildInstallProfiles keys each clip by the app id and passes the install id through', () => {
  const spec = (appId: string, label: string, urlScheme: string) => ({ appId, label, urlScheme });
  const specs = [spec('music', 'Music', 'music:'), spec('spotify', 'Spotify', 'spotify:')] as unknown as Parameters<
    typeof buildInstallProfiles
  >[0];
  const rendered = [
    { appId: 'music', pngBase64: PNG },
    { appId: 'spotify', pngBase64: PNG },
  ];
  const a = buildInstallProfiles(specs, rendered, 'Plum', { installId: ID });
  const b = buildInstallProfiles(specs, rendered, 'Sea Salt', { installId: ID });
  assert.equal(a.length, 1);
  assert.equal(topLevel(a[0].xml, 'PayloadIdentifier'), `com.jared797.glaze.icons.${ID}`);
  assert.deepEqual(clips(a[0].xml, 'PayloadIdentifier'), [
    `com.jared797.glaze.icons.${ID}.webclip.music`,
    `com.jared797.glaze.icons.${ID}.webclip.spotify`,
  ]);
  assert.deepEqual(clips(b[0].xml, 'PayloadUUID'), clips(a[0].xml, 'PayloadUUID'));
  assert.equal(topLevel(b[0].xml, 'PayloadUUID'), topLevel(a[0].xml, 'PayloadUUID'));
});

// ---- T202 item 3: say plainly which apps still need a tap ----

test('safariTapCount counts profile apps whose link is an app scheme (iOS asks “Open in…?”)', () => {
  assert.equal(opensViaSafariTap('spotify:'), true);
  assert.equal(opensViaSafariTap('whatsapp://send'), true);
  assert.equal(opensViaSafariTap('https://example.com'), false);
  assert.deepEqual(safariTapCount([{ urlScheme: 'music:' }, { urlScheme: 'spotify://' }, { urlScheme: null }]), { tap: 2, total: 2 });
  assert.deepEqual(safariTapCount([{ urlScheme: 'https://example.com' }, { urlScheme: 'maps:' }]), { tap: 1, total: 2 });
  assert.deepEqual(safariTapCount([]), { tap: 0, total: 0 });
});

test('T242 (owner-1101g, keep): the install screen always builds the profile with the stored install id', () => {
  // Jared, 1 Nov: applying a new theme's profile REPLACED the old Home Screen icons. That relies on
  // the same PayloadIdentifier / per-app clip ids for every theme, keyed by the install id.
  const root = new URL('../../', import.meta.url);
  const install = readFileSync(new URL('app/install.tsx', root), 'utf8');
  assert.match(install, /const installId = await getInstallId\(\);/);
  assert.match(install, /buildInstallProfiles\([^)]*\{ installId \}\)/);
  const store = readFileSync(new URL('src/store/installId.ts', root), 'utf8');
  assert.match(store, /'glaze\.installId\.v1'/, 'the storage key never changes (a new key = a second profile)');
  assert.match(store, /isValidInstallId\(stored\)\) return stored/);
});
