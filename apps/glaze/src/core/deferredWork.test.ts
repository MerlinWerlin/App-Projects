// T250: the deferred-work queue (ordering, coalescing, crash retry, budget accounting).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_ATTEMPTS,
  TIMING_KEEP,
  chunked,
  createDeferredQueue,
  diagnosticsLine,
  mapInChunks,
  parseDeferredState,
  serializeDeferredState,
  slowestSteps,
  type DeferredHost,
} from './deferredWork.ts';

type Disk = { raw: string | null };

function host(disk: Disk, clock = { t: 1000 }, yields = { n: 0 }): DeferredHost {
  return {
    now: () => clock.t,
    yieldTurn: () => {
      yields.n++;
      return new Promise((r) => setImmediate(r));
    },
    load: async () => disk.raw,
    save: async (raw) => {
      disk.raw = raw;
    },
  };
}

test('nothing runs before start(); after start steps run one at a time by priority, then request order', async () => {
  const disk: Disk = { raw: null };
  const q = createDeferredQueue(host(disk));
  const log: string[] = [];
  let concurrent = 0;
  let maxConcurrent = 0;
  const step = (name: string, priority?: number) =>
    q.register(name, {
      priority,
      run: async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        log.push(`start ${name}`);
        await new Promise((r) => setImmediate(r));
        log.push(`end ${name}`);
        concurrent--;
      },
    });
  step('b');
  step('a');
  step('urgent', 10);
  q.request('b');
  q.request('a');
  q.request('urgent');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(log, [], 'launch path: requests only wait');
  assert.deepEqual(q.waiting(), ['urgent', 'b', 'a']);
  await q.start();
  await q.idle();
  assert.deepEqual(log, ['start urgent', 'end urgent', 'start b', 'end b', 'start a', 'end a']);
  assert.equal(maxConcurrent, 1);
  assert.deepEqual(q.pendingPersisted(), {});
});

test('duplicate requests are coalesced (latest arg wins); a request while running re-runs once after', async () => {
  const q = createDeferredQueue(host({ raw: null }));
  const seen: unknown[] = [];
  let release: (() => void) | null = null;
  q.register('art', {
    run: async (arg) => {
      seen.push(arg);
      if (seen.length === 1) await new Promise<void>((r) => (release = r));
    },
  });
  q.request('art', 'grove');
  q.request('art', 'alpine');
  q.request('art', 'firefly');
  assert.deepEqual(q.waiting(), ['art']);
  const started = q.start();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(q.running(), 'art');
  q.request('art', 'moon');
  q.request('art', 'moon2');
  release!();
  await started;
  await q.idle();
  assert.deepEqual(seen, ['firefly', 'moon2']);
});

test('a step interrupted by a crash runs again on the next launch, without its in-memory arg', async () => {
  const disk: Disk = { raw: null };
  const q1 = createDeferredQueue(host(disk));
  q1.register('probe', { run: () => new Promise(() => {}), timeoutMs: 80 }); // never finishes: the app "dies" mid-run
  q1.request('probe', { reason: 'apply' });
  void q1.start();
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  assert.equal(q1.running(), 'probe');
  assert.deepEqual(parseDeferredState(disk.raw).pending, { probe: 1 }, 'counted before it ran');

  // Next launch.
  const q2 = createDeferredQueue(host(disk));
  const got: { arg: unknown; resumed: boolean }[] = [];
  q2.register('probe', { run: (arg, ctx) => void got.push({ arg, resumed: ctx.resumed }) });
  await q2.start();
  await q2.idle();
  assert.deepEqual(got, [{ arg: undefined, resumed: true }]);
  assert.deepEqual(parseDeferredState(disk.raw).pending, {});
});

test('a failing step is caught, recorded, retried next launch, and dropped after MAX_ATTEMPTS', async () => {
  const disk: Disk = { raw: null };
  let runs = 0;
  let after = 0;
  for (let launch = 1; launch <= MAX_ATTEMPTS + 1; launch++) {
    const q = createDeferredQueue(host(disk));
    q.register('bad', {
      run: () => {
        runs++;
        throw new Error('boom');
      },
    });
    q.register('next', { run: () => void after++ });
    if (launch === 1) q.request('bad');
    q.request('next');
    await q.start();
    await q.idle();
    if (launch === MAX_ATTEMPTS + 1) assert.deepEqual(q.dropped(), [], 'already cleared after the last failure');
  }
  assert.equal(runs, MAX_ATTEMPTS, 'tried once per launch, then given up');
  assert.equal(after, MAX_ATTEMPTS + 1, 'a failure never stops the queue');
  assert.deepEqual(parseDeferredState(disk.raw).pending, {});
  assert.ok(parseDeferredState(disk.raw).timings.some((t) => t.name === 'bad' && !t.ok));
});

test('a step that keeps crashing the app is skipped at the launch after MAX_ATTEMPTS (no crash loop)', async () => {
  const disk: Disk = { raw: serializeDeferredState({ pending: { crashy: MAX_ATTEMPTS }, timings: [] }) };
  const q = createDeferredQueue(host(disk));
  let ran = 0;
  q.register('crashy', { run: () => void ran++ });
  q.request('crashy'); // this launch asks for it again
  await q.start();
  await q.idle();
  assert.equal(ran, 0);
  assert.deepEqual(q.dropped(), ['crashy']);
  assert.deepEqual(parseDeferredState(disk.raw).pending, {});
  // A later request this session (e.g. a new theme apply) still runs it.
  q.request('crashy');
  await q.idle();
  assert.equal(ran, 1);
});

test('steps from an older build that no longer exist are dropped quietly', async () => {
  const disk: Disk = { raw: serializeDeferredState({ pending: { gone: 1 }, timings: [] }) };
  const q = createDeferredQueue(host(disk));
  await q.start();
  await q.idle();
  assert.deepEqual(parseDeferredState(disk.raw).pending, {});
});

test('budget accounting: wall time per run, over-budget flag, last TIMING_KEEP kept, slowest first', async () => {
  const clock = { t: 0 };
  const disk: Disk = { raw: null };
  const q = createDeferredQueue(host(disk, clock));
  q.register('slow', { budgetMs: 100, run: () => void (clock.t += 400) });
  q.register('quick', { budgetMs: 100, run: () => void (clock.t += 5) });
  q.request('slow');
  q.request('quick');
  await q.start();
  await q.idle();
  const t = q.timings();
  assert.deepEqual(
    t.map((x) => [x.name, x.ms, x.overBudget, x.ok]),
    [
      ['slow', 400, true, true],
      ['quick', 5, false, true],
    ],
  );
  assert.equal(slowestSteps(t, 1)[0]!.name, 'slow');
  assert.equal(diagnosticsLine(t), 'Slowest: slow 400 ms, quick 5 ms');
  assert.equal(diagnosticsLine([]), '');
  // Persisted, so the next launch (after a crash) can still show them.
  assert.equal(parseDeferredState(disk.raw).timings.length, 2);
  for (let i = 0; i < TIMING_KEEP + 5; i++) {
    q.request('quick');
    await q.idle();
  }
  assert.equal(q.timings().length, TIMING_KEEP);
});

test('steps yield between each other and can yield inside (shouldYield / pause)', async () => {
  const clock = { t: 0 };
  const yields = { n: 0 };
  const q = createDeferredQueue(host({ raw: null }, clock, yields));
  let pauses = 0;
  q.register('chunky', {
    sliceMs: 10,
    run: async (_a, ctx) => {
      for (let i = 0; i < 6; i++) {
        clock.t += 6;
        if (ctx.shouldYield()) {
          pauses++;
          await ctx.pause();
        }
      }
    },
  });
  q.register('other', { run: () => undefined });
  q.request('chunky');
  q.request('other');
  await q.start();
  await q.idle();
  assert.equal(pauses, 3);
  assert.ok(yields.n >= pauses + 1, 'plus one between the two steps');
});

test('a step that never settles times out and the queue moves on', async () => {
  const q = createDeferredQueue(host({ raw: null }));
  let next = 0;
  q.register('hang', { timeoutMs: 20, run: () => new Promise(() => {}) });
  q.register('next', { run: () => void next++ });
  q.request('hang');
  q.request('next');
  await q.start();
  await q.idle();
  assert.equal(next, 1);
  assert.equal(q.timings().find((t) => t.name === 'hang')?.ok, false);
  assert.deepEqual(q.pendingPersisted(), { hang: 1 }, 'retried next launch');
});

test('non-persisted steps never reach storage', async () => {
  const disk: Disk = { raw: null };
  const q = createDeferredQueue(host(disk));
  q.register('session', { persist: false, run: () => new Promise(() => {}), timeoutMs: 80 });
  q.request('session');
  void q.start();
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  assert.deepEqual(parseDeferredState(disk.raw).pending, {});
});

test('state parsing is defensive and storage failures never throw', async () => {
  assert.deepEqual(parseDeferredState('nope'), { pending: {}, timings: [] });
  assert.deepEqual(parseDeferredState('{"pending":{"ok":1,"bad name!":2,"neg":-1},"timings":[{"x":1}]}').pending, { ok: 1 });
  const q = createDeferredQueue({
    now: () => 0,
    yieldTurn: () => Promise.reject(new Error('no')),
    load: () => Promise.reject(new Error('locked')),
    save: () => Promise.reject(new Error('full')),
  });
  let ran = 0;
  q.register('a', { run: () => void ran++ });
  q.register('b', { run: () => void ran++ });
  q.request('a');
  q.request('b');
  await q.start();
  await q.idle();
  assert.equal(ran, 2);
});

test('chunked / mapInChunks: fixed-size chunks with a pause between them', async () => {
  assert.deepEqual(chunked([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunked([], 10), []);
  assert.deepEqual(chunked([1, 2], 0), [[1], [2]]);
  let pauses = 0;
  const out = await mapInChunks(
    Array.from({ length: 25 }, (_, i) => i),
    10,
    (c) => c.map((x) => x * 2),
    async () => void pauses++,
  );
  assert.equal(out.length, 25);
  assert.equal(out[24], 48);
  assert.equal(pauses, 2);
});
