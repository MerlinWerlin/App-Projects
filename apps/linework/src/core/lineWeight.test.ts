import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_LINE_WEIGHT,
  LINE_SCALE,
  LINE_WEIGHTS,
  LINE_WEIGHT_KEY,
  isLineWeight,
  lineScale,
  nextLineWeight,
  parseLineWeight,
  templateStroke,
} from './lineWeight.ts';
import { DEFAULT_STROKE_WIDTH } from './templates.ts';

test('three weights, thick first and default', () => {
  assert.deepEqual([...LINE_WEIGHTS], ['thick', 'medium', 'thin']);
  assert.equal(DEFAULT_LINE_WEIGHT, 'thick');
});

test('storage key is unchanged since F4 (saved choices carry over)', () => {
  assert.equal(LINE_WEIGHT_KEY, 'linework.templateLineWeight');
});

test('scales get thinner in order and thick draws the template as designed', () => {
  assert.equal(LINE_SCALE.thick, 1);
  assert.ok(LINE_SCALE.thick > LINE_SCALE.medium && LINE_SCALE.medium > LINE_SCALE.thin && LINE_SCALE.thin > 0);
});

test('parse tolerates junk', () => {
  for (const w of LINE_WEIGHTS) assert.equal(parseLineWeight(w), w);
  for (const v of [null, undefined, '', 'THICK', 'bold', 3, {}]) assert.equal(parseLineWeight(v), 'thick');
  assert.equal(isLineWeight('thin'), true);
  assert.equal(isLineWeight('hairline'), false);
});

test('next cycles thick → medium → thin → thick', () => {
  assert.equal(nextLineWeight('thick'), 'medium');
  assert.equal(nextLineWeight('medium'), 'thin');
  assert.equal(nextLineWeight('thin'), 'thick');
});

test('Trace and Lightbox use the same key, weights and scales (their inline F4 copies)', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const trace = readFileSync(join(root, 'app', 'trace.tsx'), 'utf8');
  const lightbox = readFileSync(join(root, 'app', 'lightbox.tsx'), 'utf8');
  const scale = `thick: ${LINE_SCALE.thick}, medium: ${LINE_SCALE.medium}, thin: ${LINE_SCALE.thin}`;
  for (const src of [trace, lightbox]) {
    assert.ok(src.includes(`'${LINE_WEIGHT_KEY}'`), 'storage key');
    assert.ok(src.includes(scale), 'scales');
  }
  assert.ok(trace.includes(`['${LINE_WEIGHTS.join("', '")}']`), 'weight order');
});

test('template stroke uses the template width or the default', () => {
  assert.equal(templateStroke({ strokeWidth: 10 }, 'medium'), 10 * lineScale('medium'));
  assert.equal(templateStroke({}, 'thick'), DEFAULT_STROKE_WIDTH);
  assert.equal(templateStroke({}, 'thin'), DEFAULT_STROKE_WIDTH * LINE_SCALE.thin);
});
