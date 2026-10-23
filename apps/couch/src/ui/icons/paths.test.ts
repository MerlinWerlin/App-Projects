import { ICON_NAMES, isIconName } from './names';
import { circlePath, gearPath, ICON_PATHS, ICON_STROKE, ICON_VIEWBOX, iconEntries, roundRectPath } from './paths';

/** All absolute/relative coordinates are hard to bound without a parser; check absolute M/L points. */
function absolutePoints(d: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const re = /([ML])\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) out.push([Number(m[2]), Number(m[3])]);
  return out;
}

describe('remote icon path table', () => {
  it('one grid, one stroke weight', () => {
    expect(ICON_VIEWBOX).toBe(24);
    expect(ICON_STROKE).toBeGreaterThanOrEqual(1.9);
    expect(ICON_STROKE).toBeLessThanOrEqual(2);
  });

  it('draws every id with well-formed path data inside the 24pt grid', () => {
    expect(iconEntries().map(([id]) => id)).toEqual([...ICON_NAMES]);
    for (const [id, parts] of iconEntries()) {
      expect({ id, drawn: parts.length > 0 }).toEqual({ id, drawn: true });
      for (const p of parts) {
        expect(p.d).not.toMatch(/NaN|undefined/);
        for (const [x, y] of absolutePoints(p.d)) {
          expect({ id, inside: x >= 1 && x <= 23 && y >= 1 && y <= 23 }).toEqual({ id, inside: true });
        }
      }
    }
  });

  it('covers the remote vocabulary', () => {
    for (const id of ['power', 'source', 'settings', 'home', 'back', 'menu', 'mute', 'volUp', 'volDown', 'chUp', 'chDown', 'playPause', 'rewind', 'fastForward', 'mic', 'keyboard', 'numpad', 'apps', 'tv', 'search', 'up', 'down', 'left', 'right', 'close', 'backspace', 'enter', 'check', 'speaker', 'plus', 'minus']) {
      expect(isIconName(id)).toBe(true);
    }
  });

  it('distinct artwork for distinct meanings (aliases only for +/- on the volume rocker)', () => {
    const seen = new Map<string, string>();
    const aliases = new Set(['volUp|plus', 'volDown|minus']);
    for (const [id, parts] of iconEntries()) {
      const sig = parts.map((p) => `${p.fill ? 'F' : 'S'}${p.d}`).join('|');
      const prev = seen.get(sig);
      if (prev) expect(aliases.has(`${prev}|${id}`)).toBe(true);
      else seen.set(sig, id);
    }
  });

  it('rewind and fast-forward are mirror images in absolute directions (never flipped by RTL)', () => {
    const rew = absolutePoints(ICON_PATHS.rewind[0]!.d)[0]!;
    const ff = absolutePoints(ICON_PATHS.fastForward[0]!.d)[0]!;
    expect(rew[0] + ff[0]).toBe(15); // 11.5 + 3.5: flat sides face opposite ways
    expect(absolutePoints(ICON_PATHS.left[0]!.d)[0]![0]).toBeGreaterThan(12);
    expect(absolutePoints(ICON_PATHS.right[0]!.d)[0]![0]).toBeLessThan(12);
  });

  it('shape helpers', () => {
    expect(circlePath(12, 12, 3)).toBe('M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z');
    expect(roundRectPath(2, 6, 20, 12, 2)).toMatch(/^M4 6h16a2 2 0 0 1 2 2v8/);
    expect(gearPath().split('L')).toHaveLength(32);
    expect(roundRectPath(0, 0, 4, 4, 9)).toContain('a2 2');
  });
});
