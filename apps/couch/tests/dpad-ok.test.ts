/**
 * fb-1017-ok / fb-1017b H1: the d-pad's OK key must be derived from the shared geometry helper, not from
 * hard-coded offsets or percentages, and its label must be optically centred. RN components
 * cannot render under offline bun, so these are source checks (geometry itself is tested in
 * src/core/dpadGeometry.test.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const dpad = readFileSync(join(root, 'src/ui/remote/DPad.tsx'), 'utf8');
const text = readFileSync(join(root, 'src/ui/Text.tsx'), 'utf8');
const proto = readFileSync(join(root, 'prototype/index.html'), 'utf8');
const themes = readFileSync(join(root, 'app/themes.tsx'), 'utf8');

describe('OK key (fb-1017-ok)', () => {
  it('DPad takes every size from dpadGeometry, measured with onLayout', () => {
    expect(dpad).toContain("from '../../core/dpadGeometry'");
    expect(dpad).toContain('dpadGeometry(');
    expect(dpad).toContain('onLayout');
    expect(dpad).toContain('fontScale');
  });

  it('no hard-coded percentage offsets or fixed pad size remain', () => {
    expect(dpad).not.toMatch(/'(?!100%)\d+%'/);
    expect(dpad).not.toMatch(/const SIZE\s*=/);
    expect(dpad).not.toMatch(/fontSize:\s*\d/);
  });

  it('OK label is tight (lineHeight = fontSize, no font padding, centred)', () => {
    expect(dpad).toMatch(/<Text\s+tight[\s\S]*?ui\.common\.ok/);
    expect(dpad).toContain('adjustsFontSizeToFit');
    expect(text).toContain('includeFontPadding: false');
    expect(text).toContain("textAlignVertical: 'center'");
    expect(text).toContain('lineHeight: size');
  });

  it('press scale runs on a face the same size as the key (scales from its own centre)', () => {
    expect(dpad).toMatch(/width: k\.size,\s*height: k\.size,\s*borderRadius: k\.radius/);
    expect(dpad).toContain('transform: [{ scale: okScale }]');
  });

  it('OK key is the logo remote raised disc: its art from the shared model, a keyEdge drop shadow (fb-1017b H1)', () => {
    expect(dpad).toContain('okModel(t, g.key.size)');
    expect(dpad).toMatch(/export function OkDisc\(/);
    expect(dpad).toMatch(/okFace: \{[\s\S]*?shadowRadius: \d/);
    expect(dpad).toContain('shadowColor: t.keyEdge');
    // The theme picker's mini remote draws the same disc and pad face.
    expect(themes).toContain('<OkDisc g={MINI} theme={theme} />');
    expect(themes).toContain('<PadFace g={MINI} theme={theme} />');
  });

  it('arrows are the logo remote nubs drawn from the geometry, with full-size labelled hit areas', () => {
    expect(dpad).toContain('rect(g.arrows[side])');
    expect(dpad).toContain('accessibilityLabel={c.label}');
    expect(dpad).not.toContain('c.glyph');
    expect(themes).not.toMatch(/\{(c|DPAD\.\w+)\.glyph\}/);
  });

  it('prototype OK key is centred from one size variable, never with offsets', () => {
    expect(proto).toContain('--pad:');
    // fb-1017b H1: ~52% of the ring (DPAD_KEY_RATIO), from the one size variable.
    expect(proto).toMatch(/\.pad \.okb\{[^}]*width:calc\(var\(--pad\)\*0?\.5\d*\)/);
    expect(proto).toMatch(/\.pad \.okb\{[^}]*line-height:1/);
    expect(proto).toMatch(/\.pad \.okb\{[^}]*translate\(-50%,-50%\)/);
  });
});
