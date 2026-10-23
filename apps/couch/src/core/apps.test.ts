import {
  ICON_FRAME_ASPECT,
  TILE_PALETTE,
  appInitial,
  cleanTileName,
  defaultPins,
  fallbackTile,
  iconFit,
  loadApps,
  sortApps,
  stableHash,
  tileLabel,
  tileLabelScale,
  togglePin,
} from './apps';
import { createDemoSession } from './demo';
import { RemoteSession } from './session';
import type { TvApp } from './types';

describe('fallbackTile', () => {
  it('uses only the house palette', () => {
    for (let i = 0; i < 200; i++) {
      const t = fallbackTile(`app.${i}`);
      expect(TILE_PALETTE).toContainEqual({ h1: t.h1, h2: t.h2 });
      expect(Object.keys(t).sort()).toEqual(['h1', 'h2']);
    }
  });

  it('is deterministic for an id and spreads across the palette', () => {
    expect(fallbackTile('12')).toEqual(fallbackTile('12'));
    expect(fallbackTile('com.example.app')).toEqual(fallbackTile('com.example.app'));
    expect(stableHash('')).toBe(0x811c9dc5);
    expect(stableHash('a')).toBe(0xe40c292c); // FNV-1a reference value
    expect(fallbackTile('a')).toEqual(TILE_PALETTE[0xe40c292c % TILE_PALETTE.length]);
    const pals = new Set<string>();
    for (let i = 0; i < 200; i++) pals.add(fallbackTile(String(i)).h1);
    expect(pals.size).toBe(TILE_PALETTE.length);
  });

  it('takes only an id (never the app name)', () => {
    expect(fallbackTile.length).toBe(1);
  });
});

describe('tileLabel (typographic fallback)', () => {
  it('shows short names whole on one line', () => {
    expect(tileLabel('Cinema')).toEqual({ text: 'Cinema', kind: 'name', lines: 1, longest: 6 });
    expect(tileLabel('  My  TV ')).toEqual({ text: 'My TV', kind: 'name', lines: 1, longest: 5 });
    expect(tileLabel('Weather').kind).toBe('name');
  });

  it('splits two- or three-word names over two balanced lines', () => {
    expect(tileLabel('Living Room Show')).toEqual({ text: 'Living\nRoom Show', kind: 'name', lines: 2, longest: 9 });
    expect(tileLabel('Weekend Matinee')).toEqual({ text: 'Weekend\nMatinee', kind: 'name', lines: 2, longest: 7 });
    expect(tileLabel('Home Cinema Plus')).toEqual({ text: 'HC', kind: 'initials', lines: 1, longest: 2 });
  });

  it('falls back to initials for long names', () => {
    expect(tileLabel('Extraordinarily Long Channel Name')).toEqual({ text: 'EL', kind: 'initials', lines: 1, longest: 2 });
    expect(tileLabel('superlongappname')).toEqual({ text: 'Su', kind: 'initials', lines: 1, longest: 2 });
  });

  it('strips symbol and emoji characters', () => {
    expect(cleanTileName('\u2605 Stars \u25B6\uFE0E')).toBe('Stars');
    expect(cleanTileName('Fun \u{1F3AC} Time\u2122')).toBe('Fun Time');
    expect(cleanTileName('\uF8FF TV')).toBe('TV');
    expect(tileLabel('\u266A\u2261\u25A6')).toEqual({ text: '', kind: 'initials', lines: 1, longest: 0 });
  });

  it('is deterministic and keeps non-Latin names', () => {
    expect(tileLabel('音乐')).toEqual({ text: '音乐', kind: 'name', lines: 1, longest: 2 });
    expect(tileLabel('Some Name Here Again')).toEqual(tileLabel('Some Name Here Again'));
  });

  it('font scale shrinks as the label grows', () => {
    const scales = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(tileLabelScale);
    for (let i = 1; i < scales.length; i++) expect(scales[i]!).toBeLessThanOrEqual(scales[i - 1]!);
  });
});

describe('iconFit', () => {
  const W = 120;
  const H = W / ICON_FRAME_ASPECT;

  it('fills the frame (cover) for Roku-shaped icons', () => {
    expect(iconFit(290, 218, W, H, 3)).toEqual({ mode: 'cover', width: W, height: H });
    expect(iconFit(266, 200, W, H, 3).mode).toBe('cover'); // 4:3 exactly
  });

  it('contains square and very wide icons inside the inset', () => {
    const sq = iconFit(400, 400, W, H, 3);
    expect(sq.mode).toBe('contain');
    expect(sq.width).toBeCloseTo(H * 0.84);
    expect(sq.height).toBeCloseTo(H * 0.84);
    const wide = iconFit(1600, 400, W, H, 3);
    expect(wide.mode).toBe('contain');
    expect(wide.width).toBeCloseTo(W * 0.84);
    expect(wide.height).toBeCloseTo(W * 0.84 / 4);
  });

  it('never upscales a small icon past 1.5x its pixels at the screen density', () => {
    const small = iconFit(80, 80, W, H, 3);
    expect(small).toEqual({ mode: 'contain', width: 40, height: 40 });
    expect(iconFit(80, 80, W, H, 1).width).toBeCloseTo(H * 0.84);
  });

  it('handles unknown sizes', () => {
    expect(iconFit(0, 0, W, H)).toEqual({ mode: 'contain', width: W * 0.84, height: H * 0.84 });
    expect(iconFit(NaN, 5, W, H).mode).toBe('contain');
    expect(iconFit(10, 10, 0, 0)).toEqual({ mode: 'contain', width: 0, height: 0 });
  });
});

const noSleep = async () => {};

async function demoSession() {
  const demo = await createDemoSession({ sleep: noSleep, random: () => 0.5 });
  const s = new RemoteSession(() => 1000);
  s.load(demo.tvs, demo.drivers, { demo: true });
  return { s, demo };
}

const APPS: TvApp[] = [
  { id: 'y', name: 'Yonder' },
  { id: 'a', name: 'abc tv' },
  { id: 'n', name: 'Nimbus' },
  { id: 'p', name: 'Pebble' },
];

describe('sortApps', () => {
  it('puts pinned first in pin order, rest alphabetical (case-insensitive)', () => {
    const out = sortApps(APPS, ['p', 'y']);
    expect(out.map((a) => a.id)).toEqual(['p', 'y', 'a', 'n']);
    expect(out.map((a) => a.pinned)).toEqual([true, true, false, false]);
  });
  it('ignores unknown and duplicate pins and does not mutate input', () => {
    const copy = APPS.map((a) => ({ ...a }));
    const out = sortApps(APPS, ['zzz', 'n', 'n']);
    expect(out.map((a) => a.id)).toEqual(['n', 'a', 'p', 'y']);
    expect(APPS).toEqual(copy);
  });
});

describe('togglePin', () => {
  it('appends then removes', () => {
    expect(togglePin(['a'], 'b')).toEqual(['a', 'b']);
    expect(togglePin(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('helpers', () => {
  it('defaultPins and appInitial', () => {
    expect(defaultPins([{ id: 'x', name: 'X', pinned: true }, { id: 'y', name: 'Y' }])).toEqual(['x']);
    expect(appInitial(' nimbus')).toBe('N');
    expect(appInitial('')).toBe('?');
  });
});

describe('apps against MockTv via RemoteSession', () => {
  it('lists, sorts with default pins, and launches', async () => {
    const { s, demo } = await demoSession();
    const r = await loadApps(s.activeDriver());
    if (r.kind !== 'ok') throw new Error('expected ok');
    const sorted = sortApps(r.apps, defaultPins(r.apps));
    expect(sorted.slice(0, 4).map((a) => a.name)).toEqual(['Netflix', 'YouTube', 'Disney+', 'Stan']);
    const rest = sorted.slice(4).map((a) => a.name);
    expect(rest).toEqual([...rest].sort((x, y) => x.localeCompare(y)));
    expect(await s.launchApp('svc.iview')).toBe(true);
    expect(demo.drivers.get('demo-1')!.foregroundApp).toBe('svc.iview');
  });

  it('reports an off TV as an error, no TV as none', async () => {
    const { s } = await demoSession();
    s.select('demo-3');
    const r = await loadApps(s.activeDriver());
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.message).toMatch(/off/);
    expect((await loadApps(null)).kind).toBe('none');
  });

  it('launching an unknown app fails without throwing', async () => {
    const { s } = await demoSession();
    expect(await s.launchApp('nope')).toBe(false);
    expect(s.getSnapshot().lastError).toMatch(/not installed/);
  });
});
