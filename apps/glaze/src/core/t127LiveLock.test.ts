// T127 (owner, 24 Oct): Live Lock Screen = save a Live Photo + a 3-step guide. The old Now Playing
// mode (a media player over the normal wallpaper that did nothing when tapped) is out of every
// flow. Source guards keep it that way; the Swift guards check the Live Photo pairing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../i18n/locales/en.ts';
import { CATALOGUES, TRANSLATIONS } from '../i18n/locales/index.ts';
import { translate, type Locale } from './i18n.ts';
import { GUIDE_STEPS, GUIDE_TEXT, LIVE_PHOTO_WALLPAPER_MIN_IOS, livePhotoGuide } from './liveSteps.ts';
import { LIVE_PHOTO_MAX_MS, LIVE_PHOTO_MIN_MS } from './livephoto.ts';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const uiFiles = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src', 'ui'))];

test('T127: the default Live flow never starts Now Playing', () => {
  for (const f of uiFiles) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /livelock\s*\.\s*(start|next)\s*\(/, `${f} starts Now Playing`);
    assert.doesNotMatch(src, /\bsetOnLockScreen\b/, `${f} uses setOnLockScreen`);
    assert.doesNotMatch(src, /import\s*\{[^}]*\blivelock\b[^}]*\}\s*from\s*'[^']*native\/livelock'/, `${f} imports the livelock adapter`);
  }
  for (const f of ['app/live/index.tsx', 'app/live/[id].tsx']) {
    const src = read(f);
    assert.doesNotMatch(src, /live\.editor\.setOnLock|live\.tab\.setPlaylist|LivelockRunningCard|useLivelockState/, f);
    assert.match(src, /<LivePhotoGuide\b/, `${f} shows the Live Photo guide`);
  }
  // The editor's main Live Lock action is Save as Live Photo, as a primary (filled) pill.
  assert.match(read('app/live/[id].tsx'), /<SaveAsLivePhotoButton\b/);
  const sheet = read('src/ui/LivePhotoSheet.tsx');
  const button = sheet.slice(sheet.indexOf("label={busy ? t('liveUi.livePhoto.saving')"));
  assert.doesNotMatch(button.slice(0, button.indexOf('/>')), /variant=/, 'Save as Live Photo is the primary pill');
});

test('T127: no audio background mode once Now Playing is gone', () => {
  assert.ok(!existsSync(join(ROOT, 'native-plugins', 'livelock.json')), 'native-plugins/livelock.json is removed');
  for (const name of readdirSync(join(ROOT, 'native-plugins')).filter((n) => n.endsWith('.json'))) {
    assert.doesNotMatch(read(`native-plugins/${name}`), /UIBackgroundModes/, name);
  }
  assert.match(read('docs/REVIEW_NOTES.md'), /no background audio/i);
});

test('T127: Live Lock Screen stays free (no Plus gate)', () => {
  for (const f of ['app/live/index.tsx', 'app/live/[id].tsx', 'src/ui/LivePhotoGuide.tsx', 'src/ui/LivePhotoSheet.tsx', 'src/native/livephoto.ts']) {
    assert.doesNotMatch(read(f), /src\/plus|\/plus['/]|entitlement|isPlus|usePlus/i, f);
  }
});

test('T127: the guide has exactly 3 steps: Photos, Share › Use as Wallpaper, Live Photo on', () => {
  assert.deepEqual(GUIDE_STEPS.map((s) => s.id), ['photos', 'share', 'lock']);
  assert.match(GUIDE_STEPS[1].title, /Use as Wallpaper/);
  assert.match(GUIDE_STEPS[2].body, /Live Photo button/);
  for (const ios of [0, 15, 16, 17, 18, 26]) {
    for (const build of ['expo-go', 'full'] as const) {
      for (const kind of ['video', 'gif'] as const) {
        for (const moduleReady of [undefined, true, false]) {
          const g = livePhotoGuide({ iosMajor: ios, build, kind, moduleReady });
          assert.equal(g.steps.length, 3);
          assert.ok(g.notes.includes('moves'));
          assert.ok(g.notes.includes('needs'), 'T147: the Motion not available note shows on every iOS');
          assert.equal(g.notes.includes('old-ios'), ios > 0 && ios < LIVE_PHOTO_WALLPAPER_MIN_IOS);
          assert.equal(g.canSave, g.notice === null);
          if (build === 'expo-go') assert.equal(g.notice, 'needs-full');
          else if (moduleReady === false) assert.equal(g.notice, 'needs-build');
          else if (kind === 'gif') assert.equal(g.notice, 'gif');
          else assert.equal(g.notice, null);
        }
      }
    }
  }
});

test('T127: the guide copy is honest and matches the English catalogue', () => {
  // T147 (fb-1025 C): Glaze saves a Live Photo that moves in Photos; trying it as a wallpaper
  // is optional and the copy says iPhone often keeps app-made Live Photos still.
  assert.match(GUIDE_TEXT.honest, /Live Photo that moves when you press it/);
  assert.match(GUIDE_TEXT.honest, /try it as a wallpaper/);
  assert.match(GUIDE_TEXT.moves, /doesn’t loop forever/);
  assert.match(GUIDE_TEXT.needs, /Motion not available/);
  assert.match(GUIDE_TEXT.needsFull, /TestFlight/);
  const g = (en as unknown as { liveUi: { guide: Record<string, string> } }).liveUi.guide;
  for (const [k, v] of Object.entries(GUIDE_TEXT)) assert.equal(g[k], v, `liveUi.guide.${k}`);
  for (const s of GUIDE_STEPS) {
    assert.equal(g[`${s.id}Title`], s.title);
    assert.equal(g[`${s.id}Body`], s.body);
  }
  const all = Object.values(g).join('\n');
  assert.doesNotMatch(all, /Now Playing|forever loop|loops forever/i);
  for (const l of Object.keys(TRANSLATIONS) as Locale[]) {
    if (l === 'en') continue;
    for (const k of ['honest', 'photosBody', 'lockBody', 'moves']) {
      assert.notEqual(translate(CATALOGUES, l, `liveUi.guide.${k}`), g[k], `${l} liveUi.guide.${k} is English`);
    }
  }
});

test('T127: Live Photo export pairs the still and the video', () => {
  const swift = read('modules/glaze-livephoto/ios/GlazeLivePhotoModule.swift');
  // Still: Apple MakerNote key "17" = content identifier.
  assert.match(swift, /kCGImagePropertyMakerAppleDictionary/);
  assert.match(swift, /\["17":\s*identifier\]/);
  // Video: top-level QuickTime metadata content identifier in the mdta key space.
  assert.match(swift, /keySpace = \.quickTimeMetadata/);
  assert.match(swift, /"com\.apple\.quicktime\.content\.identifier"/);
  assert.match(swift, /idItem\.value = identifier/);
  assert.match(swift, /writer\.metadata = \[idItem\]/);
  // Timed metadata track: still-image-time, int8, one-frame range at the still time.
  // T153: the value is -1 in the wallpaper recipe and 0 in the T127 fallback (t153LiveWallpaper.test.ts).
  assert.match(swift, /"mdta\/com\.apple\.quicktime\.still-image-time"/);
  assert.match(swift, /kCMMetadataBaseDataType_SInt8/);
  assert.match(swift, /stillValue: 0,/);
  assert.match(swift, /NSNumber\(value: recipe\.stillValue\)/);
  assert.match(swift, /AVAssetWriterInputMetadataAdaptor/);
  assert.match(swift, /var items: \[AVMetadataItem\] = \[stillItem\]/);
  assert.match(swift, /AVTimedMetadataGroup\(items: items, timeRange: CMTimeRange\(start: start/);
  assert.match(swift, /let start = CMTimeConvertScale\(stillTime,/);
  // The still is grabbed at the same stillTime the metadata points at.
  assert.match(swift, /stillImage\(built: built, at: stillTime\)/);
  // .mov (HEVC since T153, H.264 kept as the fallback), saved as one asset with .photo + .pairedVideo.
  assert.match(swift, /fileType: \.mov/);
  assert.match(swift, /AVVideoCodecType\.h264/);
  assert.match(swift, /PHAssetCreationRequest\.forAsset\(\)/);
  assert.match(swift, /addResource\(with: \.photo,/);
  assert.match(swift, /addResource\(with: \.pairedVideo,/);
  assert.match(swift, /requestAuthorization\(for: \.addOnly\)/);
  // Duration: at most 3 s, at least half a second.
  assert.match(swift, /maxDuration = CMTime\(value: 3, timescale: 1\)/);
  assert.equal(LIVE_PHOTO_MAX_MS, 3000);
  assert.ok(LIVE_PHOTO_MIN_MS >= 500);
});

// T137 (owner decision 24 Oct 21:03, D134-1): the continuous Now Playing loop is parked, not shipped.
test('T137: the Lock Screen loop is parked in docs/future/live-wallpaper and never linked', () => {
  assert.ok(!existsSync(join(ROOT, 'modules', 'glaze-livelock')), 'modules/glaze-livelock is not autolinked');
  assert.ok(existsSync(join(ROOT, 'docs/future/live-wallpaper/code/glaze-livelock/ios/NowPlayingController.swift')), 'parked code kept for reference');
  for (const f of ['src/native/livelock.ts', 'src/ui/LiveLockCard.tsx', 'src/core/liveLockView.ts']) {
    assert.ok(!existsSync(join(ROOT, f)), `${f} is parked`);
  }
  const walkAll = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (name === 'node_modules' || name === 'build') continue;
      if (statSync(p).isDirectory()) walkAll(p, out);
      else out.push(p);
    }
    return out;
  };
  const src = ['app', 'src', 'modules', 'targets', 'native-plugins'].flatMap((d) => walkAll(join(ROOT, d)))
    .filter((p) => /\.(ts|tsx|swift|json|plist)$/.test(p) && !/\.test\.ts$/.test(p));
  for (const p of src) {
    const s = readFileSync(p, 'utf8');
    assert.doesNotMatch(s, /UIBackgroundModes/, `${p} declares a background mode`);
    assert.doesNotMatch(s, /MPMediaItemAnimatedArtwork|MPNowPlayingInfoCenter|LiveLockCard/, `${p} still has Now Playing loop code`);
  }
  assert.doesNotMatch(read('app.config.ts'), /UIBackgroundModes/);
  const readme = read('docs/future/live-wallpaper/README.md');
  for (const part of ['What the owner wants', 'Why it is blocked', 'Triggers to watch', 'Ready-to-go plan', 'Parked code']) {
    assert.match(readme, new RegExp(part), `README has "${part}"`);
  }
  assert.match(read('docs/PLAN.md'), /docs\/future\/live-wallpaper/);
});
