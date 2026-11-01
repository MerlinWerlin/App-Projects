// T173 premium UI, §3.6 Plus sheet and §3.7 Settings (docs/PREMIUM_UI.md): source guards for the
// slices. Plus sheet: the shared thick-glass Sheet, an art-collage hero from bundled theme art,
// exactly three benefit rows with line icons, one primary pill, Restore as a plain text link, and no
// pressure patterns (no timers, no countdowns, no crossed-out prices). Settings: inset groups only
// with editorial titles, row icons in pastel circles, values in inkSecondary, Storage sizes as
// skeletons while measuring, no spinners. Every Text on both paths carries a Dynamic Type cap, and
// the new strings exist in every locale.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ja', 'ko', 'zh-Hans', 'hi', 'ar'];
const SHEET = ['src', 'plus', 'PlusLockSheet.tsx'];
const RESTORE = ['src', 'plus', 'RestorePurchases.tsx'];
const SETTINGS = ['app', '(tabs)', 'settings.tsx'];
const STORAGE = ['src', 'ui', 'PackStorageSection.tsx'];

const PLUS_PATH = [SHEET, RESTORE, ['src', 'ui', 'Sheet.tsx'], ['src', 'ui', 'PillButton.tsx']];
const SETTINGS_PATH = [
  SETTINGS,
  STORAGE,
  ['src', 'ui', 'InsetGroup.tsx'],
  ['src', 'ui', 'SwitchInsetRow.tsx'],
  ['src', 'ui', 'LanguageSection.tsx'],
  ['src', 'ui', 'SectionHeader.tsx'],
  ['src', 'ui', 'Segmented.tsx'],
  ['src', 'plus', 'TipJar.tsx'],
];

test('Plus sheet: thick glass sheet, art-collage hero from bundled theme art, three benefit rows', () => {
  const sheet = strip(read(...SHEET));
  assert.match(strip(read('src', 'ui', 'Sheet.tsx')), /<GlassBar\s+material="thick"/, 'the shared sheet is thick glass (expo-blur)');
  assert.match(sheet, /<Sheet\b[^>]*closeLabel=\{t\('plus\.lock\.close'\)\}/s);
  // (Split strings: an import-shaped literal here would trip guard.test.ts's import scan.)
  assert.ok(sheet.includes('{ ART_PACK_ASSETS }') && sheet.includes("'../ui/" + "artPackAssets'"), 'hero uses the bundled art map');
  assert.ok(sheet.includes('{ Image as ExpoImage }'), 'hero draws with expo-image');
  assert.match(sheet, /<PlusHero \/>/);
  assert.match(sheet, /<ExpoImage\b[^>]*contentFit="cover"/);
  assert.match(sheet, /accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/, 'hero is decorative');
  const benefits = /const BENEFITS[^=]*= \[([\s\S]*?)\];/.exec(sheet)?.[1] ?? '';
  assert.equal((benefits.match(/\{ icon: '/g) ?? []).length, 3, 'exactly three benefit rows');
  for (const k of ['themes', 'widgets', 'symbols']) assert.ok(benefits.includes(`'plus.lock.${k}'`), k);
  assert.match(sheet, /<Feather name=\{b\.icon\}/, 'line (Feather) icons');
});

test('Plus sheet: one price, one primary pill, Restore as a plain text link', () => {
  const sheet = strip(read(...SHEET));
  const pills = [...sheet.matchAll(/<PillButton\b[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.equal(pills.length, 1, 'one pill');
  assert.ok(!/variant=/.test(pills[0]), 'and it is the primary (filled) pill');
  assert.equal((sheet.match(/t\('plus\.lock\.price', \{ price \}\)/g) ?? []).length, 1, 'the price line appears once');
  assert.match(sheet, /<RestorePurchases\s+variant="link"/);
  const restore = strip(read(...RESTORE));
  const link = restore.slice(restore.lastIndexOf('return ('));
  assert.ok(!link.includes('<PillButton'), 'the link variant is plain text, not a pill');
  assert.match(link, /<PressableScale\b[\s\S]*?accessibilityRole="button"[\s\S]*?<Text\b/);
  assert.match(link, /\{ color: c\.tint \}/);
});

test('Plus sheet: no pressure patterns, and the free promises stay', () => {
  for (const f of [SHEET, RESTORE]) {
    const src = strip(read(...f));
    assert.doesNotMatch(src, /setTimeout|setInterval|countdown|Countdown|expires|line-through|textDecorationLine/, f.join('/'));
    assert.doesNotMatch(src, /wasPrice|originalPrice|compareAt|discount|% off/i, f.join('/'));
    assert.doesNotMatch(src, /ActivityIndicator|withSpring|Easing\.bounce|Easing\.elastic/, f.join('/'));
  }
  const sheet = read(...SHEET);
  for (const k of ['plus.lock.freeIcons', 'plus.lock.freeInstall', 'plus.lock.freeLive', 'plus.lock.freeThemes']) assert.ok(sheet.includes(`'${k}'`), k);
  const en = read('src', 'i18n', 'ns', 'plus', 'en.ts');
  assert.match(en, /price: 'One-time \{price\}\. No subscription, ever\.'/, 'one-time unlock, never a subscription');
  assert.match(en, /eyebrow: 'One-time unlock'/);
});

test('Settings: inset groups only, with editorial titles', () => {
  const s = strip(read(...SETTINGS));
  assert.doesNotMatch(s, /<SquircleCard\b/, 'no free-standing cards');
  assert.doesNotMatch(s, /<InsetGroup\b[^>]*\bheader=/, 'editorial titles, not the small header');
  assert.ok((s.match(/<InsetGroup\b[^>]*\btitle=/g) ?? []).length >= 6);
  assert.match(s, /<InsetGroup eyebrow=\{t\('plus\.lock\.eyebrow'\)\} title=\{PLUS_NAME\}/);
  assert.match(s, /<RestorePurchases variant="row"/);
  assert.match(s, /\{__DEV__ \? <TipJar \/> : null\}/);
  for (const f of [STORAGE, ['src', 'ui', 'LanguageSection.tsx'], ['src', 'plus', 'TipJar.tsx']]) {
    const src = strip(read(...f));
    assert.doesNotMatch(src, /<InsetGroup\b[^>]*\bheader=/, f.join('/'));
    assert.match(src, /<InsetGroup\b[^>]*\btitle=/, f.join('/'));
  }
  const group = strip(read('src', 'ui', 'InsetGroup.tsx'));
  assert.match(group, /<SectionHeader level="group" flushTop eyebrow=\{eyebrow\} title=\{title\}/);
  // The version is a value, read in inkSecondary.
  assert.match(s, /title=\{t\('settings\.about\.versionRow'\)\}\s+value=\{version\}/);
  assert.match(group, /styles\.value, \{ color: c\.inkSecondary \}/);
});

test('Settings: row icons sit in pastel circles', () => {
  for (const f of [['src', 'ui', 'InsetGroup.tsx'], ['src', 'ui', 'SwitchInsetRow.tsx'], STORAGE, ['src', 'plus', 'TipJar.tsx']]) {
    const src = strip(read(...f));
    assert.doesNotMatch(src, /iconTileRadius/, `${f.join('/')}: no squircle tiles`);
    assert.match(src, /borderRadius: circleRadius\((tile|sizeV2\.rowIcon)\)/, f.join('/'));
    assert.match(src, /pastels(\[iconTone\]|\.\w+)\.fill/, f.join('/'));
  }
});

test('Settings › Storage shows skeleton sizes while measuring, never a spinner', () => {
  const s = strip(read(...STORAGE));
  assert.match(s, /const measuring = storage\.measuring;/);
  assert.match(s, /\{measuring \? \(\s*<View key="measuring"[\s\S]*?<Skeleton\b/);
  assert.match(s, /\{measuring \? \(\s*<Skeleton\b/, 'the total is a skeleton while measuring');
  assert.match(s, /!measuring && storage\.enabled && storage\.packs\.length === 0/, 'no "nothing downloaded" before measuring ends');
  const hook = read('src', 'plus', 'usePackAccess.ts');
  assert.match(hook, /measuring: !store\.loaded,/);
  // No file system: loading finishes at once, so the skeleton never sticks.
  assert.match(read('src', 'native', 'packs.ts'), /if \(!INDEX\) \{\s*set\(\{ loaded: true \}\);/);
  // (PillButton keeps its in-button busy indicator, the one place docs/PREMIUM_UI.md §2 allows it.)
  for (const f of [...SETTINGS_PATH, ...PLUS_PATH].filter((p) => !p.includes('PillButton.tsx'))) {
    assert.doesNotMatch(strip(read(...f)), /ActivityIndicator/, f.join('/'));
  }
});

test('every Text on the Plus sheet and Settings paths carries a Dynamic Type cap', () => {
  for (const f of [...PLUS_PATH, ...SETTINGS_PATH]) {
    const src = strip(read(...f));
    const tags = [...src.matchAll(/<(Text|TextInput)\b[\s\S]*?(?=\/?>)/g)].map((m) => m[0]);
    assert.ok(tags.length > 0, f.join('/'));
    const uncapped = tags.filter((t) => !/maxFontSizeMultiplier=/.test(t));
    assert.deepEqual(uncapped, [], `${f.join('/')}: Text without maxFontSizeMultiplier`);
  }
});

test('the Plus sheet and Settings paths never spring', () => {
  for (const f of [...PLUS_PATH, ...SETTINGS_PATH]) {
    assert.doesNotMatch(strip(read(...f)), /withSpring|Animated\.spring|Easing\.bounce|Easing\.elastic|damping:/, f.join('/'));
  }
});

test('Settings never reads the Plus entitlement directly', () => {
  for (const f of [SETTINGS, STORAGE]) assert.doesNotMatch(read(...f), /plus\/entitlement/, f.join('/'));
});

test('every locale has the new Plus sheet and Settings strings', () => {
  const want: [string, string, string][] = [
    ['plus', '  lock: {', '    eyebrow: '],
    ['settings', '  about: {', '    versionRow: '],
    ['ui', '  storage: {', '    measuring: '],
  ];
  for (const loc of LOCALES) {
    for (const [ns, block, key] of want) {
      const src = read('src', 'i18n', 'ns', ns, `${loc}.ts`);
      const at = src.indexOf(block);
      assert.ok(at >= 0, `${loc}: ${ns} ${block.trim()}`);
      const body = src.slice(at, src.indexOf('\n  },', at));
      const line = body.split('\n').find((l) => l.startsWith(key));
      assert.ok(line, `${loc}: ${ns}.${block.trim().replace(': {', '')}.${key.trim()}`);
      assert.match(line, /: '[^']+',$/, `${loc}: ${key.trim()} is a non-empty string`);
    }
  }
});

test('T175: the unused plus.lock.notNow string is gone from every locale (the sheet has no Not now button)', () => {
  for (const loc of LOCALES) {
    assert.ok(!/^\s+notNow: /m.test(read('src', 'i18n', 'ns', 'plus', `${loc}.ts`)), `${loc}: plus.lock.notNow removed`);
  }
  assert.ok(!strip(read(...SHEET)).includes('plus.lock.notNow'), 'PlusLockSheet does not use plus.lock.notNow');
});

test('D211-1: the Plus sheet promises no gallery themes it no longer has (no counts, "more coming" line)', () => {
  const sheet = strip(read(...SHEET));
  assert.ok(!sheet.includes('PLUS_THEMES') && !sheet.includes('PLUS_PACKS'), 'no Plus theme counts');
  assert.ok(!/plus\.lock\.freeThemes', \{/.test(sheet), 'free row has no starter count');
  const en = read('src', 'i18n', 'ns', 'plus', 'en.ts');
  assert.match(en, /themes: 'More Plus themes are on the way'/);
  assert.match(en, /freeThemes: 'Every theme in the gallery and the wallpaper maker'/);
});

// ---- T210: Settings after the owner-1101d brief (Install all at once main, Clean up old icons). ----

test('T210: Settings › Help opens Clean up old icons (same strings as the Icons tab row)', () => {
  const s = strip(read(...SETTINGS));
  const help = s.slice(s.indexOf("<InsetGroup title={t('settings.help.title')}>"), s.indexOf('</InsetGroup>', s.indexOf("t('settings.help.title')")));
  assert.ok(help.length > 0);
  const row = help.slice(help.indexOf("title={t('install.cleanup.title')}") - 80, help.indexOf("router.push('/icons-cleanup')") + 40);
  assert.ok(row.includes('icon="trash-2"') && row.includes('iconTone='), 'pastel circle row icon');
  assert.ok(row.includes("subtitle={t('install.cleanup.rowSubtitle')}"));
  assert.ok(row.includes("accessibilityHint={t('install.cleanup.openHint')}"));
  assert.ok(help.indexOf("t('settings.help.howIcons')") < help.indexOf("t('install.cleanup.title')"), 'right after How icons work');
});

test('T210: the How icons work sheet tells the post-T202 truth: Install all at once is the main way', () => {
  for (const loc of LOCALES) {
    const src = read('src', 'i18n', 'ns', 'settings', `${loc}.ts`);
    const ways = /\n {4}waysBody: '([^']+)',/.exec(src)?.[1] ?? '';
    assert.ok(ways.length > 0, `${loc}: waysBody`);
    assert.ok(ways.includes('Safari') && ways.includes('iOS'), `${loc}: names the Safari tap and the iOS limit`);
    assert.doesNotMatch(ways, /beta|recommended|empfohlen|recomendado|recommandé|consigliato|おすすめ|권장|推荐|सुझाया|موصى/i, `${loc}: no stale "Shortcuts recommended / Bulk beta"`);
  }
  const en = read('src', 'i18n', 'ns', 'settings', 'en.ts');
  assert.match(en, /waysBody: 'Install all at once \(the main way\): one profile adds every icon/);
  assert.match(en, /replaces the old icons/);
  assert.match(en, /Shortcuts \(one icon at a time\): each icon uses the “Open App” action/);
});

test('T210: the sheet shows the removal steps as one numbered sequence on a soft well', () => {
  const s = strip(read(...SETTINGS));
  assert.match(s, /<View style=\{\[styles\.stepsWell, continuous, \{ backgroundColor: c\.fill \}\]\}>/);
  assert.match(s, /<View style=\{\[styles\.stepDot, \{ backgroundColor: c\.tint \}\]\}>/);
  assert.match(s, /\{formatNumber\(i \+ 1\)\}/);
  assert.match(s, /accessibilityLabel=\{\[t\('settings\.explainer\.stepNumber', \{ number: i \+ 1 \}\), t\(step\)\]\.join\(' '\)\}/, 'each step is one VoiceOver line');
  assert.match(s, /stepDot: \{[^}]*borderRadius: circleRadius\(sizeV2\.rowIcon\)/);
  assert.doesNotMatch(s, /hairlineWidth|borderTopWidth/, 'no ruled lines in Settings');
});
