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
  it('every Buy / Restore / tip result also shows as a toast', () => {
    expect(src).toContain("import { showToast } from '../src/ui/Toast';");
    expect(src).toContain("showToast(note, ok ? 'success' : 'warning')");
    // Buy/restore and tip: success path and the catch path both report.
    expect(src.match(/report\(note, r\.ok\)/g)?.length).toBe(2);
    expect(src.match(/report\(t\('app\.plus\.failed'\), false\)/g)?.length).toBe(2);
  });
  it('keeps the inline lines too', () => {
    expect(src).toContain('setBuyNote(note)');
    expect(src).toContain('setTipNote(note)');
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
