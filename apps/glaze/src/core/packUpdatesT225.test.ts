// T225: the pack-update retry wait survives an app restart (update-state.json format, pure), and
// Settings › Storage gets a clear one-line update status ("Updated 2 packs" / "All packs up to date").
// Decision recorded in packUpdates.ts: downloaded packs keep updating in the background whether or
// not Plus is owned; nothing here reads the entitlement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  PACK_UPDATE_RECENT_MS,
  PACK_UPDATE_RETRY_MAX_MS,
  PACK_UPDATE_RETRY_MS,
  PACK_UPDATE_STORE_VERSION,
  nextUpdateCheckAt,
  packUpdatePlan,
  packUpdateSummary,
  parsePackUpdateStore,
  prunePackUpdateFailures,
  recordPackUpdated,
  recordUpdateFailure,
  serializePackUpdateStore,
  updateRetryDue,
} from './packUpdates.ts';

const NOW = 1_800_000_000_000;
const pk = (id: string, packVersion: number, plus = false) => ({ id, packVersion, plus }) as never;

test('nextUpdateCheckAt: failure time plus the doubling backoff, capped at 6 h', () => {
  assert.equal(nextUpdateCheckAt({ at: NOW, attempts: 1, toVersion: 2 }), NOW + PACK_UPDATE_RETRY_MS);
  assert.equal(nextUpdateCheckAt({ at: NOW, attempts: 2, toVersion: 2 }), NOW + 2 * PACK_UPDATE_RETRY_MS);
  assert.equal(nextUpdateCheckAt({ at: NOW, attempts: 50, toVersion: 2 }), NOW + PACK_UPDATE_RETRY_MAX_MS);
});

test('store round trip: the retry wait survives a restart (same decision before and after)', () => {
  let f = recordUpdateFailure(null, NOW, 2);
  f = recordUpdateFailure(f, NOW + 1000, 2);
  const raw = serializePackUpdateStore({ failures: { a: f }, updated: { at: NOW - 5, count: 2 } });
  const json = JSON.parse(raw) as { v: number; failures: Record<string, { nextAt: number }> };
  assert.equal(json.v, PACK_UPDATE_STORE_VERSION);
  assert.equal(json.failures.a.nextAt, NOW + 1000 + 2 * PACK_UPDATE_RETRY_MS, 'next-allowed-check time is stored');
  const later = NOW + 1000 + 60_000; // "app restarted" a minute later
  const back = parsePackUpdateStore(raw, later);
  assert.deepEqual(back.failures.a, f);
  assert.deepEqual(back.updated, { at: NOW - 5, count: 2 });
  assert.equal(updateRetryDue(back.failures.a, later, 2), false, 'still waiting after the restart');
  assert.equal(updateRetryDue(back.failures.a, json.failures.a.nextAt, 2), true, 'due at nextAt');
  const catalog = { packs: [pk('a', 2)] };
  assert.deepEqual(packUpdatePlan({ catalog, versions: { a: 1 }, failures: back.failures, now: later }), []);
  assert.deepEqual(packUpdatePlan({ catalog, versions: { a: 1 }, failures: back.failures, now: json.failures.a.nextAt }), [{ id: 'a', from: 1, to: 2 }]);
});

test('parsePackUpdateStore: broken input gives the empty store, never throws', () => {
  for (const raw of [null, undefined, '', '{', 'null', '[]', '42', '"x"', '{"v":2,"failures":{"a":{"at":1,"attempts":1,"toVersion":2}}}', '{"failures":{}}']) {
    assert.deepEqual(parsePackUpdateStore(raw as string | null | undefined, NOW), { failures: {}, updated: null }, String(raw));
  }
});

test('parsePackUpdateStore: drops broken entries and keeps good ones', () => {
  const raw = JSON.stringify({
    v: 1,
    failures: {
      good: { at: NOW - 10, attempts: 1, toVersion: 3, nextAt: NOW - 10 + PACK_UPDATE_RETRY_MS },
      noNextAt: { at: NOW - 10, attempts: 2, toVersion: 3 },
      badAt: { at: 'x', attempts: 1, toVersion: 3 },
      badAttempts: { at: NOW, attempts: 0, toVersion: 3 },
      badVersion: { at: NOW, attempts: 1, toVersion: 1.5 },
      notObject: 7,
    },
    updated: { at: NOW, count: 0 },
  });
  const s = parsePackUpdateStore(raw, NOW);
  assert.deepEqual(Object.keys(s.failures).sort(), ['good', 'noNextAt']);
  assert.deepEqual(s.failures.noNextAt, { at: NOW - 10, attempts: 2, toVersion: 3 });
  assert.equal(s.updated, null, 'a zero count is not an update');
});

test('parsePackUpdateStore: a wait longer than the max backoff or a failure in the future is not honoured', () => {
  const raw = JSON.stringify({
    v: 1,
    failures: {
      far: { at: NOW - 1, attempts: 1, toVersion: 2, nextAt: NOW + PACK_UPDATE_RETRY_MAX_MS + 60_000 },
      future: { at: NOW + 3_600_000, attempts: 1, toVersion: 2 },
      ok: { at: NOW - 1, attempts: 30, toVersion: 2, nextAt: NOW - 1 + PACK_UPDATE_RETRY_MAX_MS },
    },
  });
  assert.deepEqual(Object.keys(parsePackUpdateStore(raw, NOW).failures), ['ok']);
});

test('serializePackUpdateStore: stable key order, empty store', () => {
  const f = { at: 1, attempts: 1, toVersion: 2 };
  assert.equal(serializePackUpdateStore({ failures: { b: f, a: f }, updated: null }), serializePackUpdateStore({ failures: { a: f, b: f }, updated: null }));
  assert.deepEqual(JSON.parse(serializePackUpdateStore({ failures: {}, updated: null })), { v: 1, failures: {}, updated: null });
});

test('prunePackUpdateFailures: removed packs and packs already at the target version drop their record', () => {
  const f = (toVersion: number) => ({ at: NOW, attempts: 1, toVersion });
  const out = prunePackUpdateFailures({ gone: f(2), done: f(2), past: f(2), waiting: f(3) }, { done: 2, past: 3, waiting: 2 });
  assert.deepEqual(Object.keys(out), ['waiting']);
});

test('recordPackUpdated: counts within 24 h, restarts after', () => {
  const a = recordPackUpdated(null, NOW);
  assert.deepEqual(a, { at: NOW, count: 1 });
  const b = recordPackUpdated(a, NOW + 1000);
  assert.deepEqual(b, { at: NOW + 1000, count: 2 });
  assert.deepEqual(recordPackUpdated(b, NOW + 1000 + PACK_UPDATE_RECENT_MS), { at: NOW + 1000 + PACK_UPDATE_RECENT_MS, count: 1 });
  assert.deepEqual(recordPackUpdated(b, NOW - 5), { at: NOW - 5, count: 1 }, 'clock went backwards');
});

test('packUpdateSummary: none / updating / failed / available / updated / upToDate', () => {
  const catalog = { packs: [pk('a', 2), pk('b', 3), pk('c', 1), pk('a', 9)] };
  assert.deepEqual(packUpdateSummary({ catalog: null, versions: { a: 1 }, now: NOW }), { kind: 'none' });
  assert.deepEqual(packUpdateSummary({ catalog, versions: {}, now: NOW }), { kind: 'none' }, 'nothing downloaded');
  assert.deepEqual(packUpdateSummary({ catalog, versions: { a: 2, b: 3 }, now: NOW }), { kind: 'upToDate' });
  assert.deepEqual(packUpdateSummary({ catalog, versions: { a: 1, b: 1 }, now: NOW }), { kind: 'available', count: 2 });
  assert.deepEqual(
    packUpdateSummary({ catalog, versions: { a: 1, b: 1 }, failures: { b: { at: NOW, attempts: 1, toVersion: 3 } }, now: NOW }),
    { kind: 'failed', count: 1 },
  );
  assert.deepEqual(
    packUpdateSummary({ catalog, versions: { a: 1, b: 1 }, failures: { b: { at: NOW, attempts: 1, toVersion: 2 } }, now: NOW }),
    { kind: 'available', count: 2 },
    'a failure aimed at an older version does not count',
  );
  assert.deepEqual(
    packUpdateSummary({ catalog, versions: { a: 1, b: 1 }, busy: { a: 0.2 }, failures: { b: { at: NOW, attempts: 1, toVersion: 3 } }, now: NOW }),
    { kind: 'updating', count: 1 },
  );
  assert.deepEqual(packUpdateSummary({ catalog, versions: { a: 2, c: 1 }, busy: { b: 0.5 }, now: NOW }), { kind: 'upToDate' }, 'a first download is not an update');
  const updated = { at: NOW - 1000, count: 2 };
  assert.deepEqual(packUpdateSummary({ catalog, versions: { a: 2, b: 3 }, updated, now: NOW }), { kind: 'updated', count: 2 });
  assert.deepEqual(packUpdateSummary({ catalog, versions: { a: 2, b: 3 }, updated, now: updated.at + PACK_UPDATE_RECENT_MS }), { kind: 'upToDate' }, 'after 24 h');
  assert.deepEqual(packUpdateSummary({ catalog, versions: { a: 1, b: 3 }, updated, now: NOW }), { kind: 'available', count: 1 }, 'pending work wins over the recent count');
});

test('T225 decision: background updates ignore Plus (a Plus pack on the phone updates like a free one)', () => {
  const catalog = { packs: [pk('free', 2, false), pk('plusPack', 2, true)] };
  assert.deepEqual(packUpdatePlan({ catalog, versions: { free: 1, plusPack: 1 }, now: NOW }), [
    { id: 'free', from: 1, to: 2 },
    { id: 'plusPack', from: 1, to: 2 },
  ]);
  const src = readFileSync(join(dirname(new URL(import.meta.url).pathname), 'packUpdates.ts'), 'utf8');
  assert.ok(!/from ['"][^'"]*plus\//.test(src), 'packUpdates.ts must not import from src/plus');
  assert.ok(/T225 DECISION/.test(src), 'the decision is recorded in a code comment');
});
