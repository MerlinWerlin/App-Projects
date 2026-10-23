// T117 / D110-1: the baked template files equal what their generators produce, so the generator stays the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BAKED_SETS } from './sets.ts';

for (const { name, file } of BAKED_SETS) {
  test(`baked/${file}.ts equals the ${file}.ts generator`, async () => {
    const gen = (await import(`../${file}.ts`))[name];
    const baked = (await import(`./${file}.ts`))[name];
    assert.ok(Array.isArray(gen) && gen.length > 0, `${file}.ts exports ${name}`);
    // Compare through JSON: the baked file is the JSON of the generated objects.
    assert.deepEqual(baked, JSON.parse(JSON.stringify(gen)));
  });
}
