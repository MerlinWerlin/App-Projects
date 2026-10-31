// T194: with an install id, every Glaze profile shares one top-level PayloadIdentifier and each
// web clip slot keeps its PayloadIdentifier / PayloadUUID, so a new theme's profile replaces the
// previous one in iOS. Without an install id the old behaviour is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfile,
  buildProfiles,
  estimateIconBytes,
  isValidInstallId,
  makeInstallId,
  stableProfileIdentifier,
  stableUuid,
  type WebClipIcon,
} from './mobileconfig.ts';
import { buildInstallProfiles } from './install.ts';

const PNG = 'iVBORw0KGgo=';
const icon = (label: string, url = `${label.toLowerCase()}:`): WebClipIcon => ({ label, url, pngBase64: PNG });
const ID = 'a1b2c3d4e5f60718';

/** Every <string> after a PayloadIdentifier / PayloadUUID key, in document order. */
function values(xml: string, key: string): string[] {
  const re = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`, 'g');
  return [...xml.matchAll(re)].map((m) => m[1]);
}
const topLevel = (xml: string, key: string): string => values(xml, key).at(-1)!;
const clips = (xml: string, key: string): string[] => values(xml, key).slice(0, -1);

test('makeInstallId gives a valid 16-hex id; validation rejects junk', () => {
  const id = makeInstallId();
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.ok(isValidInstallId(id));
  assert.notEqual(makeInstallId(), id);
  for (const bad of ['', 'ABC123DEF', 'a.b', 'short', 'x'.repeat(33), null, 42]) assert.equal(isValidInstallId(bad), false, String(bad));
});

test('stableUuid is deterministic, UUID-shaped and differs per seed', () => {
  const a = stableUuid('x:1:0');
  assert.equal(stableUuid('x:1:0'), a);
  assert.match(a, /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
  const many = new Set(Array.from({ length: 500 }, (_, i) => stableUuid(`${ID}:1:${i}`)));
  assert.equal(many.size, 500);
});

test('two themes built with the same install id share the profile identifier and clip ids', () => {
  const a = buildProfile({ themeName: 'Plum Glaze', icons: [icon('Music'), icon('Maps')], installId: ID });
  const b = buildProfile({ themeName: 'Sea Salt', icons: [icon('Mail'), icon('Notes')], installId: ID });
  assert.equal(topLevel(a, 'PayloadIdentifier'), `com.jared797.glaze.icons.${ID}`);
  assert.equal(topLevel(b, 'PayloadIdentifier'), topLevel(a, 'PayloadIdentifier'));
  assert.deepEqual(clips(a, 'PayloadIdentifier'), [
    `com.jared797.glaze.icons.${ID}.webclip.slot1`,
    `com.jared797.glaze.icons.${ID}.webclip.slot2`,
  ]);
  assert.deepEqual(clips(b, 'PayloadIdentifier'), clips(a, 'PayloadIdentifier'));
  assert.deepEqual(clips(b, 'PayloadUUID'), clips(a, 'PayloadUUID'));
  // Display names still say which theme it is.
  assert.match(a, /Glaze icons – Plum Glaze/);
  assert.match(b, /Glaze icons – Sea Salt/);
});

test('different installs get different identifiers', () => {
  const a = buildProfile({ themeName: 'T', icons: [icon('Music')], installId: ID });
  const b = buildProfile({ themeName: 'T', icons: [icon('Music')], installId: 'ffffeeee00001111' });
  assert.notEqual(topLevel(a, 'PayloadIdentifier'), topLevel(b, 'PayloadIdentifier'));
  assert.notDeepEqual(clips(a, 'PayloadUUID'), clips(b, 'PayloadUUID'));
});

test('split sets keep part 1 on the base identifier and give later parts their own stable one', () => {
  const icons = Array.from({ length: 6 }, (_, i) => ({ ...icon(`App${i}`), pngBase64: 'A'.repeat(2000) }));
  const files = buildProfiles({ themeName: 'Big', icons, maxBytes: 7000, installId: ID });
  assert.ok(files.length > 1);
  const ids = files.map((f) => topLevel(f.xml, 'PayloadIdentifier'));
  assert.equal(ids[0], stableProfileIdentifier(ID));
  assert.equal(ids[1], `com.jared797.glaze.icons.${ID}.part2`);
  assert.equal(new Set(ids).size, files.length);
  const allClipUuids = files.flatMap((f) => clips(f.xml, 'PayloadUUID'));
  assert.equal(new Set(allClipUuids).size, allClipUuids.length);
  const again = buildProfiles({ themeName: 'Other', icons, maxBytes: 7000, installId: ID });
  assert.deepEqual(again.map((f) => topLevel(f.xml, 'PayloadIdentifier')), ids);
});

test('no install id: identifiers stay random per build (old behaviour)', () => {
  const a = buildProfile({ themeName: 'Plum', icons: [icon('Music')] });
  const b = buildProfile({ themeName: 'Plum', icons: [icon('Music')] });
  assert.match(topLevel(a, 'PayloadIdentifier'), /^com\.jared797\.glaze\.icons\.plum\.[0-9A-F-]{36}$/);
  assert.notEqual(topLevel(a, 'PayloadIdentifier'), topLevel(b, 'PayloadIdentifier'));
  // An invalid id falls back to the old behaviour too.
  const c = buildProfile({ themeName: 'Plum', icons: [icon('Music')], installId: 'not valid!' });
  assert.match(topLevel(c, 'PayloadIdentifier'), /\.plum\./);
});

test('the top-level PayloadUUID stays fresh per build so each file is a new version', () => {
  const a = buildProfile({ themeName: 'T', icons: [icon('Music')], installId: ID });
  const b = buildProfile({ themeName: 'T', icons: [icon('Music')], installId: ID });
  assert.notEqual(topLevel(a, 'PayloadUUID'), topLevel(b, 'PayloadUUID'));
});

test('the size estimate still covers a stable-id clip', () => {
  const xml = buildProfile({ themeName: 'T', icons: [icon('Music')], installId: ID });
  const empty = buildProfile({ themeName: 'T', icons: [], installId: ID });
  assert.ok(estimateIconBytes(icon('Music')) >= xml.length - empty.length);
});

test('buildInstallProfiles passes the install id through', () => {
  const specs = [{ appId: 'music', label: 'Music', urlScheme: 'music:' }] as unknown as Parameters<typeof buildInstallProfiles>[0];
  const files = buildInstallProfiles(specs, [{ appId: 'music', pngBase64: PNG }], 'Plum', { installId: ID });
  assert.equal(files.length, 1);
  assert.equal(topLevel(files[0].xml, 'PayloadIdentifier'), `com.jared797.glaze.icons.${ID}`);
});
