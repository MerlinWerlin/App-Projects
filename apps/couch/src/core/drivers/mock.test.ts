import { KEYS } from '../keys';
import { DriverError } from '../types';
import { DEMO_VOICE_PHRASE, MockTv } from './mock';

const noSleep = async () => {};
const fixed = (r: number) => () => r;

function mk(opts: ConstructorParameters<typeof MockTv>[0] = {}) {
  return new MockTv({ sleep: noSleep, random: fixed(0.5), now: () => 1000, ...opts });
}

describe('MockTv', () => {
  it('refuses commands before connect', async () => {
    const tv = mk();
    await expect(tv.sendKey('UP')).rejects.toBeInstanceOf(DriverError);
  });

  it('logs every key with latency', async () => {
    const tv = mk({ baseMs: 30 });
    await tv.connect();
    await tv.sendKey('UP');
    await tv.sendKey('OK');
    expect(tv.log).toEqual([
      { at: 1000, what: 'UP', ms: 30 },
      { at: 1000, what: 'OK', ms: 30 },
    ]);
    expect(tv.lastMs).toBe(30);
  });

  it('accepts every canonical key', async () => {
    const tv = mk();
    await tv.connect();
    for (const k of KEYS) {
      if (k === 'POWER') continue;
      await tv.sendKey(k);
    }
    expect(tv.log).toHaveLength(KEYS.length - 1);
  });

  it('latency respects base, jitter and the 9 ms floor', () => {
    expect(mk({ baseMs: 30, jitterMs: 8, random: fixed(0) }).nextLatency()).toBe(22);
    expect(mk({ baseMs: 30, jitterMs: 8, random: fixed(0.999999) }).nextLatency()).toBe(38);
    expect(mk({ baseMs: 5, jitterMs: 2, random: fixed(0) }).nextLatency()).toBe(9);
  });

  it('volume clamps 0..100 and mute toggles', async () => {
    const tv = mk({ volume: 99 });
    await tv.connect();
    await tv.sendKey('VOL_UP');
    await tv.sendKey('VOL_UP');
    expect(await tv.volume()).toBe(100);
    const low = mk({ volume: 0 });
    await low.connect();
    await low.sendKey('VOL_DOWN');
    expect(low.vol).toBe(0);
    await low.sendKey('MUTE');
    expect(low.muted).toBe(true);
  });

  it('power toggles and blocks other keys while off', async () => {
    const tv = mk();
    await tv.connect();
    await tv.sendKey('POWER');
    expect(tv.isOn).toBe(false);
    await expect(tv.sendKey('UP')).rejects.toMatchObject({ code: 'tv_off' });
    await tv.powerOn();
    expect(tv.isOn).toBe(true);
    await tv.sendKey('UP');
  });

  it('types text and backspaces', async () => {
    const tv = mk();
    await tv.connect();
    await tv.sendText('blu');
    await tv.sendText('ey');
    await tv.sendKey('BACKSPACE');
    expect(tv.text).toBe('blue');
    expect(tv.log[0]?.what).toBe('TEXT "blu"');
  });

  it('lists and launches apps; unknown app is unsupported', async () => {
    const tv = mk();
    await tv.connect();
    const apps = await tv.listApps();
    expect(apps.map((a) => a.name)).toContain('Netflix');
    await tv.launchApp('svc.youtube');
    expect(tv.foregroundApp).toBe('svc.youtube');
    await tv.sendKey('HOME');
    expect(tv.foregroundApp).toBeNull();
    await expect(tv.launchApp('nope')).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('emits state and sent events; unsubscribe works', async () => {
    const tv = mk();
    const seen: string[] = [];
    const off = tv.on((e) => seen.push(e.type === 'state' ? `state:${e.state}` : e.type));
    await tv.connect();
    await tv.sendKey('OK');
    off();
    await tv.sendKey('OK');
    expect(seen).toEqual(['state:connecting', 'state:connected', 'sent']);
  });

  it('connect reports off when the TV is off', async () => {
    const tv = mk({ on: false });
    const states: string[] = [];
    tv.on((e) => e.type === 'state' && states.push(e.state));
    await tv.connect();
    expect(states).toEqual(['connecting', 'off']);
  });

  it('lists TV, HDMI 1-4 and AV with HDMI 1 current', async () => {
    const tv = mk();
    await tv.connect();
    const inputs = await tv.listInputs();
    expect(inputs.map((i) => i.name)).toEqual(['TV', 'HDMI 1', 'HDMI 2', 'HDMI 3', 'HDMI 4', 'AV']);
    expect(inputs.filter((i) => i.current).map((i) => i.id)).toEqual(['hdmi1']);
    expect(tv.capabilities.has('inputs')).toBe(true);
  });

  it('setInput switches and logs like other commands', async () => {
    const tv = mk({ baseMs: 30 });
    await tv.connect();
    await tv.setInput('av');
    expect(tv.input).toBe('av');
    expect(tv.log).toEqual([{ at: 1000, what: 'INPUT av', ms: 30 }]);
    expect((await tv.listInputs()).find((i) => i.current)?.id).toBe('av');
  });

  it('setInput rejects unknown inputs and needs the TV on', async () => {
    const tv = mk();
    await tv.connect();
    await expect(tv.setInput('hdmi9')).rejects.toMatchObject({ code: 'unsupported' });
    await tv.sendKey('POWER');
    await expect(tv.setInput('tv')).rejects.toMatchObject({ code: 'tv_off' });
    await expect(tv.listInputs()).rejects.toMatchObject({ code: 'tv_off' });
  });

  it('SOURCE key cycles the current input, wrapping', async () => {
    const tv = mk();
    await tv.connect();
    const seen: string[] = [];
    for (let n = 0; n < 6; n++) {
      await tv.sendKey('SOURCE');
      seen.push(tv.input);
    }
    expect(seen).toEqual(['hdmi2', 'hdmi3', 'hdmi4', 'av', 'tv', 'hdmi1']);
    expect(tv.log.map((l) => l.what)).toEqual(Array(6).fill('SOURCE'));
  });

  describe('demo voice', () => {
    it('advertises voice and records the demo phrase on end()', async () => {
      const tv = mk({ baseMs: 30 });
      expect(tv.capabilities.has('voice')).toBe(true);
      await tv.connect();
      const sent: string[] = [];
      tv.on((e) => e.type === 'sent' && sent.push(e.what));
      const s = await tv.beginVoice();
      s.sendAudio(new Uint8Array(320));
      s.sendAudio(new Uint8Array(320));
      expect(s.bytes).toBe(640);
      await s.end();
      await s.end(); // second end is a no-op
      expect(DEMO_VOICE_PHRASE).toBe('find cooking shows');
      expect(s.transcript).toBe('find cooking shows');
      expect(tv.log).toEqual([{ at: 1000, what: 'VOICE "find cooking shows"', ms: 30 }]);
      expect(sent).toEqual(['VOICE "find cooking shows"']);
    });

    it('cancel() sends nothing', async () => {
      const tv = mk();
      await tv.connect();
      const s = await tv.beginVoice();
      s.cancel();
      await s.end();
      expect(tv.log).toEqual([]);
    });

    it('refuses voice when not connected or off', async () => {
      await expect(mk().beginVoice()).rejects.toBeInstanceOf(DriverError);
      const off = mk({ on: false });
      await off.connect();
      await expect(off.beginVoice()).rejects.toMatchObject({ code: 'tv_off' });
    });
  });
});
