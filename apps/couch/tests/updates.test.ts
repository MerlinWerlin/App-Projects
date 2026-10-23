import { checkForQuietUpdate, reloadApp, _setUpdateDeps, type UpdatesLike } from '../src/native/updates';

const prodBuild = { executionEnvironment: 'standalone' };

function updates(over: Partial<UpdatesLike> = {}): UpdatesLike & { fetched: number } {
  const u = {
    isEnabled: true,
    fetched: 0,
    checkForUpdateAsync: async () => ({ isAvailable: true }),
    fetchUpdateAsync: async () => {
      u.fetched += 1;
      return {};
    },
    ...over,
  };
  return u;
}

afterEach(() => _setUpdateDeps());

describe('checkForQuietUpdate', () => {
  it('skips when expo-updates is not installed (default loader in tests)', async () => {
    expect(await checkForQuietUpdate()).toBe('skipped');
  });

  it('skips when the loader returns null', async () => {
    _setUpdateDeps({ loadUpdates: () => null, isDev: () => false, loadConstants: () => prodBuild });
    expect(await checkForQuietUpdate()).toBe('skipped');
  });

  it('skips inside Expo Go', async () => {
    const u = updates();
    _setUpdateDeps({ loadUpdates: () => u, isDev: () => false, loadConstants: () => ({ executionEnvironment: 'storeClient' }) });
    expect(await checkForQuietUpdate()).toBe('skipped');
    expect(u.fetched).toBe(0);
  });

  it('skips in development', async () => {
    const u = updates();
    _setUpdateDeps({ loadUpdates: () => u, isDev: () => true, loadConstants: () => prodBuild });
    expect(await checkForQuietUpdate()).toBe('skipped');
    expect(u.fetched).toBe(0);
  });

  it('skips when updates are disabled', async () => {
    _setUpdateDeps({ loadUpdates: () => updates({ isEnabled: false }), isDev: () => false, loadConstants: () => prodBuild });
    expect(await checkForQuietUpdate()).toBe('skipped');
  });

  it('downloads an available update without reloading', async () => {
    let reloaded = false;
    const u = updates({ reloadAsync: async () => void (reloaded = true) });
    _setUpdateDeps({ loadUpdates: () => u, isDev: () => false, loadConstants: () => prodBuild });
    expect(await checkForQuietUpdate()).toBe('downloaded');
    expect(u.fetched).toBe(1);
    expect(reloaded).toBe(false);
  });

  it('works when expo-constants is missing', async () => {
    _setUpdateDeps({ loadUpdates: () => updates(), isDev: () => false, loadConstants: () => null });
    expect(await checkForQuietUpdate()).toBe('downloaded');
  });

  it('returns none when no update is available', async () => {
    const u = updates({ checkForUpdateAsync: async () => ({ isAvailable: false }) });
    _setUpdateDeps({ loadUpdates: () => u, isDev: () => false, loadConstants: () => prodBuild });
    expect(await checkForQuietUpdate()).toBe('none');
    expect(u.fetched).toBe(0);
  });

  it('returns error when the check throws', async () => {
    const u = updates({
      checkForUpdateAsync: async () => {
        throw new Error('offline');
      },
    });
    _setUpdateDeps({ loadUpdates: () => u, isDev: () => false, loadConstants: () => prodBuild });
    expect(await checkForQuietUpdate()).toBe('error');
  });

  it('returns error when the download throws', async () => {
    const u = updates({
      fetchUpdateAsync: async () => {
        throw new Error('disk');
      },
    });
    _setUpdateDeps({ loadUpdates: () => u, isDev: () => false, loadConstants: () => prodBuild });
    expect(await checkForQuietUpdate()).toBe('error');
  });

  it('returns error when a loader throws', async () => {
    _setUpdateDeps({
      loadUpdates: () => {
        throw new Error('boom');
      },
    });
    expect(await checkForQuietUpdate()).toBe('error');
  });
});

describe('reloadApp', () => {
  it('uses Updates.reloadAsync when available', async () => {
    let n = 0;
    let dev = 0;
    _setUpdateDeps({ loadUpdates: () => ({ reloadAsync: async () => void (n += 1) }), loadDevSettings: () => ({ reload: () => void (dev += 1) }) });
    expect(await reloadApp()).toBe(true);
    expect(n).toBe(1);
    expect(dev).toBe(0);
  });

  it('falls back to DevSettings.reload when reloadAsync throws', async () => {
    let dev = 0;
    _setUpdateDeps({
      loadUpdates: () => ({
        reloadAsync: async () => {
          throw new Error('not supported in dev');
        },
      }),
      loadDevSettings: () => ({ reload: () => void (dev += 1) }),
    });
    expect(await reloadApp()).toBe(true);
    expect(dev).toBe(1);
  });

  it('falls back to DevSettings.reload when expo-updates is missing', async () => {
    let dev = 0;
    _setUpdateDeps({ loadUpdates: () => null, loadDevSettings: () => ({ reload: () => void (dev += 1) }) });
    expect(await reloadApp()).toBe(true);
    expect(dev).toBe(1);
  });

  it('returns false when nothing can reload', async () => {
    _setUpdateDeps({
      loadUpdates: () => null,
      loadDevSettings: () => ({
        reload: () => {
          throw new Error('no');
        },
      }),
    });
    expect(await reloadApp()).toBe(false);
    _setUpdateDeps({ loadUpdates: () => null, loadDevSettings: () => null });
    expect(await reloadApp()).toBe(false);
  });

  it('returns false with the default loaders in tests (no native modules)', async () => {
    expect(await reloadApp()).toBe(false);
  });
});
