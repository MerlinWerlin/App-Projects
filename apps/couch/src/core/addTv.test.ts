import {
  ADD_TV_IR_ROUTE,
  DEMO_CANDIDATES,
  SUPPORTED_PLATFORMS,
  addTvReducer,
  createAddTvState,
  isSupported,
  nextTvName,
  routeFor,
  demoScan,
  driverFor,
  finishAddTv,
  foundLabel,
  initialAddTvState,
  pairStepFor,
  pskRejected,
  tvIdFor,
  type AddCandidate,
  type AddTvEvent,
  type AddTvState,
} from './addTv';
import type { FetchLike, WsFactory } from './driver';
import { IrDriver } from './drivers/ir';
import { MockTv } from './drivers/mock';
import { RokuDriver } from './drivers/roku';
import { SonyDriver } from './drivers/sony';
import { RemoteSession } from './session';
import { MemoryKv, SavedTvStore } from './store';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const noSleep = async (): Promise<void> => {};
const run = (s: AddTvState, ...events: AddTvEvent[]): AddTvState => events.reduce(addTvReducer, s);
const mockOpts = { sleep: noSleep, random: () => 0.5 };

function listState(): AddTvState {
  return run(initialAddTvState, ...DEMO_CANDIDATES.map((c): AddTvEvent => ({ type: 'found', candidate: { ...c } })), { type: 'scanDone' });
}

describe('pairStepFor', () => {
  it('maps platforms to pair steps', () => {
    expect(pairStepFor('roku')).toEqual({ kind: 'none' });
    expect(pairStepFor('mock')).toEqual({ kind: 'none' });
    expect(pairStepFor('samsung')).toMatchObject({ kind: 'prompt', message: 'Press Allow on your TV' });
    expect(pairStepFor('webos').kind).toBe('prompt');
    expect(pairStepFor('androidtv')).toMatchObject({ kind: 'code', length: 6, charset: 'hex' });
    expect(pairStepFor('firetv')).toMatchObject({ kind: 'code', length: 4, charset: 'digits' });
  });
});

describe('driverFor', () => {
  it('builds MockTv, RokuDriver, or null for coming-soon platforms', () => {
    const fetch: FetchLike = async () => ({ status: 200, ok: true, text: async () => '' });
    expect(driverFor({ platform: 'mock', host: '1.2.3.4' }, {})).toBeInstanceOf(MockTv);
    expect(driverFor({ platform: 'roku', host: '192.168.1.5' }, { fetch })).toBeInstanceOf(RokuDriver);
    expect(driverFor({ platform: 'roku', host: '192.168.1.5' }, {})).toBeNull();
    expect(driverFor({ platform: 'samsung', host: '192.168.1.5' }, { fetch })).toBeNull();
  });
});

describe('addTvReducer', () => {
  it('collects candidates while scanning, dedupes by host, then lists', () => {
    const c = DEMO_CANDIDATES[0]!;
    const s = run(initialAddTvState, { type: 'found', candidate: c }, { type: 'found', candidate: c });
    expect(s.step).toBe('scanning');
    expect(s.candidates).toHaveLength(1);
    expect(addTvReducer(s, { type: 'scanDone' }).step).toBe('list');
    expect(foundLabel(4)).toBe('Found 4 TVs');
    expect(foundLabel(1)).toBe('Found 1 TV');
  });

  it('prompt pair step: I pressed Allow -> name', () => {
    const s = run(listState(), { type: 'pick', host: '192.168.1.41' });
    expect(s.step === 'pair' && s.pair.kind).toBe('prompt');
    const n = addTvReducer(s, { type: 'paired' });
    expect(n.step).toBe('name');
    if (n.step === 'name') expect(n.name).toBe('TV 1');
  });

  it('code pair step validates and normalises a 6-hex code', () => {
    let s = run(listState(), { type: 'pick', host: '192.168.1.60' }, { type: 'codeChanged', code: 'a1-b2zz' });
    expect(s.step === 'pair' && s.code).toBe('A1B2');
    s = addTvReducer(s, { type: 'paired' });
    expect(s.step === 'pair' && s.error).toMatch(/6 characters/);
    s = run(s, { type: 'codeChanged', code: 'a1b2c3d4' }, { type: 'paired' });
    expect(s.step).toBe('name');
  });

  it('PIN pair step accepts 4 digits only', () => {
    let s = run(listState(), { type: 'pick', host: '192.168.1.71' }, { type: 'codeChanged', code: '12ab' });
    expect(s.step === 'pair' && s.code).toBe('12');
    s = run(s, { type: 'codeChanged', code: '123456' }, { type: 'paired' });
    expect(s.step).toBe('name');
  });

  it('no-pair step and back navigation', () => {
    const p = run(listState(), { type: 'pick', host: '192.168.1.33' });
    expect(p.step === 'pair' && p.pair.kind).toBe('none');
    const n = addTvReducer(p, { type: 'paired' });
    expect(addTvReducer(n, { type: 'back' }).step).toBe('list');
    const code = run(listState(), { type: 'pick', host: '192.168.1.60' }, { type: 'codeChanged', code: 'abcdef' }, { type: 'paired' });
    expect(addTvReducer(code, { type: 'back' }).step).toBe('pair');
  });

  it('unsupported platforms say coming soon', () => {
    const sam: AddCandidate = { platform: 'samsung', host: '192.168.1.80', model: 'Q80', source: 'ssdp' };
    const s = run(initialAddTvState, { type: 'found', candidate: sam }, { type: 'scanDone' }, { type: 'pick', host: '192.168.1.80' });
    expect(s.step).toBe('unsupported');
    if (s.step === 'unsupported') expect(s.message).toMatch(/coming soon/);
    expect(addTvReducer(s, { type: 'back' }).step).toBe('list');
  });

  it('manual IP: validates with parseManualIp, then probe result picks the TV', () => {
    let s = run(listState(), { type: 'manual' }, { type: 'ipChanged', ip: '8.8.8.8' }, { type: 'ipSubmit' });
    expect(s.step === 'manual' && s.error).toMatch(/home Wi-Fi/);
    s = run(s, { type: 'ipChanged', ip: 'http://192.168.1.99:8060/' }, { type: 'ipSubmit' });
    expect(s.step === 'manual' && s.probing).toBe(true);
    expect(s.step === 'manual' && s.ip).toBe('192.168.1.99');
    const miss = addTvReducer(s, { type: 'probeResult', candidate: null });
    expect(miss.step === 'manual' && miss.error).toMatch(/No TV answered/);
    const hit = addTvReducer(s, { type: 'probeResult', candidate: { platform: 'roku', host: '192.168.1.99', source: 'probe' } });
    expect(hit.step).toBe('pair');
    if (hit.step === 'pair') expect(hit.candidate.source).toBe('manual');
  });

  it('name step requires a name', () => {
    let s = run(listState(), { type: 'pick', host: '192.168.1.33' }, { type: 'paired' }, { type: 'nameChanged', name: '  ' }, { type: 'save' });
    expect(s.step === 'name' && s.error).toMatch(/name/);
    s = run(s, { type: 'nameChanged', name: 'Lounge' }, { type: 'save' });
    expect(s.step === 'name' && s.saving).toBe(true);
  });

  it('scan first: starts scanning; manual entry only on request, never automatically', () => {
    const s0 = createAddTvState({ takenNames: [], transport: { fetch: async () => ({ status: 200, ok: true, text: async () => '' }) } });
    expect(s0.step).toBe('scanning');
    const empty = addTvReducer(s0, { type: 'scanDone' });
    expect(empty.step).toBe('list');
    expect(empty.candidates).toHaveLength(0);
    // The "Still not listed? Enter its address" link: allowed from scanning, list and unsupported only.
    expect(addTvReducer(s0, { type: 'manual' }).step).toBe('manual');
    expect(addTvReducer(empty, { type: 'manual' }).step).toBe('manual');
    const pair = run(listState(), { type: 'pick', host: '192.168.1.33' });
    expect(addTvReducer(pair, { type: 'manual' })).toBe(pair);
  });

  it("'ir' entry routes to the IR setup screen and back returns to the list", () => {
    expect(routeFor(initialAddTvState)).toBeNull();
    const ir = addTvReducer(initialAddTvState, { type: 'ir' });
    expect(ir.step).toBe('ir');
    expect(routeFor(ir)).toBe('/add-tv-ir');
    expect(ADD_TV_IR_ROUTE).toBe('/add-tv-ir');
    expect(addTvReducer(listState(), { type: 'ir' }).step).toBe('ir');
    const back = addTvReducer(ir, { type: 'back' });
    expect(back.step).toBe('list');
    expect(routeFor(back)).toBeNull();
    const pair = run(listState(), { type: 'pick', host: '192.168.1.33' });
    expect(addTvReducer(pair, { type: 'ir' })).toBe(pair);
  });

  it('nextTvName picks the smallest unused "TV n"', () => {
    expect(nextTvName([])).toBe('TV 1');
    expect(nextTvName(['TV 1', 'Lounge'])).toBe('TV 2');
    expect(nextTvName(['tv 2', ' TV 1 ', 'TV 4'])).toBe('TV 3');
    expect(nextTvName(['TV 2'])).toBe('TV 1');
    expect(nextTvName(['TV 10', 'TV one'])).toBe('TV 1');
  });

  it('name step defaults to the next TV n given saved names, stays editable, and counts TVs added in this flow', () => {
    let s = createAddTvState({ takenNames: ['TV 1', 'Bedroom'] });
    s = run(s, ...DEMO_CANDIDATES.map((c): AddTvEvent => ({ type: 'found', candidate: { ...c } })), { type: 'scanDone' });
    s = run(s, { type: 'pick', host: '192.168.1.33' }, { type: 'paired' });
    expect(s.step === 'name' && s.name).toBe('TV 2');
    s = addTvReducer(s, { type: 'nameChanged', name: 'Kitchen' });
    expect(s.step === 'name' && s.name).toBe('Kitchen');
    const tv = { id: 'mock-x', name: 'TV 2', model: 'm', platform: 'mock' as const, host: '192.168.1.33' };
    s = run(s, { type: 'saved', tv }, { type: 'rescan' });
    expect(s.taken).toEqual(['TV 1', 'Bedroom', 'TV 2']);
    s = run(s, { type: 'found', candidate: { ...DEMO_CANDIDATES[2]! } }, { type: 'scanDone' }, { type: 'pick', host: '192.168.1.33' }, { type: 'paired' });
    expect(s.step === 'name' && s.name).toBe('TV 3');
  });

  it('takenNames arriving late refresh an unedited default name only', () => {
    let s = run(listState(), { type: 'pick', host: '192.168.1.33' }, { type: 'paired' });
    expect(s.step === 'name' && s.name).toBe('TV 1');
    s = addTvReducer(s, { type: 'takenNames', names: ['TV 1'] });
    expect(s.step === 'name' && s.name).toBe('TV 2');
    s = run(s, { type: 'nameChanged', name: 'Den' }, { type: 'takenNames', names: ['TV 2'] });
    expect(s.step === 'name' && s.name).toBe('Den');
  });

  it('samsung is coming soon without a ws factory, and pairs (Allow prompt) with one', () => {
    const fetch: FetchLike = async () => ({ status: 200, ok: true, text: async () => '' });
    const ws: WsFactory = async () => {
      throw new Error('unused');
    };
    const sam: AddCandidate = { platform: 'samsung', host: '192.168.1.80', model: 'Q80', source: 'ssdp' };
    const go = (transport: { fetch?: FetchLike; ws?: WsFactory }) =>
      run(createAddTvState({ transport }), { type: 'found', candidate: sam }, { type: 'scanDone' }, { type: 'pick', host: sam.host });
    expect(go({ fetch }).step).toBe('unsupported');
    const p = go({ fetch, ws });
    expect(p.step === 'pair' && p.pair.kind).toBe('prompt');
    expect(isSupported('samsung')).toBe(false);
    expect(isSupported('samsung', { fetch: true, ws: true })).toBe(true);
    expect(SUPPORTED_PLATFORMS.has('samsung')).toBe(true);
  });

  it('tvIdFor prefers the usn', () => {
    expect(tvIdFor({ platform: 'roku', host: '192.168.1.2', usn: 'uuid:roku:ecp:X1', source: 'ssdp' })).toBe('roku-uuid:roku:ecp:X1');
    expect(tvIdFor({ platform: 'mock', host: '192.168.1.2', source: 'probe' })).toBe('mock-192.168.1.2');
  });
});

describe('add-TV flow end to end with MockTv', () => {
  it('scan -> pick -> pair -> name -> saved in store -> active in session -> sendKey works', async () => {
    let s: AddTvState = initialAddTvState;
    const dispatch = (e: AddTvEvent): void => {
      s = addTvReducer(s, e);
    };
    await demoScan((c) => dispatch({ type: 'found', candidate: c }), { sleep: noSleep });
    dispatch({ type: 'scanDone' });
    expect(s.step).toBe('list');
    expect(s.candidates).toHaveLength(DEMO_CANDIDATES.length);

    dispatch({ type: 'pick', host: '192.168.1.60' });
    dispatch({ type: 'codeChanged', code: '1a2b3c' });
    dispatch({ type: 'paired', token: 'demo-token' });
    dispatch({ type: 'nameChanged', name: 'Lounge' });
    dispatch({ type: 'roomChanged', room: 'Downstairs' });
    dispatch({ type: 'save' });
    expect(s.step === 'name' && s.saving).toBe(true);

    const session = new RemoteSession(() => 1);
    const store = new SavedTvStore(new MemoryKv(), () => 42);
    if (s.step !== 'name') throw new Error('expected name step');
    dispatch(await finishAddTv(s, { transport: {}, session, store, now: () => 42, mock: mockOpts }));
    expect(s.step).toBe('saved');

    const saved = await store.list();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: 'mock-192.168.1.60', name: 'Lounge', room: 'Downstairs', host: '192.168.1.60', token: 'demo-token', lastSeen: 42, platform: 'mock' });
    expect(await store.lastUsedId()).toBe('mock-192.168.1.60');

    const snap = session.getSnapshot();
    expect(snap.activeId).toBe('mock-192.168.1.60');
    expect(session.activeTv()?.name).toBe('Lounge');
    expect(await session.sendKey('UP')).toBe(true);
    const driver = session.activeDriver() as MockTv;
    expect(driver.log.map((l) => l.what)).toEqual(['UP']);
  });

  it('a Roku added via manual IP records its MAC from device-info (fixture)', async () => {
    const xml = readFileSync(join(__dirname, 'drivers/__fixtures__/roku/device-info.xml'), 'utf8');
    const fetch: FetchLike = async (url) => {
      if (url.endsWith('/query/device-info')) return { status: 200, ok: true, text: async () => xml };
      return { status: 200, ok: true, text: async () => '' };
    };
    let s = run(initialAddTvState, { type: 'scanDone' }, { type: 'manual' }, { type: 'ipChanged', ip: '192.168.1.99' }, { type: 'ipSubmit' });
    s = run(s, { type: 'probeResult', candidate: { platform: 'roku', host: '192.168.1.99', model: 'Roku Ultra', source: 'probe' } });
    s = run(s, { type: 'paired' }, { type: 'save' });
    if (s.step !== 'name') throw new Error('expected name step');
    const session = new RemoteSession();
    const store = new SavedTvStore(new MemoryKv());
    const ev = await finishAddTv(s, { transport: { fetch }, session, store });
    expect(ev.type).toBe('saved');
    const tv = (await store.list())[0]!;
    expect(tv.platform).toBe('roku');
    expect(tv.host).toBe('192.168.1.99');
    expect(tv.mac).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i);
    expect(await session.sendKey('HOME')).toBe(true);
  });

  it('reports a connect failure as saveFailed and does not touch the session', async () => {
    const fetch: FetchLike = async () => {
      throw new Error('ECONNREFUSED');
    };
    let s = run(initialAddTvState, { type: 'found', candidate: { platform: 'roku', host: '192.168.1.9', source: 'probe' } });
    s = run(s, { type: 'scanDone' }, { type: 'pick', host: '192.168.1.9' }, { type: 'paired' }, { type: 'save' });
    if (s.step !== 'name') throw new Error('expected name step');
    const session = new RemoteSession();
    const ev = await finishAddTv(s, { transport: { fetch }, session });
    expect(ev.type).toBe('saveFailed');
    const after = addTvReducer(s, ev);
    expect(after.step === 'name' && after.saving).toBe(false);
    expect(session.getSnapshot().tvs).toHaveLength(0);
  });
});

describe("driverFor 'ir'", () => {
  const ir = { transmit: async (): Promise<void> => {} };
  it('rebuilds an IrDriver from the saved brand/set when there is a transmitter', () => {
    const d = driverFor({ platform: 'ir', host: '', irBrand: 'LG', irSet: 1 }, { ir });
    expect(d).toBeInstanceOf(IrDriver);
    expect((d as IrDriver).codeSet.id).toBeTruthy();
  });

  it('is null without a transmitter, without brand/set, or for an unknown set', () => {
    expect(driverFor({ platform: 'ir', host: '', irBrand: 'LG', irSet: 1 }, {})).toBeNull();
    expect(driverFor({ platform: 'ir', host: '' }, { ir })).toBeNull();
    expect(driverFor({ platform: 'ir', host: '', irBrand: 'Nope', irSet: 1 }, { ir })).toBeNull();
    expect(driverFor({ platform: 'ir', host: '', irBrand: 'LG', irSet: 99 }, { ir })).toBeNull();
  });
});

describe('Sony Bravia: pre-shared key step (T30)', () => {
  const SFX = join(__dirname, 'drivers/__fixtures__/sony');
  const SYSINFO = readFileSync(join(SFX, 'system-information.json'), 'utf8');
  const RCI = readFileSync(join(SFX, 'remote-controller-info.json'), 'utf8');
  /** Fixture-backed fake Bravia that only answers when X-Auth-PSK matches `psk`. */
  const braviaFetch =
    (psk: string): FetchLike =>
    async (_url, init) => {
      if (init?.headers?.['X-Auth-PSK'] !== psk) return { status: 403, ok: false, text: async () => '' };
      const method = (JSON.parse(init?.body ?? '{}') as { method?: string }).method;
      const body =
        method === 'getPowerStatus'
          ? '{"result":[{"status":"active"}],"id":1}'
          : method === 'getRemoteControllerInfo'
            ? RCI
            : method === 'getSystemInformation'
              ? SYSINFO
              : '{"result":[],"id":1}';
      return { status: 200, ok: true, text: async () => body };
    };
  const bravia: AddCandidate = { platform: 'sony', host: '192.168.1.88', model: 'KD-55X85J', source: 'ssdp' };
  const toPsk = (transport: { fetch?: FetchLike }) =>
    run(createAddTvState({ transport }), { type: 'found', candidate: bravia }, { type: 'scanDone' }, { type: 'pick', host: bravia.host });

  it('sony is supported with fetch and pairs with a psk step (menu path marked as varying by model)', () => {
    expect(SUPPORTED_PLATFORMS.has('sony')).toBe(true);
    expect(isSupported('sony', { fetch: true, ws: false })).toBe(true);
    expect(isSupported('sony', { fetch: false, ws: true })).toBe(false);
    const step = pairStepFor('sony');
    expect(step.kind).toBe('psk');
    if (step.kind === 'psk') {
      expect(step.message).toMatch(/IP control/);
      expect(step.message).toMatch(/Pre-Shared Key/);
      expect(step.message).toMatch(/may differ by model/);
    }
    expect(toPsk({}).step).toBe('unsupported');
  });

  it('typing the key and continuing carries it to the name step as the token', () => {
    const fetch = braviaFetch('1234');
    let s = toPsk({ fetch });
    expect(s.step === 'pair' && s.pair.kind).toBe('psk');
    s = addTvReducer(s, { type: 'paired' });
    expect(s.step === 'pair' && s.error).toMatch(/Pre-Shared Key/);
    s = run(s, { type: 'codeChanged', code: ' Ab1-x ' });
    expect(s.step === 'pair' && s.code).toBe(' Ab1-x ');
    expect(s.step === 'pair' && s.error).toBeNull();
    s = addTvReducer(s, { type: 'paired', token: 'ignored' });
    expect(s.step).toBe('name');
    if (s.step === 'name') expect(s.token).toBe('Ab1-x');
    // Back keeps the typed key so it can be corrected.
    const back = addTvReducer(s, { type: 'back' });
    expect(back.step === 'pair' && back.code).toBe('Ab1-x');
  });

  it('a correct key connects, saves the key as Tv.token and the MAC from system information', async () => {
    const fetch = braviaFetch('1234');
    let s = run(toPsk({ fetch }), { type: 'codeChanged', code: '1234' }, { type: 'paired' }, { type: 'save' });
    if (s.step !== 'name') throw new Error('expected name step');
    const session = new RemoteSession();
    const store = new SavedTvStore(new MemoryKv());
    const ev = await finishAddTv(s, { transport: { fetch }, session, store });
    expect(ev.type).toBe('saved');
    s = addTvReducer(s, ev);
    expect(s.step).toBe('saved');
    const tv = (await store.list())[0]!;
    expect(tv).toMatchObject({ platform: 'sony', host: '192.168.1.88', token: '1234', mac: 'a0:c4:a5:e1:b2:c3' });
    expect(session.activeDriver()).toBeInstanceOf(SonyDriver);
  });

  it('a wrong key fails with a friendly message and returns to the key step', async () => {
    const fetch = braviaFetch('1234');
    const s = run(toPsk({ fetch }), { type: 'codeChanged', code: '9999' }, { type: 'paired' }, { type: 'save' });
    if (s.step !== 'name') throw new Error('expected name step');
    const session = new RemoteSession();
    const ev = await finishAddTv(s, { transport: { fetch }, session });
    expect(ev).toEqual({ type: 'saveFailed', message: pskRejected(), retryPair: true });
    expect(pskRejected()).toBe("That key didn't work. Check the Pre-Shared Key on the TV.");
    const after = addTvReducer(s, ev);
    expect(after.step).toBe('pair');
    if (after.step === 'pair') {
      expect(after.error).toBe(pskRejected());
      expect(after.code).toBe('9999');
    }
    expect(session.getSnapshot().tvs).toHaveLength(0);
  });

  it('retryPair is ignored outside the psk step', () => {
    const s = run(listState(), { type: 'pick', host: '192.168.1.33' }, { type: 'paired' }, { type: 'save' });
    const after = addTvReducer(s, { type: 'saveFailed', message: 'x', retryPair: true });
    expect(after.step === 'name' && after.error).toBe('x');
  });
});
