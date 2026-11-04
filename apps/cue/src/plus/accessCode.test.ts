import { MemoryKv } from '../core/library';
import { ACCESS_CODE_KEY, accessCodeDigest, createCodeAccess } from './accessCode';
import { ENTITLEMENT_KEY } from './entitlement';
import { TRIAL_KEY } from './trial';

const code = 'CUE-TEST-FIXTURE-NOT-A-REAL-CODE';
const digest = accessCodeDigest(code);
test('reusable code persists across restart without expiry, purchase, trial or network', async () => {
  const kv = new MemoryKv();
  await kv.setItem(ENTITLEMENT_KEY, 'paid-state');
  await kv.setItem(TRIAL_KEY, 'expired-trial');
  expect(await createCodeAccess(kv, digest).read()).toBe(false);
  expect(await createCodeAccess(kv, digest).activate(` ${code.toLowerCase()} `)).toBe(true);
  expect(await createCodeAccess(kv, digest).read()).toBe(true);
  expect(await createCodeAccess(new MemoryKv(), digest).activate(code)).toBe(true);
  expect(kv.data.get(ENTITLEMENT_KEY)).toBe('paid-state');
  expect(kv.data.get(TRIAL_KEY)).toBe('expired-trial');
  expect(kv.data.get(ACCESS_CODE_KEY)).toBe(digest);
});
test('invalid, empty, corrupt and failed storage cannot grant access', async () => {
  const kv = new MemoryKv(), access = createCodeAccess(kv, digest);
  for (const value of ['', 'wrong', code + 'x', 'x'.repeat(129)]) expect(await access.activate(value)).toBe(false);
  await kv.setItem(ACCESS_CODE_KEY, 'true');
  expect(await access.read()).toBe(false);
  const broken = createCodeAccess({ getItem: async () => { throw Error('read'); }, setItem: async () => { throw Error('write'); } }, digest);
  expect(await broken.read()).toBe(false);
  expect(await broken.activate(code)).toBe(false);
});
test('removing complimentary access preserves paid ownership and trial; code remains reusable', async () => {
  const kv = new MemoryKv(), access = createCodeAccess(kv, digest);
  await kv.setItem(ENTITLEMENT_KEY, 'paid-state');
  await kv.setItem(TRIAL_KEY, 'original-trial');
  await access.activate(code);
  expect(await access.remove()).toBe(true);
  expect(await access.read()).toBe(false);
  expect(kv.data.get(ENTITLEMENT_KEY)).toBe('paid-state');
  expect(kv.data.get(TRIAL_KEY)).toBe('original-trial');
  expect(await access.activate(code)).toBe(true);
});
