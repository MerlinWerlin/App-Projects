import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canApplyFromDetail,
  packDetailView,
  preferPackTheme,
  showsPackCard,
  wantsPackArtwork,
  type PackAccessState,
  type PackDetailView,
} from './packDetail.ts';
import { THEMES } from './themes.ts';
import { AURORA_PACK_ID, NEW_PLUS_THEMES } from './themesNew.ts';
import { PLUS_PACKS } from './plusThemes.ts';

const packTheme = NEW_PLUS_THEMES[0];
const starter = THEMES[0];
const bundledPlus = PLUS_PACKS[0].themes[0];
const idle = (state: PackAccessState, progress = 0, error: string | null = null) => ({ state, progress, error });

test('the fixtures are what the tests assume', () => {
  assert.equal(packTheme.packId, AURORA_PACK_ID);
  assert.equal(packTheme.plus, true);
  assert.ok(!starter.plus && !starter.packId);
  assert.ok(bundledPlus.plus && !bundledPlus.packId);
});

test('non-pack themes never show a pack card', () => {
  for (const s of ['free', 'locked', 'ready', 'disabled', 'not-downloaded', 'downloading', 'error'] as PackAccessState[]) {
    assert.deepEqual(packDetailView(starter, idle(s)), { kind: 'none' }, `starter ${s}`);
    assert.deepEqual(packDetailView(bundledPlus, idle(s)), { kind: 'none' }, `bundled plus ${s}`);
  }
  assert.deepEqual(packDetailView(null, idle('ready')), { kind: 'none' });
  assert.deepEqual(packDetailView(undefined, idle('ready')), { kind: 'none' });
  assert.equal(showsPackCard({ kind: 'none' }), false);
});

test('each access state maps to its detail state for a pack theme', () => {
  assert.deepEqual(packDetailView(packTheme, idle('locked')), { kind: 'locked' });
  assert.deepEqual(packDetailView(packTheme, idle('disabled')), { kind: 'bundled' });
  assert.deepEqual(packDetailView(packTheme, idle('not-downloaded')), { kind: 'download' });
  assert.deepEqual(packDetailView(packTheme, idle('ready')), { kind: 'ready' });
  assert.deepEqual(packDetailView(packTheme, idle('downloading', 0.42)), { kind: 'downloading', progress: 0.42, percent: 42 });
  assert.deepEqual(packDetailView(packTheme, idle('error', 0, 'Couldn’t reach the pack.')), { kind: 'error', message: 'Couldn’t reach the pack.' });
  // A Plus pack theme reported as free (shouldn't happen) shows nothing rather than guessing.
  assert.deepEqual(packDetailView(packTheme, idle('free')), { kind: 'none' });
});

test('download progress is clamped and never reads 100% before the pack is ready', () => {
  const pct = (p: number) => {
    const v = packDetailView(packTheme, idle('downloading', p));
    assert.equal(v.kind, 'downloading');
    return v.kind === 'downloading' ? [v.progress, v.percent] : null;
  };
  assert.deepEqual(pct(0), [0, 0]);
  assert.deepEqual(pct(-1), [0, 0]);
  assert.deepEqual(pct(Number.NaN), [0, 0]);
  assert.deepEqual(pct(0.999), [0.999, 99]);
  assert.deepEqual(pct(1), [1, 99]);
  assert.deepEqual(pct(7), [1, 99]);
});

test('an empty error message becomes null (the screen shows its generic text)', () => {
  assert.deepEqual(packDetailView(packTheme, idle('error', 0, '')), { kind: 'error', message: null });
  assert.deepEqual(packDetailView(packTheme, idle('error', 0, '   ')), { kind: 'error', message: null });
  assert.deepEqual(packDetailView(packTheme, idle('error', 0, null)), { kind: 'error', message: null });
});

test('Apply is offered only when the theme can be used (locked keeps Apply, which opens the Plus sheet)', () => {
  const views: [PackDetailView, boolean][] = [
    [{ kind: 'none' }, true],
    [{ kind: 'locked' }, true],
    [{ kind: 'bundled' }, true],
    [{ kind: 'ready' }, true],
    [{ kind: 'download' }, false],
    [{ kind: 'downloading', progress: 0.5, percent: 50 }, false],
    [{ kind: 'error', message: null }, false],
  ];
  for (const [v, want] of views) {
    assert.equal(canApplyFromDetail(v), want, v.kind);
    assert.equal(showsPackCard(v), v.kind !== 'none', v.kind);
    assert.equal(wantsPackArtwork(v), v.kind === 'ready', v.kind);
  }
});

test('preferPackTheme uses the downloaded copy of the same theme, otherwise the bundled one', () => {
  const downloaded = { ...packTheme, tagline: 'from the pack' };
  assert.equal(preferPackTheme(packTheme, [downloaded]), downloaded);
  assert.equal(preferPackTheme(packTheme, []), packTheme);
  assert.equal(preferPackTheme(packTheme, null), packTheme);
  // Another theme, another pack's copy, or a non-Plus copy is never swapped in.
  assert.equal(preferPackTheme(packTheme, [{ ...NEW_PLUS_THEMES[1], tagline: 'x' }]), packTheme);
  assert.equal(preferPackTheme(packTheme, [{ ...downloaded, packId: 'pack-other' }]), packTheme);
  assert.equal(preferPackTheme(packTheme, [{ ...downloaded, plus: false }]), packTheme);
  // Starter and bundled-only Plus themes are never replaced.
  assert.equal(preferPackTheme(starter, [{ ...starter, tagline: 'x', plus: true, packId: AURORA_PACK_ID }]), starter);
  assert.equal(preferPackTheme(bundledPlus, [{ ...bundledPlus, packId: AURORA_PACK_ID }]), bundledPlus);
});

test('the core state list matches src/plus/usePackAccess.ts', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/plus/usePackAccess.ts', 'utf8');
  const m = /export type PackAccessState =([^;]+);/.exec(src);
  assert.ok(m, 'PackAccessState not found');
  const plus = [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]).sort();
  const core = readFileSync('src/core/packDetail.ts', 'utf8');
  const c = /export type PackAccessState =([^;]+);/.exec(core);
  assert.ok(c);
  assert.deepEqual([...c[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]).sort(), plus);
});
