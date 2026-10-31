// Glaze brand mark + opening animation (owner, 23 Oct night; the plain Prism diamond since fb-1025 G, 25 Oct; Prism the
// little prism creature since owner-1101 item 8, T190, 1 Nov). Geometry, timings and source guards (the cloud can't
// mount React Native).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  ADAPTIVE_BG,
  ADAPTIVE_SCALE,
  ARCH,
  ARMS,
  BODY,
  BRAND,
  CALM_EASINGS,
  EYES,
  FACETS,
  FEET,
  FLOAT_UNITS,
  INTRO_MS,
  MARK_CY,
  SPARKLES,
  SPECTRUM,
  TILE,
  TRACKS,
  adaptiveForegroundSvg,
  allTweens,
  canFade,
  ease,
  frameAt,
  hump,
  iconSvg,
  mascotSvg,
  monochromeSvg,
  splashSvg,
  startupReady,
  trackKeyframes,
} from './introGlaze.ts';
import { durations } from './motion.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** PNG header: width, height, bit depth, colour type (2 = RGB, 3 = palette, 6 = RGBA) and chunk names. */
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

const BRAND_SVGS = ['icon.svg', 'icon-dark.svg', 'splash-icon.svg', 'splash-icon-dark.svg', 'adaptive-foreground.svg', 'adaptive-monochrome.svg', 'mascot.svg'];

// ---------------------------------------------------------------- the mark

test('brand (T190): the mark is Prism the creature: an upright crystal with a face, arms and feet under a rainbow arch', () => {
  // Upright crystal, point up, centred, wider at the shoulders than the base.
  assert.equal(BODY.A[0], 512, 'centred');
  assert.ok(BODY.A[1] < BODY.SL[1] && BODY.A[1] < BODY.SR[1], 'point up');
  assert.ok(BODY.SR[0] - BODY.SL[0] > BODY.BR[0] - BODY.BL[0], 'shoulders wider than the base');
  assert.ok(FACETS.length >= 4, 'soft facets');
  assert.equal(new Set(FACETS.map((f) => f.id)).size, FACETS.length);
  // A face: two big eyes on the body, symmetric, below the crown; two arms and two feet.
  assert.equal(EYES.length, 2);
  assert.equal(EYES[0].cx + EYES[1].cx, 1024, 'eyes symmetric');
  assert.ok(EYES[0].cy > BODY.SL[1], 'eyes below the crown line');
  assert.equal(ARMS.length, 2);
  assert.equal(FEET.length, 2);
  for (const f of FEET) assert.ok(f.cy > BODY.BL[1] - 20, 'feet under the body');
  // Spectrum: six distinct colours, not pink-dominant (at most one pink/rose band).
  assert.equal(SPECTRUM.length, 6);
  assert.equal(new Set(SPECTRUM).size, 6);
  const pinkish = SPECTRUM.filter((c) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    return r! > 220 && b! > 150 && g! < 180;
  });
  assert.ok(pinkish.length <= 1, `pink bands: ${pinkish.join(', ')}`);
  // The arch is behind and above Prism; the big sparkle is up and to the right.
  assert.ok(Math.abs(ARCH.cy - ARCH.outer - BODY.A[1]) <= 24, 'the arch frames the head (its top is level with the point)');
  assert.ok(ARCH.cy > BODY.SL[1], 'the arch comes down beside Prism');
  assert.ok(SPARKLES[0].cx > 512 && SPARKLES[0].cy < BODY.SL[1]);
  // Deep ground: the icon background is dark in both schemes so the rainbow and the lilac glass glow.
  for (const s of ['light', 'dark'] as const) for (const c of BRAND[s].iconBg) assert.ok(lum(c) < 0.05, `${s} ${c} is deep`);
  assert.ok(lum(ADAPTIVE_BG) < 0.05);
});

test('brand: the brand SVGs are generated from introGlaze.ts, carry the prism marker, no text; the splash is Prism asleep', () => {
  assert.equal(read('assets', 'brand', 'icon.svg'), iconSvg('light'), 'regenerate: node scripts/brand/build-brand.mjs');
  assert.equal(read('assets', 'brand', 'icon-dark.svg'), iconSvg('dark'));
  assert.equal(read('assets', 'brand', 'splash-icon.svg'), splashSvg('light'));
  assert.equal(read('assets', 'brand', 'splash-icon-dark.svg'), splashSvg('dark'));
  assert.equal(read('assets', 'brand', 'adaptive-foreground.svg'), adaptiveForegroundSvg());
  assert.equal(read('assets', 'brand', 'adaptive-monochrome.svg'), monochromeSvg());
  assert.equal(read('assets', 'brand', 'mascot.svg'), mascotSvg());
  for (const f of BRAND_SVGS) {
    const svg = read('assets', 'brand', f);
    assert.match(svg, /id="prism"/, `${f} carries the prism marker`);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 1024 1024"/);
    // Original art: plain shapes and gradients, no text, no external images.
    assert.doesNotMatch(svg, /<text|<image|href=|<script|<foreignObject/);
    assert.ok(statSync(join(root, 'assets', 'brand', f)).size < 24 * 1024, `${f} stays small`);
  }
  // The icon and mascot are awake (open eyes: filled ovals) with every rainbow colour; the splash is asleep (closed-eye
  // arcs, no ovals), with no arch and no sparkles: the intro wakes it.
  for (const svg of [iconSvg('light'), mascotSvg()]) {
    for (const c of SPECTRUM) assert.ok(svg.includes(`stroke="${c}"`), `arch ${c}`);
    assert.match(svg, /<ellipse cx="438" cy="598" rx="41" ry="53"/);
  }
  for (const s of ['light', 'dark'] as const) {
    const svg = splashSvg(s);
    for (const c of SPECTRUM) assert.ok(!svg.includes(`stroke="${c}"`), `splash has no ${c} arch`);
    assert.doesNotMatch(svg, /rx="41" ry="53"/, 'eyes closed');
    assert.ok(svg.includes('Q438 632'), 'closed-eye arc');
  }
  // The mascot is the same drawing without the ground (transparent).
  assert.doesNotMatch(mascotSvg(), /url\(#mbg\)/);
  // The splash tile sits inside the canvas with room for its shadow.
  assert.ok(TILE.cy - TILE.b >= 40 && TILE.cy + TILE.b + 30 + 34 <= 1024);
});

test('brand: the Android foreground keeps the mark inside the 66/108 safe zone', () => {
  assert.ok(ADAPTIVE_SCALE <= 66 / 108 + 0.06);
  const svg = adaptiveForegroundSvg();
  const m = svg.match(/translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/);
  assert.ok(m, 'one transform');
  const [tx, ty, s] = [Number(m![1]), Number(m![2]), Number(m![3])];
  assert.ok(Math.abs(ty - (512 - MARK_CY * s)) < 0.1);
  // Prism (point, shoulders, feet), the arch's outer edge and the clouds map inside the safe circle (radius ≈ 313).
  const outerR = ARCH.outer;
  const pts: (readonly [number, number])[] = [
    BODY.A, BODY.SL, BODY.SR,
    [FEET[0].cx - 58, FEET[0].cy + 34], [FEET[1].cx + 58, FEET[1].cy + 34],
    [ARCH.cx, ARCH.cy - outerR], [ARCH.cx - outerR * 0.7, ARCH.cy - outerR * 0.7], [ARCH.cx + outerR * 0.7, ARCH.cy - outerR * 0.7],
    [ARCH.cx - outerR, ARCH.cy + 46], [ARCH.cx + outerR, ARCH.cy + 46],
  ];
  for (const [x, y] of pts) {
    const px = tx + x * s;
    const py = ty + y * s;
    assert.ok(Math.hypot(px - 512, py - 512) <= 512 * (66 / 108) + 2, `(${x}, ${y}) → ${px.toFixed(0)}, ${py.toFixed(0)}`);
  }
});

test('brand: icon.png is 1024 × 1024 with no alpha (App Store); Android foreground and splash keep transparency; all small', () => {
  for (const f of ['icon.png', 'icon-dark.png']) {
    const icon = ihdr(`assets/brand/${f}`);
    assert.equal(icon.w, 1024, f);
    assert.equal(icon.h, 1024, f);
    assert.equal(icon.depth, 8);
    // T190: an opaque palette PNG (type 3) keeps the icon under ~100 KB; RGB (type 2) is fine too. Never an alpha
    // channel (types 4 / 6) and never a transparency chunk.
    assert.ok(icon.type === 2 || icon.type === 3, `${f}: colour type ${icon.type} has no alpha`);
    assert.ok(!icon.chunks.includes('tRNS'), 'no transparency chunk');
  }
  for (const f of ['adaptive-foreground.png', 'adaptive-monochrome.png', 'splash-icon.png', 'splash-icon-dark.png']) {
    const p = ihdr(`assets/brand/${f}`);
    assert.equal(p.w, 1024, f);
    assert.equal(p.h, 1024, f);
    assert.ok(p.type === 6 || (p.type === 3 && p.chunks.includes('tRNS')), `${f} keeps transparency`);
  }
  // Bundle budget (T190): each brand PNG ≤ 110 KB (the old Prism files were 360 to 455 KB).
  for (const f of ['icon.png', 'icon-dark.png', 'adaptive-foreground.png', 'adaptive-monochrome.png', 'splash-icon.png', 'splash-icon-dark.png']) {
    const kb = statSync(join(root, 'assets', 'brand', f)).size / 1024;
    assert.ok(kb <= 110, `${f} is ${kb.toFixed(0)} KB`);
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

test('brand: the previous icons (glaze drip, plain Prism diamond) are kept for reference; the Prism previews exist', () => {
  for (const dir of ['previous-glaze-drip', 'previous-prism-diamond']) {
    for (const f of ['icon.svg', 'icon-dark.svg', 'splash-icon.svg', 'splash-icon-dark.svg', 'adaptive-foreground.svg', 'adaptive-monochrome.svg']) {
      assert.ok(existsSync(join(root, 'docs', 'mascot', dir, f)), `${dir}/${f}`);
    }
  }
  assert.equal(read('docs', 'mascot', 'prism-icon.svg'), iconSvg('light'));
  assert.equal(read('docs', 'mascot', 'prism-mascot.svg'), mascotSvg());
  for (const f of ['docs/mascot/prism-icon.png', 'docs/mascot/prism-mascot.png']) {
    const prev = ihdr(f);
    assert.ok(prev.w >= 256 && prev.w === prev.h, f);
  }
});

// ---------------------------------------------------------------- timings (calm)

test('intro: every tween is calm (ease-in-out or linear) and the whole animation is short (≤ 1.6 s)', () => {
  for (const tw of allTweens()) {
    assert.ok((CALM_EASINGS as readonly string[]).includes(tw.easing), tw.easing);
    assert.ok(tw.duration > 0 && tw.start >= 0);
    assert.ok(tw.start + tw.duration <= INTRO_MS.total, 'inside the timeline');
  }
  assert.equal(Math.max(...allTweens().map((tw) => tw.start + tw.duration)), INTRO_MS.total);
  assert.ok(INTRO_MS.total >= 1200 && INTRO_MS.total <= 1600, `intro ${INTRO_MS.total} ms`);
  assert.equal(INTRO_MS.fadeOut, durations.slow, 'fade reuses the motion token');
  assert.ok(INTRO_MS.maxWait <= 3000, 'cap is at most 3 s');
  assert.ok(INTRO_MS.total + INTRO_MS.settle + INTRO_MS.fadeOut <= 3000, 'a ready app is showing within 3 s');
  // Order: the arch starts first, Prism wakes before the shimmer, the blink comes after it is awake, sparkles last.
  assert.ok(INTRO_MS.arch.start <= INTRO_MS.wake.start);
  assert.ok(INTRO_MS.wake.start + INTRO_MS.wake.duration < INTRO_MS.blink.start, 'awake before it blinks');
  assert.ok(INTRO_MS.shimmer.start >= INTRO_MS.wake.start);
  assert.ok(INTRO_MS.sparkle.start >= INTRO_MS.shimmer.start);
  // A gentle float: a few points at the 240 pt intro, never more.
  assert.ok(FLOAT_UNITS > 0 && (FLOAT_UNITS * 240) / 1024 <= 6, `float ${FLOAT_UNITS} units`);
});

test('intro: the first frame is the native splash (asleep, nothing lit) and the last frame is the icon (awake, at rest)', () => {
  const f0 = frameAt(0);
  assert.equal(f0.arch, 0);
  assert.equal(f0.eyesClosed, 1);
  assert.equal(f0.float, 0);
  assert.equal(f0.shimmerOpacity, 0);
  assert.equal(f0.sparkle, 0);
  const f1 = frameAt(INTRO_MS.total);
  assert.equal(f1.arch, 1);
  assert.equal(f1.eyesClosed, 0);
  assert.equal(f1.float, 0, 'settled back exactly where it started');
  assert.equal(f1.shimmerOpacity, 0);
  assert.equal(f1.sparkle, 1);
  // Exactly one blink after waking: the eyes close fully once, mid-blink.
  const mid = INTRO_MS.blink.start + INTRO_MS.blink.duration / 2;
  assert.equal(frameAt(mid).eyesClosed, 1);
  assert.equal(frameAt(INTRO_MS.blink.start - 10).eyesClosed, 0);
  let closings = 0;
  let prev = 1;
  for (let ms = 0; ms <= INTRO_MS.total; ms += 5) {
    const v = frameAt(ms).eyesClosed;
    if (prev < 0.5 && v >= 0.5) closings++;
    prev = v;
  }
  assert.equal(closings, 1, 'one blink');
});

test('intro: no overshoot or bounce: easing stays in 0..1, the float rises and settles once, fades are monotonic', () => {
  for (const name of CALM_EASINGS) {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = ease(name, i / 100);
      assert.ok(v >= 0 && v <= 1, 'no overshoot');
      assert.ok(v >= prev, 'monotonic');
      prev = v;
    }
  }
  for (let i = 0; i <= 100; i++) {
    const h = hump(i / 100);
    assert.ok(h >= 0 && h <= 1);
  }
  assert.equal(hump(0), 0);
  assert.ok(Math.abs(hump(1)) < 1e-12);
  // Float: within 0..FLOAT_UNITS, one peak (rises, then only falls), never below rest (no dip = no bounce).
  const fl = trackKeyframes('float').v;
  assert.ok(fl.every((v) => v >= 0 && v <= FLOAT_UNITS));
  const peak = fl.indexOf(Math.max(...fl));
  for (let i = 1; i <= peak; i++) assert.ok(fl[i]! >= fl[i - 1]!, 'rises');
  for (let i = peak + 1; i < fl.length; i++) assert.ok(fl[i]! <= fl[i - 1]!, 'then settles');
  for (const track of ['arch', 'shimmerX', 'sparkle'] as const) {
    const { v } = trackKeyframes(track);
    for (let i = 1; i < v.length; i++) assert.ok(v[i]! >= v[i - 1]!, `${track} never goes back`);
  }
  for (const track of TRACKS) {
    const { t, v } = trackKeyframes(track);
    for (let i = 1; i < t.length; i++) assert.ok(t[i]! > t[i - 1]!, `${track} keyframe times increase`);
    assert.ok(t[0]! >= 0 && t[t.length - 1]! <= 1);
    assert.ok(v.every((x) => Number.isFinite(x)));
  }
  const op = trackKeyframes('shimmerOpacity').v;
  assert.equal(op[0], 0);
  assert.equal(op[op.length - 1], 0);
  assert.ok(Math.max(...op) <= 0.8);
  assert.throws(() => trackKeyframes('nope' as never));
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
  assert.doesNotMatch(src, /scale/i, 'no squash, stretch or zoom');
  // The only transform on a view is the float (a vertical translate).
  const transforms = [...src.matchAll(/transform: \[([^\]]*)\]/g)].map((m) => m[1]!.trim());
  assert.deepEqual(transforms, ['{ translateY: lift }']);
  assert.match(src, /pointerEvents="none"/);
  assert.match(src, /accessibilityElementsHidden/);
  assert.match(src, /importantForAccessibility="no-hide-descendants"/);
  // Only Easing.linear and the sine in-out curve.
  for (const m of src.matchAll(/Easing\.(\w+)/g)) assert.ok(['linear', 'inOut', 'sin'].includes(m[1]!), `Easing.${m[1]}`);
  assert.match(src, /duration: INTRO_MS\.fadeOut/);
  assert.match(src, /duration: INTRO_MS\.total/);
  // Hands over from the native splash on the first frame; Reduce Motion jumps to the finished frame.
  assert.match(src, /requestAnimationFrame\(\(\) => \{\s*SplashScreen\.hideAsync\(\)/);
  assert.match(src, /isReduceMotionEnabled\(\)/);
  assert.match(src, /shouldReduceMotion\(/);
  assert.match(src, /clock\.setValue\(1\)/);
  // Draws Prism the creature from the shared geometry: body, facets, arch, eyes (open + closed for the wake and blink).
  for (const name of ['BODY_D', 'FACETS', 'archPath', 'SPECTRUM', 'EYES', 'closedEyePath', 'SPARKLES_D', "trackKeyframes('eyesClosed')", "trackKeyframes('float')"]) {
    assert.ok(src.includes(name), name);
  }
  // No leftover plain-diamond or glaze-drip mark.
  assert.doesNotMatch(src, /GEM_OUTLINE|rayPath|BEAM_D|glazePath|beadCircle|DRIPS/);
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
