// T108 (oversight D104-2): the Space (Webb) credit line stays visible wherever a downloaded Space
// image is shown or saved. Source guards over the UI (no React in Node): any screen or component that
// reads a downloaded photo's file (usePhotoTheme / photoEntry ... .uri) must also render the credit
// (<PhotoCredit>) or carry it in its save / apply confirmation (photoCreditParams).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** UI files (not core, not the store/hook that only hold the URI) that read a Space photo's file. */
function photoReaders(): string[] {
  const skip = new Set(['src/native/photoPacks.ts', 'src/ui/usePhotoTheme.ts']);
  return [...walk(join(root, 'app')), ...walk(join(root, 'src'))]
    .map((p) => relative(root, p).split('\\').join('/'))
    .filter((p) => !p.startsWith('src/core/') && !skip.has(p))
    .filter((p) => {
      const s = read(p);
      return /usePhotoTheme\(|photoEntry\(|getPhotoState\(/.test(s) && /\.uri\b/.test(s);
    });
}

test('T108 every UI file that shows or saves a downloaded Space photo also shows its credit', () => {
  const readers = photoReaders();
  assert.ok(readers.includes('app/theme/[id].tsx'), 'theme detail reads the photo');
  for (const p of readers) {
    const s = read(p);
    assert.match(s, /<PhotoCredit\b|photoCreditParams\(/, `${p} shows a Space photo but not its credit`);
  }
});

test('T108 PhotoCredit always renders the exact credit line, outside the optional actions', () => {
  const s = read('src', 'ui', 'PhotoCredit.tsx');
  const main = s.slice(s.indexOf('export function PhotoCredit('));
  const credit = main.indexOf('{src.credit}');
  assert.ok(credit > 0, 'credit rendered from the manifest, untranslated');
  assert.ok(credit < main.indexOf('{showActions ?'), 'credit is not behind showActions');
  assert.doesNotMatch(main.slice(0, credit), /src\.credit\s*\?|credit\.slice|numberOfLines/, 'never hidden or truncated');
});

test('T108 theme detail renders the credit card whenever the theme is a Space photo theme', () => {
  const d = read('app', 'theme', '[id].tsx');
  assert.match(d, /\{spacePhoto\.photo \? <PhotoCredit theme=\{theme\}/);
  // The downloaded photo is only used as the preview background through spacePhoto.uri.
  assert.match(d, /spacePhoto\.uri \?/);
});

test('T105 Apply › Wallpaper saves the downloaded Webb photo, offers the download first, and keeps the credit', () => {
  const d = read('app', 'theme', '[id].tsx');
  assert.match(d, /wallpaperSourceFor\(\{ ownPhoto: !!photo, isSpace: !!spacePhoto\.photo, spaceReady: !!spacePhoto\.uri \}\)/);
  // Save to Photos uses the downloaded file (cropped to the screen by the photo saver).
  assert.match(d, /from === 'space-photo' && spacePhoto\.uri\s*\? await saveSpacePhoto\(spacePhoto\.uri\)/);
  assert.match(d, /photoSaver\.save\(\s*\{\s*uri,/);
  // Not downloaded yet: the step offers the download (with the T108 Retry state) before saving.
  assert.match(d, /wallSource === 'space-offer-download' \? \(\s*<View[^>]*>\s*<Text[^>]*>\{t\('ui\.photoCredit\.applyOffer'\)\}<\/Text>\s*<PhotoDownloadControl p=\{spacePhoto\}/);
  // Credit next to the save button and in the saved confirmation.
  assert.match(d, /t\('ui\.photoCredit\.creditLine', spaceCredit\)/);
  assert.match(d, /savedFrom === 'space-photo' && spaceCredit \? t\('ui\.photoCredit\.savedCredit', spaceCredit\)/);
});

test('T105 Settings › Storage lists downloaded Space photos with size, credit and Remove (no network)', () => {
  const s = read('src', 'ui', 'PackStorageSection.tsx');
  assert.match(s, /useDownloadedPhotos\(\)/);
  assert.match(s, /photos\.rows\.map/);
  assert.match(s, /bytes\(r\.bytes\)/);
  assert.match(s, /t\('ui\.photoCredit\.creditLine', credit\)/);
  assert.match(s, /onRemovePhoto\(r\.themeId, r\.name\)/);
  const hook = read('src', 'ui', 'usePhotoTheme.ts');
  const fn = hook.slice(hook.indexOf('export function useDownloadedPhotos'), hook.indexOf('export function usePhotoTheme('));
  assert.match(fn, /refreshPhoto\(s\)/, 'local look-up only');
  assert.doesNotMatch(fn, /download(PhotoTheme)?\(/, 'Settings never downloads');
});

test('T108 the Download control keeps the friendly failure state with Retry', () => {
  const s = read('src', 'ui', 'PhotoCredit.tsx');
  assert.match(s, /v\.kind === 'failed'/);
  assert.match(s, /t\(v\.titleKey\)/);
  assert.match(s, /t\(v\.bodyKey\)/);
  assert.match(s, /ui\.photoCredit\.retry'/);
  // The store derives its message from the friendly failure, not a raw error.
  const store = read('src', 'native', 'photoPacks.ts');
  assert.match(store, /photoFailureOf\(e\)/);
  assert.match(store, /throw new HttpStatusError\(res\.status\)/);
  assert.match(store, /async move\(/);
});
