import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IconSpec } from './iconspec.ts';
import {
  PHOTOS_ALBUM,
  batchFraction,
  renderTimingText,
  buildInstallProfiles,
  checklistCount,
  defaultInstallState,
  fileSlug,
  iconFilename,
  isProfileStepDone,
  joinPath,
  overallProgress,
  parseInstallState,
  percentText,
  planInstall,
  planSummary,
  profileStepCards,
  profileThemeName,
  progressLabel,
  reasonText,
  sanitizeInstallState,
  serializeInstallState,
  shortcutItems,
  shortcutSteps,
  shortcutUrl,
  toggleProfileStep,
  toggleShortcutDone,
  webClipIcons,
} from './install.ts';

function spec(appId: string, label: string, urlScheme: string | null): IconSpec {
  return {
    appId,
    label,
    urlScheme,
    shape: 'squircle',
    background: { kind: 'solid', colour: '#7A2E6B' },
    glyph: 'star',
    glyphSet: 'feather',
    glyphColour: '#FFFFFF',
    glyphScale: 0.55,
    showLabel: true,
  };
}

const SPECS = [
  spec('music', 'Music', 'music:'),
  spec('custom-bank', 'My Bank', null),
  spec('maps', 'Maps', 'maps://'),
  spec('custom-blank', 'Blank', '   '),
];

// A real 1x1 PNG.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('planInstall splits by URL scheme and keeps order', () => {
  const plan = planInstall(SPECS);
  assert.deepEqual(plan.profile.map((s) => s.appId), ['music', 'maps']);
  assert.deepEqual(plan.shortcuts.map((s) => s.appId), ['custom-bank', 'custom-blank']);
  assert.deepEqual(planInstall([]), { profile: [], shortcuts: [] });
});

test('shortcutItems: bulk lists only scheme-less apps, shortcuts lists all', () => {
  const bulk = shortcutItems(SPECS, 'bulk');
  assert.deepEqual(bulk.map((i) => [i.spec.appId, i.reason, i.url]), [
    ['custom-bank', 'no-scheme', null],
    ['custom-blank', 'no-scheme', null],
  ]);
  const all = shortcutItems(SPECS, 'shortcuts');
  assert.deepEqual(all.map((i) => [i.spec.appId, i.reason]), [
    ['music', 'chosen'],
    ['custom-bank', 'no-scheme'],
    ['maps', 'chosen'],
    ['custom-blank', 'no-scheme'],
  ]);
  assert.equal(all[0].url, 'music:');
  assert.match(reasonText('no-scheme'), /Shortcuts/);
});

test('shortcutUrl trims and nulls empty schemes', () => {
  assert.equal(shortcutUrl({ urlScheme: ' spotify: ' }), 'spotify:');
  assert.equal(shortcutUrl({ urlScheme: '' }), null);
  assert.equal(shortcutUrl({ urlScheme: null }), null);
});

test('planSummary wording', () => {
  assert.equal(planSummary(planInstall(SPECS)), '2 icons via one profile, 2 via Shortcuts');
  assert.equal(planSummary(planInstall(SPECS), 2), '2 icons via 2 profiles, 2 via Shortcuts');
  assert.equal(planSummary(planInstall([SPECS[0]])), '1 icon via one profile');
  assert.equal(planSummary(planInstall([SPECS[1]])), '1 icon via Shortcuts');
  assert.equal(planSummary({ profile: [], shortcuts: [] }), 'No apps selected yet');
});

test('progress maths is clamped and monotonic across phases', () => {
  assert.equal(batchFraction(0, 0), 0);
  assert.equal(batchFraction(5, 10), 0.5);
  assert.equal(batchFraction(12, 10), 1);
  assert.equal(batchFraction(-1, 10), 0);
  assert.equal(batchFraction(NaN, 10), 0);
  assert.equal(overallProgress('idle'), 0);
  assert.equal(overallProgress('rendering', 0, 10), 0);
  assert.ok(Math.abs(overallProgress('rendering', 10, 10) - 0.85) < 1e-9);
  assert.equal(overallProgress('done'), 1);
  const seq = [
    overallProgress('rendering', 3, 10),
    overallProgress('rendering', 10, 10),
    overallProgress('building'),
    overallProgress('saving', 1, 2),
    overallProgress('sharing', 0, 1),
    overallProgress('done'),
  ];
  for (let i = 1; i < seq.length; i++) assert.ok(seq[i] >= seq[i - 1], `step ${i}`);
  assert.equal(percentText(0.426), '43%');
  assert.equal(percentText(2), '100%');
  assert.equal(progressLabel('rendering', 3, 10), 'Drawing icons 3 of 10');
  assert.equal(progressLabel('saving', 0, 2), 'Saving file 1 of 2');
  assert.equal(progressLabel('sharing', 0, 1), 'Opening share sheet');
});

test('file names are safe and sortable', () => {
  assert.equal(iconFilename('Spotify', 2), 'glaze-03-spotify.png');
  assert.equal(iconFilename('Café Crème!', 0), 'glaze-01-cafe-creme.png');
  assert.equal(iconFilename('日本', 9), 'glaze-10-icon.png');
  assert.equal(iconFilename('x', -3), 'glaze-01-x.png');
  assert.equal(fileSlug('../../etc/passwd'), 'etc-passwd');
  assert.ok(fileSlug('a'.repeat(100)).length <= 32);
  assert.equal(joinPath('file:///cache/', 'a.png'), 'file:///cache/a.png');
  assert.equal(joinPath('file:///cache', 'a.png'), 'file:///cache/a.png');
});

test('shortcutSteps: Open URL with a scheme, Open App without', () => {
  const withUrl = shortcutSteps('Music', 'music:');
  const joined = withUrl.join('\n');
  assert.match(joined, /Open URL/);
  assert.match(joined, /music:/);
  assert.match(joined, /Rename/);
  assert.match(joined, /Add to Home Screen/);
  assert.match(joined, /Choose Photo/);
  assert.ok(joined.includes(PHOTOS_ALBUM));
  assert.match(withUrl[withUrl.length - 1], /Tap Add/);
  const noUrl = shortcutSteps('My Bank', null).join('\n');
  assert.match(noUrl, /Open App/);
  assert.doesNotMatch(noUrl, /Open URL/);
  assert.match(noUrl, /My Bank/);
  assert.match(shortcutSteps('  ', null).join('\n'), /App/);
});

test('profile step cards cover open, install, Not Verified, hide and remove', () => {
  const cards = profileStepCards();
  const ids = cards.map((c) => c.id);
  assert.deepEqual(ids, ['save', 'open', 'install', 'not-verified', 'hide-old', 'remove']);
  assert.equal(new Set(ids).size, ids.length);
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  assert.match(byId.open.body, /Profile Downloaded/);
  assert.match(byId.install.body, /VPN & Device Management/);
  // Owner 24 Oct: "couldn't find it in Settings" -> the card says where else to look and that iOS drops it after ~8 min.
  assert.match(byId.install.body, /Downloaded Profile/);
  assert.match(byId.install.body, /8 minutes/);
  assert.match(byId['not-verified'].body, /not signed/);
  assert.match(byId['not-verified'].body, /cannot read/);
  assert.match(byId['hide-old'].body, /Remove from Home Screen/);
  assert.match(byId['hide-old'].body, /App Library/);
  assert.match(byId.remove.body, /Remove Profile/);
  assert.match(profileStepCards(3)[0].body, /3 files/);
  for (const c of cards) assert.ok(c.title && c.body && c.illustration);
});

test('profile generation: rendered PNGs become one web clip per scheme app', () => {
  const plan = planInstall(SPECS);
  const rendered = [
    { appId: 'maps', pngBase64: PNG },
    { appId: 'music', pngBase64: PNG },
    { appId: 'custom-bank', pngBase64: PNG },
  ];
  const icons = webClipIcons(plan.profile, rendered);
  assert.deepEqual(icons.map((i) => [i.label, i.url]), [
    ['Music', 'music:'],
    ['Maps', 'maps://'],
  ]);
  let n = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const files = buildInstallProfiles(plan.profile, rendered, '  Plum Glaze ', { uuid });
  assert.equal(files.length, 1);
  assert.equal(files[0].filename, 'Glaze-plum-glaze.mobileconfig');
  const xml = files[0].xml;
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.equal((xml.match(/com\.apple\.webClip\.managed/g) ?? []).length, 2);
  assert.ok(xml.includes('<string>music:</string>'));
  assert.ok(xml.includes('<string>maps://</string>'));
  assert.ok(!xml.includes('My Bank'));
  assert.ok(xml.includes('Glaze icons – Plum Glaze'));
});

test('profile generation: missing PNGs skipped, empty -> no files, split when large', () => {
  const plan = planInstall(SPECS);
  assert.deepEqual(buildInstallProfiles(plan.profile, [], null), []);
  const one = buildInstallProfiles(plan.profile, [{ appId: 'music', pngBase64: PNG }], null);
  assert.equal(one.length, 1);
  assert.equal(one[0].filename, 'Glaze-custom.mobileconfig');
  const big = 'A'.repeat(4000);
  const many = Array.from({ length: 6 }, (_, i) => spec(`a${i}`, `App ${i}`, `app${i}:`));
  const files = buildInstallProfiles(many, many.map((s) => ({ appId: s.appId, pngBase64: big })), 'Big', {
    maxBytes: 10000,
  });
  assert.ok(files.length > 1);
  assert.match(files[0].filename, /^Glaze-big-1-of-\d+\.mobileconfig$/);
  const total = files.reduce((k, f) => k + (f.xml.match(/webClip\.managed/g) ?? []).length, 0);
  assert.equal(total, 6);
  assert.equal(profileThemeName(null), 'Custom');
  assert.equal(profileThemeName(' Moss '), 'Moss');
});

test('install state round-trips and repairs bad input', () => {
  let s = defaultInstallState();
  s = toggleProfileStep(s, 'Glaze-a.mobileconfig', 'open');
  s = toggleProfileStep(s, 'Glaze-a.mobileconfig', 'install');
  s = toggleShortcutDone(s, 'custom-bank');
  s = { ...s, choice: 'shortcuts' };
  const back = parseInstallState(serializeInstallState(s));
  assert.deepEqual(back, s);
  assert.ok(isProfileStepDone(back, 'Glaze-a.mobileconfig', 'open'));
  assert.ok(!isProfileStepDone(back, 'Glaze-b.mobileconfig', 'open'));

  const off = toggleProfileStep(toggleProfileStep(s, 'Glaze-a.mobileconfig', 'open'), 'Glaze-a.mobileconfig', 'install');
  assert.deepEqual(off.profileSteps, {});
  assert.deepEqual(toggleShortcutDone(s, 'custom-bank', true).shortcutsDone, ['custom-bank']);
  assert.deepEqual(toggleShortcutDone(s, 'custom-bank', false).shortcutsDone, []);

  assert.deepEqual(parseInstallState(null), defaultInstallState());
  assert.deepEqual(parseInstallState('{nope'), defaultInstallState());
  assert.deepEqual(parseInstallState('{"v":99,"choice":"shortcuts"}'), defaultInstallState());
  const repaired = sanitizeInstallState({
    profileSteps: { a: ['x', 'x', 3, ''], b: 'nope', c: [] },
    shortcutsDone: ['m', null, 'm'],
    choice: 'teleport',
  });
  assert.deepEqual(repaired, { profileSteps: { a: ['x'] }, shortcutsDone: ['m'], choice: 'bulk' });
  assert.deepEqual(sanitizeInstallState([1, 2]), defaultInstallState());
});

test('checklistCount', () => {
  assert.deepEqual(checklistCount(['a', 'b', 'c'], ['b', 'z']), { done: 1, total: 3 });
  assert.deepEqual(checklistCount([], ['a']), { done: 0, total: 0 });
});

test('renderTimingText formats on-device render timing for the owner to report', () => {
  assert.equal(renderTimingText(60, 14_230), 'Drew 60 icons in 14 s (0.24 s each)');
  assert.equal(renderTimingText(12, 3_400), 'Drew 12 icons in 3.4 s (0.28 s each)');
  assert.equal(renderTimingText(1, 250), 'Drew 1 icon in 0.3 s (0.25 s each)');
  assert.equal(renderTimingText(0, 1000), null);
  assert.equal(renderTimingText(5, -1), null);
  assert.equal(renderTimingText(5, Number.NaN), null);
});
