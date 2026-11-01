import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeToiletFocus, nextToiletFocus, parseToiletFocus, toiletIdOfPin } from './followups99.ts';
import { toiletLayerPins } from './maplayers.ts';

test('toiletIdOfPin: only saved-toilet pins (t:) give an id', () => {
  assert.equal(toiletIdOfPin('t:osm-node-42'), 'osm-node-42');
  assert.equal(toiletIdOfPin('t:'), null);
  assert.equal(toiletIdOfPin('w:pin1'), null);
  assert.equal(toiletIdOfPin('p:t:1'), null);
});

test('toilet focus token round-trips, keeps bars in the id, rejects junk', () => {
  const f = { nonce: 'abc-1', toiletId: 'node|7' };
  assert.deepEqual(parseToiletFocus(encodeToiletFocus(f)), f);
  for (const bad of [null, 3, '', '|x', 'x|', 'nobar', 'x'.repeat(401)]) assert.equal(parseToiletFocus(bad), null, String(bad));
});

test('nextToiletFocus: each token runs once; memory first, then the route param', () => {
  const a = encodeToiletFocus({ nonce: 'n1', toiletId: 'a' });
  const b = encodeToiletFocus({ nonce: 'n2', toiletId: 'b' });
  assert.deepEqual(nextToiletFocus([a, b], new Set()), { nonce: 'n1', toiletId: 'a' });
  assert.deepEqual(nextToiletFocus([a, b], new Set(['n1'])), { nonce: 'n2', toiletId: 'b' });
  assert.equal(nextToiletFocus([a, b], new Set(['n1', 'n2'])), null);
  assert.equal(nextToiletFocus([null, undefined, 'junk'], new Set()), null);
});

test('a saved toilet pin id leads back to the saved toilet', () => {
  const pins = toiletLayerPins([{ toilet: { id: 'node/9', lat: 35.0, lon: 135.7, name: 'Station' }, note: '', vote: null, savedAt: 1 }]);
  assert.equal(pins.length, 1);
  assert.equal(toiletIdOfPin(pins[0].id), 'node/9');
});
