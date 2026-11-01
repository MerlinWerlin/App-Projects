// fb-1023 D (owner idea, "maybe"): mascot concepts. Concept only, so these are source guards:
// the three preview SVGs are small and self-contained, docs/MASCOT.md asks the owner question,
// and the real app icon config is untouched.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const path = (...p: string[]) => join(root, ...p);
const read = (...p: string[]) => readFileSync(path(...p), 'utf8');
const N = ['1', '2', '3'];

test('fb-1023 D: three mascot preview SVGs and icon SVGs exist, each under 8 KB', () => {
  for (const n of N) {
    for (const file of [`mascot-${n}.svg`, `mascot-${n}-icon.svg`]) {
      const p = path('docs', 'mascot', file);
      assert.ok(existsSync(p), `${file} exists`);
      assert.ok(statSync(p).size < 8 * 1024, `${file} is under 8 KB`);
    }
    const svg = read('docs', 'mascot', `mascot-${n}.svg`);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 240 240"/);
    assert.match(read('docs', 'mascot', `mascot-${n}-icon.svg`), /^<svg [^>]*viewBox="0 0 1024 1024"/);
  }
});

test('fb-1023 D: mascot SVGs are self-contained (no <image>, no external href/url, no <text>)', () => {
  for (const n of N) {
    for (const file of [`mascot-${n}.svg`, `mascot-${n}-icon.svg`]) {
      const svg = read('docs', 'mascot', file);
      assert.doesNotMatch(svg, /<image\b/i, `${file}: no <image>`);
      assert.doesNotMatch(svg, /<text\b/i, `${file}: no <text>`);
      assert.doesNotMatch(svg, /<(script|foreignObject|use)\b/i, `${file}: no script/foreignObject/use`);
      assert.doesNotMatch(svg, /href\s*=/i, `${file}: no href`);
      assert.doesNotMatch(svg, /url\(\s*['"]?(https?:|data:|\/\/)/i, `${file}: only local url(#id) refs`);
      assert.doesNotMatch(svg, /@import/i);
    }
  }
});

test('fb-1023 D: three distinct mascots (different previews)', () => {
  const svgs = N.map((n) => read('docs', 'mascot', `mascot-${n}.svg`));
  assert.equal(new Set(svgs).size, 3);
});

test('fb-1023 D: MASCOT.md has the three concepts, originality statement and the owner question', () => {
  const md = read('docs', 'MASCOT.md');
  assert.match(md, /Which mascot \(1, 2, 3 or none\)\?/);
  for (const name of ['Tessel', 'Latchling', 'Vitri']) assert.match(md, new RegExp(`## \\d\\. ${name}`));
  for (const n of N) assert.match(md, new RegExp(`mascot/mascot-${n}\\.(png|svg)`));
  assert.match(md, /## Originality/);
  assert.match(md, /Nothing changes in the app until you pick/);
  assert.match(read('docs', 'LICENSES.md'), /Mascot concepts/);
});

test('fb-1023 D / T199: no mascot is wired in; the icon is the Prism diamond from assets/brand', () => {
  const expo = JSON.parse(read('app.json')).expo;
  // History: the faceless glaze-pour tile (23 Oct), the plain Prism diamond (fb-1025 G, 25 Oct), Prism the little
  // prism creature (T190, 1 Nov morning), rejected the same day (T199, owner-1101d #2): back to the diamond.
  // Tessel, Latchling and Vitri were never picked: no icon, splash or plugin may point at any mascot.
  assert.equal(expo.icon, './assets/brand/icon.png');
  assert.equal(expo.ios?.icon, undefined);
  assert.equal(expo.android?.icon, undefined);
  assert.match(expo.android?.adaptiveIcon?.foregroundImage ?? '', /^\.\/assets\/brand\//);
  assert.doesNotMatch(read('app.json'), /mascot/i);
  assert.doesNotMatch(read('app.config.ts'), /mascot/i);
  assert.doesNotMatch(JSON.stringify(expo.plugins ?? []), /alternate-app-icons|mascot/i);
  // Not Tessel's face (its ink #1D1A21), and not the rejected creature (its ink #22184A).
  assert.doesNotMatch(read('assets', 'brand', 'icon.svg'), /#1D1A21|#22184A/i);
  assert.match(read('assets', 'brand', 'icon.svg'), /id="prism"/);
  assert.equal(read('assets', 'brand', 'icon.svg'), read('docs', 'mascot', 'previous-prism-diamond', 'icon.svg'));
});

test('T199: MASCOT.md records the creature rejection, the return to the diamond and the missing picked image', () => {
  const md = read('docs', 'MASCOT.md');
  assert.match(md, /## Decision \(owner-1101d #2, 1 Nov 2026, 10:31\): creature rejected, back to the Prism diamond/);
  assert.match(md, /docs\/mascot\/picked-prism\.png/);
  assert.match(md, /glaze-prism-image/);
  assert.match(md, /rejected-prism-creature/);
  assert.match(md, /Needs a new native build/);
  assert.match(md, /previous-prism-diamond/);
  assert.match(md, /previous-glaze-drip/);
  // The earlier decisions stay as a record.
  assert.match(md, /owner-1101 item 8/);
  assert.match(md, /## Earlier decision \(fb-1025 G, 25 Oct 2026\)/);
  assert.match(md, /Mascots 1 to 3 \(Tessel, Latchling, Vitri\) are not used/);
  for (const f of ['prism-icon.svg', 'prism-mascot.svg', 'prism-icon.png', 'prism-mascot.png', 'mascot.svg']) {
    assert.ok(existsSync(path('docs', 'mascot', 'rejected-prism-creature', f)), f);
  }
  assert.match(read('docs', 'LICENSES.md'), /prism creature/i);
});
