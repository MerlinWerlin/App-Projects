// Glaze brand mark + opening animation. T199 (owner-1101d #2, 1 Nov): the app icon is the 25 Oct Prism diamond again
// (the cute prism creature of T190 was rejected) and the intro is a full-screen light-beam scene. Geometry, timings
// and source guards (the cloud can't mount React Native).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  ADAPTIVE_BG,
  BAND_OPACITY,
  BEAM_TILT_DEG,
  BRAND,
  CALM_EASINGS,
  FAN_FROM_DEG,
  FAN_TO_DEG,
  GEM,
  GEM_FACETS,
  GEM_EDGES_D,
  GEM_OUTLINE_D,
  GEM_GLINT_D,
  FIGURE,
  FIGURE_GLINT_D,
  INTRO_MS,
  SPECTRUM,
  SPLASH_SIZE,
  SWEEP_FROM_DEG,
  TRACKS,
  allTweens,
  canFade,
  ease,
  frameAt,
  introLayout,
  polyPath,
  splashSvg,
  startupReady,
  trackKeyframes,
} from './introGlaze.ts';
import { darkV2, lightV2 } from './designV2.ts';
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

const DIAMOND = ['icon.svg', 'icon-dark.svg', 'adaptive-foreground.svg', 'adaptive-monochrome.svg'];
const BRAND_SVGS = [...DIAMOND, 'splash-icon.svg', 'splash-icon-dark.svg'];

// ---------------------------------------------------------------- the mark

test('brand (T199, T216): the brand SVG sources (splash, intro gem, Android monochrome) are the 25 Oct Prism diamond, verbatim', () => {
  for (const f of DIAMOND) {
    assert.equal(read('assets', 'brand', f), read('docs', 'mascot', 'previous-prism-diamond', f), `${f} = the 25 Oct diamond (node scripts/brand/build-brand.mjs)`);
  }
  for (const f of BRAND_SVGS) {
    const svg = read('assets', 'brand', f);
    assert.match(svg, /id="prism"/, `${f} carries the prism marker`);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 1024 1024"/);
    // Original art: plain shapes and gradients, no text, no external images.
    assert.doesNotMatch(svg, /<text|<image|href=|<script|<foreignObject/);
    assert.ok(statSync(join(root, 'assets', 'brand', f)).size < 24 * 1024, `${f} stays small`);
    // No creature: no eyes, blush or rainbow arch.
    assert.doesNotMatch(svg, /<ellipse/, `${f}: no creature face or feet`);
  }
  assert.ok(!existsSync(join(root, 'assets', 'brand', 'mascot.svg')), 'the creature mascot left the bundle');
  // The gem in the intro / splash is the icon's gem: same facets and lit gradients, same edges, outline and glint.
  const icon = read('assets', 'brand', 'icon.svg');
  for (const fc of GEM_FACETS) {
    assert.ok(icon.includes(`<path d="${polyPath(fc.pts)}" fill="url(#plit-${fc.id})"/>`), `facet ${fc.id}`);
    assert.ok(icon.includes(`id="plit-${fc.id}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${fc.lit[0]}"/><stop offset="1" stop-color="${fc.lit[1]}"/>`), `lit ${fc.id}`);
  }
  for (const d of [GEM_EDGES_D, GEM_OUTLINE_D, GEM_GLINT_D]) assert.ok(icon.includes(`d="${d}"`), d.slice(0, 20));
  for (const c of SPECTRUM) assert.ok(icon.includes(`fill="${c}"`), `fan ${c}`);
  // The 25 Oct splash's unlit colours are the intro's first frame.
  const oldSplash = read('docs', 'mascot', 'previous-prism-diamond', 'splash-icon.svg');
  for (const fc of GEM_FACETS) assert.ok(oldSplash.includes(`<stop offset="0" stop-color="${fc.dim[0]}"/><stop offset="1" stop-color="${fc.dim[1]}"/>`), `dim ${fc.id}`);
  // Point down, centred; a dark ground.
  assert.equal(GEM.TIP[0], 512);
  assert.ok(GEM.TIP[1] > GEM.L[1] && GEM.TIP[1] > GEM.T1[1]);
  assert.ok(lum(ADAPTIVE_BG) < 0.05);
});

test('brand (T199, reference since T220): the diamond splash SVG still matches introGlaze.ts', () => {
  assert.equal(read('assets', 'brand', 'splash-icon.svg'), splashSvg(), 'regenerate: node scripts/brand/build-brand.mjs');
  assert.equal(read('assets', 'brand', 'splash-icon-dark.svg'), splashSvg());
  const svg = splashSvg();
  assert.doesNotMatch(svg, /<rect|clip-path|<ellipse|<circle/, 'no tile, ground, shadow or glow');
  for (const fc of GEM_FACETS) assert.ok(svg.includes(`stop-color="${fc.dim[0]}"`), `dim ${fc.id}`);
  for (const c of SPECTRUM) assert.ok(!svg.includes(`fill="${c}"`), `no ${c} fan before the light arrives`);
});

test('brand: icon.png is 1024 × 1024 with no alpha (App Store); Android foreground and splash keep transparency', () => {
  for (const f of ['icon.png', 'icon-dark.png']) {
    const icon = ihdr(`assets/brand/${f}`);
    assert.equal(icon.w, 1024, f);
    assert.equal(icon.h, 1024, f);
    assert.equal(icon.depth, 8);
    // Never an alpha channel (types 4 / 6) and never a transparency chunk.
    assert.ok(icon.type === 2 || icon.type === 3, `${f}: colour type ${icon.type} has no alpha`);
    assert.ok(!icon.chunks.includes('tRNS'), 'no transparency chunk');
  }
  for (const f of ['adaptive-foreground.png', 'adaptive-monochrome.png', 'splash-icon.png', 'splash-icon-dark.png', 'prism-figure.png']) {
    const p = ihdr(`assets/brand/${f}`);
    // T220: the splash / intro figure is 720 px (shown at SPLASH_SIZE = 240 pt, so @3x); the Android icons 1024.
    const px = f.startsWith('adaptive') ? 1024 : 720;
    assert.equal(p.w, px, f);
    assert.equal(p.h, px, f);
    assert.ok(p.type === 6 || (p.type === 3 && p.chunks.includes('tRNS')), `${f} keeps transparency`);
  }
  // Bundle budget. T216: icon.png / icon-dark.png / adaptive-foreground.png are the picked Prism picture (RGB, a
  // palette PNG bands its glass gradients). T199: the diamond's soft gradients band badly in a palette PNG, so the icons are RGB (about
  // 420 KB, like the 25 Oct files); everything else stays small.
  const budget: Record<string, number> = { 'icon.png': 860, 'icon-dark.png': 860, 'adaptive-foreground.png': 520, 'splash-icon.png': 380, 'splash-icon-dark.png': 380, 'prism-figure.png': 480 };
  for (const f of ['icon.png', 'icon-dark.png', 'adaptive-foreground.png', 'adaptive-monochrome.png', 'splash-icon.png', 'splash-icon-dark.png', 'prism-figure.png']) {
    const kb = statSync(join(root, 'assets', 'brand', f)).size / 1024;
    assert.ok(kb <= (budget[f] ?? 130), `${f} is ${kb.toFixed(0)} KB`);
  }
});

test('brand: app.json wires the icon, adaptive icon and both splash images; the splash is dark in both appearances', () => {
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
  // T199: splash background = the intro's first frame (the dark bg token) in light and dark, so there is no flash.
  assert.equal(BRAND.introBg, darkV2.bg);
  assert.equal(splash.backgroundColor, BRAND.introBg);
  assert.equal(splash.dark.backgroundColor, BRAND.introBg);
  assert.equal(splash.imageWidth, SPLASH_SIZE);
  assert.match(read('src', 'ui', 'IntroGlaze.tsx'), /export const INTRO_SIZE = SPLASH_SIZE;/);
  for (const f of [expo.icon, ai.foregroundImage, ai.monochromeImage, splash.image, splash.dark.image]) {
    assert.ok(existsSync(join(root, f)), f);
  }
});

test('brand: the previous icons are kept for reference; the rejected creature is filed away, not bundled', () => {
  for (const dir of ['previous-glaze-drip', 'previous-prism-diamond']) {
    for (const f of ['icon.svg', 'icon-dark.svg', 'splash-icon.svg', 'splash-icon-dark.svg', 'adaptive-foreground.svg', 'adaptive-monochrome.svg']) {
      assert.ok(existsSync(join(root, 'docs', 'mascot', dir, f)), `${dir}/${f}`);
    }
  }
  for (const f of ['prism-icon.svg', 'prism-icon.png', 'prism-mascot.svg', 'prism-mascot.png', 'mascot.svg']) {
    assert.ok(existsSync(join(root, 'docs', 'mascot', 'rejected-prism-creature', f)), `rejected-prism-creature/${f}`);
    assert.ok(!existsSync(join(root, 'docs', 'mascot', f)), `${f} moved out of docs/mascot`);
  }
});

// ---------------------------------------------------------------- full-screen layout

test('intro layout: the gem sits where the native splash draws it; the beam and the fan reach past the screen edges', () => {
  for (const [w, h] of [[390, 844], [320, 568], [430, 932], [1024, 1366], [200, 200]] as const) {
    const L = introLayout(w, h);
    assert.equal(L.size, Math.min(SPLASH_SIZE, w - 32, h - 32), 'same size as the splash image (imageWidth, contain)');
    assert.ok(Math.abs(L.ox - (w - L.size) / 2) <= 0.05 && Math.abs(L.oy - (h - L.size) / 2) <= 0.05, 'centred like the splash');
    // The tip and the entry point are on the gem, inside the screen.
    assert.ok(L.tip[0] > 0 && L.tip[0] < w && L.tip[1] > 0 && L.tip[1] < h);
    assert.ok(L.entry[1] < L.tip[1], 'light enters above the point');
    // The beam (in its 2·len square, centred on the entry point) starts at the centre and leaves the screen whatever
    // the sweep angle: its length covers the whole diagonal.
    assert.equal(L.beam.x1, L.len);
    assert.equal(L.beam.y1, L.len);
    assert.ok(L.len >= Math.hypot(w, h));
    assert.ok(L.beam.x2 < L.beam.x1 && L.beam.y2 < L.beam.y1, 'from the upper left');
    // Six bands, one per glaze colour, fanning downward from the tip.
    assert.equal(L.bands.length, 6);
    assert.deepEqual(L.bands.map((b) => b.color), [...SPECTRUM]);
    for (const b of L.bands) {
      assert.ok(b.d.startsWith(`M${L.tip[0]} ${L.tip[1]} L`), 'from the point');
      assert.ok(b.y2 > L.tip[1], 'downward');
    }
  }
  assert.ok(BEAM_TILT_DEG > 0 && BEAM_TILT_DEG < 30, 'a gentle diagonal');
  assert.ok(FAN_FROM_DEG < 0 && FAN_TO_DEG > 0 && FAN_TO_DEG - FAN_FROM_DEG <= 80);
  assert.ok(BAND_OPACITY > 0 && BAND_OPACITY < 0.8, 'soft bands, never solid');
  assert.doesNotThrow(() => introLayout(Number.NaN, 0));
});

// ---------------------------------------------------------------- timings (calm)

test('intro (T199): every tween is calm (ease-in-out or linear) and the whole thing, fade included, is ≤ 1.5 s', () => {
  for (const tw of allTweens()) {
    assert.ok((CALM_EASINGS as readonly string[]).includes(tw.easing), tw.easing);
    assert.ok(tw.duration > 0 && tw.start >= 0);
    assert.ok(tw.start + tw.duration <= INTRO_MS.total, 'inside the timeline');
  }
  assert.ok(Math.abs(Math.max(...allTweens().map((tw) => tw.start + tw.duration)) - INTRO_MS.total) <= 20, 'total = the last tween');
  assert.equal(INTRO_MS.fadeOut, durations.slow, 'fade reuses the motion token');
  assert.ok(INTRO_MS.total + INTRO_MS.settle + INTRO_MS.fadeOut <= 1500, `intro ${INTRO_MS.total} + ${INTRO_MS.settle} + ${INTRO_MS.fadeOut} ms`);
  assert.ok(INTRO_MS.maxWait <= 3000, 'cap is at most 3 s');
  // Order: the beam arrives, then the gem lights, then the bands bloom, the glint last.
  assert.ok(INTRO_MS.beam.start <= INTRO_MS.ignite.start);
  assert.ok(INTRO_MS.ignite.start < INTRO_MS.band.start);
  assert.ok(INTRO_MS.glint.start > INTRO_MS.band.start);
});

test('intro: the first frame is the native splash (unlit, dark, no beam) and the last is the finished scene', () => {
  const f0 = frameAt(0);
  assert.equal(f0.beam, 0);
  assert.equal(f0.ignite, 0);
  assert.equal(f0.glint, 0);
  assert.deepEqual(f0.bands, [0, 0, 0, 0, 0, 0]);
  assert.equal(f0.sweep, SWEEP_FROM_DEG);
  const f1 = frameAt(INTRO_MS.total);
  assert.equal(f1.beam, 1);
  assert.equal(f1.ignite, 1);
  assert.equal(f1.glint, 1);
  assert.equal(f1.sweep, 0, 'the beam settles exactly on the gem');
  assert.deepEqual(f1.bands, [1, 1, 1, 1, 1, 1]);
  // The bands bloom left to right.
  const mid = frameAt(INTRO_MS.band.start + INTRO_MS.band.duration / 2);
  for (let i = 1; i < 6; i++) assert.ok(mid.bands[i]! <= mid.bands[i - 1]!, `band ${i} follows band ${i - 1}`);
});

test('intro: no overshoot or bounce: easing stays in 0..1 and every track moves one way only', () => {
  for (const name of CALM_EASINGS) {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = ease(name, i / 100);
      assert.ok(v >= 0 && v <= 1, 'no overshoot');
      assert.ok(v >= prev, 'monotonic');
      prev = v;
    }
  }
  for (const track of TRACKS) {
    const { t, v } = trackKeyframes(track);
    for (let i = 1; i < t.length; i++) assert.ok(t[i]! > t[i - 1]!, `${track} keyframe times increase`);
    assert.ok(t[0]! >= 0 && t[t.length - 1]! <= 1);
    assert.ok(v.every((x) => Number.isFinite(x)));
    for (let i = 1; i < v.length; i++) assert.ok(v[i]! >= v[i - 1]!, `${track} never goes back`);
    if (track === 'sweep') assert.ok(v.every((x) => x >= SWEEP_FROM_DEG && x <= 0), 'the sweep never passes its rest angle');
    else assert.ok(v.every((x) => x >= 0 && x <= 1));
  }
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

test('intro (T199): IntroGlaze is full screen, calm, untouchable, hidden from VoiceOver and Expo Go-safe', () => {
  const src = strip(read('src', 'ui', 'IntroGlaze.tsx'));
  assert.doesNotMatch(src, SPRINGY, 'no springs');
  assert.doesNotMatch(src, /scale/i, 'no squash, stretch or zoom');
  // The only transform is the beam's rotation (the sweep).
  const transforms = [...src.matchAll(/transform: \[([^\]]*)\]/g)].map((m) => m[1]!.trim());
  assert.deepEqual(transforms, ['{ rotate: sweep }']);
  assert.match(src, /pointerEvents="none"/);
  assert.match(src, /accessibilityElementsHidden/);
  assert.match(src, /importantForAccessibility="no-hide-descendants"/);
  // Only Easing.linear and the sine in-out curve.
  for (const m of src.matchAll(/Easing\.(\w+)/g)) assert.ok(['linear', 'inOut', 'sin'].includes(m[1]!), `Easing.${m[1]}`);
  assert.match(src, /duration: INTRO_MS\.fadeOut/);
  assert.match(src, /duration: INTRO_MS\.total/);
  // Full screen: the host fills the window on the dark bg token, and the scene is drawn at window size (no tile).
  assert.match(src, /StyleSheet\.absoluteFill, styles\.host, \{ backgroundColor: bg, opacity: fade \}/);
  assert.match(src, /const bg = paletteFor\('dark'\)\.bg;/);
  assert.match(src, /introLayout\(width, height\)/);
  assert.match(src, /<Svg width=\{width\} height=\{height\}>/);
  assert.doesNotMatch(src, /squirclePath|TILE\b|tileRim/, 'no tile');
  // Hands over from the native splash on the first frame; Reduce Motion jumps to the finished frame, then fades.
  assert.match(src, /requestAnimationFrame\(\(\) => \{\s*SplashScreen\.hideAsync\(\)/);
  assert.match(src, /isReduceMotionEnabled\(\)/);
  assert.match(src, /shouldReduceMotion\(/);
  assert.match(src, /clock\.setValue\(1\)/);
  // T220: draws the picked Prism figure, unlit (the splash) then lit; the beam, the six bands and the glint.
  for (const name of ['FIGURE_GLINT_D', 'assets/brand/prism-figure.png', 'assets/brand/splash-icon.png', 'SPECTRUM', 'mode="dim"', 'mode="lit"', "trackKeyframes('sweep')", "trackKeyframes('ignite')", 'BAND_TRACKS']) {
    assert.ok(src.includes(name), name);
  }
  // No leftover creature (eyes, blink, float, arch) or glaze-drip mark.
  assert.doesNotMatch(src, /EYES|closedEye|blink|FLOAT|archPath|CLOUDS|glazePath|DRIPS/);
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
  // The app the intro fades to keeps its own background (light or dark).
  assert.equal(BRAND.light.bg, lightV2.bg);
  assert.equal(BRAND.dark.bg, darkV2.bg);
});

test('brand (T216): the app icon is the Prism picture Jared picked on 25 Oct, not a redrawn guess', () => {
  const dir = join(root, 'docs', 'mascot', 'picked-1025');
  assert.ok(existsSync(join(dir, 'glaze-prism.jpg')), 'the picked picture is in the repo');
  assert.match(read('docs', 'mascot', 'picked-1025', 'README.md'), /glaze-prism\.jpg — THE PICK/);
  // icon-dark is the same picture (it is already dark), byte for byte.
  assert.ok(readFileSync(join(root, 'assets', 'brand', 'icon.png')).equals(readFileSync(join(root, 'assets', 'brand', 'icon-dark.png'))));
  // Generated by the picked-icon script; build-brand.mjs no longer renders these from the diamond SVGs.
  const build = read('scripts', 'brand', 'build-brand.mjs');
  for (const f of ['icon.png', 'icon-dark.png', 'adaptive-foreground.png', 'adaptive-monochrome.png', 'splash-icon.png', 'splash-icon-dark.png', 'prism-figure.png']) {
    assert.ok(!build.includes(`'${f}'`), `build-brand.mjs leaves ${f} alone`);
  }
  assert.match(read('scripts', 'brand', 'picked-icon.py'), /glaze-prism\.jpg/);
  // The photo-like icon is far bigger than the old vector render (about 420 KB); a guard against falling back to it.
  assert.ok(statSync(join(root, 'assets', 'brand', 'icon.png')).size > 600 * 1024, 'icon.png is the picked picture');
});

test('brand (T220, owner-1101e 11:39): splash, intro and Android monochrome all come from the picked Prism picture', () => {
  const script = read('scripts', 'brand', 'picked-icon.py');
  for (const f of ['prism-figure.png', 'splash-icon.png', 'splash-icon-dark.png', 'adaptive-monochrome.png']) assert.ok(script.includes(`'${f}'`), f);
  // Light and dark splash are the same unlit figure.
  assert.ok(readFileSync(join(root, 'assets', 'brand', 'splash-icon.png')).equals(readFileSync(join(root, 'assets', 'brand', 'splash-icon-dark.png'))));
  // The beam enters the head from above and the colour fan pours from under the feet, inside the 1024 canvas.
  assert.ok(FIGURE.ENTRY[1] < FIGURE.TIP[1]);
  for (const p of [FIGURE.ENTRY, FIGURE.TIP]) assert.ok(p[0] > 0 && p[0] < 1024 && p[1] > 0 && p[1] < 1024);
  const L = introLayout(390, 844);
  const k = L.size / 1024;
  assert.ok(Math.abs(L.tip[1] - (L.oy + FIGURE.TIP[1] * k)) < 0.1, 'fan from the figure, not the old gem tip');
  assert.match(FIGURE_GLINT_D, /^M\d/);
});
