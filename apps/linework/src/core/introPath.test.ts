import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { INTRO_LINE_D, INTRO_MS, introLineLength, introSamples, startupReady, toViewBox } from './introPath.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('fb-1022c intro: the line is the logo line', () => {
  const svg = readFileSync(join(root, 'assets', 'brand', 'icon.svg'), 'utf8') + readFileSync(join(root, 'assets', 'brand', 'splash-icon-dark.svg'), 'utf8');
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  assert.ok(norm(svg).includes(norm(INTRO_LINE_D).replace(/^M /, 'M ')), 'brand SVG holds the same path');
});

test('fb-1022c intro: samples run from the line start to the pencil tip, evenly', () => {
  const s = introSamples(40);
  assert.equal(s.length, 40);
  const [sx, sy] = toViewBox([214, 760]);
  const [ex, ey] = toViewBox([662, 556]);
  assert.ok(Math.hypot(s[0]!.x - sx, s[0]!.y - sy) < 0.5);
  assert.ok(Math.hypot(s[39]!.x - ex, s[39]!.y - ey) < 0.5);
  const len = introLineLength();
  assert.ok(len > 900 && len < 1600, `length ${len}`);
  const steps = s.slice(1).map((p, i) => Math.hypot(p.x - s[i]!.x, p.y - s[i]!.y));
  const min = Math.min(...steps);
  const max = Math.max(...steps);
  assert.ok(max / min < 1.2, 'even spacing');
});

test('fb-1022c intro: same size as the native splash, which shows the pencil only', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
  const ui = readFileSync(join(root, 'src', 'ui', 'IntroDraw.tsx'), 'utf8');
  assert.match(ui, new RegExp(`INTRO_SIZE = ${splash.imageWidth};`));
  const svg = readFileSync(join(root, 'assets', 'brand', 'splash-icon.svg'), 'utf8');
  assert.ok(!svg.includes('M 214 760'), 'splash has no line (the app draws it)');
  assert.ok(svg.includes('translate(214 760) rotate(-38)'), 'pencil rests at the line start');
});

test('D111-2 intro: startup goes ahead when ready, or by the cap even if not', () => {
  assert.ok(INTRO_MS.maxWait <= 3000, 'cap is at most 3 s');
  assert.ok(INTRO_MS.maxWait > INTRO_MS.draw, 'cap lets the line finish drawing');
  assert.equal(startupReady(true, true, 0), true);
  assert.equal(startupReady(false, true, 0), false);
  assert.equal(startupReady(true, false, INTRO_MS.maxWait - 1), false);
  assert.equal(startupReady(false, false, INTRO_MS.maxWait), true);
  assert.equal(startupReady(false, false, 60000), true);
});

test('D111-2 intro: the root layout and intro never load the template catalogue, and the layout arms the cap', () => {
  const layout = readFileSync(join(root, 'app', '_layout.tsx'), 'utf8');
  const intro = readFileSync(join(root, 'src', 'ui', 'IntroDraw.tsx'), 'utf8');
  for (const src of [layout, intro]) {
    assert.ok(!/from ['"][^'"]*(templates|templateArt)[^'"]*['"]/.test(src), 'no catalogue import at startup');
  }
  assert.ok(layout.includes('startupReady(') && layout.includes('INTRO_MS.maxWait'), 'layout uses the startup cap');
});
