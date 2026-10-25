import { MemoryKv, type KvStore } from '../core/library';
import { DAY_MS, FIRST_LAUNCH_KEY, TRIAL_DAYS, earliestStamp, parseStamp, resolveFirstLaunch, trialLabel, trialState } from './trial';

const T0 = Date.UTC(2026, 9, 25, 9, 0, 0);

class BrokenKv implements KvStore {
  async getItem(): Promise<string | null> {
    throw new Error('keychain unavailable');
  }
  async setItem(): Promise<void> {
    throw new Error('keychain unavailable');
  }
}

describe('trialState', () => {
  it('is a full 7 days at first launch', () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(trialState(T0, T0)).toEqual({ active: true, daysLeft: 7, endsAt: T0 + 7 * DAY_MS });
  });

  it('counts whole days left, rounding up', () => {
    expect(trialState(T0, T0 + 1).daysLeft).toBe(7);
    expect(trialState(T0, T0 + DAY_MS).daysLeft).toBe(6);
    expect(trialState(T0, T0 + 6 * DAY_MS + 1).daysLeft).toBe(1);
    expect(trialState(T0, T0 + 7 * DAY_MS - 1)).toMatchObject({ active: true, daysLeft: 1 });
  });

  it('ends exactly 7 days after the first launch', () => {
    expect(trialState(T0, T0 + 7 * DAY_MS)).toMatchObject({ active: false, daysLeft: 0 });
    expect(trialState(T0, T0 + 400 * DAY_MS)).toMatchObject({ active: false, daysLeft: 0 });
  });

  it('tolerates small clock jitter but not rolling the clock back to before the first launch', () => {
    expect(trialState(T0, T0 - 60_000)).toMatchObject({ active: true, daysLeft: 7 });
    expect(trialState(T0, T0 - 3 * DAY_MS)).toMatchObject({ active: false, daysLeft: 0 });
  });
});

describe('stamps', () => {
  it('parses only positive numbers', () => {
    expect(parseStamp(String(T0))).toBe(T0);
    expect(parseStamp(null)).toBeNull();
    expect(parseStamp('')).toBeNull();
    expect(parseStamp('nope')).toBeNull();
    expect(parseStamp('-5')).toBeNull();
    expect(parseStamp('0')).toBeNull();
  });

  it('picks the earliest valid stamp, or now when there is none', () => {
    expect(earliestStamp([T0 + 5, null, T0], T0 + 99)).toBe(T0);
    expect(earliestStamp([null, undefined], T0 + 99)).toBe(T0 + 99);
  });
});

describe('resolveFirstLaunch', () => {
  it('first launch: stamps now into both stores', async () => {
    const kv = new MemoryKv();
    const secure = new MemoryKv();
    expect(await resolveFirstLaunch(kv, secure, T0)).toBe(T0);
    expect(kv.data.get(FIRST_LAUNCH_KEY)).toBe(String(T0));
    expect(secure.data.get(FIRST_LAUNCH_KEY)).toBe(String(T0));
  });

  it('reinstall: kv is empty but the Keychain still has the old stamp, so the trial does not restart', async () => {
    const kv = new MemoryKv();
    const secure = new MemoryKv();
    await secure.setItem(FIRST_LAUNCH_KEY, String(T0));
    const first = await resolveFirstLaunch(kv, secure, T0 + 10 * DAY_MS);
    expect(first).toBe(T0);
    expect(kv.data.get(FIRST_LAUNCH_KEY)).toBe(String(T0));
    expect(trialState(first, T0 + 10 * DAY_MS).active).toBe(false);
  });

  it('uses the earliest of the two and repairs the later one', async () => {
    const kv = new MemoryKv();
    const secure = new MemoryKv();
    await kv.setItem(FIRST_LAUNCH_KEY, String(T0 - DAY_MS));
    await secure.setItem(FIRST_LAUNCH_KEY, String(T0));
    expect(await resolveFirstLaunch(kv, secure, T0 + DAY_MS)).toBe(T0 - DAY_MS);
    expect(secure.data.get(FIRST_LAUNCH_KEY)).toBe(String(T0 - DAY_MS));
  });

  it('falls back to kv only when there is no secure store (Expo Go) or it throws', async () => {
    const kv = new MemoryKv();
    await kv.setItem(FIRST_LAUNCH_KEY, String(T0));
    expect(await resolveFirstLaunch(kv, null, T0 + DAY_MS)).toBe(T0);
    expect(await resolveFirstLaunch(kv, new BrokenKv(), T0 + DAY_MS)).toBe(T0);
    const fresh = new MemoryKv();
    expect(await resolveFirstLaunch(fresh, new BrokenKv(), T0)).toBe(T0);
    expect(fresh.data.get(FIRST_LAUNCH_KEY)).toBe(String(T0));
  });

  it('ignores a corrupt stored value', async () => {
    const kv = new MemoryKv();
    await kv.setItem(FIRST_LAUNCH_KEY, 'garbage');
    expect(await resolveFirstLaunch(kv, null, T0)).toBe(T0);
    expect(kv.data.get(FIRST_LAUNCH_KEY)).toBe(String(T0));
  });
});

describe('trialLabel', () => {
  it('says how many days are left, singular on the last day, nothing after', () => {
    expect(trialLabel(trialState(T0, T0))).toEqual({ key: 'plus.trial.left', n: 7 });
    expect(trialLabel(trialState(T0, T0 + 6.5 * DAY_MS))).toEqual({ key: 'plus.trial.leftOne', n: 1 });
    expect(trialLabel(trialState(T0, T0 + 8 * DAY_MS))).toBeNull();
  });
});
