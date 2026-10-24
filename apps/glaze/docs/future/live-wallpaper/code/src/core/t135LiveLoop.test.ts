// T135 (owner, 24 Oct: "wanted this continuous loop"): the iOS 26 continuous loop is back, fixed.
// Root cause of the T10 "small player": the loop was exported at the screen aspect, and Apple
// ignores animated artwork whose preview/video doesn't match the key's aspect (3:4 here).
// Source guards for the Swift side (it can't be compiled here), the payload, config and UI wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEVICES, newProject } from './loop.ts';
import { buildLivelockPayload, parseLivelockPayload } from './livelockPayload.ts';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const SWIFT = 'modules/glaze-livelock/ios';
const np = () => read(`${SWIFT}/NowPlayingController.swift`);
const exporter = () => read(`${SWIFT}/LoopExporter.swift`);

/** Swift source without // comments, so guards check code, not prose. */
const code = (src: string) => src.replace(/\/\/[^\n]*/g, '');

test('T135: the payload export is exactly 3:4 on every device', () => {
  for (const d of DEVICES) {
    const p = newProject({ id: 'a', sourceUri: 'file:///x.mov', kind: 'video', sourceDurationMs: 8000, sourceWidth: 1080, sourceHeight: 1920, now: 1 });
    const r = buildLivelockPayload([p], d);
    assert.ok(r.ok);
    if (!r.ok) continue;
    const e = r.payload.export;
    assert.equal(e.width * 4, e.height * 3, `${d.id}: ${e.width}x${e.height}`);
    assert.ok(e.width % 2 === 0 && e.height % 2 === 0);
    assert.ok(e.fps <= 60);
    const c = r.payload.projects[0].cropRect;
    assert.equal(c.width * 4, c.height * 3, `${d.id} crop ${c.width}x${c.height}`);
    assert.notEqual(e.height, d.pixels.height, 'never the screen size');
    assert.ok(parseLivelockPayload(r.json));
  }
});

test('T135: Swift decoder enforces the 3:4 export', () => {
  const src = code(read(`${SWIFT}/LivelockPayload.swift`));
  assert.match(src, /payload\.export\.width \* 4 == payload\.export\.height \* 3/);
  assert.match(src, /payload\.export\.fps <= 60/);
});

test('T135: Now Playing uses the 3:4 animated artwork key, only when the platform supports it', () => {
  const src = code(np());
  assert.match(src, /MPMediaItemAnimatedArtwork\(/);
  assert.match(src, /artworkID: artworkID,\s*previewImageRequestHandler: \{ _ in preview \},\s*videoAssetFileURLRequestHandler: \{ _ in videoURL \}/);
  assert.match(src, /let key = MPNowPlayingInfoProperty3x4AnimatedArtwork/);
  assert.match(src, /MPNowPlayingInfoCenter\.supportedAnimatedArtworkKeys\.contains\(key\)/);
  // A non-3:4 preview is never registered (iOS would ignore it): report "static" instead.
  assert.match(src, /abs\(size\.width \/ size\.height - 0\.75\) < 0\.01/);
  assert.match(src, /"animated-3x4"/);
  assert.match(src, /body\["artwork"\] = artworkMode/);
  assert.match(src, /artworkMode = "static"/);
  // Static artwork is the same 3:4 preview; title falls back to "Live Lock Screen", artist Glaze.
  assert.match(src, /MPMediaItemArtwork\(boundsSize: preview\.size\) \{ _ in preview \}/);
  assert.match(src, /title\.isEmpty \? "Live Lock Screen" : title/);
  assert.match(src, /MPMediaItemPropertyArtist: "Glaze"/);
  // Unique artworkID per export (the hashed file name).
  assert.match(src, /artworkID: loop\.videoURL\.lastPathComponent/);
  // The VERIFY block cites Apple's doc and the root cause.
  assert.match(np(), /Providing animated artwork for media items/);
  assert.match(np(), /ROOT CAUSE/);
});

test('T135: silent looping audio, .playback without mixWithOthers, remote play/pause/toggle', () => {
  const src = code(np());
  assert.match(src, /setCategory\(\.playback, mode: \.default, options: \[\]\)/);
  assert.doesNotMatch(src, /mixWithOthers/);
  assert.match(src, /numberOfLoops = -1/);
  assert.match(src, /AVAudioPlayer\(contentsOf: SilentAudio\.fileURL\(\)\)/);
  for (const cmd of ['playCommand', 'pauseCommand', 'togglePlayPauseCommand']) assert.match(src, new RegExp(`center\\.${cmd}`));
  // Play/pause flips the Lock Screen button through the playback rate.
  assert.match(src, /info\[MPNowPlayingInfoPropertyPlaybackRate\] = playing \? 1\.0 : 0\.0/);
  // Interruptions pause; Low Power Mode stops and blocks a start.
  assert.match(src, /AVAudioSession\.interruptionNotification/);
  assert.match(src, /setState\(\.paused, reason: "interrupted"\)/);
  assert.match(src, /NSProcessInfoPowerStateDidChange/);
  assert.match(src, /stop\(reason: "low-power"\)/);
  assert.match(src, /setState\(\.error, reason: "low-power"\)/);
  // Old exports are pruned only after the new item is live.
  assert.match(src, /try self\.begin\(ready\)\s*exporter\.prune\(keeping:/);
});

test('T135: the preview is the first frame of the 3:4 render', () => {
  const src = code(exporter());
  assert.match(src, /let render = CGSize\(width: s\.width, height: s\.height\)/);
  assert.match(src, /videoComposition\.renderSize = render/);
  assert.match(src, /let asset = AVURLAsset\(url: out\)[\s\S]*let preview = try await Self\.previewImage\(asset\)/);
  assert.match(src, /requestedTimeToleranceBefore = \.zero/);
  assert.match(src, /requestedTimeToleranceAfter = \.zero/);
  assert.match(src, /generator\.image\(at: \.zero\)/);
  assert.match(src, /"v2-3x4"/, 'cache key changed so no screen-aspect export is reused');
});

test('T135: isSupported needs the audio background mode in Info.plist', () => {
  const src = code(read(`${SWIFT}/GlazeLivelockModule.swift`));
  assert.match(src, /forInfoDictionaryKey: "UIBackgroundModes"/);
  assert.match(src, /modes\.contains\("audio"\)/);
});

test('T135: native-plugins/livelock.json declares the audio background mode', () => {
  assert.deepEqual(JSON.parse(read('native-plugins/livelock.json')), { infoPlist: { UIBackgroundModes: ['audio'] } });
  const pkg = read('package.json');
  assert.doesNotMatch(pkg, /@bacons\/apple-targets|expo-dev-client/);
});

test('T135: both Live screens render LiveLockCard and keep the Live Photo fallback', () => {
  for (const f of ['app/(tabs)/live.tsx', 'app/live/[id].tsx']) {
    const src = read(f);
    assert.match(src, /<LiveLockCard\b/, `${f} renders the loop card`);
    assert.match(src, /<LivePhotoGuide\b/, `${f} keeps the Live Photo guide`);
    assert.match(src, /from '\.\.\/\.\.\/src\/ui\/LiveLockCard'/);
  }
  assert.ok(existsSync(join(ROOT, 'src/ui/LivePhotoGuide.tsx')));
  assert.match(read('app/live/[id].tsx'), /<SaveAsLivePhotoButton\b/);
});

test('T135: the card reaches native code only through src/native/livelock.ts', () => {
  const card = code(read('src/ui/LiveLockCard.tsx'));
  assert.match(card, /from '\.\.\/native\/livelock'/);
  assert.doesNotMatch(card, /requireNativeModule|requireOptionalNativeModule|NativeModules|glaze-livelock/);
  assert.match(card, /livelock\.start\(\[p\]\)/);
  assert.match(card, /livelock\.stop\(\)/);
  assert.match(card, /livelock\.addStateListener\(/);
  assert.match(card, /liveLockView\(/);
  // Accessibility: a hint on Start and Stop; Stop has its full label.
  assert.match(card, /accessibilityHint=\{t\('liveUi\.loop\.startHint'\)\}/);
  assert.match(card, /accessibilityHint=\{t\('liveUi\.loop\.stopHint'\)\}/);
  // The adapter still only uses requireOptionalNativeModule.
  const adapter = read('src/native/livelock.ts');
  assert.match(adapter, /requireOptionalNativeModule<NativeLivelock>\('GlazeLivelock'\)/);
  assert.doesNotMatch(adapter, /requireNativeModule\(/);
});

test('T135: nothing in the loop path reads Plus or names a competitor', () => {
  const files = [
    'src/ui/LiveLockCard.tsx',
    'src/core/liveLockView.ts',
    'src/core/livelockPayload.ts',
    'src/native/livelock.ts',
    `${SWIFT}/NowPlayingController.swift`,
    `${SWIFT}/LoopExporter.swift`,
    'docs/LIVELOCK.md',
  ];
  const banned = /Themify|Icon Themer|MyScreen|ScreenKit|Widgetsmith|intoLive|Loopy|Lockio/i;
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /src\/plus|\/plus['/]|entitlement|isPlus|usePlus/i, f);
    assert.doesNotMatch(src, banned, f);
  }
});
