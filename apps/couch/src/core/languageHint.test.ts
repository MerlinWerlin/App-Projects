import { LANGUAGE_HINT_KEY, LanguageHint } from './languageHint';
import { MemoryKv, type KvStore } from './store';

describe('first-launch language line (show once)', () => {
  it('shows in the first session and writes the seen flag at once', async () => {
    const kv = new MemoryKv();
    const hint = new LanguageHint(kv);
    expect(hint.getState()).toBe('loading');
    expect(hint.visible()).toBe(false);
    await hint.start();
    expect(hint.visible()).toBe(true);
    expect(kv.data.get(LANGUAGE_HINT_KEY)).toBe('1');
  });

  it('never shows again after the first session', async () => {
    const kv = new MemoryKv();
    await new LanguageHint(kv).start();
    const next = new LanguageHint(kv);
    await next.start();
    expect(next.visible()).toBe(false);
    expect(next.getState()).toBe('hidden');
  });

  it('hides at once when Change is tapped, and stays hidden', async () => {
    const kv = new MemoryKv();
    const hint = new LanguageHint(kv);
    await hint.start();
    const seen: boolean[] = [];
    hint.subscribe(() => seen.push(hint.visible()));
    await hint.dismiss();
    expect(hint.visible()).toBe(false);
    expect(seen).toEqual([false]);
    const next = new LanguageHint(kv);
    await next.start();
    expect(next.visible()).toBe(false);
  });

  it('stays hidden when tapped before storage answers', async () => {
    let release: (v: string | null) => void = () => {};
    const kv: KvStore = {
      getItem: () => new Promise((r) => (release = r)),
      setItem: async () => {},
    };
    const hint = new LanguageHint(kv);
    const started = hint.start();
    await hint.dismiss();
    release(null);
    await started;
    expect(hint.visible()).toBe(false);
  });

  it('start() decides once per run', async () => {
    const kv = new MemoryKv();
    const hint = new LanguageHint(kv);
    await hint.start();
    await hint.start();
    expect(hint.visible()).toBe(true);
  });

  it('never throws and hides when storage fails', async () => {
    const kv: KvStore = {
      getItem: async () => {
        throw new Error('no storage');
      },
      setItem: async () => {
        throw new Error('no storage');
      },
    };
    const hint = new LanguageHint(kv);
    await expect(hint.start()).resolves.toBeUndefined();
    expect(hint.visible()).toBe(false);
    await expect(hint.dismiss()).resolves.toBeUndefined();
  });

  it('still shows when only the write fails', async () => {
    const kv: KvStore = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('full');
      },
    };
    const hint = new LanguageHint(kv);
    await hint.start();
    expect(hint.visible()).toBe(true);
  });
});
