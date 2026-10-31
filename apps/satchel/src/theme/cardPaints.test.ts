// T87: loyalty card paints exist for every colour in both themes and their text is AA on the fill.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARD_COLOURS } from '../core/loyalty.ts';
import { barcodePanel, cardPaints } from './tokens.ts';

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('every card colour has a light and a dark paint with AA text', () => {
  for (const mode of ['light', 'dark'] as const) {
    for (const c of CARD_COLOURS) {
      const p = cardPaints[mode][c];
      assert.ok(p, `${mode} ${c}`);
      assert.ok(contrast(p.ink, p.fill) >= 4.5, `${mode} ${c} ink ${contrast(p.ink, p.fill).toFixed(2)}`);
      assert.ok(contrast(p.muted, p.fill) >= 4.5, `${mode} ${c} muted ${contrast(p.muted, p.fill).toFixed(2)}`);
    }
    assert.equal(Object.keys(cardPaints[mode]).length, CARD_COLOURS.length);
  }
});

test('barcode panel is black on white for scanners', () => {
  assert.equal(contrast(barcodePanel.ink, barcodePanel.bg), 21);
});
