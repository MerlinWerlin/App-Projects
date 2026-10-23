import type { FetchLike, Transport, TvDriver, WsFactory } from './driver';
import { IrDriver } from './drivers/ir';
import { MockTv } from './drivers/mock';
import { RokuDriver } from './drivers/roku';
import { SamsungDriver } from './drivers/samsung';
import type { IrTransmitter } from './ir/transmitter';
import { connectRestored, orderSaved, restoreSaved } from './restore';
import { MemoryKv, SavedTvStore } from './store';
import type { Tv } from './types';

const fetch: FetchLike = async () => ({ status: 200, ok: true, text: async () => '' });
const ws: WsFactory = async () => {
  throw new Error('not used');
};
const ir: IrTransmitter = { transmit: async () => {} };

const roku: Tv = { id: 'roku-1', name: 'Lounge', model: 'Roku Ultra', platform: 'roku', host: '192.168.1.33' };
const mock: Tv = { id: 'mock-1', name: 'Demo', model: 'Demo TV', platform: 'mock', host: '192.168.1.41' };
const samsung: Tv = { id: 'samsung-1', name: 'Bedroom', model: 'QE55', platform: 'samsung', host: '192.168.1.50', token: 't' };
const irTv: Tv = { id: 'ir-1', name: 'Kitchen', model: 'LG TV (IR)', platform: 'ir', host: '', irBrand: 'LG', irSet: 1 };

async function storeWith(tvs: Tv[], lastUsed: string | null): Promise<SavedTvStore> {
  const s = new SavedTvStore(new MemoryKv());
  for (const t of tvs) await s.add(t);
  await s.setLastUsed(lastUsed);
  return s;
}

describe('orderSaved', () => {
  it('puts the last-used TV first and keeps the rest in order', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(orderSaved(list, 'c').map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(orderSaved(list, 'a').map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(orderSaved(list, null).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(orderSaved(list, 'gone').map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('restoreSaved', () => {
  it('roku + mock + samsung without ws: samsung is skipped (kept in the store), last used first', async () => {
    const store = await storeWith([roku, mock, samsung], 'mock-1');
    const r = await restoreSaved(store, { fetch });
    expect(r.tvs.map((t) => t.id)).toEqual(['mock-1', 'roku-1']);
    expect(r.drivers.get('mock-1')).toBeInstanceOf(MockTv);
    expect(r.drivers.get('roku-1')).toBeInstanceOf(RokuDriver);
    expect(r.skipped.map((t) => t.id)).toEqual(['samsung-1']);
    expect(r.tvs[0]).not.toHaveProperty('addedAt');
    expect((await store.list()).map((t) => t.id)).toEqual(['roku-1', 'mock-1', 'samsung-1']);
  });

  it('samsung is restored (with its token) once a ws factory exists', async () => {
    const store = await storeWith([roku, samsung], 'samsung-1');
    const r = await restoreSaved(store, { fetch, ws });
    expect(r.tvs.map((t) => t.id)).toEqual(['samsung-1', 'roku-1']);
    expect((r.drivers.get('samsung-1') as SamsungDriver).token).toBe('t');
    expect(r.skipped).toEqual([]);
  });

  it('IR TVs come back from irBrand/irSet when there is a transmitter, else are skipped', async () => {
    const store = await storeWith([irTv], null);
    const withIr = await restoreSaved(store, { fetch, ir });
    expect(withIr.drivers.get('ir-1')).toBeInstanceOf(IrDriver);
    expect(withIr.tvs[0]).toMatchObject({ irBrand: 'LG', irSet: 1 });
    const without = await restoreSaved(store, { fetch });
    expect(without.tvs).toEqual([]);
    expect(without.skipped.map((t) => t.id)).toEqual(['ir-1']);
  });

  it('never throws: a failing store restores nothing', async () => {
    const broken = {
      list: async () => {
        throw new Error('disk');
      },
      lastUsedId: async () => null,
    };
    const r = await restoreSaved(broken, { fetch });
    expect(r).toEqual({ tvs: [], drivers: new Map(), skipped: [] });
  });

  it('an empty store restores nothing', async () => {
    const t: Transport = {};
    const r = await restoreSaved(new SavedTvStore(new MemoryKv()), t);
    expect(r.tvs).toEqual([]);
  });
});

describe('connectRestored', () => {
  it('connects every driver and swallows failures', async () => {
    const calls: string[] = [];
    const ok = { connect: async () => void calls.push('ok') } as unknown as TvDriver;
    const bad = {
      connect: async () => {
        calls.push('bad');
        throw new Error('offline');
      },
    } as unknown as TvDriver;
    await expect(connectRestored(new Map([['a', ok], ['b', bad]]))).resolves.toBeUndefined();
    expect(calls.sort()).toEqual(['bad', 'ok']);
  });
});
