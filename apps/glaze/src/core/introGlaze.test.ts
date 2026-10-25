// Glaze brand mark + opening animation (owner, 23 Oct night; mark = Prism since fb-1025 G, 25 Oct). Geometry, timings
// and source guards (the cloud can't mount React Native).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  ADAPTIVE_BG,
  ADAPTIVE_SCALE,
  BRAND,
  CALM_EASINGS,
  FACETS,
  FAN,
  GEM,
  INTRO_MS,
  SPECTRUM,
  TILE,
  adaptiveForegroundSvg,
  allTweens,
  canFade,
  ease,
  frameAt,
  iconSvg,
  monochromeSvg,
  rayPath,
  splashSvg,
  startupReady,
  trackKeyframes,
} from './introGlaze.ts';
import { durations } from './motion.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

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

/** Relative luminance of a #RRGGBB colour (sRGB). */
function lum(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

// ---------------------------------------------------------------- the mark

test('brand (fb-1025 G): the mark is the Prism, a faceted crystal pointing down with a six-colour spectrum fan', () => {
  // Gem cut seen slightly from above: table above the girdle, front vertex nearest (lowest), point below everything.
  assert.ok(GEM.l[1] < GEM.L[1] && GEM.r[1] < GEM.R[1], 'table sits above the girdle');
  assert.ok(GEM.F[1] > GEM.L[1] && GEM.F[1] > GEM.R[1], 'front vertex is nearest the viewer');
  assert.ok(GEM.T[1] > GEM.F[1], 'the point is lowest');
  assert.equal(GEM.T[0], 512, 'centred');
  assert.ok(FACETS.length >= 6, 'faceted');
  assert.equal(new Set(FACETS.map((f) => f.id)).size, FACETS.length);
  // Spectrum: six distinct colours, not pink-dominant (at most one pink/rose band).
  assert.equal(SPECTRUM.length, 6);
  assert.equal(new Set(SPECTRUM).size, 6);
  const pinkish = SPECTRUM.filter((c) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    return r! > 220 && b! > 150 && g! < 180;
  });
  assert.ok(pinkish.length <= 1, `pink bands: ${pinkish.join(', ')}`);
  // The fan opens downward (both edges below the horizon) and is not a horizontal band.
  assert.ok(FAN.from < 180 && FAN.to > 0 && FAN.from > FAN.to);
  assert.ok(FAN.from - FAN.to >= 45, 'a fan, not a beam');
  for (let i = 0; i < SPECTRUM.length; i++) assert.match(rayPath(i), /^M[\d. L-]+Z$/);
  // Deep ground: the icon background is dark in both schemes so the spectrum glows.
  for (const s of ['light', 'dark'] as const) for (const c of BRAND[s].iconBg) assert.ok(lum(c) < 0.05, `${s} ${c} is deep`);
  assert.ok(lum(ADAPTIVE_BG) < 0.05);
});

test('brand: icon.svg is generated from introGlaze.ts, carries the prism marker; the splash is the unlit crystal', () => {
  assert.equal(read('assets', 'brand', 'icon.svg'), iconSvg('light'), 'regenerate: node scripts/brand/build-brand.mjs');
  assert.equal(read('assets', 'brand', 'icon-dark.svg'), iconSvg('dark'));
  assert.equal(read('assets', 'brand', 'splash-icon.svg'), splashSvg('light'));
  assert.equal(read('assets', 'brand', 'splash-icon-dark.svg'), splashSvg('dark'));
  assert.equal(read('assets', 'brand', 'adaptive-foreground.svg'), adaptiveForegroundSvg());
  assert.equal(read('assets', 'brand', 'adaptive-monochrome.svg'), monochromeSvg());
  for (const f of ['icon.svg', 'icon-dark.svg', 'splash-icon.svg', 'splash-icon-dark.svg', 'adaptive-foreground.svg', 'adaptive-monochrome.svg']) {
    const svg = read('assets', 'brand', f);
    assert.match(svg, /id="prism"/, `${f} carries the prism marker`);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 1024 1024"/);
    // Original art: plain shapes and gradients, no text, no external images.
    assert.doesNotMatch(svg, /<text|<image|href=|<script|<foreignObject/);
    assert.ok(statSync(join(root, 'assets', 'brand', f)).size < 24 * 1024, `${f} stays small`);
  }
  // Every spectrum colour is in the icon; the splash has no spectrum and no beam (the intro lights it).
  for (const c of SPECTRUM) assert.ok(iconSvg('light').includes(`fill="${c}"`), c);
  for (const s of ['light', 'dark'] as const) {
    const svg = splashSvg(s);
    for (const c of SPECTRUM) assert.ok(!svg.includes(`fill="${c}"`), `splash has no ${c} ray`);
    for (const fc of FACETS) assert.ok(svg.includes(`dim-${fc.id}`) && !svg.includes(`lit-${fc.id}`), `${fc.id} unlit`);
  }
  // The splash tile sits inside the canvas with room for its shadow.
  assert.ok(TILE.cy - TILE.b >= 40 && TILE.cy + TILE.b + 30 + 34 <= 1024);
});

test('brand: the Android foreground keeps the mark inside the 66/108 safe zone', () => {
  assert.ok(ADAPTIVE_SCALE <= 66 / 108 + 0.06);
  const svg = adaptiveForegroundSvg();
  const m = svg.match(/translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/);
  assert.ok(m, 'one transform');
  const [tx, ty, s] = [Number(m![1]), Number(m![2]), Number(m![3])];
  // The crystal (girdle corners and point) maps inside the safe circle (radius 512 × 66/108 ≈ 313).
  for (const [x, y] of [GEM.L, GEM.R, GEM.T, GEM.l, GEM.r]) {
    const px = tx + x * s;
    const py = ty + y * s;
    assert.ok(Math.hypot(px - 512, py - 512) <= 512 * (66 / 108) + 2, `(${x}, ${y}) → ${px.toFixed(0)}, ${py.toFixed(0)}`);
  }
});

test('brand: icon.png is 1024 × 1024 RGB with no alpha (App Store); Android foreground and splash keep transparency', () => {
  for (const f of ['icon.png', 'icon-dark.png']) {
    const icon = ihdr(`assets/brand/${f}`);
    assert.equal(icon.w, 1024, f);
    assert.equal(icon.h, 1024, f);
    assert.equal(icon.depth, 8);
    assert.equal(icon.type, 2, `${f}: colour type 2 = RGB, no alpha`);
    assert.ok(!icon.chunks.includes('tRNS'), 'no transparency chunk');
  }
  for (const f of ['adaptive-foreground.png', 'adaptive-monochrome.png', 'splash-icon.png', 'splash-icon-dark.png']) {
    const p = ihdr(`assets/brand/${f}`);
    assert.equal(p.w, 1024, f);
    assert.equal(p.h, 1024, f);
    assert.equal(p.type, 6, `${f} keeps alpha`);
  }
  for (const f of ['icon.png', 'icon-dark.png', 'adaptive-foreground.png', 'adaptive-monochrome.png', 'splash-icon.png', 'splash-icon-dark.png']) {
    assert.ok(statSync(join(root, 'assets', 'brand', f)).size < 1024 * 1024, `${f} under 1 MB`);
  }
});

test('brand: app.json wires the icon, adaptive icon and both splash images; splash imageWidth = INTRO_SIZE', () => {
  const expo = JSON.parse(read('app.json')).expo;
  assert.equal(expo.icon, './assets/brand/icon.png');
  const ai = expo.android.adaptiveIcon;
  assert.equal(ai.foregroundImage, './assets/brand/adaptive-foreground.png');
  assert.equal(ai.monochromeImage, './assets/brand/adaptive-monochrome.png');
  assert.equal(ai.backgroundColor, ADAPTIVE_BG, 'adaptive background = the Prism ground');
  const splash = expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')?.[1];
  assert.ok(splash, 'expo-splash-screen plugin configured');
  assert.equal(splash.image, './assets/brand/splash-icon.png');
  assert.equal(splash.dark.image, './assets/brand/splash-icon-dark.png');
  // Splash background = the intro background = the app background (designV2 bg), so the hand-over is seamless.
  assert.equal(splash.backgroundColor, BRAND.light.bg);
  assert.equal(splash.dark.backgroundColor, BRAND.dark.bg);
  const ui = read('src', 'ui', 'IntroGlaze.tsx');
  assert.match(ui, new RegExp(`export const INTRO_SIZE = ${splash.imageWidth};`));
  for (const f of [expo.icon, ai.foregroundImage, ai.monochromeImage, splash.image, splash.dark.image]) {
    assert.ok(existsSync(join(root, f)), f);
  }
});

test('brand: the previous glaze-drip icon is kept for reference and the Prism preview exists', () => {
  for (const f of ['icon.svg', 'icon-dark.svg', 'splash-icon.svg', 'splash-icon-dark.svg', 'adaptive-foreground.svg', 'adaptive-monochrome.svg']) {
    assert.ok(existsSync(join(root, 'docs', 'mascot', 'previous-glaze-drip', f)), f);
  }
  assert.equal(read('docs', 'mascot', 'prism-icon.svg'), iconSvg('light'));
  const prev = ihdr('docs/mascot/prism-icon.png');
  assert.ok(prev.w >= 256 && prev.w === prev.h);
});

// ---------------------------------------------------------------- timings (calm)

test('intro: every tween is calm (ease-in-out or linear) and the whole animation fits well under the cap', () => {
  for (const tw of allTweens()) {
    assert.ok((CALM_EASINGS as readonly string[]).includes(tw.easing), tw.easing);
    assert.ok(tw.duration > 0 && tw.start >= 0);
    assert.ok(tw.start + tw.duration <= INTRO_MS.total, 'inside the timeline');
  }
  assert.equal(Math.max(...allTweens().map((tw) => tw.start + tw.duration)), INTRO_MS.total);
  assert.ok(INTRO_MS.total >= 1600 && INTRO_MS.total <= 2000, `intro ${INTRO_MS.total} ms`);
  assert.equal(INTRO_MS.fadeOut, durations.slow, 'fade reuses the motion token');
  assert.ok(INTRO_MS.maxWait <= 3000, 'cap is at most 3 s');
  assert.ok(INTRO_MS.total + INTRO_MS.settle + INTRO_MS.fadeOut <= 3000, 'a ready app is showing within 3 s');
  // Order: the beam arrives before the crystal is fully lit; the rays fan out left to right after the light reaches
  // the point; the gloss sweeps once every ray is out.
  assert.ok(INTRO_MS.beam.start <= INTRO_MS.lit.start);
  assert.equal(INTRO_MS.rays.length, SPECTRUM.length);
  for (let i = 1; i < INTRO_MS.rays.length; i++) assert.ok(INTRO_MS.rays[i]!.start > INTRO_MS.rays[i - 1]!.start, 'left to right');
  assert.ok(INTRO_MS.rays[0]!.start >= INTRO_MS.lit.start + INTRO_MS.lit.duration / 2);
  const raysEnd = Math.max(...INTRO_MS.rays.map((tw) => tw.start + tw.duration));
  assert.ok(INTRO_MS.gloss.start >= raysEnd - 120);
});

test('intro: the first frame is the native splash (nothing lit) and the last frame is the icon (everything lit)', () => {
  const f0 = frameAt(0);
  assert.equal(f0.beam, 0);
  assert.equal(f0.lit, 0);
  assert.equal(f0.sparkle, 0);
  assert.ok(f0.rays.every((v) => v === 0));
  const f1 = frameAt(INTRO_MS.total);
  assert.equal(f1.beam, 1);
  assert.equal(f1.lit, 1);
  assert.equal(f1.sparkle, 1);
  assert.ok(f1.rays.every((v) => v === 1));
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
  for (const track of ['beam', 'lit', 'glossX', 'sparkle', ...SPECTRUM.map((_, i) => `ray${i}` as const)] as const) {
    const { t, v } = trackKeyframes(track);
    for (let i = 1; i < v.length; i++) {
      assert.ok(v[i]! >= v[i - 1]!, `${track} never goes back`);
      assert.ok(t[i]! > t[i - 1]!, `${track} keyframe times increase`);
    }
    assert.ok(t[t.length - 1]! <= 1);
  }
  const op = trackKeyframes('glossOpacity').v;
  assert.equal(op[0], 0);
  assert.equal(op[op.length - 1], 0);
  assert.ok(Math.max(...op) <= 0.9);
  assert.throws(() => trackKeyframes('ray9'));
});

test('intro: startup goes ahead when fonts + languages are ready, or by the cap; fade waits for the animation too', () => {
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
  // Draws the Prism from the shared geometry (no leftover glaze-drip mark).
  for (const name of ['FACETS', 'GEM_OUTLINE', 'rayPath', 'SPECTRUM', 'BEAM_D', 'sparklePath']) assert.ok(src.includes(name), name);
  assert.doesNotMatch(src, /glazePath|beadCircle|DRIPS/);
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
