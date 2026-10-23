/**
 * D12-2 / POLISH rule 7 guardrail: idle animations (cinema glow breathing + drift, breathing mic ring)
 * stop when the screen loses focus or the app backgrounds, and Reduce Motion swaps them for a still look.
 * The policy is pure TS (idle.ts); the wiring checks read the component sources, since React Native
 * components cannot render under the offline bun runner.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { idleMode, isForeground } from './idle';

const root = join(__dirname, '..', '..', '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');

describe('idle animation policy', () => {
  test('loops only when focused, foreground, wanted and Reduce Motion is off', () => {
    expect(idleMode({ reduce: false, active: true })).toBe('loop');
    expect(idleMode({ reduce: false, active: true, wanted: true })).toBe('loop');
  });

  test('pauses when the screen blurs or the app backgrounds', () => {
    expect(idleMode({ reduce: false, active: false })).toBe('paused');
    expect(idleMode({ reduce: false, active: false, wanted: true })).toBe('paused');
  });

  test('pauses when the component does not want to animate (mic not listening)', () => {
    expect(idleMode({ reduce: false, active: true, wanted: false })).toBe('paused');
  });

  test('Reduce Motion always gives a still look, never a loop', () => {
    for (const active of [true, false]) {
      for (const wanted of [true, false]) {
        expect(idleMode({ reduce: true, active, wanted })).toBe('still');
      }
    }
  });

  test('only the active app state counts as foreground', () => {
    expect(isForeground('active')).toBe(true);
    for (const s of ['background', 'inactive', 'unknown', 'extension', null, undefined]) {
      expect(isForeground(s)).toBe(false);
    }
  });
});

describe('idle animation wiring', () => {
  test('useActive combines screen focus (with blur cleanup) and AppState', () => {
    const s = src('src/ui/motion/useActive.ts');
    expect(s).toContain('useFocusEffect');
    expect(s).toMatch(/return \(\) => setFocused\(false\)/);
    expect(s).toContain("AppState.addEventListener('change'");
    expect(s).toContain('isForeground(');
    expect(s).toContain('sub.remove()');
    expect(s).toMatch(/return focused && fg/);
  });

  test('CinemaGlow gates its loops on the policy and stops them in cleanup', () => {
    const s = src('src/ui/fx/CinemaGlow.tsx');
    expect(s).toContain('useActive()');
    expect(s).toContain('useReducedMotion()');
    expect(s).toContain('idleMode({ reduce, active })');
    expect(s).toMatch(/mode === 'still'[\s\S]*STATIC_OPACITY/);
    expect(s).toMatch(/mode === 'paused'\) return/);
    expect(s).toMatch(/breathing\.stop\(\);\s*drifting\.stop\(\);/);
    expect(s).toContain('[mode, breath, drift]');
  });

  test('VoiceButton mic ring breathes only while listening and active, static under Reduce Motion', () => {
    const s = src('src/ui/remote/VoiceButton.tsx');
    expect(s).toContain('useActive()');
    expect(s).toContain('useReducedMotion()');
    expect(s).toContain('idleMode({ reduce, active, wanted: listening })');
    expect(s).toMatch(/ringMode !== 'loop'[\s\S]*breath\.stopAnimation\(\)/);
    expect(s).toMatch(/loop\.stop\(\)/);
    expect(s).toMatch(/const ringStyle = reduce\s*\?\s*\{ opacity: 0\.55 \}/);
  });
});
