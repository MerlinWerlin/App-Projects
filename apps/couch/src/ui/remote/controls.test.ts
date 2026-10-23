import { COLOR_KEYS, KEY_LABEL, KEYS, NUM_KEYS, isKey, type Key } from '../../core/keys';
import type { FetchLike } from '../../core/driver';
import { MockTv } from '../../core/drivers/mock';
import { RokuDriver } from '../../core/drivers/roku';
import { isIconName } from '../icons/names';
import {
  allKeyControls,
  CHANNEL,
  classifySwipe,
  COLOR_ROW,
  DPAD,
  formatLatency,
  GLYPH,
  KEY_ICON,
  MID,
  NAV_MODES,
  NAV_ROW,
  NUMPAD_GRID,
  NUMPAD_OK,
  numpadSupported,
  opensSourceSheet,
  PLAYBACK_ROW,
  remoteVisibility,
  showColorKeys,
  TOP_ROW,
  TOP_ROW_KEYS,
  VOICE_BUTTON,
  VOLUME,
} from './controls';

const dummyFetch: FetchLike = async () => ({ status: 200, ok: true, text: async () => '' });
const mockCaps = new MockTv().capabilities;
const rokuCaps = new RokuDriver({ host: '192.168.1.33', fetch: dummyFetch }).capabilities;

describe('remote layout v2', () => {
  it('top row: labelled Power / Source / Settings', () => {
    expect(TOP_ROW_KEYS.map((c) => c.key)).toEqual(['POWER', 'SOURCE', 'SETTINGS']);
    expect(TOP_ROW_KEYS.map((c) => c.caption)).toEqual(['Power', 'Source', 'Settings']);
    expect(TOP_ROW.power.variant).toBe('power');
    expect(TOP_ROW.settings.label).toBe('TV settings');
    expect(opensSourceSheet('SOURCE')).toBe(true);
    expect(opensSourceSheet('SETTINGS')).toBe(false);
    expect(opensSourceSheet('INPUT')).toBe(false);
  });

  it('nav toggle, d-pad, nav row, rockers, playback in prototype order', () => {
    expect(NAV_MODES.map((m) => m.label)).toEqual(['D-pad', 'Touchpad']);
    expect([DPAD.up.key, DPAD.left.key, DPAD.ok.key, DPAD.right.key, DPAD.down.key]).toEqual([
      'UP',
      'LEFT',
      'OK',
      'RIGHT',
      'DOWN',
    ]);
    expect(NAV_ROW.map((c) => c.key)).toEqual(['BACK', 'HOME', 'MENU']);
    expect([VOLUME.up.key, VOLUME.down.key]).toEqual(['VOL_UP', 'VOL_DOWN']);
    expect([CHANNEL.up.key, CHANNEL.down.key]).toEqual(['CH_UP', 'CH_DOWN']);
    expect(PLAYBACK_ROW.map((c) => c.key)).toEqual(['REW', 'PLAY_PAUSE', 'FF']);
  });

  it('mid grid: Mute, Number pad (123), Keyboard, App list; voice is not in it', () => {
    expect(MID.map((c) => (c.kind === 'key' ? c.key : c.action))).toEqual(['MUTE', 'NUMPAD', 'KEYBOARD', 'APPS']);
    expect(MID.map((c) => c.label)).toEqual(['Mute', 'Number pad', 'Keyboard', 'App list']);
    expect(MID.map((c) => c.icon)).toEqual(['mute', 'numpad', 'keyboard', 'apps']);
  });

  it('hold-to-talk button', () => {
    expect(VOICE_BUTTON.key).toBe('VOICE');
    expect(VOICE_BUTTON.label).toBe('Hold to talk to your TV');
    expect(VOICE_BUTTON.caption).toBe('Hold to talk');
    expect(VOICE_BUTTON.icon).toBe('mic');
  });

  it('colour row uses prototype colours and KEY_LABEL', () => {
    expect(COLOR_ROW.map((c) => [c.key, c.label, c.color])).toEqual([
      ['RED', 'Red button', '#D9473F'],
      ['GREEN', 'Green button', '#2E9A5A'],
      ['YELLOW', 'Yellow button', '#E3B22B'],
      ['BLUE', 'Blue button', '#2F6BD3'],
    ]);
  });

  it('number pad grid: 1-9, dash, 0, then OK sending ENTER', () => {
    expect(NUMPAD_GRID.map((c) => c.key)).toEqual([
      'NUM_1',
      'NUM_2',
      'NUM_3',
      'NUM_4',
      'NUM_5',
      'NUM_6',
      'NUM_7',
      'NUM_8',
      'NUM_9',
      'NUM_DASH',
      'NUM_0',
    ]);
    expect(NUMPAD_GRID[9]?.label).toBe('Dash');
    expect(NUMPAD_OK.key).toBe('ENTER');
    expect(NUMPAD_OK.label).toBe('Enter');
    expect(NUMPAD_OK.glyph).toBe('OK');
    expect(NUMPAD_OK.icon).toBeNull();
    expect(NUMPAD_GRID[9]?.icon).toBe('minus');
    expect(NUMPAD_GRID.slice(0, 9).map((c) => c.glyph)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('every key control has label === KEY_LABEL; non-colour keys have an icon or text (digits / OK)', () => {
    for (const c of [...allKeyControls(), ...NUMPAD_GRID, NUMPAD_OK]) {
      expect(isKey(c.key)).toBe(true);
      expect(c.label).toBe(KEY_LABEL[c.key]);
      if (c.icon !== null) expect(isIconName(c.icon)).toBe(true);
      if (!(COLOR_KEYS as readonly Key[]).includes(c.key)) expect(c.icon !== null || c.glyph.length > 0).toBe(true);
    }
    for (const k of KEYS) expect(typeof GLYPH[k]).toBe('string');
  });

  it('icons, not glyphs: physical keys use the vector set; text is only digits and OK', () => {
    expect(TOP_ROW_KEYS.map((c) => c.icon)).toEqual(['power', 'source', 'settings']);
    expect([DPAD.up.icon, DPAD.left.icon, DPAD.right.icon, DPAD.down.icon]).toEqual(['up', 'left', 'right', 'down']);
    expect(DPAD.ok.icon).toBeNull();
    expect(NAV_ROW.map((c) => c.icon)).toEqual(['back', 'home', 'menu']);
    expect([VOLUME.up.icon, VOLUME.down.icon, CHANNEL.up.icon, CHANNEL.down.icon]).toEqual(['volUp', 'volDown', 'chUp', 'chDown']);
    expect(PLAYBACK_ROW.map((c) => c.icon)).toEqual(['rewind', 'playPause', 'fastForward']);
    for (const c of COLOR_ROW) expect(c.icon).toBeNull();
    for (const k of KEYS) {
      const icon = KEY_ICON[k];
      if (icon !== null) expect(isIconName(icon)).toBe(true);
      expect(GLYPH[k]).toMatch(/^(|OK|[0-9])$/);
    }
  });

  it('places every Key exactly once (remote rows, numpad sheet, colour row, voice button)', () => {
    const placed: Key[] = [...allKeyControls(), ...NUMPAD_GRID, { key: VOICE_BUTTON.key }].map((c) => c.key);
    expect(new Set(placed).size).toBe(placed.length);
    // Text-entry keys live in the keyboard sheet (ENTER is also the numpad OK);
    // INPUT is a legacy alias that SOURCE replaces on screen.
    const elsewhere = new Set<Key>(['BACKSPACE', 'ENTER', 'SEARCH', 'INPUT']);
    expect([...placed].sort()).toEqual(KEYS.filter((k) => !elsewhere.has(k)).sort());
    for (const k of NUM_KEYS) expect(placed).toContain(k);
  });

  it('wide hints on nav and playback rows', () => {
    for (const c of [...NAV_ROW, ...PLAYBACK_ROW]) expect(c.variant).toBe('wide');
  });
});

describe('capability-driven visibility', () => {
  it('MockTv: colour row shown, numpad sends digits', () => {
    expect(showColorKeys(mockCaps)).toBe(true);
    expect(numpadSupported(mockCaps)).toBe(true);
    expect(remoteVisibility(mockCaps)).toEqual({ colorKeys: true, numpadButton: true, numpadDigits: true });
    expect(allKeyControls(mockCaps).map((c) => c.key)).toEqual(expect.arrayContaining([...COLOR_KEYS]));
  });

  it('Roku: no colour row, 123 button still shown but sheet explains digits are unsupported', () => {
    expect(showColorKeys(rokuCaps)).toBe(false);
    expect(numpadSupported(rokuCaps)).toBe(false);
    expect(remoteVisibility(rokuCaps)).toEqual({ colorKeys: false, numpadButton: true, numpadDigits: false });
    const keys = allKeyControls(rokuCaps).map((c) => c.key);
    for (const k of COLOR_KEYS) expect(keys).not.toContain(k);
    expect(MID.some((c) => c.kind === 'action' && c.action === 'NUMPAD')).toBe(true);
  });

  it('empty capability set hides colours', () => {
    expect(showColorKeys(new Set())).toBe(false);
  });
});

describe('classifySwipe', () => {
  it('maps dominant axis beyond threshold to a direction', () => {
    expect(classifySwipe(40, 5)).toBe('RIGHT');
    expect(classifySwipe(-40, 5)).toBe('LEFT');
    expect(classifySwipe(5, 40)).toBe('DOWN');
    expect(classifySwipe(5, -40)).toBe('UP');
    expect(classifySwipe(-50, 60)).toBe('DOWN');
    expect(classifySwipe(60, -50)).toBe('RIGHT');
  });

  it('uses the 36pt prototype threshold, configurable', () => {
    expect(classifySwipe(36, 0, { phase: 'move' })).toBeNull();
    expect(classifySwipe(37, 0, { phase: 'move' })).toBe('RIGHT');
    expect(classifySwipe(21, 0, { threshold: 20 })).toBe('RIGHT');
  });

  it('a small quick release is a tap -> OK', () => {
    expect(classifySwipe(0, 0)).toBe('OK');
    expect(classifySwipe(3, -4, { elapsedMs: 120 })).toBe('OK');
    expect(classifySwipe(10, 10)).toBe('OK');
  });

  it('no OK while the finger is down, after a slow press, or for a medium drift', () => {
    expect(classifySwipe(0, 0, { phase: 'move' })).toBeNull();
    expect(classifySwipe(0, 0, { elapsedMs: 250 })).toBeNull();
    expect(classifySwipe(20, 0)).toBeNull();
    expect(classifySwipe(11, 0)).toBeNull();
  });

  it('ignores non-finite input', () => {
    expect(classifySwipe(Number.NaN, 0)).toBeNull();
  });
});

describe('formatLatency', () => {
  it('formats ms or a dash', () => {
    expect(formatLatency(null)).toBe('—');
    expect(formatLatency(33.6)).toBe('34 ms');
  });
});
