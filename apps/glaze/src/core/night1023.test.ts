// Night 23 Oct 2026 cross-app pass (docs/OWNER_1023_NIGHT.md): owner feedback given on Linework and Couch,
// applied to Glaze. Source guards, since the cloud can't mount React Native.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('night-1023 N1: the wallpaper editor Style and Pattern rows are 2×2 blocks of equal pills', () => {
  const wp = strip(read('app', 'wallpaper.tsx'));
  assert.match(wp, /<Segmented grid label=\{t\('wallpaper\.design\.style'\)\}/);
  assert.match(wp, /<Segmented\s+grid\s+label=\{t\('wallpaper\.design\.pattern'\)\}/);
  assert.match(wp, /grid && styles\.segmentGrid/);
  assert.match(wp, /grid && styles\.segmentItemGrid/);
  assert.match(wp, /segmentGrid: \{ flexWrap: 'wrap'/);
  assert.match(wp, /segmentItemGrid: \{ flexGrow: 1, flexShrink: 0, flexBasis: '45%'/);
  // Same press rules as the shared Segmented: chosen pill does nothing, a change ticks.
  assert.match(wp, /if \(selected\) return;\s*haptic\('select'\);\s*onChange\(o\.id\);/);
  // Calm motion: no springs or scaling added to the editor rows.
  assert.doesNotMatch(wp, /\bwithSpring\b|Animated\.spring/);
});

test('night-1023 N2: status lines are spoken on iOS (live regions are Android-only)', () => {
  const a = strip(read('src', 'ui', 'announce.ts'));
  assert.match(a, /Platform\.OS !== 'ios'/);
  assert.match(a, /AccessibilityInfo\.announceForAccessibility\(msg\)/);
  assert.match(strip(read('app', 'wallpaper.tsx')), /useAnnounce\(status\?\.text, status\)/);
  assert.match(strip(read('app', 'collage.tsx')), /useAnnounce\(status\?\.text, status\)/);
  assert.match(strip(read('app', 'feedback.tsx')), /useAnnounce\(note\)/);
});

test('night-1023 N3: Unlock and Restore never fail silently (Linework fb-1023)', () => {
  const sheet = strip(read('src', 'plus', 'PlusLockSheet.tsx'));
  assert.equal((sheet.match(/announce\(t\('plus\.lock\.unavailable'\)\)/g) ?? []).length, 2);
  assert.match(sheet, /catch \{\s*haptic\('warning'\);/);
  const restore = strip(read('src', 'plus', 'RestorePurchases.tsx'));
  assert.match(restore, /announce\(t\(found \? 'plus\.lock\.restored' : 'plus\.lock\.restoreNone'\)\)/);
  assert.match(restore, /announce\(t\('plus\.lock\.restoreFailed'\)\)/);
});
