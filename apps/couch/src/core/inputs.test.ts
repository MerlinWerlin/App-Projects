import type { DriverEvent, TvDriver } from './driver';
import type { Key } from './keys';
import { MockTv } from './drivers/mock';
import { RemoteSession } from './session';
import {
  noSourceMessage,
  SOURCE_LABELS,
  chooseSource,
  currentSourceId,
  loadSources,
  nextInput,
  nextSource,
} from './inputs';
import { DriverError, type Capability, type TvInput } from './types';

const noSleep = async () => {};

async function mock(): Promise<MockTv> {
  const tv = new MockTv({ sleep: noSleep, random: () => 0.5, now: () => 1000 });
  await tv.connect();
  return tv;
}

/** Minimal driver with chosen capabilities/methods, recording calls. */
function fake(opts: {
  caps: Capability[];
  inputs?: TvInput[];
  withSet?: boolean;
  sendKey?: (k: Key) => Promise<void>;
}) {
  const calls: string[] = [];
  const d: TvDriver = {
    platform: 'mock',
    capabilities: new Set(opts.caps),
    connect: async () => {},
    disconnect: async () => {},
    sendKey: opts.sendKey ?? (async (k) => void calls.push(`key ${k}`)),
    sendText: async () => {},
    launchApp: async () => {},
    on: (_cb: (e: DriverEvent) => void) => () => {},
  };
  if (opts.inputs) {
    const list = opts.inputs;
    d.listInputs = async () => {
      calls.push('list');
      return list;
    };
  }
  if (opts.withSet) d.setInput = async (id) => void calls.push(`set ${id}`);
  return { d, calls };
}

const ROKU_LIKE: TvInput[] = [
  { id: 'InputTuner', name: 'TV' },
  { id: 'InputHDMI1', name: 'HDMI 1' },
  { id: 'InputHDMI2', name: 'HDMI 2' },
];

describe('loadSources', () => {
  it('lists the TV inputs with the current one flagged (MockTv)', async () => {
    const tv = await mock();
    const v = await loadSources(tv);
    expect(v.kind).toBe('list');
    if (v.kind !== 'list') return;
    expect(v.inputs.map((i) => i.name)).toEqual([...SOURCE_LABELS]);
    expect(currentSourceId(v.inputs)).toBe('hdmi1');
  });

  it('cycles when the driver has no inputs capability or no listInputs', async () => {
    expect(await loadSources(fake({ caps: ['keys'], inputs: ROKU_LIKE, withSet: true }).d)).toEqual({ kind: 'cycle' });
    expect(await loadSources(fake({ caps: ['keys', 'inputs'] }).d)).toEqual({ kind: 'cycle' });
  });

  it('cycles when the TV returns an empty list', async () => {
    expect(await loadSources(fake({ caps: ['keys', 'inputs'], inputs: [], withSet: true }).d)).toEqual({ kind: 'cycle' });
  });
});

describe('chooseSource', () => {
  it('sets the input on the TV', async () => {
    const tv = await mock();
    await chooseSource(tv, 'hdmi3');
    expect(tv.input).toBe('hdmi3');
    expect(tv.log.map((l) => l.what)).toEqual(['INPUT hdmi3']);
  });

  it('is a friendly unsupported error without setInput', async () => {
    const { d } = fake({ caps: ['keys'] });
    await expect(chooseSource(d, 'hdmi1')).rejects.toMatchObject({ code: 'unsupported', message: noSourceMessage() });
  });
});

describe('nextInput / currentSourceId', () => {
  it('steps from the current input and wraps', () => {
    const list: TvInput[] = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', current: true }, { id: 'c', name: 'C' }];
    expect(nextInput(list)?.id).toBe('c');
    expect(nextInput(list, 'c')?.id).toBe('a');
    expect(nextInput(list, 'zzz')?.id).toBe('c'); // unknown currentId falls back to the flag
  });

  it('starts at the first input when the current one is unknown', () => {
    expect(nextInput(ROKU_LIKE)?.id).toBe('InputTuner');
    expect(nextInput(ROKU_LIKE, 'InputHDMI2')?.id).toBe('InputTuner');
    expect(nextInput([])).toBeNull();
  });
});

describe('nextSource', () => {
  it('uses setInput over the list, cycling from the current input (MockTv)', async () => {
    const tv = await mock();
    expect(await nextSource(tv)).toBe('hdmi2');
    expect(await nextSource(tv)).toBe('hdmi3');
    expect(tv.input).toBe('hdmi3');
    expect(tv.log.map((l) => l.what)).toEqual(['INPUT hdmi2', 'INPUT hdmi3']);
  });

  it('uses the list passed in and the last chosen id when the TV reports no current input', async () => {
    const { d, calls } = fake({ caps: ['keys', 'inputs'], inputs: ROKU_LIKE, withSet: true });
    expect(await nextSource(d, { inputs: ROKU_LIKE })).toBe('InputTuner');
    expect(await nextSource(d, { inputs: ROKU_LIKE, currentId: 'InputTuner' })).toBe('InputHDMI1');
    expect(calls).toEqual(['set InputTuner', 'set InputHDMI1']);
  });

  it('fetches the list when none is passed', async () => {
    const { d, calls } = fake({ caps: ['keys', 'inputs'], inputs: ROKU_LIKE, withSet: true });
    await nextSource(d, { currentId: 'InputHDMI1' });
    expect(calls).toEqual(['list', 'set InputHDMI2']);
  });

  it('sends SOURCE when the TV shares no list', async () => {
    const { d, calls } = fake({ caps: ['keys'] });
    expect(await nextSource(d)).toBeNull();
    expect(calls).toEqual(['key SOURCE']);
  });

  it('sends SOURCE when the TV list is empty', async () => {
    const { d, calls } = fake({ caps: ['keys', 'inputs'], inputs: [], withSet: true });
    expect(await nextSource(d)).toBeNull();
    expect(calls).toEqual(['list', 'key SOURCE']);
  });

  it('turns a driver with no SOURCE key into a friendly unsupported error', async () => {
    const { d } = fake({
      caps: ['keys'],
      sendKey: async (k) => {
        throw new DriverError('unsupported', `${k} is not available on Roku.`);
      },
    });
    await expect(nextSource(d)).rejects.toMatchObject({ code: 'unsupported', message: noSourceMessage() });
  });

  it('is unsupported without keys or inputs', async () => {
    const { d, calls } = fake({ caps: ['text'] });
    await expect(nextSource(d)).rejects.toMatchObject({ code: 'unsupported', message: noSourceMessage() });
    expect(calls).toEqual([]);
  });

  it('passes other errors through', async () => {
    const tv = await mock();
    await tv.sendKey('POWER');
    await expect(nextSource(tv)).rejects.toMatchObject({ code: 'tv_off' });
  });

  it('errors become session lastError through exec', async () => {
    const { d } = fake({ caps: ['text'] });
    const s = new RemoteSession(() => 0);
    s.load([{ id: 'a', name: 'TV 1', model: 'Demo', platform: 'mock', host: 'demo' }], new Map([['a', d]]), { demo: true });
    expect(await s.exec((drv) => nextSource(drv).then(() => undefined))).toBe(false);
    expect(s.getSnapshot().lastError).toBe(noSourceMessage());
  });
});
