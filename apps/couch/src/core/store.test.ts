import { MemoryKv, STORE_KEY, SavedTvStore, parseDoc } from './store';
import type { Tv } from './types';

const tv = (id: string, extra: Partial<Tv> = {}): Tv => ({
  id,
  name: `TV ${id}`,
  model: 'Model',
  platform: 'roku',
  host: '192.168.1.10',
  ...extra,
});

describe('SavedTvStore', () => {
  it('adds, lists and persists a versioned JSON doc', async () => {
    const kv = new MemoryKv();
    const s = new SavedTvStore(kv, () => 100);
    await s.add(tv('a', { room: 'Lounge', mac: 'aa:bb:cc:dd:ee:ff' }));
    const list = await s.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'a', room: 'Lounge', mac: 'aa:bb:cc:dd:ee:ff', addedAt: 100, lastSeen: 100 });
    const raw = JSON.parse(kv.data.get(STORE_KEY)!);
    expect(raw.version).toBe(1);
    // A second store over the same KV sees the data.
    const s2 = new SavedTvStore(kv);
    expect((await s2.get('a'))?.name).toBe('TV a');
  });

  it('updates name/room/token and markSeen sets ip, mac and lastSeen', async () => {
    let t = 1;
    const s = new SavedTvStore(new MemoryKv(), () => t);
    await s.add(tv('a'));
    t = 5;
    await s.update('a', { name: 'Bedroom', room: 'Upstairs', token: 'tok' });
    await s.markSeen('a', { ip: '192.168.1.77', mac: '11:22:33:44:55:66' });
    const a = await s.get('a');
    expect(a).toMatchObject({ name: 'Bedroom', room: 'Upstairs', token: 'tok', host: '192.168.1.77', mac: '11:22:33:44:55:66', lastSeen: 5, addedAt: 1 });
    expect(await s.update('missing', { name: 'x' })).toBeNull();
  });

  it('re-adding the same id replaces it but keeps addedAt', async () => {
    let t = 1;
    const s = new SavedTvStore(new MemoryKv(), () => t);
    await s.add(tv('a'));
    t = 9;
    await s.add(tv('a', { name: 'New' }));
    const list = await s.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'New', addedAt: 1 });
  });

  it('tracks last used and pins, and remove clears them', async () => {
    const s = new SavedTvStore(new MemoryKv());
    await s.add(tv('a'));
    await s.add(tv('b'));
    await s.setLastUsed('b');
    await s.setLastUsed('nope'); // ignored
    expect(await s.lastUsedId()).toBe('b');
    await s.setPins('b', ['12', '13']);
    expect(await s.pins('b')).toEqual(['12', '13']);
    expect(await s.remove('b')).toBe(true);
    expect(await s.remove('b')).toBe(false);
    expect(await s.lastUsedId()).toBeNull();
    expect(await s.pins('b')).toEqual([]);
    expect((await s.list()).map((x) => x.id)).toEqual(['a']);
  });

  it('serialises concurrent writes', async () => {
    const s = new SavedTvStore(new MemoryKv());
    await Promise.all([s.add(tv('a')), s.add(tv('b')), s.add(tv('c'))]);
    expect((await s.list()).map((x) => x.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('parseDoc', () => {
  it('returns an empty doc for null, corrupt JSON and unknown versions', () => {
    expect(parseDoc(null).tvs).toEqual([]);
    expect(parseDoc('{oops').tvs).toEqual([]);
    expect(parseDoc(JSON.stringify({ version: 99, tvs: [tv('a')] })).tvs).toEqual([]);
  });

  it('drops invalid TVs and dangling references', () => {
    const doc = parseDoc(
      JSON.stringify({
        version: 1,
        tvs: [tv('a'), { id: 'bad' }],
        lastUsedId: 'gone',
        pinsByTv: { a: ['1', 2], gone: ['x'] },
      }),
    );
    expect(doc.tvs.map((t) => t.id)).toEqual(['a']);
    expect(doc.lastUsedId).toBeNull();
    expect(doc.pinsByTv).toEqual({ a: ['1'] });
  });
});

describe('IR TVs and saved pins', () => {
  it('round-trips irBrand / irSet through the stored JSON', async () => {
    const kv = new MemoryKv();
    const s = new SavedTvStore(kv);
    await s.add(tv('ir-1', { platform: 'ir', host: '', irBrand: 'LG', irSet: 1 }));
    const again = await new SavedTvStore(kv).get('ir-1');
    expect(again).toMatchObject({ platform: 'ir', irBrand: 'LG', irSet: 1 });
  });

  it('drops IR fields of the wrong type', () => {
    const doc = parseDoc(JSON.stringify({ version: 1, tvs: [{ ...tv('a'), irBrand: 3, irSet: '2' }] }));
    expect(doc.tvs[0]).not.toHaveProperty('irBrand');
    expect(doc.tvs[0]).not.toHaveProperty('irSet');
  });

  it('savedPins is null until pins are set, then survives a new store over the same KV', async () => {
    const kv = new MemoryKv();
    const s = new SavedTvStore(kv);
    await s.add(tv('a'));
    expect(await s.savedPins('a')).toBeNull();
    await s.setPins('a', []);
    expect(await s.savedPins('a')).toEqual([]);
    await s.setPins('a', ['12']);
    expect(await new SavedTvStore(kv).savedPins('a')).toEqual(['12']);
  });
});
