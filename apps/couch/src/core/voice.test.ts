import type { TvDriver } from './driver';
import { MockTv } from './drivers/mock';
import type { Capability } from './types';
import { DriverError } from './types';
import { setLocale } from '../i18n/core';
import { sendTranscript, VOICE_NOTES, VoiceController, voiceLanguage, voiceMode, type SpeechToText, type VoiceState } from './voice';

const noSleep = async () => {};

async function demoTv(opts: ConstructorParameters<typeof MockTv>[0] = {}) {
  const tv = new MockTv({ sleep: noSleep, random: () => 0.5, now: () => 1000, ...opts });
  await tv.connect();
  return tv;
}

/** A driver without native voice and (optionally) without a SEARCH mapping. */
function plainDriver(opts: { search?: boolean } = {}) {
  const calls: string[] = [];
  const d: TvDriver = {
    platform: 'roku',
    capabilities: new Set<Capability>(['keys', 'text']),
    connect: async () => {},
    disconnect: async () => {},
    sendKey: async (k) => {
      if (k === 'SEARCH' && opts.search === false) throw new DriverError('unsupported', 'no search');
      calls.push(k);
    },
    sendText: async (t) => {
      calls.push(`TEXT ${t}`);
    },
    launchApp: async () => {},
    on: () => () => {},
  };
  return { d, calls };
}

function fakeStt(result = 'news', avail = true) {
  const log: string[] = [];
  const langs: string[] = [];
  const stt: SpeechToText = {
    available: () => avail,
    start: async (_onPartial, lang) => {
      log.push('start');
      langs.push(lang ?? '');
    },
    stop: async () => {
      log.push('stop');
      return result;
    },
    cancel: () => {
      log.push('cancel');
    },
  };
  return { stt, log, langs };
}

function mkCtl(getDriver: () => TvDriver | null, stt: SpeechToText | null = null) {
  const notes: string[] = [];
  const states: VoiceState[] = [];
  let keyboard = 0;
  const ctl = new VoiceController({
    getDriver,
    stt,
    onNote: (n) => notes.push(n),
    onOpenKeyboard: () => keyboard++,
    onState: (s) => states.push(s),
  });
  return { ctl, notes, states, keyboard: () => keyboard };
}

describe('voiceMode', () => {
  it('prefers native when the driver has voice + beginVoice', async () => {
    expect(voiceMode(await demoTv(), true)).toBe('native');
    expect(voiceMode(await demoTv(), false)).toBe('native');
  });
  it('uses speech-to-text when there is no native voice', () => {
    expect(voiceMode(plainDriver().d, true)).toBe('stt');
  });
  it('falls back to the keyboard', () => {
    expect(voiceMode(plainDriver().d, false)).toBe('keyboard');
    expect(voiceMode(null, false)).toBe('keyboard');
  });
  it('needs both the capability and the method for native', () => {
    const { d } = plainDriver();
    const withCapOnly = { ...d, capabilities: new Set<Capability>(['voice']) };
    expect(voiceMode(withCapOnly, false)).toBe('keyboard');
  });
});

describe('sendTranscript', () => {
  it('opens search then types', async () => {
    const { d, calls } = plainDriver();
    await sendTranscript(d, 'news');
    expect(calls).toEqual(['SEARCH', 'TEXT news']);
  });
  it('just types when SEARCH is unsupported', async () => {
    const { d, calls } = plainDriver({ search: false });
    await sendTranscript(d, 'news');
    expect(calls).toEqual(['TEXT news']);
  });
  it('rethrows other errors', async () => {
    const { d } = plainDriver();
    d.sendKey = async () => {
      throw new DriverError('tv_off', 'off');
    };
    await expect(sendTranscript(d, 'x')).rejects.toMatchObject({ code: 'tv_off' });
  });
});

describe('VoiceController', () => {
  it('native: press → listening, release → sends demo phrase → idle', async () => {
    const tv = await demoTv();
    const { ctl, notes, states } = mkCtl(() => tv);
    await ctl.press();
    expect(ctl.state).toBe('listening');
    expect(notes).toEqual([VOICE_NOTES.listening]);
    await ctl.release();
    expect(ctl.state).toBe('idle');
    expect(states).toEqual(['listening', 'sending', 'idle']);
    expect(tv.log.map((l) => l.what)).toEqual(['VOICE "find cooking shows"']);
    expect(notes[1]).toBe('Sent to the TV: "find cooking shows"');
  });

  it('release before press finished starting still sends once', async () => {
    const tv = await demoTv();
    const { ctl } = mkCtl(() => tv);
    const p = ctl.press();
    const r = ctl.release();
    await Promise.all([p, r]);
    expect(tv.log.map((l) => l.what)).toEqual(['VOICE "find cooking shows"']);
    expect(ctl.state).toBe('idle');
  });

  it('cancel sends nothing', async () => {
    const tv = await demoTv();
    const { ctl, states } = mkCtl(() => tv);
    await ctl.press();
    ctl.cancel();
    await ctl.release();
    expect(tv.log).toEqual([]);
    expect(states).toEqual(['listening', 'idle']);
  });

  it('native error becomes a note and returns to idle', async () => {
    const tv = await demoTv({ on: false });
    const { ctl, notes } = mkCtl(() => tv);
    await ctl.press();
    expect(ctl.state).toBe('idle');
    expect(notes.at(-1)).toBe('The TV is off. Press power to wake it.');
  });

  it('stt: opens search and types the transcript', async () => {
    const { d, calls } = plainDriver();
    const { stt, log } = fakeStt('  cooking shows ');
    const { ctl, notes } = mkCtl(() => d, stt);
    await ctl.press();
    await ctl.release();
    expect(log).toEqual(['start', 'stop']);
    expect(calls).toEqual(['SEARCH', 'TEXT cooking shows']);
    expect(notes).toEqual([VOICE_NOTES.listening, 'Sent to the TV: "cooking shows"']);
    expect(ctl.state).toBe('idle');
  });

  it('stt: empty transcript sends nothing', async () => {
    const { d, calls } = plainDriver();
    const { stt } = fakeStt('   ');
    const { ctl, notes } = mkCtl(() => d, stt);
    await ctl.press();
    await ctl.release();
    expect(calls).toEqual([]);
    expect(notes.at(-1)).toBe(VOICE_NOTES.empty);
    expect(ctl.state).toBe('idle');
  });

  it('stt: cancel calls stt.cancel and sends nothing', async () => {
    const { d, calls } = plainDriver();
    const { stt, log } = fakeStt('x');
    const { ctl } = mkCtl(() => d, stt);
    await ctl.press();
    ctl.cancel();
    expect(log).toEqual(['start', 'cancel']);
    expect(calls).toEqual([]);
  });

  it('keyboard fallback: note + open keyboard, stays idle', async () => {
    const { d } = plainDriver();
    const { ctl, notes, keyboard, states } = mkCtl(() => d, fakeStt('x', false).stt);
    await ctl.press();
    expect(notes).toEqual(['Voice needs the full app. Type it instead.']);
    expect(keyboard()).toBe(1);
    expect(states).toEqual([]);
    expect(ctl.currentMode()).toBe('keyboard');
  });

  it('no TV: note only', async () => {
    const { ctl, notes, keyboard } = mkCtl(() => null);
    await ctl.press();
    expect(notes).toEqual([VOICE_NOTES.noTv]);
    expect(keyboard()).toBe(0);
  });

  it('ignores a second press while listening', async () => {
    const tv = await demoTv();
    const { ctl } = mkCtl(() => tv);
    await ctl.press();
    await ctl.press();
    await ctl.release();
    expect(tv.log).toHaveLength(1);
  });
});

describe('voice language (owner-1016 R3)', () => {
  afterEach(() => setLocale('en'));

  it('recognises speech in the active app language', async () => {
    setLocale('fr');
    expect(voiceLanguage()).toBe('fr-FR');
    const { d } = plainDriver();
    const { stt, langs } = fakeStt('infos');
    const { ctl } = mkCtl(() => d, stt);
    await ctl.press();
    expect(langs).toEqual(['fr-FR']);
    await ctl.release();
    setLocale('ar');
    await ctl.press();
    expect(langs).toEqual(['fr-FR', 'ar']);
    ctl.cancel();
  });

  it('defaults to English and accepts an override', async () => {
    const { d } = plainDriver();
    const a = fakeStt();
    await mkCtl(() => d, a.stt).ctl.press();
    expect(a.langs).toEqual(['en-US']);
    const b = fakeStt();
    const ctl = new VoiceController({ getDriver: () => d, stt: b.stt, onNote: () => {}, onOpenKeyboard: () => {}, language: () => 'hi-IN' });
    await ctl.press();
    expect(b.langs).toEqual(['hi-IN']);
  });
});
