import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cityCells, fetchCityElements, OVERPASS_URL } from './overpass.mjs';

const bbox = [10, -4, 12, -2];
const quiet = { sleep: async () => {}, log: () => {} };
const json = (data) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

test('four sequential requests cover the city and deduplicate shared edges by OSM type/id', async () => {
  assert.deepEqual(cityCells(bbox), [[10, -4, 11, -3], [11, -4, 12, -3], [10, -3, 11, -2], [11, -3, 12, -2]]);
  assert.throws(() => cityCells([12, -4, 10, -2]));
  const queries = [];
  let active = false;
  const result = await fetchCityElements(bbox, { ...quiet, fetchImpl: async (url, options) => {
    assert.equal(active, false);
    active = true;
    assert.equal(url, OVERPASS_URL);
    assert.equal(options.method, 'POST');
    const query = new URLSearchParams(options.body).get('data');
    assert.ok(query.includes('[timeout:60]'));
    queries.push(query);
    await Promise.resolve();
    active = false;
    return json({ elements: [{ type: 'node', id: 1 }, { type: 'way', id: 1 }], osm3s: { timestamp_osm_base: '2026-11-03T00:00:00Z' } });
  } });
  for (const [i, [w, s, e, n]] of cityCells(bbox).entries()) assert.ok(queries[i].includes(`(${s},${w},${n},${e})`));
  assert.equal(queries.length, 4);
  assert.deepEqual(result.elements, [{ type: 'node', id: 1 }, { type: 'way', id: 1 }]);
  assert.equal(result.receipts.length, 4);
  assert.ok(result.receipts.every((r) => r.osmTimestamp === '2026-11-03T00:00:00Z'));
});

test('HTTP 429 respects Retry-After and retries the same area before advancing', async () => {
  const waits = [];
  const bodies = [];
  const result = await fetchCityElements(bbox, { ...quiet, sleep: async (ms) => waits.push(ms), fetchImpl: async (_, options) => {
    bodies.push(options.body);
    return bodies.length === 1 ? new Response('busy', { status: 429, headers: { 'Retry-After': '45' } }) : json({ elements: [] });
  } });
  assert.equal(waits[0], 45000);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(bodies.length, 5);
  assert.equal(result.receipts[0].attempt, 2);
});

test('HTTP 200 with a runtime remark never becomes a partial city', async () => {
  let calls = 0;
  await assert.rejects(fetchCityElements(bbox, { ...quiet, label: 'Tokyo', fetchImpl: async () => {
    calls++;
    return json({ remark: 'runtime error: Query timed out', elements: [{ type: 'node', id: 99 }] });
  } }), /Tokyo POIs cell 1\/4.*attempt 3\/3: Overpass remark: runtime error/);
  assert.equal(calls, 3);
});

test('a later failed area rejects the whole city even after earlier successful areas', async () => {
  let calls = 0;
  await assert.rejects(fetchCityElements(bbox, { ...quiet, fetchImpl: async () => {
    calls++;
    return calls === 1 ? json({ elements: [{ type: 'node', id: 1 }] }) : new Response('busy', { status: 504 });
  } }), /cell 2\/4.*HTTP 504: busy/);
  assert.equal(calls, 4);
});

test('malformed responses fail and HTTP 400 is not retried', async () => {
  for (const data of [{}, { elements: {} }, { elements: [{ type: 'junk', id: 1 }] }]) {
    await assert.rejects(fetchCityElements(bbox, { ...quiet, fetchImpl: async () => json(data) }), /Invalid Overpass/);
  }
  let calls = 0;
  await assert.rejects(fetchCityElements(bbox, { ...quiet, fetchImpl: async () => {
    calls++;
    return new Response('parse error', { status: 400 });
  } }), /attempt 1\/3: HTTP 400: parse error/);
  assert.equal(calls, 1);
});

test('request timeout also covers a response body that stalls after HTTP headers', async () => {
  let calls = 0;
  await assert.rejects(fetchCityElements(bbox, { ...quiet, requestTimeoutMs: 5, fetchImpl: async (_, { signal }) => {
    calls++;
    return { ok: true, json: async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      signal.throwIfAborted();
      return { elements: [] };
    } };
  } }), /timeout/i);
  assert.equal(calls, 3);
});
