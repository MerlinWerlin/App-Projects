import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BURST_GAP_MS, formatDeferredDiagnostics, formatDuration, summarizeStartup, type StartupLineStrings } from './startupDiagnostics.ts';
import type { StepTiming } from './deferredWork.ts';

const run = (name: string, at: number, ms: number, ok = true): StepTiming => ({ name, at, ms, ok, budgetMs: 250, overBudget: ms > 250 });

const EN: StartupLineStrings = {
  line: ({ total, step, time }) => `Last launch: background work done in ${total} · slowest step: ${step} ${time}`,
  failed: ({ count }) => `steps that failed: ${count}`,
  empty: 'No startup data yet',
  duration: (d) => `${d.value} ${d.unit}`,
  step: (key, raw) => (key === 'packRestore' ? 'theme packs' : key === 'installedProbe' ? 'app check' : raw),
};

test('formatDuration: ms under a second, one-decimal seconds above', () => {
  assert.deepEqual(formatDuration(120.4), { unit: 'ms', value: 120 });
  assert.deepEqual(formatDuration(999), { unit: 'ms', value: 999 });
  assert.deepEqual(formatDuration(1000), { unit: 's', value: 1 });
  assert.deepEqual(formatDuration(1234), { unit: 's', value: 1.2 });
  assert.deepEqual(formatDuration(-5), { unit: 'ms', value: 0 });
  assert.deepEqual(formatDuration(Number.NaN), { unit: 'ms', value: 0 });
});

test('summarizeStartup: empty / junk input is null', () => {
  assert.equal(summarizeStartup([]), null);
  assert.equal(summarizeStartup(null), null);
  assert.equal(summarizeStartup(undefined), null);
  assert.equal(summarizeStartup([null, 3, { name: 'x' }, { name: 'y', ms: Number.NaN, at: 1 }]), null);
});

test('summarizeStartup: only the latest burst counts', () => {
  const t = [
    run('installedProbe', 0, 5000), // an older launch, slow
    run('packRestore', 100_000, 120),
    run('widgetTheme', 100_200, 40),
    run('installedProbe', 100_300, 80, false),
  ];
  const s = summarizeStartup(t);
  assert.ok(s);
  assert.equal(s.totalMs, 380);
  assert.deepEqual(s.slowest, { name: 'packRestore', key: 'packRestore', ms: 120, ok: true });
  assert.equal(s.failed, 1);
});

test('summarizeStartup: unsorted input and runs within the gap stay together', () => {
  const t = [run('widgetTheme', 1000 + BURST_GAP_MS, 30), run('packRestore', 0, 1000)];
  const s = summarizeStartup(t);
  assert.ok(s);
  assert.equal(s.totalMs, 1000 + BURST_GAP_MS + 30);
  assert.equal(s.slowest.name, 'packRestore');
});

test('summarizeStartup: unknown step names have no label key', () => {
  const s = summarizeStartup([run('somethingNew', 5, 10)]);
  assert.equal(s?.slowest.key, null);
  assert.equal(s?.slowest.name, 'somethingNew');
});

test('formatDeferredDiagnostics: the plain-words line', () => {
  const line = formatDeferredDiagnostics([run('packRestore', 0, 120), run('widgetTheme', 150, 40)], EN);
  assert.equal(line, 'Last launch: background work done in 190 ms · slowest step: theme packs 120 ms');
  const slow = formatDeferredDiagnostics([run('installedProbe', 0, 1450, false)], EN);
  assert.equal(slow, 'Last launch: background work done in 1.5 s · slowest step: app check 1.5 s · steps that failed: 1');
});

test('formatDeferredDiagnostics: empty text when nothing ran', () => {
  assert.equal(formatDeferredDiagnostics([], EN), 'No startup data yet');
  assert.equal(formatDeferredDiagnostics(null, EN), 'No startup data yet');
});

test('formatDeferredDiagnostics: never throws, even with throwing strings', () => {
  const bad: StartupLineStrings = {
    ...EN,
    line: () => {
      throw new Error('boom');
    },
  };
  assert.equal(formatDeferredDiagnostics([run('packRestore', 0, 1)], bad), 'No startup data yet');
  const worse = {
    ...bad,
    get empty(): string {
      throw new Error('boom');
    },
  } as StartupLineStrings;
  assert.equal(formatDeferredDiagnostics([run('packRestore', 0, 1)], worse), '');
});
