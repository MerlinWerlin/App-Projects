import {
  MIN_DAYS_BETWEEN_ASKS,
  RATING_KEY,
  RatingController,
  SESSION_GAP_MS,
  emptyRatingState,
  markAsked,
  parseRatingState,
  ratingScreenFromPath,
  ratingVerdict,
  recordError,
  recordSuccess,
  serializeRatingState,
  shouldAskForRating,
  startSession,
  type RatingState,
} from './ratingPolicy';
import { MemoryKv, type KvStore } from './store';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_760_000_000_000;

/** n finished successful sessions, first launch at T0, plus an open session. */
function grown(n: number, open = { success: true, error: false }): RatingState {
  return { ...emptyRatingState(), firstLaunchAt: T0, successfulSessions: n, open };
}

const ctx = (days: number, over: Partial<{ appVersion: string; screen: 'remote' | 'addTv' | 'onboarding' | 'other' }> = {}) => ({
  now: T0 + days * DAY,
  appVersion: '1.0.0',
  screen: 'remote' as const,
  ...over,
});

describe('ratingVerdict', () => {
  it('asks after 7 days and 3 successful sessions (current one included)', () => {
    expect(ratingVerdict(grown(2), ctx(7))).toBe('ask');
    expect(shouldAskForRating(grown(2), ctx(30))).toBe(true);
  });

  it('waits 7 days after the first launch', () => {
    expect(ratingVerdict(grown(10), ctx(6.9))).toBe('too_soon');
    expect(ratingVerdict({ ...grown(10), firstLaunchAt: null }, ctx(100))).toBe('too_soon');
  });

  it('needs 3 successful sessions', () => {
    expect(ratingVerdict(grown(1), ctx(30))).toBe('few_sessions');
    expect(ratingVerdict(grown(0), ctx(30))).toBe('few_sessions');
  });

  it('never in a session with an error, or before a success this session', () => {
    expect(ratingVerdict(grown(5, { success: true, error: true }), ctx(30))).toBe('error_this_session');
    expect(ratingVerdict(grown(5, { success: false, error: false }), ctx(30))).toBe('no_success_now');
    expect(ratingVerdict({ ...grown(5), open: null }, ctx(30))).toBe('no_success_now');
  });

  it('only on the remote screen (never onboarding / add-TV)', () => {
    expect(ratingVerdict(grown(5), ctx(30, { screen: 'addTv' }))).toBe('wrong_screen');
    expect(ratingVerdict(grown(5), ctx(30, { screen: 'onboarding' }))).toBe('wrong_screen');
    expect(ratingVerdict(grown(5), ctx(30, { screen: 'other' }))).toBe('wrong_screen');
  });

  it('at most once per version, and not again within 90 days on a new version', () => {
    const asked = markAsked(grown(5), '1.0.0', T0 + 30 * DAY);
    expect(ratingVerdict(asked, ctx(400))).toBe('asked_this_version');
    expect(ratingVerdict(asked, ctx(31, { appVersion: '1.1.0' }))).toBe('asked_recently');
    expect(ratingVerdict(asked, ctx(30 + MIN_DAYS_BETWEEN_ASKS, { appVersion: '1.1.0' }))).toBe('ask');
  });
});

describe('session bookkeeping', () => {
  it('counts a finished session only if it had a success and no error', () => {
    let s = startSession(emptyRatingState(), T0);
    expect(s.firstLaunchAt).toBe(T0);
    s = startSession(recordSuccess(s), T0 + DAY); // success
    s = startSession(recordError(recordSuccess(s)), T0 + 2 * DAY); // success + error: not counted
    s = startSession(s, T0 + 3 * DAY); // nothing sent: not counted
    expect(s.successfulSessions).toBe(1);
    expect(s.firstLaunchAt).toBe(T0);
    expect(s.open).toEqual({ success: false, error: false });
  });

  it('round-trips and survives garbage', () => {
    const s = markAsked(grown(4), '2.0.0', T0);
    expect(parseRatingState(serializeRatingState(s))).toEqual(s);
    for (const raw of [null, '', '{', 'null', '[]', '{"version":99}', '{"version":1,"successfulSessions":-3,"askedVersions":[1,"a"]}']) {
      const p = parseRatingState(raw);
      expect(p.successfulSessions).toBeGreaterThanOrEqual(0);
      expect(p.askedVersions.every((v) => typeof v === 'string')).toBe(true);
    }
  });
});

describe('ratingScreenFromPath', () => {
  it('classifies Expo Router paths', () => {
    expect(ratingScreenFromPath('/remote')).toBe('remote');
    expect(ratingScreenFromPath('/(tabs)/remote')).toBe('remote');
    expect(ratingScreenFromPath('/add-tv')).toBe('addTv');
    expect(ratingScreenFromPath('/add-tv-ir')).toBe('addTv');
    expect(ratingScreenFromPath('/onboarding')).toBe('onboarding');
    expect(ratingScreenFromPath('/settings')).toBe('other');
    expect(ratingScreenFromPath('/apps')).toBe('other');
    expect(ratingScreenFromPath(null)).toBe('other');
  });
});

describe('RatingController', () => {
  function setup(opts: { kv?: KvStore; shown?: boolean | 'throw' } = {}) {
    const kv = opts.kv ?? new MemoryKv();
    let now = T0;
    let requests = 0;
    const c = () =>
      new RatingController({
        kv,
        now: () => now,
        appVersion: '1.0.0',
        requestReview: async () => {
          requests++;
          if (opts.shown === 'throw') throw new Error('boom');
          return opts.shown ?? true;
        },
      });
    return {
      kv,
      make: c,
      advance: (ms: number) => (now += ms),
      requests: () => requests,
    };
  }

  /** Simulates one cold launch with one key sent; returns the controller. */
  async function launch(env: ReturnType<typeof setup>, opts: { error?: boolean } = {}) {
    const c = env.make();
    await c.start();
    c.onSuccess();
    if (opts.error) c.onError();
    await c.start();
    return c;
  }

  it('asks once on the 3rd good launch after a week, and never again for this version', async () => {
    const env = setup();
    let c = await launch(env);
    expect(await c.maybeAsk('remote')).toBe('too_soon');
    env.advance(3 * DAY);
    c = await launch(env);
    expect(await c.maybeAsk('remote')).toBe('too_soon');
    env.advance(4 * DAY);
    c = await launch(env);
    expect(await c.maybeAsk('addTv')).toBe('wrong_screen');
    expect(await c.maybeAsk('remote')).toBe('ask');
    expect(env.requests()).toBe(1);
    expect(await c.maybeAsk('remote')).toBe('asked_this_version');
    env.advance(DAY);
    c = await launch(env);
    expect(await c.maybeAsk('remote')).toBe('asked_this_version');
    expect(env.requests()).toBe(1);
    expect(JSON.parse((await env.kv.getItem(RATING_KEY)) ?? '{}').askedVersions).toEqual(['1.0.0']);
  });

  it('a launch with an error neither counts nor asks', async () => {
    const env = setup();
    await launch(env);
    env.advance(DAY);
    await launch(env, { error: true });
    env.advance(DAY);
    let c = await launch(env);
    env.advance(7 * DAY);
    expect(await c.maybeAsk('remote')).toBe('few_sessions'); // 2 good so far (error one skipped)
    c = await launch(env, { error: true });
    expect(await c.maybeAsk('remote')).toBe('error_this_session');
    c = await launch(env);
    expect(await c.maybeAsk('remote')).toBe('ask');
  });

  it('does not use up the ask when the review sheet is unavailable', async () => {
    const env = setup({ shown: false });
    for (let i = 0; i < 3; i++) {
      await launch(env);
      env.advance(4 * DAY);
    }
    const c = await launch(env);
    expect(await c.maybeAsk('remote')).toBe('unavailable');
    expect(c.getState().askedVersions).toEqual([]);
    expect(parseRatingState(await env.kv.getItem(RATING_KEY)).askedVersions).toEqual([]);
  });

  it('treats a throwing review call as asked (polite side)', async () => {
    const env = setup({ shown: 'throw' });
    for (let i = 0; i < 3; i++) {
      await launch(env);
      env.advance(4 * DAY);
    }
    const c = await launch(env);
    expect(await c.maybeAsk('remote')).toBe('ask');
    expect(await c.maybeAsk('remote')).toBe('asked_this_version');
  });

  it('records events that arrive before storage has loaded', async () => {
    const env = setup();
    const c = env.make();
    c.onSuccess();
    await c.start();
    expect(c.getState().open).toEqual({ success: true, error: false });
  });

  it('a long time in the background starts a new session', async () => {
    const env = setup();
    const c = await launch(env);
    c.onBackground();
    env.advance(SESSION_GAP_MS - 1);
    expect(await c.resume()).toBe(false);
    expect(c.getState().open?.success).toBe(true);
    c.onBackground();
    env.advance(SESSION_GAP_MS);
    expect(await c.onForeground('remote')).toBe('new_session');
    expect(c.getState().successfulSessions).toBe(1);
    expect(c.getState().open).toEqual({ success: false, error: false });
  });

  it('never throws when storage fails', async () => {
    const broken: KvStore = {
      getItem: () => Promise.reject(new Error('no disk')),
      setItem: () => Promise.reject(new Error('no disk')),
    };
    const env = setup({ kv: broken });
    const c = await launch(env);
    c.onError();
    await expect(c.maybeAsk('remote')).resolves.toBe('error_this_session');
  });
});
