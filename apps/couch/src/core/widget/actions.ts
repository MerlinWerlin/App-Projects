/**
 * Home Screen widget actions (T77, part 1). Pure TypeScript, no React Native.
 *
 * A widget button is one of a small, fixed set of actions. Each action maps to ordinary remote keys
 * (src/core/keys.ts), so a widget tap sends exactly what the same button in the app sends. Every TV
 * control stays free: nothing here knows about Couch Plus.
 */
import { t, type MessageKey } from '../../i18n/core';
import { KEY_LABEL_KEY, type Key } from '../keys';

/** Action ids. They are also the path segment of the widget deep link (couch://widget/<action>). */
export const WIDGET_ACTIONS = ['power', 'volume-up', 'volume-down', 'mute', 'next-input', 'home', 'play-pause'] as const;

export type WidgetAction = (typeof WIDGET_ACTIONS)[number];

export function isWidgetAction(v: unknown): v is WidgetAction {
  return typeof v === 'string' && (WIDGET_ACTIONS as readonly string[]).includes(v);
}

/** The remote key(s) each action sends, in order. */
const ACTION_KEYS: Readonly<Record<WidgetAction, readonly Key[]>> = Object.freeze({
  // POWER toggles on every driver that supports it; waking a TV that is fully off is the driver's job.
  power: Object.freeze(['POWER'] as const),
  'volume-up': Object.freeze(['VOL_UP'] as const),
  'volume-down': Object.freeze(['VOL_DOWN'] as const),
  mute: Object.freeze(['MUTE'] as const),
  // SOURCE steps to the next input, the same key the remote's Source button and inputs.ts use.
  'next-input': Object.freeze(['SOURCE'] as const),
  home: Object.freeze(['HOME'] as const),
  'play-pause': Object.freeze(['PLAY_PAUSE'] as const),
});

/** Keys to send for a widget action (never empty). */
export function actionKeys(action: WidgetAction): readonly Key[] {
  return ACTION_KEYS[action];
}

const ACTION_LABEL_KEY: Readonly<Record<WidgetAction, MessageKey>> = {
  power: KEY_LABEL_KEY.POWER!,
  'volume-up': KEY_LABEL_KEY.VOL_UP!,
  'volume-down': KEY_LABEL_KEY.VOL_DOWN!,
  mute: KEY_LABEL_KEY.MUTE!,
  'next-input': 'core.widget.action.nextInput',
  home: KEY_LABEL_KEY.HOME!,
  'play-pause': KEY_LABEL_KEY.PLAY_PAUSE!,
};

/** Translated label (also the accessibility label) for a widget button, in the active language. */
export function widgetActionLabel(action: WidgetAction): string {
  return t(ACTION_LABEL_KEY[action]);
}

/** What a small / medium widget shows by default (PLAN: power + volume first). */
export const DEFAULT_WIDGET_ACTIONS: readonly WidgetAction[] = Object.freeze([
  'power',
  'volume-down',
  'volume-up',
  'mute',
  'next-input',
  'play-pause',
]);

/** Most buttons a widget snapshot carries (a medium widget fits about six). */
export const MAX_WIDGET_ACTIONS = 6;
