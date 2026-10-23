import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_ARTS, emptyArtStyle, type EmptyArt } from './emptyState.ts';
import { darkV2, lightV2 } from '../theme/tokensV2.ts';
import { contrastRatio } from './contrast.ts';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

test('every empty-state variant has its own pastel', () => {
  const pastels = EMPTY_ARTS.map((a) => emptyArtStyle(a).pastel);
  assert.equal(new Set(pastels).size, EMPTY_ARTS.length);
  for (const p of pastels) assert.ok(p >= 0 && p < lightV2.pastels.length);
});

test('unknown variant falls back to drawings', () => {
  assert.deepEqual(emptyArtStyle('nope' as EmptyArt), emptyArtStyle('drawings'));
});

test('title and body text stay AA on every empty-state pastel (light and dark)', () => {
  for (const pal of [lightV2, darkV2]) {
    for (const a of EMPTY_ARTS) {
      const bg = pal.pastels[emptyArtStyle(a).pastel];
      // Dark pastels are translucent: composite over the screen background (paper) the card sits on.
      assert.ok(contrastRatio(pal.graphite, bg, pal.paper) >= 4.5, `${a} graphite`);
      assert.ok(contrastRatio(pal.muted, bg, pal.paper) >= 4.5, `${a} muted`);
    }
  }
});

// T89: one component for every empty state. Screens may sit under a route group (app/(tabs)/, T81).
test('every empty state uses EmptyStateV2 (Templates, Home recents, My drawings)', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const screen = (name: string): string => {
    const p = [join(root, 'app', '(tabs)', name), join(root, 'app', name)].find((f) => existsSync(f));
    assert.ok(p, `${name} found`);
    return readFileSync(p, 'utf8');
  };
  const templates = screen('templates.tsx');
  assert.match(templates, /<EmptyStateV2\b/);
  assert.match(templates, /'favourites' : 'search'/);
  const home = screen('index.tsx');
  assert.match(home, /<EmptyStateV2\s+art="recents"/);
  assert.match(screen('drawings.tsx'), /<EmptyStateV2\s+art="drawings"/);
  // The older one-off empty cards are gone.
  assert.ok(!existsSync(join(root, 'src', 'ui', 'EmptyState.tsx')));
  assert.ok(!existsSync(join(root, 'src', 'ui', 'PencilDoodle.tsx')));
  for (const src of [templates, home]) assert.doesNotMatch(src, /PencilDoodle/);
});
