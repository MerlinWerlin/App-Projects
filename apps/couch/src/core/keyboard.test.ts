import { createDemoSession } from './demo';
import { diffText, LiveTyper, type TypeSink } from './keyboard';
import type { Key } from './keys';
import { RemoteSession } from './session';

const noSleep = async () => {};

async function demoSession() {
  const demo = await createDemoSession({ sleep: noSleep, random: () => 0.5 });
  const s = new RemoteSession(() => 1000);
  s.load(demo.tvs, demo.drivers, { demo: true });
  return { s, tv: demo.drivers.get('demo-1')! };
}

describe('diffText', () => {
  it('appends as one text op', () => {
    expect(diffText('ab', 'abcd')).toEqual([{ type: 'text', text: 'cd' }]);
  });
  it('deletes as backspaces', () => {
    expect(diffText('abcd', 'ab')).toEqual([
      { type: 'key', key: 'BACKSPACE' },
      { type: 'key', key: 'BACKSPACE' },
    ]);
  });
  it('no change, no ops', () => {
    expect(diffText('abc', 'abc')).toEqual([]);
  });
  it('middle edit backspaces to the common prefix then retypes', () => {
    expect(diffText('house', 'horse')).toEqual([
      { type: 'key', key: 'BACKSPACE' },
      { type: 'key', key: 'BACKSPACE' },
      { type: 'key', key: 'BACKSPACE' },
      { type: 'text', text: 'rse' },
    ]);
  });
  it('treats an emoji as one character', () => {
    expect(diffText('hi 👍', 'hi ')).toEqual([{ type: 'key', key: 'BACKSPACE' }]);
  });
});

describe('LiveTyper against MockTv', () => {
  it('live typing leaves the TV text equal to the field', async () => {
    const { s, tv } = await demoSession();
    const typer = new LiveTyper(s);
    const states = ['b', 'br', 'bre', 'brea', 'break', 'brea', 'bread', 'breading', 'bead', 'Bluey', ''];
    const done = states.map((v) => typer.update(v));
    await Promise.all(done);
    expect(tv.text).toBe('');
    for (const v of ['s', 'st', 'sta', 'stan', 'sta', 'star']) void typer.update(v);
    expect(await typer.idle()).toBe(true);
    expect(tv.text).toBe('star');
    expect(typer.text).toBe('star');
  });

  it('only sends the change', async () => {
    const { s, tv } = await demoSession();
    const typer = new LiveTyper(s);
    await typer.update('abc');
    await typer.update('abd');
    expect(tv.log.map((l) => l.what)).toEqual(['TEXT "abc"', 'BACKSPACE', 'TEXT "d"']);
    expect(tv.text).toBe('abd');
  });

  it('send-on-enter types everything then ENTER', async () => {
    const { s, tv } = await demoSession();
    const typer = new LiveTyper(s);
    expect(await typer.submit('Bluey')).toBe(true);
    expect(tv.text).toBe('Bluey');
    expect(tv.log.map((l) => l.what)).toEqual(['TEXT "Bluey"', 'ENTER']);
  });

  it('clear backspaces what was sent', async () => {
    const { s, tv } = await demoSession();
    const typer = new LiveTyper(s);
    await typer.update('news');
    expect(await typer.clear()).toBe(true);
    expect(tv.text).toBe('');
  });

  it('reports failure when the TV is off and keeps the order', async () => {
    const { s } = await demoSession();
    s.select('demo-3');
    const typer = new LiveTyper(s);
    expect(await typer.update('x')).toBe(false);
    expect(s.getSnapshot().lastError).toMatch(/off/);
  });

  it('serialises slow sends in order', async () => {
    const calls: string[] = [];
    const sink: TypeSink = {
      sendText: async (t: string) => {
        await new Promise((r) => setTimeout(r, 5));
        calls.push(`t:${t}`);
        return true;
      },
      sendKey: async (k: Key) => {
        calls.push(`k:${k}`);
        return true;
      },
    };
    const typer = new LiveTyper(sink);
    void typer.update('ab');
    void typer.update('a');
    void typer.update('ac');
    await typer.idle();
    expect(calls).toEqual(['t:ab', 'k:BACKSPACE', 't:c']);
  });
});
