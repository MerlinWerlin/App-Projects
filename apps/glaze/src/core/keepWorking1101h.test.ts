// T255 (owner-1101h): what Jared said works well on TestFlight 1.0.1 (19) must keep working.
// Each item is pinned to the tests that already cover it; this file fails if one of those guards
// is deleted or renamed, so a later change can't quietly drop the behaviour with its test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const here = join(import.meta.dirname, '.');

const KEEP: { item: string; file: string; tests: string[] }[] = [
  {
    item: 'starry textured icons (default look)',
    file: 'iconLook.test.ts',
    tests: ['the default icon look is themed (textured)', 'night / space themes get stars'],
  },
  {
    item: 'icon install + theme-swap replacement (stable profile id)',
    file: 'mobileconfigStable.test.ts',
    tests: ['makeInstallId gives a valid 16-hex id', 'stableUuid is deterministic'],
  },
  {
    item: 'My widget art Manage / Delete',
    file: 'widgetArtCleanup.test.ts',
    tests: ['removeMany / clearAll / removePiece keep the index metadata', 'wiring: adapter, theme apply, widget fallback and Manage UI'],
  },
  {
    item: 'clock widget with live time',
    file: 'liveArt.test.ts',
    tests: ['constellation clock a live clock', 'Swift guards: interactive focus, live timer'],
  },
  {
    item: 'Fill layout (red-moon piece)',
    file: 't236WidgetFill.test.ts',
    tests: ['Seamless widget: Edit Widget Layout Fill (default) / Fit'],
  },
  {
    item: 'icon style picker always visible',
    file: 'iconLookT240.test.ts',
    tests: ['the Icons step renders the look selector always'],
  },
];

for (const k of KEEP) {
  test(`owner-1101h keep: ${k.item}`, () => {
    const p = join(here, k.file);
    assert.ok(existsSync(p), `${k.file} still exists`);
    const src = readFileSync(p, 'utf8');
    for (const t of k.tests) assert.ok(src.includes(t), `${k.file} still has the test "${t}"`);
  });
}

test('owner-1101h keep: Swift live clock still draws the system time, not a baked number', () => {
  const swift = readFileSync(join(here, '..', '..', 'targets', 'widget', 'LiveArtOverlay.swift'), 'utf8');
  assert.match(swift, /Text\([^)]*style: \.time|\.timer|Date\(\)/, 'live time from the system');
});
