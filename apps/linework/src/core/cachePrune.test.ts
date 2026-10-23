import test from 'node:test';
import assert from 'node:assert/strict';
import { filesToPrune, outlineNameTime } from './cachePrune.ts';

const e = (name: string, time: number) => ({ name, time });

test('filesToPrune keeps the newest N and returns the rest', () => {
  const entries = [e('a', 1), e('b', 5), e('c', 3), e('d', 4), e('e', 2)];
  assert.deepEqual(filesToPrune(entries, 2).sort(), ['a', 'c', 'e']);
});

test('filesToPrune returns nothing when at or under the limit', () => {
  assert.deepEqual(filesToPrune([], 10), []);
  assert.deepEqual(filesToPrune([e('a', 1), e('b', 2)], 2), []);
  assert.deepEqual(filesToPrune([e('a', 1)], 10), []);
});

test('filesToPrune with keep 0 or negative prunes everything', () => {
  assert.deepEqual(filesToPrune([e('a', 1), e('b', 2)], 0).sort(), ['a', 'b']);
  assert.deepEqual(filesToPrune([e('a', 1), e('b', 2)], -3).sort(), ['a', 'b']);
  assert.deepEqual(filesToPrune([e('a', 1)], Number.NaN), ['a']);
});

test('filesToPrune floors fractional keep', () => {
  assert.deepEqual(filesToPrune([e('a', 1), e('b', 2), e('c', 3)], 1.9).sort(), ['a', 'b']);
});

test('filesToPrune treats unknown times as oldest', () => {
  const entries = [e('x', Number.NaN), e('a', 1), e('b', 2)];
  assert.deepEqual(filesToPrune(entries, 2), ['x']);
});

test('filesToPrune breaks ties by name deterministically', () => {
  const entries = [e('outline-a-1.png', 7), e('outline-a-3.png', 7), e('outline-a-2.png', 7)];
  assert.deepEqual(filesToPrune(entries, 1), ['outline-a-2.png', 'outline-a-1.png']);
});

test('filesToPrune dedupes names and does not mutate input', () => {
  const entries = [e('a', 1), e('a', 9), e('b', 5)];
  const copy = entries.map((x) => ({ ...x }));
  assert.deepEqual(filesToPrune(entries, 1), ['b']);
  assert.deepEqual(entries, copy);
});

test('filesToPrune keeps 10 of 15', () => {
  const entries = Array.from({ length: 15 }, (_, i) => e(`f${String(i).padStart(2, '0')}`, i * 1000));
  const pruned = filesToPrune(entries, 10);
  assert.equal(pruned.length, 5);
  assert.deepEqual(pruned.sort(), ['f00', 'f01', 'f02', 'f03', 'f04']);
});

test('outlineNameTime parses the pipeline file name', () => {
  const ms = 1760000000000;
  assert.equal(outlineNameTime(`outline-${ms.toString(36)}-42.png`), ms);
  assert.equal(outlineNameTime('photo.png'), null);
  assert.equal(outlineNameTime('outline-xyz.png'), null);
  assert.equal(outlineNameTime(`outline-${ms.toString(36)}-1.jpg`), null);
});
