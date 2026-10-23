// Night 23 Oct 2026 cross-app pass (docs/OWNER_1023_NIGHT.md): owner feedback given on Couch and Glaze,
// checked against Linework. Source guards, since React Native screens can't mount in Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const code = (...p: string[]) => read(...p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('night-1023: a photo that cannot be opened is spoken on iOS (live regions are Android-only)', () => {
  const src = code('src', 'ui', 'ImageErrorBoundary.tsx');
  assert.match(src, /if \(Platform\.OS !== 'ios'\) return;/);
  assert.match(src, /AccessibilityInfo\.announceForAccessibility\(`\$\{title\}\. \$\{body\}`\)/);
  assert.match(src, /\}, \[kind, title, body\]\);/);
});

test('night-1023 (Couch fb-1022d volume HUD under the Dynamic Island): camera overlays stay below the safe-area top', () => {
  const trace = code('app', 'trace.tsx');
  assert.match(trace, /const topRowTop = insets\.top \+ space\.sm;/);
  assert.match(trace, /<RecordingPill rec=\{rec\} top=\{topRowTop \+ /);
  assert.match(trace, /<TouchLockCatcher[\s\S]{0,80}top=\{topRowTop\}/);
  const lightbox = code('app', 'lightbox.tsx');
  assert.match(lightbox, /top: insets\.top \+ space\.sm,/);
  // Toasts sit at the bottom, above the home indicator.
  assert.match(lightbox, /bottom: insets\.bottom \+ space\.xl/);
  assert.match(trace, /bottom: insets\.bottom \+ space\.md/);
});
