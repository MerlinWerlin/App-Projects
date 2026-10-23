import { createDemoSession } from './demo';
import { RemoteSession, describeError } from './session';
import { DriverError } from './types';
import { MockTv } from './drivers/mock';

const noSleep = async () => {};

async function demoSession() {
  const demo = await createDemoSession({ sleep: noSleep, random: () => 0.5 });
  const s = new RemoteSession(() => 1000);
  s.load(demo.tvs, demo.drivers, { demo: true });
  return { s, demo };
}

describe('RemoteSession', () => {
  it('selects the first TV on load and reports demo', async () => {
    const { s } = await demoSession();
    const snap = s.getSnapshot();
    expect(snap.demo).toBe(true);
    expect(snap.activeId).toBe('demo-1');
    expect(s.activeTv()?.name).toBe('Living room');
  });

  it('routes keys to the active driver and records latency', async () => {
    const { s, demo } = await demoSession();
    expect(await s.sendKey('UP')).toBe(true);
    expect(demo.drivers.get('demo-1')!.log.map((l) => l.what)).toEqual(['UP']);
    expect(s.getSnapshot().lastMs).toBe(38);
  });

  it('never throws: an off TV becomes lastError', async () => {
    const { s } = await demoSession();
    s.select('demo-3');
    expect(await s.sendKey('UP')).toBe(false);
    expect(s.getSnapshot().lastError).toMatch(/off/);
    expect(await s.sendKey('POWER')).toBe(true);
    expect(s.getSnapshot().state).toBe('connected');
    expect(await s.sendKey('UP')).toBe(true);
  });

  it('snapshot is stable until something changes', async () => {
    const { s } = await demoSession();
    const a = s.getSnapshot();
    expect(s.getSnapshot()).toBe(a);
    let calls = 0;
    const un = s.subscribe(() => calls++);
    await s.sendKey('OK');
    expect(s.getSnapshot()).not.toBe(a);
    expect(calls).toBeGreaterThan(0);
    un();
  });

  it('ignores selecting an unknown TV and errors with none selected', async () => {
    const s = new RemoteSession();
    s.select('nope');
    expect(s.getSnapshot().activeId).toBeNull();
    expect(await s.sendText('hi')).toBe(false);
    expect(s.getSnapshot().lastError).toMatch(/No TV/);
  });

  it('launches apps and types text in demo', async () => {
    const { s, demo } = await demoSession();
    const apps = await demo.drivers.get('demo-1')!.listApps();
    expect(await s.launchApp(apps[0]!.id)).toBe(true);
    expect(await s.sendText('abc')).toBe(true);
  });

  it('add appends a TV + driver, selects it, and replaces by id', async () => {
    const { s } = await demoSession();
    const d = new MockTv({ sleep: noSleep, random: () => 0.5 });
    await d.connect();
    const before = s.getSnapshot().tvs;
    s.add({ id: 'new-1', name: 'Den', model: 'Demo', platform: 'mock', host: '192.168.1.90' }, d);
    const snap = s.getSnapshot();
    expect(snap.tvs).not.toBe(before);
    expect(snap.tvs.map((t) => t.id)).toEqual(['demo-1', 'demo-2', 'demo-3', 'new-1']);
    expect(snap.activeId).toBe('new-1');
    expect(await s.sendKey('UP')).toBe(true);
    expect(d.log.map((l) => l.what)).toEqual(['UP']);
    s.add({ id: 'new-1', name: 'Den 2', model: 'Demo', platform: 'mock', host: '192.168.1.90' }, d);
    expect(s.getSnapshot().tvs.filter((t) => t.id === 'new-1').map((t) => t.name)).toEqual(['Den 2']);
  });

  it('describes driver errors in plain words', () => {
    expect(describeError(new DriverError('pair_required', 'x'))).toMatch(/Pair/);
    expect(describeError(new Error('boom'))).toBe('boom');
  });
});
