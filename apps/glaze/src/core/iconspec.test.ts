import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSpec,
  resolveSpecs,
  installMethodFor,
  contrastRatio,
  contrastWarnings,
  specContrast,
} from './iconspec.ts';
import type { IconApp, IconStyle, IconOverride } from './iconspec.ts';

const style: IconStyle = {
  shape: 'squircle',
  background: { kind: 'solid', colour: '#7A2E6B' },
  glyphColour: '#FFFFFF',
  glyphSet: 'line',
  showLabel: true,
  glyphScale: 0.6,
};

const apps: IconApp[] = [
  { id: 'music', name: 'Music', urlScheme: 'music:', glyph: 'music' },
  { id: 'notes', name: 'Notes', urlScheme: null, glyph: 'edit' },
  { id: 'mail', name: 'Mail', urlScheme: 'message:', glyph: 'mail' },
];

test('style applies when there is no override; app defaults supply label and glyph', () => {
  const [m] = resolveSpecs(apps, style);
  assert.deepEqual(m, {
    appId: 'music',
    label: 'Music',
    urlScheme: 'music:',
    shape: 'squircle',
    background: { kind: 'solid', colour: '#7A2E6B' },
    glyph: 'music',
    glyphSet: 'line',
    glyphColour: '#FFFFFF',
    glyphScale: 0.6,
    showLabel: true,
  });
  assert.equal('overrideImage' in m, false);
});

test('override > style > app defaults, per field', () => {
  const overrides: Record<string, IconOverride> = {
    music: {
      label: 'Tunes',
      glyph: 'headphones',
      glyphColour: '#000000',
      background: { kind: 'gradient', from: '#FFFFFF', to: '#EEEEEE', angle: 45 },
      shape: 'blob',
      showLabel: false,
      glyphScale: 0.8,
      overrideImage: 'file:///photo.png',
    },
    notes: { glyphColour: '#111111' },
  };
  const [m, n, mail] = resolveSpecs(apps, style, overrides);
  assert.equal(m.label, 'Tunes');
  assert.equal(m.glyph, 'headphones');
  assert.equal(m.glyphColour, '#000000');
  assert.deepEqual(m.background, { kind: 'gradient', from: '#FFFFFF', to: '#EEEEEE', angle: 45 });
  assert.equal(m.shape, 'blob');
  assert.equal(m.showLabel, false);
  assert.equal(m.glyphScale, 0.8);
  assert.equal(m.overrideImage, 'file:///photo.png');
  // partial override: only glyphColour changes
  assert.equal(n.glyphColour, '#111111');
  assert.equal(n.label, 'Notes');
  assert.equal(n.glyph, 'edit');
  assert.equal(n.shape, 'squircle');
  assert.deepEqual(n.background, style.background);
  // untouched app
  assert.equal(mail.glyphColour, '#FFFFFF');
});

test('blank override strings fall back; showLabel false override is respected', () => {
  const s = resolveSpec(apps[0], style, { label: '   ', glyph: '', showLabel: false });
  assert.equal(s.label, 'Music');
  assert.equal(s.glyph, 'music');
  assert.equal(s.showLabel, false);
});

test('overrides for unknown apps are ignored and order follows apps', () => {
  const specs = resolveSpecs(apps, style, { ghost: { label: 'Ghost' } });
  assert.deepEqual(specs.map((s) => s.appId), ['music', 'notes', 'mail']);
  assert.ok(specs.every((s) => s.label !== 'Ghost'));
});

test('installMethodFor: profile with a URL scheme, Shortcuts without', () => {
  const [m, n] = resolveSpecs(apps, style);
  assert.equal(installMethodFor(m), 'profile');
  assert.equal(installMethodFor(n), 'shortcuts');
  assert.equal(installMethodFor({ urlScheme: '  ' }), 'shortcuts');
});

test('contrast ratio and warnings', () => {
  assert.equal(Math.round(contrastRatio('#000', '#FFFFFF')! * 10) / 10, 21);
  assert.equal(contrastRatio('#fff', '#fff'), 1);
  assert.equal(contrastRatio('plum', '#fff'), null);
  const specs = resolveSpecs(apps, style, {
    music: { glyphColour: '#FFFFFF', background: { kind: 'gradient', from: '#000000', to: '#F0F0F0', angle: 0 } },
    notes: { glyphColour: '#FFFFFF', background: { kind: 'glass', tint: '#FAFAFA', opacity: 0.5 }, overrideImage: 'x.png' },
  });
  assert.ok(specContrast(specs[0])! < 3);
  assert.deepEqual(contrastWarnings(specs), ['music']);
});
