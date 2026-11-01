// T173 premium UI, §3.5 Install flow (docs/PREMIUM_UI.md) + T156 copy: source guards for the slice:
// editorial SectionHeaders as the headings, the profile steps as one numbered sequence with a single
// "current" step (timed ease-out fade, no spring), skeletons of the result while waiting and no
// ActivityIndicator, a finished "Done" panel, one `success` haptic per flow, Dynamic Type caps on
// every Text on the install path, and the new strings (and the T156 Safari copy) in every locale.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const INSTALL_PATH = ['app', 'install.tsx'];
const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ja', 'ko', 'zh-Hans', 'hi', 'ar'];

/** The body of a top-level block (`  name: {` ... `  },`) of a locale file. */
function block(src: string, name: string): string {
  return new RegExp(`\\n {2}${name}: \\{\\n([\\s\\S]*?)\\n {2}\\},\\n`).exec(src)?.[1] ?? '';
}

test('install screen headings are editorial SectionHeaders, the steps one with an eyebrow', () => {
  const d = strip(read(...INSTALL_PATH));
  assert.ok(d.includes(' SectionHeader, Skeleton, SquircleCard }'), 'SectionHeader and Skeleton come from src/ui/v2');
  assert.ok((d.match(/<SectionHeader\b/g) ?? []).length >= 5);
  assert.ok(d.includes("eyebrow={t('install.sequence.eyebrow')}"));
  // No bare title2 headers left in the scrolling screen (the empty state keeps its own).
  assert.equal((d.match(/accessibilityRole="header" style=\{\[\.\.\.ts\('title2'\)/g) ?? []).length, 1);
});

test('profile steps read as one numbered sequence with exactly one current step', () => {
  const d = strip(read(...INSTALL_PATH));
  assert.match(d, /const currentStep = stepDone\.indexOf\(false\);/);
  assert.match(d, /state=\{done \? 'done' : i === currentStep \? 'current' : 'upcoming'\}/);
  assert.match(d, /index=\{i \+ 1\}/);
  assert.match(d, /total=\{cards\.length\}/);
  // The sequence sits on one lifted card, not an inset group with separators.
  const seq = d.slice(d.indexOf("eyebrow={t('install.sequence.eyebrow')}"), d.indexOf('</SquircleCard>', d.indexOf("eyebrow={t('install.sequence.eyebrow')}")));
  assert.ok(seq.includes('outline={false}'));
  assert.ok(!seq.includes('<InsetGroup'));
  // Current: filled tint number and the "Current step" label; others muted.
  assert.match(d, /current \? c\.tint : c\.fill/);
  assert.ok(d.includes("t('install.sequence.current')"));
  assert.match(d, /color: current \? c\.ink : c\.inkSecondary/);
  assert.ok(d.includes("t('install.sequence.a11yCurrent'") && d.includes("t('install.sequence.a11yStep'"));
});

test('step and finished fades are timed ease-out (≤ base), shorter under Reduce Motion, never a spring', () => {
  const d = strip(read(...INSTALL_PATH));
  assert.match(d, /duration: reduced \? durations\.fast : durations\.base, easing: easeOutCurve/);
  assert.match(d, /on\.value = withTiming\(current \? 1 : 0, fadeTiming\(reduced\)\)/);
  assert.match(d, /shown\.value = withTiming\(1, fadeTiming\(reduced\)\)/);
  assert.match(d, /const reduced = useMotionReduced\(\);/);
  assert.doesNotMatch(d, /withSpring|springify|durations\.slow/);
});

test('waits show skeletons of the result, never an ActivityIndicator', () => {
  const d = strip(read(...INSTALL_PATH));
  assert.doesNotMatch(d, /ActivityIndicator/);
  assert.match(d, /\{bulkBusy \? <ResultSkeleton icons=\{[^}]+\} file \/> : null\}/);
  assert.match(d, /\{photosBusy \? <ResultSkeleton icons=\{[^}]+\} \/> : null\}/);
  assert.ok(d.includes('<IconGridSkeleton'), 'loading state stays a skeleton');
});

test('finished state: a clear Done panel, and one success haptic per flow', () => {
  const d = strip(read(...INSTALL_PATH));
  assert.match(d, /const bulkFinished = phase === 'done' && profiles\.length !== 0 && !bulkError;/);
  assert.match(d, /\{bulkFinished \? \(\s*<FinishedPanel/);
  assert.ok(d.includes("title={t('install.finished.title')}"));
  const panel = d.slice(d.indexOf('function FinishedPanel'), d.indexOf('type StepState'));
  assert.ok(panel.length > 0 && !panel.includes('haptic('), 'the panel itself never buzzes');
  // generate(): one success (after saving) and saveToPhotos(): one success.
  const gen = d.slice(d.indexOf('const generate = useCallback'), d.indexOf('const shareAgain = useCallback'));
  assert.equal((gen.match(/haptic\('success'\)/g) ?? []).length, 1);
  const photos = d.slice(d.indexOf('const saveToPhotos = useCallback'), d.indexOf('const cancelRender = useCallback'));
  assert.equal((photos.match(/haptic\('success'\)/g) ?? []).length, 1);
});

test('every Text on the install path carries a Dynamic Type cap', () => {
  for (const f of [INSTALL_PATH, ['src', 'ui', 'ProgressBar.tsx'], ['src', 'ui', 'SectionHeader.tsx'], ['src', 'ui', 'PillButton.tsx']]) {
    const src = strip(read(...f));
    const tags = [...src.matchAll(/<(Text|TextInput)\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(tags.length > 0, f.join('/'));
    const uncapped = tags.filter((t) => !/maxFontSizeMultiplier=/.test(t));
    assert.deepEqual(uncapped, [], `${f.join('/')}: Text without maxFontSizeMultiplier`);
  }
});

test('every locale has the sequence and finished strings', () => {
  for (const loc of LOCALES) {
    const src = read('src', 'i18n', 'ns', 'install', `${loc}.ts`);
    const seq = block(src, 'sequence');
    for (const k of ['eyebrow:', 'title:', 'current:', 'a11yCurrent:', 'a11yStep:', 'allDone:']) {
      assert.ok(seq.includes(k), `${loc}: install.sequence ${k}`);
    }
    for (const k of ['{index}', '{total}', '{title}', '{body}']) assert.ok(seq.includes(k), `${loc}: a11y placeholder ${k}`);
    const fin = block(src, 'finished');
    for (const k of ['title:', 'safari:', 'share:']) assert.ok(fin.includes(k), `${loc}: install.finished ${k}`);
  }
});

test('T156: the Safari page and step copy say Safari may ask before Install is tapped, in every locale', () => {
  // Per locale: a word for "before" next to the Install button name, in the page body and the allow step.
  const before: Record<string, RegExp> = {
    en: /before you tap Install/,
    de: /bevor du auf „Installieren“ tippst/,
    es: /antes de que toques Instalar/,
    fr: /avant (même )?que vous touchiez Installer/,
    it: /prima che tocchi Installa/,
    'pt-BR': /antes de você tocar em Instalar/,
    ja: /「インストール」をタップする前/,
    ko: /설치를 탭하기 전/,
    'zh-Hans': /轻点“安装”之前/,
    hi: /इंस्टॉल पर टैप करने से पहले/,
    ar: /قبل أن تضغط «تثبيت»/,
  };
  for (const loc of LOCALES) {
    const src = read('src', 'i18n', 'ns', 'install', `${loc}.ts`);
    const page = /\n {4}page: \{ title: '[^']*', body: '([^']*)'/.exec(src)?.[1] ?? '';
    const allow = /\n {6}allow: \{ title: '[^']*', body: '([^']*)'/.exec(src)?.[1] ?? '';
    assert.match(page, before[loc], `${loc}: page body`);
    assert.match(allow, before[loc], `${loc}: allow step`);
  }
});

// ---- T210: premium pass on the owner-1101d install flow (Install all at once main, small
// "Prefer Shortcuts?" link, Clean up old icons). ----

test('T210: install cards lift by surface (raised in dark), never a hairline', () => {
  const d = strip(read(...INSTALL_PATH));
  assert.match(d, /const cardTone: CardTone = scheme === 'dark' \? 'raised' : 'surface';/);
  const cards = [...d.matchAll(/<SquircleCard\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(cards.length >= 6, 'summary, coverage, bulk, sequence, shortcuts, android, skeleton');
  for (const card of cards) assert.match(card, /outline=\{false\}/, card);
  assert.doesNotMatch(d, /hairlineWidth/, 'no ruled lines: file rows and coverage rows are spaced surfaces');
  assert.doesNotMatch(d, /borderTop(Width|Color)/);
  assert.match(d, /styles\.fileRow, continuous, \{ backgroundColor: c\.fill \}/);
});

test('T210: the summary is the hero: icons on a soft well, one editorial heading with an eyebrow', () => {
  const d = strip(read(...INSTALL_PATH));
  const at = d.indexOf('<SquircleCard size="large" tone={cardTone}');
  assert.ok(at > 0);
  const card = d.slice(at, d.indexOf('</SquircleCard>', at));
  assert.match(card, /styles\.well, continuous, \{ backgroundColor: c\.fill \}/);
  assert.match(card, /<SectionHeader level="group" flushTop eyebrow=\{t\('install\.summary\.eyebrow'\)\} title=\{summary\}/);
  assert.ok(!card.includes('accessibilityRole="header"'), 'no bare header Text left in the summary');
});

test('T210: Install all at once is an editorial header; Prefer Shortcuts stays a small centred link at the foot', () => {
  const d = strip(read(...INSTALL_PATH));
  assert.match(
    d,
    /<SectionHeader\s+eyebrow=\{t\('install\.method\.bulkEyebrow'\)\}\s+title=\{t\('install\.method\.bulk'\)\}\s+body=\{t\('install\.method\.bulkBody', \{ count: plan\.profile\.length \}\)\}/,
  );
  const card = d.slice(d.indexOf("title={t('install.method.bulk')}"), d.indexOf("eyebrow={t('install.sequence.eyebrow')}"));
  const link = card.indexOf("label={t('install.method.shortcutsFallback')}");
  const main = card.indexOf("t('install.bulk.generate')");
  assert.ok(main > 0 && link > main, 'the fallback link comes after the main pill');
  const pill = card.slice(card.lastIndexOf('<PillButton', link), card.indexOf('/>', link));
  assert.match(pill, /variant="plain"/);
  assert.match(pill, /size="small"/);
  assert.match(card, /<View style=\{styles\.fallbackLink\}>/);
  assert.match(d, /fallbackLink: \{ alignItems: 'center', paddingTop: spaceV2\.sm \}/);
});

test('T210: the first load is a skeleton of the screen, and Clean up old icons uses editorial titles', () => {
  const d = strip(read(...INSTALL_PATH));
  assert.match(d, /<InstallSkeleton label=\{t\('install\.state\.loading'\)\} tone=\{cardTone\} \/>/);
  const sk = d.slice(d.indexOf('function InstallSkeleton('), d.indexOf('function CleanupTip('));
  assert.ok(sk.includes('<IconGridSkeleton') && (sk.match(/<Skeleton\b/g) ?? []).length >= 5);
  assert.ok(!sk.includes('<Text'), 'just the shape (the label is for VoiceOver)');
  assert.doesNotMatch(d, /<InsetGroup\b[^>]*\bheader=/, 'editorial group titles on the install screen');
  const cleanup = strip(read('app', 'icons-cleanup.tsx'));
  assert.doesNotMatch(cleanup, /<InsetGroup\b[^>]*\bheader=/);
  assert.match(cleanup, /<InsetGroup key=\{s\.header\} title=\{t\(s\.header\)\}/);
  assert.match(cleanup, /gap: editorialV2\.sectionTop/);
  const tags = [...cleanup.matchAll(/<(Text|TextInput)\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(tags.length > 0 && tags.every((x) => /maxFontSizeMultiplier=/.test(x)));
});

test('T210: the new install eyebrows exist in every locale', () => {
  for (const loc of LOCALES) {
    const src = read('src', 'i18n', 'ns', 'install', `${loc}.ts`);
    assert.match(block(src, 'summary'), /\n {4}eyebrow: '[^']+',/, `${loc}: install.summary.eyebrow`);
    assert.match(block(src, 'method'), /\n {4}bulkEyebrow: '[^']+',/, `${loc}: install.method.bulkEyebrow`);
  }
  const en = read('src', 'i18n', 'ns', 'install', 'en.ts');
  assert.match(en, /eyebrow: 'Your icon set',/);
  assert.match(en, /bulkEyebrow: 'The quick way',/);
});
