/**
 * Remote layout as data, ported from prototype/index.html viewRemote().
 * Pure TS (no React Native) so it is unit-tested with bun/jest; the .tsx
 * components only render this. Every TV control is free.
 *
 * Copy (owner-1016 R3): captions and labels on these tables are getters that translate on every
 * read (src/ui/lazyCopy.ts); single strings are exported as message keys (*_KEY) for t().
 * Key labels (KEY_LABEL) come from src/core/keys and move to the catalogue in T51.
 */
import { COLOR_KEYS, KEY_LABEL, KEY_LABEL_KEY, type Key } from '../../core/keys';
import type { Capability } from '../../core/types';
import { en } from '../../i18n/catalog';
import { t, type MessageKey } from '../../i18n/core';
import type { IconName } from '../icons/names';
import { withCopy } from '../lazyCopy';

/** A button that sends a TV key. Label is always KEY_LABEL[key] (prototype aria-label). */
export interface KeyControl {
  kind: 'key';
  key: Key;
  label: string;
  /**
   * Vector icon drawn on the button (src/ui/icons, fb-1017b H2), or null when the button shows
   * text instead (digits, OK) or nothing (colour keys).
   */
  icon: IconName | null;
  /** Text shown when there is no icon: digits and 'OK' only. Never an emoji or symbol glyph. */
  glyph: string;
  /** Prototype class hints: round / wide / power colouring / lbl (glyph above a small caption). */
  variant?: 'round' | 'wide' | 'power';
  /** Visible text under the glyph (prototype .key.lbl). */
  caption?: string;
}

/** A button that does something in the app instead of sending a key. */
export type ActionId = 'NUMPAD' | 'KEYBOARD' | 'APPS';
export interface ActionControl {
  kind: 'action';
  action: ActionId;
  label: string;
  icon: IconName;
}

export type Control = KeyControl | ActionControl;

function key(k: Key, glyph: string, variant?: KeyControl['variant'], caption?: MessageKey): KeyControl {
  const c: KeyControl = withCopy({ kind: 'key', key: k, label: KEY_LABEL[k], icon: KEY_ICON[k], glyph } as KeyControl, {
    label: KEY_LABEL_KEY[k],
  });
  if (variant) c.variant = variant;
  if (caption) withCopy(c, { caption });
  return c;
}

/**
 * Icon per key (fb-1017b H2): Couch's own vector set, never emoji or text symbols.
 * null = the key shows text (digits, OK) or nothing (colour keys draw their colour).
 */
export const KEY_ICON: Record<Key, IconName | null> = {
  POWER: 'power',
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  OK: null,
  BACK: 'back',
  HOME: 'home',
  MENU: 'menu',
  INPUT: 'source',
  VOL_UP: 'volUp',
  VOL_DOWN: 'volDown',
  MUTE: 'mute',
  CH_UP: 'chUp',
  CH_DOWN: 'chDown',
  REW: 'rewind',
  PLAY_PAUSE: 'playPause',
  FF: 'fastForward',
  BACKSPACE: 'backspace',
  ENTER: 'enter',
  SEARCH: 'search',
  SOURCE: 'source',
  SETTINGS: 'settings',
  NUM_0: null,
  NUM_1: null,
  NUM_2: null,
  NUM_3: null,
  NUM_4: null,
  NUM_5: null,
  NUM_6: null,
  NUM_7: null,
  NUM_8: null,
  NUM_9: null,
  NUM_DASH: 'minus',
  RED: null,
  GREEN: null,
  YELLOW: null,
  BLUE: null,
  VOICE: 'mic',
};

/**
 * Text drawn on keys that have no icon (digits and OK). Every icon key is '' here: its artwork is
 * KEY_ICON. Kept as a table so callers that still print `glyph` compile (they show nothing extra).
 */
export const GLYPH: Record<Key, string> = {
  POWER: '',
  UP: '',
  DOWN: '',
  LEFT: '',
  RIGHT: '',
  OK: 'OK',
  BACK: '',
  HOME: '',
  MENU: '',
  INPUT: '',
  VOL_UP: '',
  VOL_DOWN: '',
  MUTE: '',
  CH_UP: '',
  CH_DOWN: '',
  REW: '',
  PLAY_PAUSE: '',
  FF: '',
  BACKSPACE: '',
  ENTER: '',
  SEARCH: '',
  SOURCE: '',
  SETTINGS: '',
  NUM_0: '0',
  NUM_1: '1',
  NUM_2: '2',
  NUM_3: '3',
  NUM_4: '4',
  NUM_5: '5',
  NUM_6: '6',
  NUM_7: '7',
  NUM_8: '8',
  NUM_9: '9',
  NUM_DASH: '',
  RED: '',
  GREEN: '',
  YELLOW: '',
  BLUE: '',
  VOICE: '',
};

/**
 * Top row (prototype v2): labelled Power / Source / Settings.
 * Source opens the source picker sheet in the app (it does not send a key directly).
 */
export const TOP_ROW = {
  power: key('POWER', GLYPH.POWER, 'power', 'ui.remote.power'),
  source: key('SOURCE', GLYPH.SOURCE, undefined, 'ui.remote.source'),
  settings: key('SETTINGS', GLYPH.SETTINGS, undefined, 'ui.remote.settings'),
} as const;
export const TOP_ROW_KEYS: readonly KeyControl[] = [TOP_ROW.power, TOP_ROW.source, TOP_ROW.settings];

/** Keys whose press opens an app sheet instead of sending (prototype click handler). */
export function opensSourceSheet(k: Key): boolean {
  return k === 'SOURCE';
}

/** Direction pad (prototype .pad): group label "Direction pad". */
export const DPAD_LABEL_KEY: MessageKey = 'ui.remote.dpad';
export const DPAD = {
  up: key('UP', GLYPH.UP),
  left: key('LEFT', GLYPH.LEFT),
  ok: key('OK', GLYPH.OK),
  right: key('RIGHT', GLYPH.RIGHT),
  down: key('DOWN', GLYPH.DOWN),
} as const;

export const TOUCHPAD_LABEL_KEY: MessageKey = 'ui.remote.touchpadLabel';
export const TOUCHPAD_HINT_KEY: MessageKey = 'ui.remote.touchpadHint';

/** D-pad / Touchpad segmented toggle: its own centred row in v2. */
export type NavMode = 'pad' | 'touch';
export const NAV_MODE_LABEL_KEY: MessageKey = 'ui.remote.navMode';
/**
 * @deprecated English only, kept so app/(tabs)/remote.tsx builds until it moves to
 * t(NAV_MODE_LABEL_KEY) (T48). Read from the catalogue, not hard-coded.
 */
export const NAV_MODE_LABEL: string = en['ui.remote.navMode'];
export const NAV_MODES: ReadonlyArray<{ mode: NavMode; label: string }> = [
  withCopy({ mode: 'pad' as NavMode, label: '' }, { label: 'ui.remote.navPad' }),
  withCopy({ mode: 'touch' as NavMode, label: '' }, { label: 'ui.remote.navTouch' }),
];

/** Big full-width "Hold to talk" button (prototype .voice). Behaviour lives in VoiceButton.tsx. */
export const VOICE_BUTTON = withCopy(
  { key: 'VOICE' as const, label: KEY_LABEL.VOICE, caption: '', icon: 'mic' as IconName },
  { caption: 'ui.remote.holdToTalk', label: KEY_LABEL_KEY.VOICE },
);

export const NAV_ROW: readonly KeyControl[] = [
  key('BACK', GLYPH.BACK, 'wide'),
  key('HOME', GLYPH.HOME, 'wide'),
  key('MENU', GLYPH.MENU, 'wide'),
];

export interface Rocker {
  label: string;
  caption: string;
  up: KeyControl;
  down: KeyControl;
}
export const VOLUME: Rocker = withCopy(
  { label: '', caption: '', up: key('VOL_UP', GLYPH.VOL_UP), down: key('VOL_DOWN', GLYPH.VOL_DOWN) },
  { label: 'ui.remote.volume', caption: 'ui.remote.volumeShort' },
);
export const CHANNEL: Rocker = withCopy(
  { label: '', caption: '', up: key('CH_UP', GLYPH.CH_UP), down: key('CH_DOWN', GLYPH.CH_DOWN) },
  { label: 'ui.remote.channel', caption: 'ui.remote.channelShort' },
);

/** An app action: an icon button whose accessibility label is translated on read. */
function action(id: ActionId, label: MessageKey, icon: IconName): ActionControl {
  return withCopy<ActionControl>({ kind: 'action', action: id, label: '', icon }, { label });
}

/** The 2x2 grid between the rockers (prototype v2 .mid): Mute, 123, Keyboard, Apps. */
export const MID: readonly Control[] = [
  key('MUTE', GLYPH.MUTE),
  action('NUMPAD', 'ui.remote.numberPad', 'numpad'),
  action('KEYBOARD', 'ui.remote.keyboard', 'keyboard'),
  action('APPS', 'ui.remote.appList', 'apps'),
];

export const PLAYBACK_ROW: readonly KeyControl[] = [
  key('REW', GLYPH.REW, 'wide'),
  key('PLAY_PAUSE', GLYPH.PLAY_PAUSE, 'wide'),
  key('FF', GLYPH.FF, 'wide'),
];

/** Colour buttons (prototype .colors): pill row, colours from the prototype. */
export interface ColorControl extends KeyControl {
  color: string;
}
export const COLOR_ROW_LABEL_KEY: MessageKey = 'ui.remote.colourButtons';
export const COLOR_HEX: Record<(typeof COLOR_KEYS)[number], string> = {
  RED: '#D9473F',
  GREEN: '#2E9A5A',
  YELLOW: '#E3B22B',
  BLUE: '#2F6BD3',
};
export const COLOR_ROW: readonly ColorControl[] = COLOR_KEYS.map((k) => ({ ...key(k, GLYPH[k]), color: COLOR_HEX[k] }));

/** Number pad sheet keys in grid order: 1-9, dash, 0, then OK (sends ENTER). */
export const NUMPAD_TITLE_KEY: MessageKey = 'ui.numpad.title';
export const NUMPAD_NOTE_KEY: MessageKey = 'ui.numpad.note';
export const NUMPAD_UNSUPPORTED_NOTE_KEY: MessageKey = 'ui.numpad.unsupported';
export const NUMPAD_GRID: readonly KeyControl[] = [
  ...(['NUM_1', 'NUM_2', 'NUM_3', 'NUM_4', 'NUM_5', 'NUM_6', 'NUM_7', 'NUM_8', 'NUM_9'] as const).map((k) => key(k, GLYPH[k])),
  key('NUM_DASH', GLYPH.NUM_DASH),
  key('NUM_0', GLYPH.NUM_0),
];
/** The numpad's OK: sends ENTER, a11y label 'Enter'. */
export const NUMPAD_OK: KeyControl = key('ENTER', 'OK');
// The numpad's OK shows the word (ui.common.ok), not the enter artwork.
NUMPAD_OK.icon = null;

/* ---------- capability-driven visibility ---------- */

export interface RemoteVisibility {
  /** Colour row only when the driver says RED/GREEN/YELLOW/BLUE reach the TV (hidden on Roku). */
  colorKeys: boolean;
  /** The 123 button is always on screen. */
  numpadButton: true;
  /** Whether the numpad sheet can send digits; false -> sheet shows NUMPAD_UNSUPPORTED_NOTE_KEY. */
  numpadDigits: boolean;
}

export function showColorKeys(caps: ReadonlySet<Capability>): boolean {
  return caps.has('colorKeys');
}

export function numpadSupported(caps: ReadonlySet<Capability>): boolean {
  return caps.has('numbers');
}

export function remoteVisibility(caps: ReadonlySet<Capability>): RemoteVisibility {
  return { colorKeys: showColorKeys(caps), numpadButton: true, numpadDigits: numpadSupported(caps) };
}

/** Every key control on the remote screen (not sheets), in on-screen order (prototype v2). */
export function allKeyControls(caps?: ReadonlySet<Capability>): KeyControl[] {
  const mid = MID.filter((c): c is KeyControl => c.kind === 'key');
  const colours = !caps || showColorKeys(caps) ? COLOR_ROW : [];
  return [
    ...TOP_ROW_KEYS,
    DPAD.up,
    DPAD.left,
    DPAD.ok,
    DPAD.right,
    DPAD.down,
    ...NAV_ROW,
    VOLUME.up,
    VOLUME.down,
    ...mid,
    CHANNEL.up,
    CHANNEL.down,
    ...PLAYBACK_ROW,
    ...colours,
  ];
}

/* ---------- touchpad gestures ---------- */

export type SwipeResult = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'OK' | null;

export interface SwipeOpts {
  /** Distance (pt) before a move counts as a direction. Prototype: 36. */
  threshold?: number;
  /** Max travel (pt) for a release to count as a tap. */
  tapSlop?: number;
  /** Max duration (ms) for a tap. Prototype: 250. */
  tapMaxMs?: number;
  /** Gesture duration so far; taps need it under tapMaxMs (omit to ignore time). */
  elapsedMs?: number;
  /** 'move' never yields OK (finger still down); 'end' may yield OK. Default 'end'. */
  phase?: 'move' | 'end';
}

export const SWIPE_DEFAULTS = { threshold: 36, tapSlop: 10, tapMaxMs: 250 } as const;

/**
 * Classify a touchpad gesture from its displacement (screen coords: +dy is down).
 * Beyond `threshold` on the dominant axis -> direction; tiny, quick release -> OK.
 */
export function classifySwipe(dx: number, dy: number, opts: SwipeOpts = {}): SwipeResult {
  const threshold = opts.threshold ?? SWIPE_DEFAULTS.threshold;
  const tapSlop = opts.tapSlop ?? SWIPE_DEFAULTS.tapSlop;
  const tapMaxMs = opts.tapMaxMs ?? SWIPE_DEFAULTS.tapMaxMs;
  const phase = opts.phase ?? 'end';
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax > threshold || ay > threshold) {
    if (ax > ay) return dx > 0 ? 'RIGHT' : 'LEFT';
    return dy > 0 ? 'DOWN' : 'UP';
  }
  if (phase === 'end' && ax <= tapSlop && ay <= tapSlop) {
    if (opts.elapsedMs !== undefined && opts.elapsedMs >= tapMaxMs) return null;
    return 'OK';
  }
  return null;
}

/** Latency text for the header (prototype: "34 ms" or an em dash). */
export function formatLatency(ms: number | null): string {
  return ms === null ? '—' : t('ui.remote.latency', { ms: String(Math.round(ms)) });
}
