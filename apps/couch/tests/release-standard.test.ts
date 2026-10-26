/**
 * App Factory release standard (App-Projects docs/RELEASE_STANDARD.md, owner 25 Oct 2026; oversight D142-2).
 * Code-side tripwires for docs/RELEASE_CHECKLIST.md. Node built-ins only, so it runs under Jest and Bun.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUS_FOR_SALE } from '../src/core/forSale';
import { DEFAULT_VISIBILITY } from '../src/core/appVisibility';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('release standard 1: first launch', () => {
  it('app filters start off', () => {
    expect(DEFAULT_VISIBILITY.favouritesOnly).toBe(false);
    expect(DEFAULT_VISIBILITY.hidden).toEqual([]);
  });

  it('the first-launch language line is on the Remote screen', () => {
    expect(read('app/(tabs)/remote.tsx')).toMatch(/LanguageHint/);
  });
});

describe('release standard 2: purchases', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
  const iap = pkg.dependencies?.['expo-iap'];

  it('expo-iap, when present, is pinned to an exact version', () => {
    if (iap === undefined) return;
    expect(iap).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('Couch Plus is only for sale with a real, exactly pinned store library', () => {
    if (!PLUS_FOR_SALE) return;
    expect(iap).toBeDefined();
  });

  it('while nothing is for sale, purchase and test-build copy is only reachable behind plusForSale()', () => {
    if (PLUS_FOR_SALE) return;
    const plus = read('app/plus.tsx');
    // Every Buy / Restore path in the Plus screen sits inside a `forSale ? (...)` branch.
    expect(plus).toMatch(/const forSale = plusForSale\(\)/);
    const gated = (plus.match(/\{forSale \? \(/g) ?? []).length;
    expect(gated).toBeGreaterThanOrEqual(1);
    for (const screen of ['app/settings.tsx', 'app/themes.tsx']) {
      expect(read(screen)).toMatch(/plusForSale\(\)/);
    }
  });

  it('the store listing sells nothing and says so in the review notes', () => {
    if (PLUS_FOR_SALE) return;
    const listing = JSON.parse(read('store/listing.json')) as Record<string, unknown>;
    expect(listing.inAppPurchases).toBeUndefined();
    expect(String(listing.reviewNotes)).toMatch(/no in-app purchases/i);
    for (const k of ['description', 'promotionalText', 'whatsNew', 'subtitle']) {
      expect(String(listing[k] ?? '')).not.toMatch(/Couch Plus|in-app purchase|test build/i);
    }
  });
});
