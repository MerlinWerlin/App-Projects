import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeTheme, SKINS } from './theme.ts';

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const HEX = /^#[0-9a-fA-F]{6}$/;

test('every skin is complete and readable in dark and light', () => {
  assert.ok(SKINS.length >= 1);
  const ids = new Set<string>();
  for (const s of SKINS) {
    assert.ok(!ids.has(s.id), `dup ${s.id}`);
    ids.add(s.id);
    for (const mode of ['dark', 'light'] as const) {
      const p = s[mode];
      for (const k of ['bg', 'card', 'cardHi', 'ink', 'sub', 'rec', 'recInk', 'rew', 'rewInk', 'score', 'discBody', 'labelForward', 'labelBack'] as const)
        assert.match(p[k], HEX, `${s.id} ${mode} ${k}`);
      const where = `${s.id} ${mode}`;
      assert.ok(contrast(p.ink, p.bg) >= 7, `${where} ink/bg`);
      assert.ok(contrast(p.ink, p.card) >= 7, `${where} ink/card`);
      assert.ok(contrast(p.sub, p.card) >= 4.5, `${where} sub/card`);
      assert.ok(contrast(p.recInk, p.rec) >= 4.5, `${where} recInk/rec`);
      assert.ok(contrast(p.rewInk, p.rew) >= 4.5, `${where} rewInk/rew`);
      assert.ok(contrast(p.score, p.cardHi) >= 3, `${where} score/cardHi`);
      assert.ok(p.bgGradient.length >= 2 && p.recGradient.length >= 2, `${where} gradients`);
    }
    assert.equal(makeTheme(s.id, true).skin, s.id);
  }
});
