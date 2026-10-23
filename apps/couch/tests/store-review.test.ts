/**
 * T75 (run 42): the rating prompt only ever uses the OS review sheet, checks isAvailableAsync first,
 * does nothing in Expo Go or without the module, and never throws. Pure TS + Node built-ins.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { _setStoreReviewDeps, requestStoreReview, type StoreReviewLike } from '../src/native/storeReview';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

function fake(available: boolean | 'throw', review: 'ok' | 'throw' = 'ok') {
  const calls: string[] = [];
  const mod: StoreReviewLike = {
    isAvailableAsync: async () => {
      calls.push('available');
      if (available === 'throw') throw new Error('x');
      return available;
    },
    requestReview: async () => {
      calls.push('review');
      if (review === 'throw') throw new Error('x');
    },
  };
  return { mod, calls };
}

afterEach(() => _setStoreReviewDeps());

describe('requestStoreReview', () => {
  it('is false when the module is missing (tests, Expo Go without it)', async () => {
    await expect(requestStoreReview()).resolves.toBe(false);
  });

  it('checks isAvailableAsync before requestReview', async () => {
    const f = fake(true);
    _setStoreReviewDeps({ loadStoreReview: () => f.mod, loadConstants: () => ({ executionEnvironment: 'standalone' }) });
    await expect(requestStoreReview()).resolves.toBe(true);
    expect(f.calls).toEqual(['available', 'review']);
  });

  it('does not request when unavailable, and never throws', async () => {
    for (const [avail, rev] of [[false, 'ok'], ['throw', 'ok'], [true, 'throw']] as const) {
      const f = fake(avail, rev);
      _setStoreReviewDeps({ loadStoreReview: () => f.mod, loadConstants: () => null });
      await expect(requestStoreReview()).resolves.toBe(false);
      if (avail !== true) expect(f.calls).not.toContain('review');
    }
  });

  it('does nothing inside Expo Go (never asks to rate Expo Go)', async () => {
    const f = fake(true);
    _setStoreReviewDeps({ loadStoreReview: () => f.mod, loadConstants: () => ({ executionEnvironment: 'storeClient' }) });
    await expect(requestStoreReview()).resolves.toBe(false);
    expect(f.calls).toEqual([]);
  });

  it('a loader that throws is treated as missing', async () => {
    _setStoreReviewDeps({
      loadStoreReview: () => {
        throw new Error('native module missing');
      },
    });
    await expect(requestStoreReview()).resolves.toBe(false);
  });
});

describe('no pushy prompts (MARKET hate #8)', () => {
  it('the hook uses only the OS sheet: no Alert / own pre-prompt, no analytics', () => {
    const src = read('src/state/useRatingPrompt.ts');
    expect(src).toMatch(/requestReview:\s*requestStoreReview/);
    expect(src).not.toMatch(/\bAlert\b|\bModal\b|analytics|fetch\(/);
    expect(src).toMatch(/ratingScreenFromPath\(pathRef\.current\)/);
  });

  it('src/core/ratingPolicy.ts stays pure (no React Native / native imports)', () => {
    const src = read('src/core/ratingPolicy.ts');
    expect(src).not.toMatch(/from\s+['"](react|react-native|expo[^'"]*)['"]/);
    expect(src).not.toMatch(/from\s+['"][^'"]*\/native\//);
  });
});
