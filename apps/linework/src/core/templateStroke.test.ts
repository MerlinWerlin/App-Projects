// fb-1017 F4: template line thickness. templateStroke lives in app/trace.tsx (mirrors the owner's PC copy);
// this test lifts its definitions out of the source and checks the maths and the wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEFAULT_STROKE_WIDTH } from './templates.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const trace = readFileSync(join(root, 'app', 'trace.tsx'), 'utf8');

function loadTemplateStroke(): (tpl: { strokeWidth?: number }, w: string) => number {
  const scale = /const LINE_SCALE: Record<LineWeight, number> = (\{[^}]*\});/.exec(trace);
  assert.ok(scale, 'LINE_SCALE present');
  const fn = /function templateStroke\(tpl: Template, w: LineWeight\): number \{\n\s*return ([^;]+);\n\}/.exec(trace);
  assert.ok(fn, 'templateStroke present');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('DEFAULT_STROKE_WIDTH', `const LINE_SCALE = ${scale[1]}; return (tpl, w) => ${fn[1]};`)(
    DEFAULT_STROKE_WIDTH,
  ) as (tpl: { strokeWidth?: number }, w: string) => number;
}

test('F4: templateStroke scales the template stroke (thick 1, medium 0.6, thin 0.35)', () => {
  const templateStroke = loadTemplateStroke();
  assert.equal(templateStroke({}, 'thick'), DEFAULT_STROKE_WIDTH);
  assert.ok(Math.abs(templateStroke({}, 'medium') - DEFAULT_STROKE_WIDTH * 0.6) < 1e-9);
  assert.ok(Math.abs(templateStroke({ strokeWidth: 6 }, 'thin') - 2.1) < 1e-9);
  assert.equal(templateStroke({ strokeWidth: 3 }, 'thick'), 3);
});

test('F4: trace wiring — weights, storage key, cycle order, Lines button before Mirror, Lightbox follows', () => {
  assert.match(trace, /type LineWeight = 'thick' \| 'medium' \| 'thin';/);
  assert.match(trace, /const LINE_WEIGHTS: LineWeight\[\] = \['thick', 'medium', 'thin'\];/);
  assert.match(trace, /const LINE_WEIGHT_KEY = 'linework\.templateLineWeight';/);
  assert.match(trace, /useState<LineWeight>\('thick'\)/);
  assert.match(trace, /strokeWidth=\{templateStroke\(steps\.template \?\? template, lineWeight\)\}/);
  const lines = trace.indexOf('icon="edit-2"');
  const mirror = trace.indexOf('icon="columns"');
  assert.ok(lines > 0 && lines < mirror, 'Lines button sits before Mirror');
  assert.match(trace, /active=\{lineWeight !== 'thick'\}/);
  const lb = readFileSync(join(root, 'app', 'lightbox.tsx'), 'utf8');
  assert.match(lb, /'linework\.templateLineWeight'/);
  assert.match(lb, /thick: 1, medium: 0\.6, thin: 0\.35/);
});
