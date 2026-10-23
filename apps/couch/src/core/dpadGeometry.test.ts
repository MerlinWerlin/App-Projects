import {
  DPAD_KEY_RATIO,
  DPAD_MAX_DIAMETER,
  DPAD_MAX_FONT_SCALE,
  DPAD_MIN_BAND,
  DPAD_MIN_KEY_RATIO,
  dpadAvailableWidth,
  dpadGeometry,
} from './dpadGeometry';

// iPhone window widths (pt): SE 1st gen, SE 2/3 & mini, 14/15, 16/17, 16 Pro, Plus/Pro Max, 16/17 Pro Max.
const WIDTHS = [320, 375, 390, 393, 402, 428, 430, 440];
// Default, larger text, and the largest accessibility Dynamic Type sizes (AX5 ~ 3.1x).
const SCALES = [1, 1.2, 1.35, 2, 3.12];

describe('d-pad geometry (fb-1017-ok, fb-1017b H1 bigger OK)', () => {
  it('OK key is about 52% of the ring, never below 50%', () => {
    expect(DPAD_KEY_RATIO).toBeCloseTo(0.52, 5);
    expect(DPAD_MIN_KEY_RATIO).toBe(0.5);
    expect(DPAD_MIN_BAND).toBe(44);
  });

  for (const w of WIDTHS) {
    for (const s of SCALES) {
      it(`width ${w} pt, font scale ${s}`, () => {
        const avail = dpadAvailableWidth(w);
        const g = dpadGeometry(avail, s);
        // fits: never wider than the space, never bigger than the design size
        expect(g.diameter).toBeLessThanOrEqual(avail);
        expect(g.diameter).toBeLessThanOrEqual(DPAD_MAX_DIAMETER);
        expect(g.diameter % 2).toBe(0);
        // OK is a true circle at ~50-55% of the ring (fb-1017b H1), even integer size
        const ratio = g.key.size / g.diameter;
        expect(ratio).toBeGreaterThanOrEqual(0.5);
        expect(ratio).toBeLessThanOrEqual(0.55);
        expect(g.key.size % 2).toBe(0);
        expect(g.key.radius * 2).toBe(g.key.size);
        // exactly centred: equal margin on every side, integer points (no half-pixel drift)
        expect(g.key.offset * 2 + g.key.size).toBe(g.diameter);
        expect(Number.isInteger(g.key.offset)).toBe(true);
        // arrow band (ring minus key, per side) stays a full touch target
        expect(g.key.offset).toBeGreaterThanOrEqual(44);
        // equal positive gap between the key and the ring arcs; key never clipped
        expect(g.key.gap).toBeGreaterThan(0);
        expect(g.key.gap).toBe(g.key.offset - g.ringInset - g.ringStroke);
        // label: lineHeight == fontSize, fits inside the key's border, stays readable
        expect(g.label.lineHeight).toBe(g.label.fontSize);
        expect(g.label.fontSize).toBeGreaterThanOrEqual(20);
        expect(g.label.fontSize).toBeLessThan(g.key.size - 2 * g.key.border);
        expect(g.label.maxWidth).toBeLessThan(g.key.size - 2 * g.key.border);
        // bevel: the label box sits on the plain accent, between highlight and shade
        // (checked in the inner face's coordinates, where the gradient is drawn, and in the key's)
        const inner = g.key.size - 2 * g.key.border;
        const face = (share: number) => (share * g.key.size - g.key.border) / inner;
        const top = Math.min((inner - g.label.lineHeight) / 2 / inner, (g.key.size - g.label.lineHeight) / 2 / g.key.size);
        const bottom = Math.max((inner + g.label.lineHeight) / 2 / inner, (g.key.size + g.label.lineHeight) / 2 / g.key.size);
        expect(face(g.bevel.highlightEnd)).toBeLessThanOrEqual(top);
        expect(face(g.bevel.shadeStart)).toBeGreaterThanOrEqual(bottom);
        expect(g.bevel.highlightEnd).toBeLessThanOrEqual(top);
        expect(g.bevel.shadeStart).toBeGreaterThanOrEqual(bottom);
        // arrows: symmetric around the key, large hit areas, no overlap with the key
        const { up, down, left, right } = g.arrows;
        expect(up.w).toBe(down.w);
        expect(up.h).toBe(down.h);
        expect(left.w).toBe(right.w);
        expect(left.h).toBe(right.h);
        expect(up.w).toBe(left.h);
        expect(up.h).toBe(left.w);
        expect(up.x + up.w / 2).toBe(g.diameter / 2);
        expect(down.x + down.w / 2).toBe(g.diameter / 2);
        expect(left.y + left.h / 2).toBe(g.diameter / 2);
        expect(right.y + right.h / 2).toBe(g.diameter / 2);
        expect(up.y).toBe(0);
        expect(left.x).toBe(0);
        expect(down.y + down.h).toBe(g.diameter);
        expect(right.x + right.w).toBe(g.diameter);
        expect(up.y + up.h).toBeLessThanOrEqual(g.key.offset);
        expect(right.x).toBeGreaterThanOrEqual(g.key.offset + g.key.size);
        expect(Math.min(up.w, up.h)).toBeGreaterThanOrEqual(44);
        // arrow icons: even box that fits well inside the band
        expect(g.arrowIcon.size % 2).toBe(0);
        expect(g.arrowIcon.size).toBeGreaterThanOrEqual(22);
        expect(g.arrowIcon.size).toBeLessThan(up.h - 2 * g.ringInset - 2 * g.ringStroke);
      });
    }
  }

  it('large phones get the full design size, SE 1st gen shrinks to fit', () => {
    const se1 = dpadGeometry(dpadAvailableWidth(320));
    const std = dpadGeometry(dpadAvailableWidth(393));
    const max = dpadGeometry(dpadAvailableWidth(440));
    expect(se1.diameter).toBe(252);
    expect(std.diameter).toBe(260);
    expect(max.diameter).toBe(260);
    // fb-1017b H1 numbers (were key 100/104, band 76/78, label 16)
    expect([se1.key.size, se1.key.offset]).toEqual([130, 61]);
    expect([std.key.size, std.key.offset]).toEqual([134, 63]);
    expect([max.key.size, max.key.offset]).toEqual([134, 63]);
  });

  it('label is about 20-22 pt at font scale 1 on every phone', () => {
    for (const w of WIDTHS) {
      const f = dpadGeometry(dpadAvailableWidth(w), 1).label.fontSize;
      expect(f).toBeGreaterThanOrEqual(20);
      expect(f).toBeLessThanOrEqual(22);
    }
    expect(dpadGeometry(dpadAvailableWidth(393), 1).label.fontSize).toBe(21);
  });

  it('label grows with Dynamic Type but stops at the cap, still inside the key', () => {
    const base = dpadGeometry(260, 1).label.fontSize;
    const big = dpadGeometry(260, DPAD_MAX_FONT_SCALE);
    expect(big.label.fontSize).toBeGreaterThan(base);
    expect(dpadGeometry(260, 3.12).label.fontSize).toBe(big.label.fontSize);
    expect(big.label.fontSize).toBeLessThan(big.label.maxWidth);
  });

  it('tiny pads give up key share (down to 50%) to keep a 44 pt band, never below 50%', () => {
    for (let d = 120; d <= 260; d += 2) {
      const g = dpadGeometry(d);
      const ratio = g.key.size / g.diameter;
      expect(ratio).toBeGreaterThanOrEqual(DPAD_MIN_KEY_RATIO);
      expect(ratio).toBeLessThanOrEqual(0.55);
      expect(g.key.offset * 2 + g.key.size).toBe(g.diameter);
      if (d >= 176) expect(g.key.offset).toBeGreaterThanOrEqual(DPAD_MIN_BAND);
      if (d >= 200) expect(ratio).toBeGreaterThan(0.51);
    }
  });

  it('bad input falls back to the design size', () => {
    expect(dpadGeometry(Number.NaN).diameter).toBe(260);
    expect(dpadGeometry(0).diameter).toBe(260);
  });
});
