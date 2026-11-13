// Owner 2026-11-14 ("Yes, add them"): the three how-to screen recordings are bundled and played
// muted, looping and inline, poster first, Reduce Motion = poster + play button, paused off-screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const r = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

test('the clips and posters are bundled (offline) and stay small', () => {
  let total = 0;
  for (const k of ['wallpaper', 'icons', 'widgets']) {
    const mp4 = statSync(join(process.cwd(), 'assets', 'video', `glaze-howto-${k}.mp4`)).size;
    const jpg = statSync(join(process.cwd(), 'assets', 'video', `glaze-howto-${k}-poster.jpg`)).size;
    assert.ok(mp4 < 2.5 * 1024 * 1024, `${k} clip under 2.5 MB`);
    total += mp4 + jpg;
  }
  assert.ok(total < 6.5 * 1024 * 1024, `all clips under 6.5 MB (${(total / 1048576).toFixed(1)} MB)`);
  const list = r('src', 'ui', 'howToClips.ts');
  for (const k of ['wallpaper', 'icons', 'widgets']) assert.ok(list.includes('assets/video/glaze-howto-' + k + '.mp4'), k);
});

test('playback: muted, looping, inline, poster until ready, Reduce Motion and off-screen handled', () => {
  const clip = r('src', 'ui', 'HowToClip.tsx');
  assert.match(clip, /p\.loop = true;\s*p\.muted = true;/);
  assert.match(clip, /nativeControls=\{false\}/);
  assert.match(clip, /status === 'readyToPlay'/);
  assert.match(clip, /const showPoster = !ready \|\| !wantsPlay;/);
  assert.match(clip, /useState\(!reduce\)/);
  assert.match(clip, /useFocusEffect\(/);
  assert.match(clip, /AppState\.addEventListener\('change'/);
  assert.doesNotMatch(r('package.json'), /"react-native-video"/);
});

test('the clips are on the icons walkthrough and the Wallpaper, Icons and Widgets setup steps', () => {
  assert.match(r('app', 'icons-intro.tsx'), /<HowToClip clip=\{HOW_TO_CLIPS\.icons\}/);
  const flow = r('src', 'ui', 'ThemeSetupFlow.tsx');
  for (const k of ['wallpaper', 'icons', 'widgets']) assert.ok(flow.includes(`<HowToClip clip={HOW_TO_CLIPS.${k}} label={t('theme.howTo.${k}')} />`), k);
});
