// T117 / D110-1: the baked template files equal what their generators produce, so the generator stays the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BAKED_SETS } from './sets.ts';
import { slimPath, slimTemplates } from './slim.ts';

for (const { name, file } of BAKED_SETS) {
  test(`baked/${file}.ts equals the ${file}.ts generator`, async () => {
    const gen = (await import(`../${file}.ts`))[name];
    const baked = (await import(`./${file}.ts`))[name];
    assert.ok(Array.isArray(gen) && gen.length > 0, `${file}.ts exports ${name}`);
    // Compare through JSON: the baked file is the JSON of the generated objects, straight-line runs thinned (slim.ts).
    assert.deepEqual(baked, JSON.parse(JSON.stringify(slimTemplates(gen))));
  });
}

test('slimPath thins straight runs only, keeps curves, ends and number text', () => {
  assert.equal(slimPath('M 0 0 L 10 0.1 L 20 0 L 30 0.2 L 40 0'), 'M 0 0 L 40 0');
  assert.equal(slimPath('M 0 0 L 10 5 L 20 0'), 'M 0 0 L 10 5 L 20 0');
  assert.equal(slimPath('M 0 0 C 1 2 3 4 5 6 L 10 6.1 L 20 6 Z'), 'M 0 0 C 1 2 3 4 5 6 L 20 6 Z');
  assert.equal(slimPath('M 0 0 A 5 5 0 1 0 10 0 Z'), 'M 0 0 A 5 5 0 1 0 10 0 Z');
  assert.equal(slimPath('m 0 0 l 10 0 l 10 0'), 'm 0 0 l 10 0 l 10 0');
});
