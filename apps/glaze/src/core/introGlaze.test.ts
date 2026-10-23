// Glaze brand mark + opening animation (owner, 23 Oct night). Geometry, timings and source guards (the cloud can't
// mount React Native).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  CALM_EASINGS,
  DRIPS,
  FINAL_STATE,
  GLAZE_PROUD,
  INTRO_MS,
  LONGEST,
  TILE_TOP,
  UNDER_DY,
  adaptiveForegroundSvg,
  allTweens,
  beadCircle,
  canFade,
  ease,
  frameAt,
  glazeKeyframes,
  glazePath,
  iconSvg,
  monochromeSvg,
  splashSvg,
  startupReady,
  trackKeyframes,
} from './introGlaze.ts';
import { durations } from './motion.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const numbers = (d: string) => d.match(/-?\d+(?:\.\d+)?/g) ?? [];
const commands = (d: string) => d.replace(/[^A-Za-z]/g, '');

/** PNG header: width, height, bit depth, colour type (2 = RGB, 6 = RGBA). */
function ihdr(file: string): { w: number; h: number; depth: number; type: number; chunks: string[] } {
  const b = readFileSync(join(root, file));
  assert.equal(b.subarray(1, 4).toString('latin1'), 'PNG', `${file} is a PNG`);
  assert.equal(b.subarray(12, 16).toString('latin1'), 'IHDR');
  const chunks: string[] = [];
  for (let o = 8; o + 8 <= b.length; ) {
    const len = b.readUInt32BE(o);
    chunks.push(b.subarray(o + 4, o + 8).toString('latin1'));
    o += 12 + len;
  }
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24]!, type: b[25]!, chunks };
}

// ---------------------------------------------------------------- the mark

test('brand: the glaze shape keeps one command structure for every frame (Animated interpolates it)', () => {
  const kf = glazeKeyframes(32);
  assert.equal(kf.d.length, 32);
  const cmd = commands(kf.d[0]!);
  const n = numbers(kf.d[0]!).length;
  for (const d of kf.d) {
    assert.equal(commands(d), cmd);
    assert.equal(numbers(d).length, n);
    assert.doesNotMatch(d, /NaN|Infinity|e[+-]?\d/, 'plain decimals only');
  }
  assert.equal(kf.d[kf.d.length - 1], glazePath(FINAL_STATE), 'the pour ends on the logo');
  for (let i = 1; i < kf.t.length; i++) assert.ok(kf.t[i]! > kf.t[i - 1]!, 'keyframe times increase');
  assert.ok(kf.t[kf.t.length - 1]! <= 1);
});

test('brand: three uneven drips; the middle one is longest and grows the bead', () => {
  assert.equal(DRIPS.length, 3);
  assert.equal(new Set(DRIPS.map((d) => d.len)).size, 3, 'uneven');
  const longest = DRIPS.reduce((m, d, i) => (d.len > DRIPS[m]!.len ? i : m), 0);
  assert.equal(longest, LONGEST);
  assert.equal(beadCircle(0).r, 0);
  assert.ok(beadCircle(1).r > 0);
  // The longest drip runs slower than the others.
  const durs = INTRO_MS.drips.map((tw) => tw.duration);
  assert.equal(Math.max(...durs), durs[LONGEST]);
});

test('brand: before the pour nothing of the glaze shows (the first frame equals the native splash)', () => {
  const d0 = glazePath(frameAt(0));
  const ys = numbers(d0).filter((_, i) => i % 2 === 1).map(Number);
  // Everything sits above the clip's top edge, even with the under-edge offset.
  assert.ok(Math.max(...ys) < TILE_TOP - GLAZE_PROUD - UNDER_DY, `max y ${Math.max(...ys)}`);
});

test('brand: icon.svg is generated from introGlaze.ts and holds the final glaze; the splash has none', () => {
  assert.equal(read('assets', 'brand', 'icon.svg'), iconSvg('light'), 'regenerate: node scripts/brand/build-brand.mjs');
  assert.equal(read('assets', 'brand', 'icon-dark.svg'), iconSvg('dark'));
  assert.equal(read('assets', 'brand', 'splash-icon.svg'), splashSvg('light'));
  assert.equal(read('assets', 'brand', 'splash-icon-dark.svg'), splashSvg('dark'));
  assert.equal(read('assets', 'brand', 'adaptive-foreground.svg'), adaptiveForegroundSvg());
  assert.equal(read('assets', 'brand', 'adaptive-monochrome.svg'), monochromeSvg());
  assert.ok(read('assets', 'brand', 'icon.svg').includes(glazePath(FINAL_STATE)));
  for (const s of ['light', 'dark'] as const) assert.ok(!splashSvg(s).includes(glazePath(FINAL_STATE)), 'the app pours the glaze');
  // Original art: plain shapes and gradients, no text, no external images.
  for (const f of ['icon.svg', 'splash-icon.svg', 'adaptive-foreground.svg']) {
    const svg = read('assets', 'brand', f);
    assert.doesNotMatch(svg, /<text|<image|href=/);
  }
});

test('brand: icon.png is 1024 × 1024 RGB with no alpha (App Store); Android foreground and splash keep transparency', () => {
  const icon = ihdr('assets/brand/icon.png');
  assert.equal(icon.w, 1024);
  assert.equal(icon.h, 1024);
  assert.equal(icon.depth, 8);
  assert.equal(icon.type, 2, 'colour type 2 = RGB, no alpha');
  assert.ok(!icon.chunks.includes('tRNS'), 'no transparency chunk');
  for (const f of ['adaptive-foreground.png', 'adaptive-monochrome.png', 'splash-icon.png', 'splash-icon-dark.png']) {
    const p = ihdr(`assets/brand/${f}`);
    assert.equal(p.w, 1024, f);
    assert.equal(p.h, 1024, f);
    assert.equal(p.type, 6, `${f} keeps alpha`);
  }
});

test('brand: app.json wires the icon, adaptive icon and both splash images; splash imageWidth = INTRO_SIZE', () => {
  const expo = JSON.parse(read('app.json')).expo;
  assert.equal(expo.icon, './assets/brand/icon.png');
  const ai = expo.android.adaptiveIcon;
  assert.equal(ai.foregroundImage, './assets/brand/adaptive-foreground.png');
  assert.equal(ai.monochromeImage, './assets/brand/adaptive-monochrome.png');
  assert.match(ai.backgroundColor, /^#[0-9A-F]{6}$/i);
  const splash = expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')?.[1];
  assert.ok(splash, 'expo-splash-screen plugin configured');
  assert.equal(splash.image, './assets/brand/splash-icon.png');
  assert.equal(splash.dark.image, './assets/brand/splash-icon-dark.png');
  // Splash background = the intro background = the app background (designV2 bg), so the hand-over is seamless.
  assert.equal(splash.backgroundColor, '#F4F1F7');
  assert.equal(splash.dark.backgroundColor, '#0F0D12');
  const ui = read('src', 'ui', 'IntroGlaze.tsx');
  assert.match(ui, new RegExp(`export const INTRO_SIZE = ${splash.imageWidth};`));
  for (const f of [expo.icon, ai.foregroundImage, ai.monochromeImage, splash.image, splash.dark.image]) {
    assert.ok(existsSync(join(root, f)), f);
  }
});

// ---------------------------------------------------------------- timings (calm)

test('intro: every tween is calm (ease-in-out or linear) and the whole pour fits well under the cap', () => {
  for (const tw of allTweens()) {
    assert.ok((CALM_EASINGS as readonly string[]).includes(tw.easing), tw.easing);
    assert.ok(tw.duration > 0 && tw.start >= 0);
    assert.ok(tw.start + tw.duration <= INTRO_MS.total, 'inside the timeline');
  }
  assert.equal(Math.max(...allTweens().map((tw) => tw.start + tw.duration)), INTRO_MS.total);
  assert.ok(INTRO_MS.total >= 1600 && INTRO_MS.total <= 2000, `pour ${INTRO_MS.total} ms`);
  assert.equal(INTRO_MS.fadeOut, durations.slow, 'fade reuses the motion token');
  assert.ok(INTRO_MS.maxWait <= 3000, 'cap is at most 3 s');
  assert.ok(INTRO_MS.total + INTRO_MS.settle + INTRO_MS.fadeOut <= 3000, 'a ready app is showing within 3 s');
  // The bead forms only once the longest drip has (almost) arrived, and the gloss sweeps once the glaze is still.
  const longestEnd = INTRO_MS.drips[LONGEST]!.start + INTRO_MS.drips[LONGEST]!.duration;
  assert.ok(INTRO_MS.bead.start >= longestEnd - 60);
  assert.ok(INTRO_MS.gloss.start >= INTRO_MS.bead.start + INTRO_MS.bead.duration / 2);
});

test('intro: easing never overshoots and every track is monotonic where it should be', () => {
  for (const name of CALM_EASINGS) {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = ease(name, i / 100);
      assert.ok(v >= 0 && v <= 1, 'no overshoot');
      assert.ok(v >= prev, 'monotonic');
      prev = v;
    }
  }
  for (const track of ['bead', 'glossX', 'streak'] as const) {
    const { v } = trackKeyframes(track);
    for (let i = 1; i < v.length; i++) assert.ok(v[i]! >= v[i - 1]!, `${track} never goes back`);
  }
  const op = trackKeyframes('glossOpacity').v;
  assert.equal(op[0], 0);
  assert.equal(op[op.length - 1], 0);
  assert.ok(Math.max(...op) <= 0.9);
  // Drips only ever lengthen.
  let last = frameAt(0).drips;
  for (let ms = 0; ms <= INTRO_MS.total; ms += 50) {
    const f = frameAt(ms);
    f.drips.forEach((p, i) => assert.ok(p >= last[i]!));
    last = f.drips;
  }
});

test('intro: startup goes ahead when fonts + languages are ready, or by the cap; fade waits for the pour too', () => {
  assert.equal(startupReady(true, true, 0), true);
  assert.equal(startupReady(false, true, 0), false);
  assert.equal(startupReady(true, false, INTRO_MS.maxWait - 1), false);
  assert.equal(startupReady(false, false, INTRO_MS.maxWait), true);
  assert.equal(canFade(false, true), false);
  assert.equal(canFade(true, false), false);
  assert.equal(canFade(true, true), true);
});

// ---------------------------------------------------------------- source guards

const SPRINGY = /\bwithSpring\b|\.springify\(|\bspringConfig\b|Animated\.spring\b|Easing\.(bounce|elastic|back)\b|\bBounceIn\b|\bZoomIn\b/;

test('intro: IntroGlaze is calm, untouchable, hidden from VoiceOver and Expo Go-safe', () => {
  const src = strip(read('src', 'ui', 'IntroGlaze.tsx'));
  assert.doesNotMatch(src, SPRINGY);
  assert.doesNotMatch(src, /scale/i, 'no squash or stretch');
  assert.match(src, /pointerEvents="none"/);
  assert.match(src, /accessibilityElementsHidden/);
  assert.match(src, /importantForAccessibility="no-hide-descendants"/);
  // Only Easing.linear and the sine in-out curve.
  for (const m of src.matchAll(/Easing\.(\w+)/g)) assert.ok(['linear', 'inOut', 'sin'].includes(m[1]!), `Easing.${m[1]}`);
  assert.match(src, /duration: INTRO_MS\.fadeOut/);
  // Hands over from the native splash on the first frame; Reduce Motion jumps to the finished logo.
  assert.match(src, /requestAnimationFrame\(\(\) => \{\s*SplashScreen\.hideAsync\(\)/);
  assert.match(src, /isReduceMotionEnabled\(\)/);
  assert.match(src, /shouldReduceMotion\(/);
  assert.match(src, /clock\.setValue\(1\)/);
  // Expo Go-safe imports only.
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
  for (const i of imports) assert.ok(/^(react|react-native|react-native-svg|expo-splash-screen|\.\.\/.+)$/.test(i), i);
});

test('intro: the root layout mounts the app only when the intro starts fading, with the intro as a later sibling', () => {
  const src = strip(read('app', '_layout.tsx'));
  assert.match(src, /let app: ReactNode = null;\s*if \(ready && revealed\) \{\s*app = \(/);
  assert.match(src, /\{app\}\s*\{intro\}/);
  assert.match(src, /onReveal=\{\(\) => setRevealed\(true\)\}/);
  assert.ok(src.includes('startupReady(') && src.includes('INTRO_MS.maxWait'), 'layout arms the startup cap');
  assert.match(src, /loadLocaleOverride\(\)/);
  assert.match(src, /<I18nProvider>/);
  assert.match(src, /<ToastProvider>/);
  // The startup path never pulls in the theme catalogue or packs UI.
  for (const f of [read('app', '_layout.tsx'), read('src', 'ui', 'IntroGlaze.tsx')]) {
    assert.doesNotMatch(f, /from ['"][^'"]*(catalogue|themes|photoPack)[^'"]*['"]/);
  }
});
