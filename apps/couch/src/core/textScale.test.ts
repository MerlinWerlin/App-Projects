import { DPAD_MAX_FONT_SCALE, DPAD_MIN_BAND, dpadAvailableWidth, dpadGeometry } from './dpadGeometry';
import {
  AX5_FONT_SCALE,
  MIN_HIT,
  ROLE_CAP,
  TEXT_ROLES,
  estimateTextWidth,
  fitsInRow,
  gridCellWidth,
  gridColumns,
  itemWidth,
  longestWordWidth,
  maxLines,
  minKeyHeight,
  normalizeFontScale,
  remoteContentWidth,
  roleCap,
  roleScale,
  rowOrStack,
  scaledFontSize,
  scaledLineHeight,
  sheetContentWidth,
} from './textScale';

// iPhone window widths (pt): SE 1st gen, SE 2/3 & mini, 14/15, 16 Pro, Plus/Pro Max, 16/17 Pro Max.
const WIDTHS = [320, 375, 390, 402, 430, 440];
// Default to the largest accessibility size (AX5 ~ 3.1x) in 0.1 steps.
const SCALES = Array.from({ length: 22 }, (_, i) => Math.round((1 + i * 0.1) * 10) / 10);

// Real labels from the catalogues (English, German: long words, Hindi, Japanese).
const NAV = [
  ['D-pad', 'Touchpad'],
  ['Steuerkreuz', 'Touchpad'],
  ['D-pad', 'टचपैड'],
];
const TOP = [
  ['Power', 'Source', 'Settings'],
  ['Ein/Aus', 'Quelle', 'Einstellungen'],
];
const SLEEP = [
  ['Off', '15 minutes', '30 minutes', '45 minutes', '60 minutes', '90 minutes'],
  ['Aus', '15 Minuten', '30 Minuten', '45 Minuten', '60 Minuten', '90 Minuten'],
  ['オフ', '15分', '30分', '45分', '60分', '90分'],
];
const SOURCES = ['HDMI 1', 'HDMI 2', 'Live TV', 'Composite AV', 'USB'];
const SIMPLE = ['Power', 'Home', 'Louder', 'Next channel', 'Quieter', 'Previous channel'];

describe('textScale: roles and caps', () => {
  it('normalizes bad font scales to 1 and never below the smallest system size', () => {
    expect(normalizeFontScale(Number.NaN)).toBe(1);
    expect(normalizeFontScale(0)).toBe(1);
    expect(normalizeFontScale(-2)).toBe(1);
    expect(normalizeFontScale(undefined)).toBe(1);
    expect(normalizeFontScale(0.5)).toBe(0.8);
    expect(normalizeFontScale(3.1)).toBe(3.1);
  });

  it('every role grows with the text size up to its cap, never past it', () => {
    for (const role of TEXT_ROLES) {
      let prev = 0;
      for (const s of SCALES) {
        const r = roleScale(s, role);
        expect(r).toBeLessThanOrEqual(roleCap(role));
        expect(r).toBeGreaterThanOrEqual(prev);
        expect(r).toBeGreaterThanOrEqual(1);
        prev = r;
      }
      expect(roleScale(AX5_FONT_SCALE, role)).toBe(Math.min(AX5_FONT_SCALE, ROLE_CAP[role]));
    }
  });

  it('body copy follows the system all the way to AX5; key text stops earlier', () => {
    expect(roleCap('body')).toBeGreaterThanOrEqual(AX5_FONT_SCALE);
    for (const role of ['label', 'title', 'caption', 'meta', 'glyph'] as const) {
      expect(roleCap(role)).toBeGreaterThan(1.5);
      expect(roleCap(role)).toBeLessThan(roleCap('body'));
    }
    expect(scaledFontSize(15, 3.1, 'label')).toBeCloseTo(36);
  });

  it('the d-pad role is exactly dpadGeometry\'s own cap', () => {
    expect(roleCap('dpad')).toBe(DPAD_MAX_FONT_SCALE);
  });
});

describe('textScale: the d-pad keeps its geometry at every size', () => {
  it('OK ~52% of the ring, arrow bands >= 44 pt, label lineHeight = fontSize, label capped', () => {
    for (const w of WIDTHS) {
      for (const s of SCALES) {
        const g = dpadGeometry(dpadAvailableWidth(w), s);
        expect(g.key.size / g.diameter).toBeGreaterThanOrEqual(0.5);
        expect(g.key.size / g.diameter).toBeLessThanOrEqual(0.53);
        expect(g.key.offset).toBeGreaterThanOrEqual(DPAD_MIN_BAND);
        expect(g.label.lineHeight).toBe(g.label.fontSize);
        expect(g.label.fontSize).toBe(dpadGeometry(dpadAvailableWidth(w), Math.min(s, DPAD_MAX_FONT_SCALE)).label.fontSize);
      }
    }
  });

  it('remoteContentWidth matches the d-pad\'s available width (same card)', () => {
    for (const w of WIDTHS) expect(remoteContentWidth(w)).toBe(dpadAvailableWidth(w));
    expect(remoteContentWidth(390, true)).toBeLessThan(remoteContentWidth(390));
  });
});

describe('textScale: keys grow and stay >= 44 pt', () => {
  it('minKeyHeight covers the scaled label and never drops under 44 pt', () => {
    for (const role of TEXT_ROLES) {
      let prev = 0;
      for (const s of SCALES) {
        const h = minKeyHeight(15, s, role);
        expect(h).toBeGreaterThanOrEqual(MIN_HIT);
        expect(h).toBeGreaterThanOrEqual(scaledLineHeight(15, s, role));
        expect(h).toBeGreaterThanOrEqual(prev);
        prev = h;
      }
    }
    expect(minKeyHeight(15, 3.1, 'label', { lines: 2 })).toBeGreaterThan(minKeyHeight(15, 3.1, 'label'));
  });

  it('numpad keys keep their 56 pt floor and grow past it with large digits', () => {
    expect(minKeyHeight(20, 1, 'glyph', { padV: 12, floor: 56 })).toBe(56);
    expect(minKeyHeight(20, 3.1, 'glyph', { padV: 12, floor: 56 })).toBeGreaterThan(56);
  });

  it('a glyph at its cap still fits the 52 pt round key', () => {
    for (const s of SCALES) expect(scaledLineHeight(20, s, 'glyph')).toBeLessThanOrEqual(52 - 8);
  });

  it('the rocker caption fits its 56 pt slot once it shrinks to fit (minimumFontScale 0.6)', () => {
    for (const cap of ['VOL', 'CH', 'CAN', 'صوت', 'قناة', '音量', '频道', '볼륨']) {
      for (const s of SCALES) {
        expect(estimateTextWidth(cap, scaledFontSize(11, s, 'caption') * 0.6, 0.9)).toBeLessThanOrEqual(56);
      }
    }
  });
});

describe('textScale: rows turn into stacks, grids drop columns', () => {
  it('estimates widths: wider text, wider scripts and larger sizes are wider', () => {
    expect(estimateTextWidth('', 15)).toBe(0);
    expect(estimateTextWidth('Settings', 30)).toBeGreaterThan(estimateTextWidth('Settings', 15));
    expect(estimateTextWidth('音量', 15)).toBeGreaterThan(estimateTextWidth('Vo', 15));
    expect(longestWordWidth('Previous channel', 15)).toBe(estimateTextWidth('Previous', 15));
    expect(longestWordWidth('前のチャンネル', 15)).toBe(estimateTextWidth('前', 15));
    expect(fitsInRow(100, [50, 40], 10)).toBe(true);
    expect(fitsInRow(100, [50, 41], 10)).toBe(false);
    expect(fitsInRow(10, [])).toBe(true);
  });

  it('nav toggle: a row at default size on every phone, a stack once the labels stop fitting', () => {
    for (const labels of NAV) {
      for (const w of WIDTHS) {
        const avail = remoteContentWidth(w) - 6;
        const spec = { fontSize: 12.5, role: 'label' as const, padH: 12 };
        expect(rowOrStack(avail, labels, { ...spec, fontScale: 1 })).toBe('row');
        let stacked = false;
        for (const s of SCALES) {
          const layout = rowOrStack(avail, labels, { ...spec, fontScale: s });
          if (layout === 'row') {
            // Never goes back to a row once stacked, and a row really fits.
            expect(stacked).toBe(false);
            expect(fitsInRow(avail, labels.map((l) => itemWidth(l, { ...spec, fontScale: s })))).toBe(true);
          } else stacked = true;
        }
      }
    }
    // At AX5 on the smallest phone the long German label stacks.
    expect(rowOrStack(remoteContentWidth(320) - 6, NAV[1]!, { fontSize: 12.5, fontScale: 3.1, role: 'label', padH: 12 })).toBe('stack');
  });

  it('top row (Power / Source / Settings): a row at default size, items never squeezed under 64 pt', () => {
    for (const labels of TOP) {
      for (const w of WIDTHS) {
        const spec = { fontSize: 11.5, role: 'caption' as const, padH: 10, minItem: 64, gap: 10 };
        expect(rowOrStack(remoteContentWidth(w), labels, { ...spec, fontScale: 1 })).toBe('row');
        for (const s of SCALES) {
          if (rowOrStack(remoteContentWidth(w), labels, { ...spec, fontScale: s }) === 'row') {
            const widths = labels.map((l) => Math.max(64, itemWidth(l, { ...spec, fontScale: s })));
            expect(fitsInRow(remoteContentWidth(w), widths, 10)).toBe(true);
          }
        }
      }
    }
    expect(rowOrStack(remoteContentWidth(375), TOP[0]!, { fontSize: 11.5, fontScale: 3.1, role: 'caption', padH: 10, minItem: 64, gap: 10 })).toBe('stack');
  });

  it('grids keep the prototype columns at default size and drop columns as text grows', () => {
    const cases = [
      ...SLEEP.map((labels) => ({ labels, preferred: 3, base: 15, padH: 6, gap: 10, width: sheetContentWidth, min: 3 })),
      { labels: SOURCES, preferred: 2, base: 15, padH: 12, gap: 10, width: sheetContentWidth, min: 2 },
      { labels: SIMPLE, preferred: 2, base: 17, padH: 8, gap: 12, width: (w: number) => remoteContentWidth(w), min: 2 },
    ];
    for (const c of cases) {
      for (const w of WIDTHS) {
        const avail = c.width(w);
        const spec = { fontSize: c.base, role: 'label' as const, padH: c.padH, gap: c.gap, wrap: true };
        expect(gridColumns(avail, c.preferred, c.labels, { ...spec, fontScale: 1 })).toBe(c.min);
        let prev = c.preferred;
        for (const s of SCALES) {
          const n = gridColumns(avail, c.preferred, c.labels, { ...spec, fontScale: s });
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(prev);
          prev = n;
          if (n > 1) {
            // Every label's longest word fits its cell: nothing breaks mid-word or clips.
            const cell = (avail - c.gap * (n - 1)) / n;
            const size = scaledFontSize(c.base, s, 'label');
            for (const l of c.labels) expect(longestWordWidth(l, size) + 2 * c.padH).toBeLessThanOrEqual(cell);
          }
        }
      }
    }
    // At AX5 the simple remote is one big key per row on every phone.
    for (const w of WIDTHS) {
      expect(gridColumns(remoteContentWidth(w), 2, SIMPLE, { fontSize: 17, fontScale: 3.1, role: 'label', padH: 8, gap: 12, wrap: true })).toBe(1);
    }
  });

  it('without wrap the whole label must fit, so columns drop sooner', () => {
    const spec = { fontSize: 15, fontScale: 2, role: 'label' as const, padH: 6, gap: 10 };
    expect(gridColumns(343, 3, SLEEP[0]!, spec)).toBeLessThanOrEqual(gridColumns(343, 3, SLEEP[0]!, { ...spec, wrap: true }));
    expect(gridColumns(343, 0, SLEEP[0]!, spec)).toBe(1);
  });

  it('grid cell widths leave room for the gaps', () => {
    expect(gridCellWidth(1)).toBe('100%');
    expect(gridCellWidth(2)).toBe('48.5%');
    expect(gridCellWidth(3)).toBe('31.5%');
    for (const n of [2, 3, 4, 5]) expect(parseFloat(gridCellWidth(n)) * n).toBeLessThan(100);
  });

  it('long names get more lines as the text grows, one at default sizes', () => {
    expect(maxLines(1)).toBe(1);
    expect(maxLines(1.2)).toBe(1);
    let prev = 1;
    for (const s of SCALES) {
      expect(maxLines(s)).toBeGreaterThanOrEqual(prev);
      prev = maxLines(s);
    }
    expect(maxLines(3.1)).toBe(3);
  });

  it('sheet content width: the 440 pt panel minus its padding', () => {
    expect(sheetContentWidth(320)).toBe(288);
    expect(sheetContentWidth(375)).toBe(343);
    expect(sheetContentWidth(1024)).toBe(408);
  });
});
