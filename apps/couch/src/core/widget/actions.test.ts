import { isKey } from '../keys';
import { setLocale } from '../../i18n/core';
import {
  DEFAULT_WIDGET_ACTIONS,
  MAX_WIDGET_ACTIONS,
  WIDGET_ACTIONS,
  actionKeys,
  isWidgetAction,
  widgetActionLabel,
} from './actions';

describe('widget actions', () => {
  afterEach(() => setLocale('en'));

  it('has the seven planned actions', () => {
    expect([...WIDGET_ACTIONS]).toEqual(['power', 'volume-up', 'volume-down', 'mute', 'next-input', 'home', 'play-pause']);
  });

  it('maps every action to real remote keys', () => {
    expect(actionKeys('power')).toEqual(['POWER']);
    expect(actionKeys('volume-up')).toEqual(['VOL_UP']);
    expect(actionKeys('volume-down')).toEqual(['VOL_DOWN']);
    expect(actionKeys('mute')).toEqual(['MUTE']);
    expect(actionKeys('next-input')).toEqual(['SOURCE']);
    expect(actionKeys('home')).toEqual(['HOME']);
    expect(actionKeys('play-pause')).toEqual(['PLAY_PAUSE']);
    for (const a of WIDGET_ACTIONS) {
      expect(actionKeys(a).length).toBeGreaterThan(0);
      for (const k of actionKeys(a)) expect(isKey(k)).toBe(true);
    }
  });

  it('key lists are frozen', () => {
    expect(Object.isFrozen(actionKeys('power'))).toBe(true);
    expect(() => (actionKeys('mute') as string[]).push('POWER')).toThrow();
  });

  it('recognises action ids exactly', () => {
    for (const a of WIDGET_ACTIONS) expect(isWidgetAction(a)).toBe(true);
    for (const bad of ['Power', 'POWER', 'volume_up', 'volumeUp', '', ' power', 'power ', 'toString', 'constructor', 7, null, undefined, {}]) {
      expect(isWidgetAction(bad)).toBe(false);
    }
  });

  it('labels come from the catalogue and follow the language', () => {
    expect(widgetActionLabel('power')).toBe('Power');
    expect(widgetActionLabel('volume-up')).toBe('Volume up');
    expect(widgetActionLabel('next-input')).toBe('Next input');
    expect(widgetActionLabel('play-pause')).toBe('Play or pause');
    setLocale('de');
    expect(widgetActionLabel('next-input')).toBe('Nächster Eingang');
    setLocale('pseudo');
    expect(widgetActionLabel('mute')).not.toBe('Mute');
  });

  it('defaults fit the cap and are valid', () => {
    expect(DEFAULT_WIDGET_ACTIONS.length).toBeLessThanOrEqual(MAX_WIDGET_ACTIONS);
    expect(DEFAULT_WIDGET_ACTIONS[0]).toBe('power');
    for (const a of DEFAULT_WIDGET_ACTIONS) expect(isWidgetAction(a)).toBe(true);
  });
});
