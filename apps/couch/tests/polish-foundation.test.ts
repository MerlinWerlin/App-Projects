/**
 * Premium polish foundation (T37, docs/POLISH.md): motion tokens, fx bus, Expo Go guardrails.
 * Pure TS + Node built-ins.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { clampDir, emitFx, fxListenerCount, onFx, type FxEvent } from '../src/ui/fx/bus';
import {
  duration,
  easeOut,
  entrance,
  nav,
  pressScale,
  pressedScale,
  spring,
  staggerDelay,
} from '../src/theme/motion';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

describe('motion tokens', () => {
  it('match the brief', () => {
    expect(duration).toEqual({ fast: 120, base: 200, slow: 320 });
    expect(spring.damping).toBe(18);
    expect(spring.stiffness).toBe(220);
    expect(easeOut).toHaveLength(4);
    expect(pressScale).toBe(0.97);
    expect(nav.maxTransition).toBeLessThanOrEqual(350);
  });

  it('staggers 30 ms per item, capped at 8 items', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(30);
    expect(staggerDelay(7)).toBe(210);
    expect(staggerDelay(20)).toBe(210);
    expect(staggerDelay(-3)).toBe(0);
    expect(staggerDelay(Number.NaN)).toBe(0);
  });

  it('Reduce Motion swaps movement for a short fade and no press scaling', () => {
    expect(entrance(5, true)).toEqual({ delay: 0, duration: duration.fast, fromY: 0 });
    expect(entrance(2, false).fromY).toBeGreaterThan(0);
    expect(pressedScale(true)).toBe(1);
    expect(pressedScale(false)).toBe(0.97);
  });
});

describe('fx bus', () => {
  it('delivers events and unsubscribes', () => {
    const got: FxEvent[] = [];
    const off = onFx((e) => got.push(e));
    emitFx({ type: 'power' });
    off();
    emitFx({ type: 'connected' });
    expect(got).toEqual([{ type: 'power' }]);
    expect(fxListenerCount()).toBe(0);
  });

  it('a throwing listener never breaks others', () => {
    let n = 0;
    const a = onFx(() => {
      throw new Error('boom');
    });
    const b = onFx(() => {
      n += 1;
    });
    expect(() => emitFx({ type: 'press', dir: { x: 0, y: 0 } })).not.toThrow();
    expect(n).toBe(1);
    a();
    b();
  });

  it('clamps directions', () => {
    expect(clampDir(3, -2)).toEqual({ x: 1, y: -1 });
    expect(clampDir(Number.NaN, 0.5)).toEqual({ x: 0, y: 0.5 });
  });
});

describe('polish guardrails (Expo Go)', () => {
  const ui = [...walk('src/ui'), ...walk('app'), ...walk('src/theme')];

  it('no reanimated/worklets or other native-only animation packages are imported', () => {
    for (const f of ui) {
      const src = read(f);
      expect({ f, bad: /from 'react-native-(reanimated|worklets|gesture-handler)'|from 'lottie/.test(src) }).toEqual({ f, bad: false });
    }
  });

  it('expo-blur (in Expo Go, oversight D72-1) is imported only by the root layout, which registers it', () => {
    for (const f of ui) {
      const src = read(f);
      const imports = /from 'expo-blur'/.test(src);
      expect({ f, imports }).toEqual({ f, imports: f.replace(/\\/g, '/').endsWith('app/_layout.tsx') });
    }
    expect(read('app/_layout.tsx')).toMatch(/registerBlurView\(BlurView/);
  });

  it('every Animated config in the UI uses the native driver for transform/opacity', () => {
    for (const f of ui) {
      const src = read(f);
      expect({ f, jsDriver: /useNativeDriver:\s*false/.test(src) }).toEqual({ f, jsDriver: false });
    }
  });

  it('polish dependencies stay Expo Go modules (svg, blur, linear-gradient)', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['react-native-svg']).toBeDefined();
    expect(pkg.dependencies['react-native-reanimated']).toBeUndefined();
    expect(pkg.dependencies['expo-blur']).toMatch(/^~/);
    expect(pkg.dependencies['expo-linear-gradient']).toMatch(/^~/);
  });

  it('tabs cross-fade and Reduce Motion turns it off', () => {
    const tabs = read('app/(tabs)/_layout.tsx');
    expect(tabs).toMatch(/animation: reduce \? 'none' : 'fade'/);
  });

  it('splash fades after fonts load', () => {
    expect(read('app/_layout.tsx')).toMatch(/fade: true/);
  });
});
