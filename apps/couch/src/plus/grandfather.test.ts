/**
 * Grandfathering (owner decision 7 Nov 2026): anyone who had the free Couch 1.0.3 keeps the remote and casting.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  INSTALL_KEY,
  LEGACY_KEYS,
  appTransactionGrandfathered,
  looksLikeOldInstall,
  markLegacy,
  resolveInstallKind,
  type KvLike,
} from './grandfather';

function kv(initial: Record<string, string> = {}): KvLike & { data: Map<string, string>; writes: string[] } {
  const data = new Map(Object.entries(initial));
  const writes: string[] = [];
  return {
    data,
    writes,
    getItem: async (k) => (data.has(k) ? data.get(k)! : null),
    setItem: async (k, v) => {
      writes.push(k);
      data.set(k, v);
    },
  };
}

describe('resolveInstallKind', () => {
  it('a fresh install (nothing stored) is saved as fresh', async () => {
    const s = kv();
    expect(await resolveInstallKind(s)).toBe('fresh');
    expect(s.data.get(INSTALL_KEY)).toBe('fresh');
  });

  it('any key the 1.0.3 app writes means an update from the free app: legacy, saved', async () => {
    for (const k of LEGACY_KEYS) {
      const s = kv({ [k]: '{"x":1}' });
      expect({ k, kind: await resolveInstallKind(s) }).toEqual({ k, kind: 'legacy' });
      expect(s.data.get(INSTALL_KEY)).toBe('legacy');
    }
  });

  it('the decision is made once: this version writing the same keys later never makes a fresh install legacy', async () => {
    const s = kv();
    expect(await resolveInstallKind(s)).toBe('fresh');
    s.data.set('couch.rating', '{"version":1}');
    s.data.set('couch.languageHint.v1', '1');
    expect(await resolveInstallKind(s)).toBe('fresh');
  });

  it('asks for the marker and every old key in the same tick, before anything else can write', async () => {
    const asked: string[] = [];
    const slow: KvLike = {
      getItem: (k) => {
        asked.push(k);
        return new Promise((r) => setTimeout(() => r(null), 1));
      },
      setItem: async () => undefined,
    };
    const pending = resolveInstallKind(slow);
    expect(asked).toEqual([INSTALL_KEY, ...LEGACY_KEYS]);
    expect(await pending).toBe('fresh');
  });

  it('a saved legacy marker stays legacy even when the old keys are gone', async () => {
    expect(await resolveInstallKind(kv({ [INSTALL_KEY]: 'legacy' }))).toBe('legacy');
  });

  it('empty values do not count as old data', () => {
    expect(looksLikeOldInstall([null, '', '  '])).toBe(false);
    expect(looksLikeOldInstall([null, '1'])).toBe(true);
  });

  it('storage that cannot be read: fresh for this run, nothing saved (decided again next launch)', async () => {
    const broken: KvLike = {
      getItem: async () => {
        throw new Error('io');
      },
      setItem: async () => {
        throw new Error('io');
      },
    };
    expect(await resolveInstallKind(broken)).toBe('fresh');
    const writes: string[] = [];
    const halfBroken: KvLike = {
      getItem: async (k) => {
        if (k === INSTALL_KEY) return null;
        throw new Error('io');
      },
      setItem: async (k) => {
        writes.push(k);
      },
    };
    expect(await resolveInstallKind(halfBroken)).toBe('fresh');
    expect(writes).toEqual([]);
  });

  it('markLegacy upgrades a fresh marker and never throws', async () => {
    const s = kv({ [INSTALL_KEY]: 'fresh' });
    await markLegacy(s);
    expect(await resolveInstallKind(s)).toBe('legacy');
    await markLegacy({ getItem: async () => null, setItem: async () => Promise.reject(new Error('x')) });
  });

  it('LEGACY_KEYS are the keys the app really writes (src/core, src/plus at 1.0.3)', () => {
    const root = join(__dirname, '..', '..');
    const src = ['store', 'prefs', 'languageHint', 'ratingPolicy', 'appVisibility', 'sleepTimer', 'storeIcons']
      .map((f) => readFileSync(join(root, 'src/core', `${f}.ts`), 'utf8'))
      .join('\n');
    for (const k of LEGACY_KEYS) if (k !== 'couch.entitlement') expect({ k, found: src.includes(`'${k}'`) }).toEqual({ k, found: true });
  });
});

describe('appTransactionGrandfathered (App Store AppTransaction, optional)', () => {
  it('production build numbers up to 15 (1.0.3 was build 14) are grandfathered', () => {
    for (const v of ['1', '9', '14', '15']) expect({ v, g: appTransactionGrandfathered({ originalAppVersion: v, environment: 'Production' }) }).toEqual({ v, g: true });
    for (const v of ['16', '40']) expect({ v, g: appTransactionGrandfathered({ originalAppVersion: v, environment: 'Production' }) }).toEqual({ v, g: false });
  });

  it('version strings 1.0.3 or lower are grandfathered; 1.0.4 and up are not', () => {
    for (const v of ['1.0.3', '1.0.2', '1.0.1', '1.0.0', '0.9', '1.0.3.1']) expect({ v, g: appTransactionGrandfathered({ originalAppVersion: v }) }).toEqual({ v, g: true });
    for (const v of ['1.0.4', '1.1', '1.1.0', '2.0']) expect({ v, g: appTransactionGrandfathered({ originalAppVersion: v }) }).toEqual({ v, g: false });
  });

  it('sandbox, TestFlight and Xcode never count, and their constant "1.0" is ignored everywhere', () => {
    for (const environment of ['Sandbox', 'Xcode', 'sandbox']) expect(appTransactionGrandfathered({ originalAppVersion: '14', environment })).toBe(false);
    expect(appTransactionGrandfathered({ originalAppVersion: '1.0', environment: 'Production' })).toBe(false);
    expect(appTransactionGrandfathered({ originalAppVersion: '1.0' })).toBe(false);
  });

  it('anything unexpected is not grandfathered', () => {
    for (const tx of [null, undefined, {}, { originalAppVersion: '' }, { originalAppVersion: 14 }, { originalAppVersion: 'abc' }, { originalAppVersion: '0' }]) {
      expect(appTransactionGrandfathered(tx as never)).toBe(false);
    }
  });
});
