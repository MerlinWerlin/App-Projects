import { DEMO_TV_APPS } from './demo';
import {
  FAVOURITES_CAP,
  FavouritesRepo,
  addFavourite,
  applyFavouriteEdit,
  canAddFavourite,
  canMoveFavourite,
  initialFavourites,
  isFavourite,
  moveFavourite,
  moveFavouriteTo,
  normaliseFavourites,
  reconcileFavourites,
  removeFavourite,
  sameFavourites,
  splitApps,
  toggleFavourite,
  type FavouritesBacking,
} from './favourites';
import { MemoryKv, SavedTvStore } from './store';
import type { Tv, TvApp } from './types';

const app = (id: string, name = id.toUpperCase(), pinned?: boolean): TvApp =>
  pinned === undefined ? { id, name } : { id, name, pinned };
const apps = (...ids: string[]) => ids.map((id) => app(id));
const many = (n: number) => Array.from({ length: n }, (_, i) => `a${i}`);

describe('normaliseFavourites', () => {
  it('rejects non-arrays', () => {
    expect(normaliseFavourites(null)).toEqual([]);
    expect(normaliseFavourites('a')).toEqual([]);
    expect(normaliseFavourites({ 0: 'a' })).toEqual([]);
  });
  it('drops non-strings, empty ids and duplicates, keeping first order', () => {
    expect(normaliseFavourites(['b', 1, '', 'a', 'b', null, 'c', 'a'])).toEqual(['b', 'a', 'c']);
  });
  it('applies the cap', () => {
    expect(normaliseFavourites(many(20))).toHaveLength(FAVOURITES_CAP);
    expect(normaliseFavourites(many(20), 3)).toEqual(['a0', 'a1', 'a2']);
  });
  it('the default cap is 12', () => {
    expect(FAVOURITES_CAP).toBe(12);
  });
});

describe('reconcileFavourites', () => {
  it('drops ids the TV no longer reports and keeps the order of the rest', () => {
    expect(reconcileFavourites(['c', 'gone', 'a', 'b'], apps('a', 'b', 'c'))).toEqual(['c', 'a', 'b']);
  });
  it('never adds favourites the user did not choose', () => {
    expect(reconcileFavourites([], apps('a', 'b'))).toEqual([]);
  });
  it('an empty app list empties the visible list', () => {
    expect(reconcileFavourites(['a'], [])).toEqual([]);
  });
  it('dedupes and caps', () => {
    const ids = many(15);
    expect(reconcileFavourites([...ids, ids[0]!], apps(...ids))).toEqual(ids.slice(0, 12));
  });
  it('does not mutate its input', () => {
    const favs = ['b', 'x'];
    reconcileFavourites(favs, apps('b'));
    expect(favs).toEqual(['b', 'x']);
  });
});

describe('initialFavourites', () => {
  it('uses the TV-pinned apps in list order when nothing was saved', () => {
    const list = [app('a', 'A', false), app('b', 'B', true), app('c', 'C', true)];
    expect(initialFavourites(null, list)).toEqual(['b', 'c']);
  });
  it('prefers a saved list, even an empty one', () => {
    const list = [app('a', 'A', true), app('b', 'B')];
    expect(initialFavourites(['b'], list)).toEqual(['b']);
    expect(initialFavourites([], list)).toEqual([]);
  });
  it('reconciles the saved list', () => {
    expect(initialFavourites(['gone', 'b'], apps('a', 'b'))).toEqual(['b']);
  });
  it('demo TV apps start with their pinned apps as favourites', () => {
    const favs = initialFavourites(null, DEMO_TV_APPS);
    expect(favs.length).toBeGreaterThan(0);
    expect(favs).toEqual(DEMO_TV_APPS.filter((a) => a.pinned).map((a) => a.id));
  });
});

describe('add / remove / toggle', () => {
  it('adds to the end', () => {
    expect(addFavourite(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('adding an existing favourite is a no-op', () => {
    expect(addFavourite(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });
  it('adding an empty id is a no-op', () => {
    expect(addFavourite(['a'], '')).toEqual(['a']);
  });
  it('respects the cap', () => {
    const full = many(FAVOURITES_CAP);
    expect(canAddFavourite(full)).toBe(false);
    expect(addFavourite(full, 'new')).toEqual(full);
    expect(canAddFavourite(full.slice(1))).toBe(true);
    expect(addFavourite(['a'], 'b', 1)).toEqual(['a']);
  });
  it('removes', () => {
    expect(removeFavourite(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
    expect(removeFavourite(['a'], 'zz')).toEqual(['a']);
  });
  it('toggles', () => {
    expect(toggleFavourite(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleFavourite(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleFavourite(many(12), 'x')).toEqual(many(12));
    expect(toggleFavourite(many(12), 'a3')).not.toContain('a3');
  });
  it('isFavourite', () => {
    expect(isFavourite(['a'], 'a')).toBe(true);
    expect(isFavourite(['a'], 'b')).toBe(false);
  });
  it('never mutates its input', () => {
    const favs = ['a', 'b'];
    addFavourite(favs, 'c');
    removeFavourite(favs, 'a');
    toggleFavourite(favs, 'b');
    moveFavourite(favs, 'a', 1);
    expect(favs).toEqual(['a', 'b']);
  });
});

describe('move', () => {
  const favs = ['a', 'b', 'c', 'd'];
  it('moves earlier and later by one', () => {
    expect(moveFavourite(favs, 'c', -1)).toEqual(['a', 'c', 'b', 'd']);
    expect(moveFavourite(favs, 'b', 1)).toEqual(['a', 'c', 'b', 'd']);
  });
  it('clamps at the ends', () => {
    expect(moveFavourite(favs, 'a', -1)).toEqual(favs);
    expect(moveFavourite(favs, 'd', 1)).toEqual(favs);
    expect(moveFavourite(favs, 'b', -10)).toEqual(['b', 'a', 'c', 'd']);
    expect(moveFavourite(favs, 'b', 10)).toEqual(['a', 'c', 'd', 'b']);
  });
  it('unknown id, zero or non-finite steps are no-ops', () => {
    expect(moveFavourite(favs, 'zz', 1)).toEqual(favs);
    expect(moveFavourite(favs, 'a', 0)).toEqual(favs);
    expect(moveFavourite(favs, 'a', Number.NaN)).toEqual(favs);
  });
  it('moveFavouriteTo moves by index, clamped', () => {
    expect(moveFavouriteTo(favs, 0, 3)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveFavouriteTo(favs, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveFavouriteTo(favs, -5, 99)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveFavouriteTo([], 0, 1)).toEqual([]);
    expect(moveFavouriteTo(favs, 2, 2)).toEqual(favs);
  });
  it('canMoveFavourite', () => {
    expect(canMoveFavourite(favs, 'a', -1)).toBe(false);
    expect(canMoveFavourite(favs, 'a', 1)).toBe(true);
    expect(canMoveFavourite(favs, 'd', 1)).toBe(false);
    expect(canMoveFavourite(favs, 'd', -1)).toBe(true);
    expect(canMoveFavourite(favs, 'zz', 1)).toBe(false);
    expect(canMoveFavourite(['a'], 'a', 1)).toBe(false);
  });
});

describe('applyFavouriteEdit', () => {
  it('dispatches each edit', () => {
    expect(applyFavouriteEdit(['a'], { kind: 'add', id: 'b' })).toEqual(['a', 'b']);
    expect(applyFavouriteEdit(['a', 'b'], { kind: 'remove', id: 'a' })).toEqual(['b']);
    expect(applyFavouriteEdit(['a'], { kind: 'toggle', id: 'a' })).toEqual([]);
    expect(applyFavouriteEdit(['a', 'b'], { kind: 'move', id: 'b', by: -1 })).toEqual(['b', 'a']);
    expect(applyFavouriteEdit(['a'], { kind: 'add', id: 'b' }, 1)).toEqual(['a']);
  });
  it('sameFavourites compares order', () => {
    expect(sameFavourites(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameFavourites(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameFavourites(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('splitApps', () => {
  const list = [app('z', 'Zed'), app('b', 'beta'), app('a', 'Alpha'), app('c', 'Gamma')];
  it('favourites first in user order, the rest alphabetical', () => {
    const { favourites, others } = splitApps(list, ['c', 'z']);
    expect(favourites.map((a) => a.id)).toEqual(['c', 'z']);
    expect(favourites.every((a) => a.pinned === true)).toBe(true);
    expect(others.map((a) => a.id)).toEqual(['a', 'b']);
    expect(others.every((a) => a.pinned === false)).toBe(true);
  });
  it('ignores missing and duplicate ids', () => {
    const { favourites, others } = splitApps(list, ['gone', 'a', 'a']);
    expect(favourites.map((a) => a.id)).toEqual(['a']);
    expect(others).toHaveLength(3);
  });
  it('ties on name fall back to id', () => {
    const { others } = splitApps([app('2', 'Same'), app('1', 'same')], []);
    expect(others.map((a) => a.id)).toEqual(['1', '2']);
  });
  it('does not mutate the apps', () => {
    const src = [app('a', 'A', false)];
    splitApps(src, ['a']);
    expect(src[0]!.pinned).toBe(false);
  });
});

describe('FavouritesRepo', () => {
  const tv = (id: string): Tv => ({ id, name: `TV ${id}`, model: 'M', platform: 'roku', host: '192.168.1.10' });

  it('persists per saved TV through SavedTvStore pins', async () => {
    const kv = new MemoryKv();
    const store = new SavedTvStore(kv);
    await store.add(tv('one'));
    await store.add(tv('two'));
    const repo = new FavouritesRepo(store);
    expect(await repo.load('one')).toBeNull();
    await repo.save('one', ['b', 'a']);
    await repo.save('two', ['c']);
    // A fresh repo + store over the same KV (app restart) reads them back per TV.
    const again = new FavouritesRepo(new SavedTvStore(kv));
    expect(await again.load('one')).toEqual(['b', 'a']);
    expect(await again.load('two')).toEqual(['c']);
    expect(again.peek('one')).toBeUndefined();
  });

  it('keeps demo / unsaved TVs in memory only', async () => {
    const kv = new MemoryKv();
    const repo = new FavouritesRepo(new SavedTvStore(kv));
    await repo.save('demo-1', ['x']);
    expect(repo.peek('demo-1')).toEqual(['x']);
    expect(await repo.load('demo-1')).toEqual(['x']);
    expect(await new FavouritesRepo(new SavedTvStore(kv)).load('demo-1')).toBeNull();
  });

  it('normalises what it saves and loads', async () => {
    const backing: FavouritesBacking = {
      savedPins: async () => ['a', 'a', 'b'],
      setPins: async () => {},
    };
    const repo = new FavouritesRepo(backing, 3);
    expect(await repo.load('t')).toEqual(['a', 'b']);
    await repo.save('t', ['1', '2', '3', '4', '1']);
    expect(repo.peek('t')).toEqual(['1', '2', '3']);
  });

  it('never throws on storage failures', async () => {
    const backing: FavouritesBacking = {
      savedPins: async () => {
        throw new Error('boom');
      },
      setPins: async () => {
        throw new Error('boom');
      },
    };
    const repo = new FavouritesRepo(backing);
    expect(await repo.load('t')).toBeNull();
    await expect(repo.save('t', ['a'])).resolves.toBeUndefined();
    expect(await repo.load('t')).toEqual(['a']);
  });

  it('an edit made while loading wins over the stored list', async () => {
    let release: (v: string[]) => void = () => {};
    const backing: FavouritesBacking = {
      savedPins: () => new Promise<string[]>((r) => (release = r)),
      setPins: async () => {},
    };
    const repo = new FavouritesRepo(backing);
    const pending = repo.load('t');
    await repo.save('t', ['new']);
    release(['old']);
    expect(await pending).toEqual(['new']);
  });

  it('peek returns a copy and clear forgets memory', async () => {
    const repo = new FavouritesRepo({ savedPins: async () => null, setPins: async () => {} });
    await repo.save('t', ['a']);
    repo.peek('t')!.push('b');
    expect(repo.peek('t')).toEqual(['a']);
    repo.clear('t');
    expect(repo.peek('t')).toBeUndefined();
    await repo.save('u', ['a']);
    repo.clear();
    expect(repo.peek('u')).toBeUndefined();
  });
});
