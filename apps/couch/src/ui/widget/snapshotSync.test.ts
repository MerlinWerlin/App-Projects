import { UNAVAILABLE_WIDGET_BRIDGE, type WidgetBridge } from '../../core/widget/bridge';
import { parseWidgetSnapshot, type WidgetSnapshotInput } from '../../core/widget/snapshot';
import { createWidgetSnapshotSync } from './snapshotSync';

function fakeBridge(over: Partial<WidgetBridge> = {}) {
  const calls: string[] = [];
  const writes: string[] = [];
  const bridge: WidgetBridge = {
    available: true,
    setSnapshot: async (json) => {
      calls.push('set');
      writes.push(json);
    },
    reloadTimelines: async () => {
      calls.push('reload');
    },
    ...over,
  };
  return { bridge, calls, writes };
}

const input = (over: Partial<WidgetSnapshotInput> = {}): WidgetSnapshotInput => ({
  tv: { id: 'demo-1', name: 'Den' },
  state: 'connected',
  plus: true,
  now: 1,
  ...over,
});

describe('widget snapshot sync', () => {
  it('writes, then reloads timelines', async () => {
    const { bridge, calls, writes } = fakeBridge();
    const sync = createWidgetSnapshotSync(bridge);
    expect(await sync.update(input())).toBe(true);
    expect(calls).toEqual(['set', 'reload']);
    expect(parseWidgetSnapshot(writes[0]!)?.tv?.name).toBe('Den');
    expect(sync.last()?.buttons.length).toBeGreaterThan(0);
  });

  it('skips writes when nothing visible changed', async () => {
    const { bridge, calls } = fakeBridge();
    const sync = createWidgetSnapshotSync(bridge);
    await sync.update(input({ now: 1 }));
    expect(await sync.update(input({ now: 99 }))).toBe(false);
    expect(await sync.update(input({ state: 'off' }))).toBe(true);
    expect(await sync.update(input({ state: 'off', plus: false }))).toBe(true);
    expect(calls).toEqual(['set', 'reload', 'set', 'reload', 'set', 'reload']);
  });

  it('keeps writes in order', async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const slow = new Promise<void>((r) => (release = r));
    let first = true;
    const { bridge } = fakeBridge({
      setSnapshot: async (json) => {
        const name = parseWidgetSnapshot(json)?.tv?.name ?? '?';
        if (first) {
          first = false;
          await slow;
        }
        order.push(name);
      },
    });
    const sync = createWidgetSnapshotSync(bridge);
    const a = sync.update(input({ tv: { id: 'demo-1', name: 'A' } }));
    const b = sync.update(input({ tv: { id: 'demo-1', name: 'B' } }));
    release();
    await Promise.all([a, b]);
    expect(order).toEqual(['A', 'B']);
  });

  it('does nothing with the unavailable bridge', async () => {
    const sync = createWidgetSnapshotSync(UNAVAILABLE_WIDGET_BRIDGE);
    expect(await sync.update(input())).toBe(false);
    expect(sync.last()).toBeNull();
  });

  it('never rejects when the bridge throws', async () => {
    const { bridge } = fakeBridge({
      setSnapshot: async () => {
        throw new Error('boom');
      },
    });
    const sync = createWidgetSnapshotSync(bridge);
    await expect(sync.update(input())).resolves.toBe(false);
    // the next update still runs
    await expect(sync.update(input({ state: 'off' }))).resolves.toBe(false);
    expect(sync.last()).toBeNull();
  });

  it('retries the same content after a failed write', async () => {
    let fail = true;
    const { bridge, writes } = fakeBridge();
    const flaky: WidgetBridge = {
      ...bridge,
      setSnapshot: async (json) => {
        if (fail) throw new Error('busy');
        await bridge.setSnapshot(json);
      },
    };
    const sync = createWidgetSnapshotSync(flaky);
    expect(await sync.update(input())).toBe(false);
    fail = false;
    expect(await sync.update(input())).toBe(true);
    expect(writes).toHaveLength(1);
  });
});
