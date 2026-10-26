import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePetStatus, PETS } from './islandPets.ts';

test('native status decoder preserves session identity, pet and mood', () => {
  assert.deepEqual(decodePetStatus({ enabled: true, active: true, id: 'native-id', pet: 'fox', mood: 'sleepy', startedAt: 1793000000000 }),
    { enabled: true, session: { id: 'native-id', pet: 'fox', mood: 'sleepy', startedAt: 1793000000000 } });
  assert.deepEqual(decodePetStatus({ enabled: false, active: false }), { enabled: false, session: null });
});
test('malformed bridge replies cannot claim a pet is running or stopped', () => {
  for (const raw of [null, {}, { enabled: true }, { enabled: true, active: true, pet: 'dragon' },
    { enabled: true, active: true, id: 'a', pet: 'cat', mood: 'happy', startedAt: NaN }]) {
    assert.throws(() => decodePetStatus(raw));
  }
});
test('original pet silhouettes have a bounded square grid for the compact Island', () => {
  for (const p of PETS) {
    assert.equal(p.rows.length, 16);
    for (const row of p.rows) { assert.equal(row.length, 16); assert.match(row, /^[.#owe]+$/); }
  }
});
