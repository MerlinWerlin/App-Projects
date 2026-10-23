/** night-intro: app icon, splash and opening-animation wiring. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADAPTIVE_BG, INTRO_BG, INTRO_SIZE } from '../src/core/introRemote';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const app = JSON.parse(read('app.json')).expo;

/** Width, height, bit depth and colour type from a PNG's IHDR chunk. */
function ihdr(file: string) {
  const b = readFileSync(join(root, file));
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(b.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], colorType: b[25] };
}

describe('app icon (owner icon, 23 Oct)', () => {
  it('is 1024x1024 RGB with no alpha channel (App Store rejects alpha)', () => {
    const p = ihdr('assets/brand/icon.png');
    expect(p).toEqual({ w: 1024, h: 1024, depth: 8, colorType: 2 });
    const b = readFileSync(join(root, 'assets/brand/icon.png'));
    expect(b.includes(Buffer.from('tRNS'))).toBe(false);
  });

  it('is wired for iOS and Android', () => {
    expect(app.icon).toBe('./assets/brand/icon.png');
    expect(app.ios.icon).toBe('./assets/brand/icon.png');
    expect(app.android.adaptiveIcon).toEqual({ foregroundImage: './assets/brand/adaptive-icon.png', backgroundColor: ADAPTIVE_BG });
    const a = ihdr('assets/brand/adaptive-icon.png');
    expect([a.w, a.h, a.colorType]).toEqual([1024, 1024, 6]);
  });
});

describe('splash + intro hand-over', () => {
  const plugin = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen');
  const splash = plugin?.[1];

  it('splash image is the intro first frame at the same size, on the same black, light and dark', () => {
    expect(splash.imageWidth).toBe(INTRO_SIZE);
    expect(splash.image).toBe('./assets/brand/splash-icon.png');
    expect(splash.backgroundColor).toBe(INTRO_BG);
    expect(splash.dark).toEqual({ image: './assets/brand/splash-icon.png', backgroundColor: INTRO_BG });
    const s = ihdr('assets/brand/splash-icon.png');
    expect([s.w, s.h]).toEqual([1024, 1024]);
  });

  it('the root layout mounts the navigator only once the intro reveals, with the intro as the last sibling', () => {
    const layout = read('app/_layout.tsx');
    expect(layout).toMatch(/ready && revealed \?/);
    expect(layout.indexOf('{app}')).toBeLessThan(layout.indexOf('{intro}'));
    expect(layout).toContain('startupReady(');
    expect(layout).toContain('INTRO_MS.maxWait');
    expect(layout).toContain('onReveal={() => setRevealed(true)}');
  });

  it('the intro hands the splash over on its first frame, never takes touches and is hidden from VoiceOver', () => {
    const ui = read('src/ui/IntroRemote.tsx');
    expect(ui).toMatch(/requestAnimationFrame\(\(\) => \{\s*SplashScreen\.hideAsync\(\)/);
    expect(ui).toContain('pointerEvents="none"');
    expect(ui).toContain('accessibilityElementsHidden');
    expect(ui).toContain('importantForAccessibility="no-hide-descendants"');
    expect(ui).toContain('isReduceMotionEnabled');
    expect(ui).not.toMatch(/Animated\.spring|useNativeDriver:\s*false/);
    expect(ui).toContain('NEVER_MIRROR_STYLE');
  });
});
