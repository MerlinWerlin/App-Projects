import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimLangHint, dismissLangHint, LANG_HINT_KEY } from './langHint.ts';

const mem = () => {
  const m = new Map<string, string>();
  return { m, get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => void m.set(k, v) };
};

test('language line shows on the first session only', async () => {
  const s = mem();
  assert.equal(await claimLangHint(s, true), true);
  assert.equal(s.m.get(LANG_HINT_KEY), 'shown');
  // next launch (intro now seen, flag stored)
  assert.equal(await claimLangHint(s, false), false);
  assert.equal(await claimLangHint(s, true), false);
});

test('tapping Change hides it for good', async () => {
  const s = mem();
  await dismissLangHint(s);
  assert.equal(await claimLangHint(s, true), false);
});

test('existing installs updating over the air never see it', async () => {
  const s = mem();
  assert.equal(await claimLangHint(s, false), false);
  assert.equal(await claimLangHint(s, true), false);
});

test('unreadable storage keeps it hidden; unwritable storage still shows it this session', async () => {
  const broken = { get: async () => { throw new Error('io'); }, set: async () => {} };
  assert.equal(await claimLangHint(broken, true), false);
  const readOnly = { get: async () => null, set: async () => { throw new Error('io'); } };
  assert.equal(await claimLangHint(readOnly, true), true);
  await dismissLangHint(readOnly); // never throws
});
