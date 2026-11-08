/**
 * Night 23 Oct 2026 cross-app pass (docs/OWNER_1023_NIGHT.md): owner feedback given on Linework
 * ("tapping Unlock Plus did nothing" -> never fail silently, fb-1023) applied to Couch. Source guards,
 * since React Native screens can't mount here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('night-1023: Plus actions never fail silently', () => {
  const src = code('app/plus.tsx');
  it('every trial / Buy / Restore result also shows as a toast (paywall, owner 7 Nov 2026)', () => {
    expect(src).toContain("import { showToast } from '../src/ui/Toast';");
    expect(src).toContain("showToast(note, ok ? 'success' : 'warning')");
    // One say() for every outcome: the inline line and the toast together.
    expect(src).toMatch(/const say = useCallback\(\(note: string, ok: boolean\) => \{\s*setBuyNote\(note\);\s*report\(note, ok\);/);
    for (const key of ['app.plus.thanksPlus', 'core.plus.unavailable', 'app.plus.failed', 'app.plus.notBought', 'app.plus.restoreNone',
      'app.plus.trialUnavailable', 'app.plus.trialFailed', 'app.plus.trialUsed', 'app.plus.trialStarted']) {
      expect({ key, said: src.includes(`'${key}'`) }).toEqual({ key, said: true });
    }
    // Both promise chains end in a catch that says so.
    expect(src.match(/\.catch\(\(\) => say\(t\('app\.plus\.(failed|trialFailed)'\), false\)\)/g)?.length).toBe(2);
  });
  it('keeps the inline lines too', () => {
    expect(src).toContain('setBuyNote(note)');
    expect(src).not.toContain('setTipNote');
  });
});

describe('night-1023: failures are spoken on iOS (live regions are Android-only)', () => {
  const hook = code('src/ui/useAnnounce.ts');
  it('announces on iOS only, once per text within the dedupe window', () => {
    expect(hook).toContain("Platform.OS !== 'ios'");
    expect(hook).toContain('AccessibilityInfo.announceForAccessibility(msg)');
    expect(hook).toContain('now - lastAt < DEDUPE_MS');
  });
  it('the remote (and its sheets) and the Apps tab speak snap.lastError', () => {
    expect(code('app/(tabs)/remote.tsx')).toContain('useAnnounce(snap.lastError);');
    expect(code('app/(tabs)/apps.tsx')).toContain('useAnnounce(snap.lastError);');
  });
  it('the remote screen still never imports Plus', () => {
    expect(code('src/ui/useAnnounce.ts')).not.toMatch(/plus/i);
  });
});
