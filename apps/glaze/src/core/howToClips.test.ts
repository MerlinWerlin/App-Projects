// Owner 2026-11-14 / 2026-11-15: the how-to screen recordings are bundled (offline) and open LARGE in
// their own sheet: on their own the first time each task is reached (remembered per category) and
// from an always-visible "Watch how" button. No small inline players.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HOW_TO_CATEGORIES, howToSeenKey, shouldAutoOpenHowTo } from './howTo.ts';

const r = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

test('the clips and posters are bundled (offline) and stay small', () => {
  let total = 0;
  for (const k of HOW_TO_CATEGORIES) {
    const mp4 = statSync(join(process.cwd(), 'assets', 'video', `glaze-howto-${k}.mp4`)).size;
    const jpg = statSync(join(process.cwd(), 'assets', 'video', `glaze-howto-${k}-poster.jpg`)).size;
    assert.ok(mp4 < 2.5 * 1024 * 1024, `${k} clip under 2.5 MB`);
    total += mp4 + jpg;
  }
  assert.ok(total < 6.5 * 1024 * 1024, `all clips under 6.5 MB (${(total / 1048576).toFixed(1)} MB)`);
  const list = r('src', 'ui', 'howToClips.ts');
  for (const k of HOW_TO_CATEGORIES) assert.ok(list.includes('assets/video/glaze-howto-' + k + '.mp4'), k);
});

test('once per category: auto-open only when not seen; one key per category', () => {
  assert.equal(shouldAutoOpenHowTo(false), true);
  assert.equal(shouldAutoOpenHowTo(true), false);
  assert.deepEqual(HOW_TO_CATEGORIES.map(howToSeenKey), ['glaze.howTo.seen.v1.wallpaper', 'glaze.howTo.seen.v1.icons', 'glaze.howTo.seen.v1.widgets']);
  const sheet = r('src', 'ui', 'HowToSheet.tsx');
  assert.match(sheet, /if \(!live \|\| !shouldAutoOpenHowTo\(seen\)\) return;\s*setOpen\(true\);\s*void markHowToSeen\(category\);/);
  // A failed read counts as seen: never a surprise video in a loop.
  assert.match(r('src', 'store', 'howTo.ts'), /catch \{\s*return true;/);
});

test('the large sheet: title, caption in words, largest phone frame, Got it + Watch again', () => {
  const sheet = r('src', 'ui', 'HowToSheet.tsx');
  assert.match(sheet, /presentationStyle="pageSheet"/);
  assert.match(sheet, /const h = Math\.max\(0, Math\.min\(box\.h, box\.w \/ ASPECT\)\);/);
  assert.match(sheet, /t\('theme\.howTo\.gotIt'\)/);
  assert.match(sheet, /t\('theme\.howTo\.again'\)/);
  assert.match(sheet, /accessibilityViewIsModal onAccessibilityEscape=\{onClose\}/);
  assert.match(sheet, /label=\{t\('theme\.howTo\.videoLabel', \{ steps: caption \}\)\}/);
});

test('playback: muted, looping, inline, poster until ready, Reduce Motion, tap to pause, replay, off-screen', () => {
  const clip = r('src', 'ui', 'HowToClip.tsx');
  assert.match(clip, /p\.loop = true;\s*p\.muted = true;/);
  assert.match(clip, /nativeControls=\{false\}/);
  assert.match(clip, /status === 'readyToPlay'/);
  assert.match(clip, /const showPoster = !ready \|\| !wantsPlay;/);
  assert.match(clip, /useState\(!reduce\)/);
  assert.match(clip, /onPress=\{\(\) => setWantsPlay\(\(v\) => !v\)\}/);
  assert.match(clip, /player\.currentTime = 0;/);
  assert.match(clip, /useFocusEffect\(/);
  assert.match(clip, /AppState\.addEventListener\('change'/);
  assert.doesNotMatch(r('package.json'), /"react-native-video"/);
});

test('Watch how everywhere, auto-open at each first time, and no inline players left', () => {
  const flow = r('src', 'ui', 'ThemeSetupFlow.tsx');
  for (const k of HOW_TO_CATEGORIES) {
    assert.ok(flow.includes(`useHowTo('${k}', { auto: visible && step === '${k}' })`), `flow ${k}`);
    assert.ok(flow.includes(`{${k}How.button()}`) && flow.includes(`{${k}How.sheet}`), `flow ${k} button + sheet`);
  }
  assert.match(r('app', 'icons-intro.tsx'), /\{how\.button\(\)\}/);
  assert.match(r('app', 'install.tsx'), /useHowTo\('icons', \{ auto: true \}\)/);
  // 1.0.32: the hook must sit in WidgetStudio (where `how` is read), not in the route wrapper (1.0.31 threw
  // "how is not defined" on the Widget Studio's first render).
  const studio = r('app', 'widget-studio.tsx');
  const inner = studio.slice(studio.indexOf('function WidgetStudio('));
  assert.match(inner, /useHowTo\('widgets', \{ auto: true \}\)/);
  assert.ok(studio.indexOf("useHowTo('widgets'") > studio.indexOf('function WidgetStudio('), 'useHowTo lives inside WidgetStudio');
  assert.ok(inner.includes('onPress={how.open}') && inner.includes('{how.sheet}'), 'WidgetStudio uses its own how');
  assert.match(r('app', 'theme', '[id].tsx'), /if \(saved\) void howToSeen\('wallpaper'\)/);
  for (const f of [['src', 'ui', 'ThemeSetupFlow.tsx'], ['app', 'icons-intro.tsx'], ['app', 'install.tsx'], ['app', 'widget-studio.tsx']]) {
    assert.doesNotMatch(r(...f), /<HowToClip\b/, f.join('/'));
  }
});
