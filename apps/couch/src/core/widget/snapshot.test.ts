import { setLocale } from '../../i18n/core';
import { MAX_WIDGET_ACTIONS } from './actions';
import { parseWidgetLink } from './links';
import {
  MAX_WIDGET_TV_NAME,
  WIDGET_OPEN_URL,
  buildWidgetSnapshot,
  parseWidgetSnapshot,
  pickWidgetActions,
  sameWidgetContent,
  serializeWidgetSnapshot,
  widgetConnection,
  widgetTvName,
  type WidgetSnapshotInput,
} from './snapshot';

const TV = { id: 'samsung-192.168.1.20', name: 'Living room' };
const base = (over: Partial<WidgetSnapshotInput> = {}): WidgetSnapshotInput => ({ tv: TV, state: 'connected', plus: true, now: 1000, ...over });

describe('widget snapshot', () => {
  afterEach(() => setLocale('en'));

  it('with Plus and a TV: name, connection and default buttons with deep links', () => {
    const s = buildWidgetSnapshot(base());
    expect(s.version).toBe(1);
    expect(s.updatedAt).toBe(1000);
    expect(s.plus).toBe(true);
    expect(s.tv).toEqual({ id: TV.id, name: 'Living room', connection: 'connected', connectionLabel: 'Connected' });
    expect(s.buttons.map((b) => b.action)).toEqual(['power', 'volume-down', 'volume-up', 'mute', 'next-input', 'play-pause']);
    expect(s.buttons[0]).toEqual({ action: 'power', label: 'Power', url: 'couch://widget/power?tv=samsung-192.168.1.20' });
    for (const b of s.buttons) expect(parseWidgetLink(b.url)).toEqual({ action: b.action, tvId: TV.id });
    expect(s.message).toBeNull();
    expect(s.openLabel).toBe('Open Couch');
    expect(s.openUrl).toBe(WIDGET_OPEN_URL);
  });

  it('without Plus: no buttons, a hint and the open tile; the TV is still named', () => {
    const s = buildWidgetSnapshot(base({ plus: false }));
    expect(s.plus).toBe(false);
    expect(s.buttons).toEqual([]);
    expect(s.message).toBe('Widgets come with Couch Plus. Every button in the app stays free.');
    expect(s.tv?.name).toBe('Living room');
    expect(s.openLabel).toBe('Open Couch');
  });

  it('with Plus but no TV (or demo mode): asks to add a TV', () => {
    const s = buildWidgetSnapshot(base({ tv: null, state: null }));
    expect(s.tv).toBeNull();
    expect(s.buttons).toEqual([]);
    expect(s.message).toBe('Add a TV in Couch to use this widget');
  });

  it('treats a TV with an invalid id as no TV (never builds a bad link)', () => {
    const s = buildWidgetSnapshot(base({ tv: { id: 'bad id/x', name: 'X' } }));
    expect(s.tv).toBeNull();
    expect(s.buttons).toEqual([]);
  });

  it('caps and dedupes buttons', () => {
    const s = buildWidgetSnapshot(base({ actions: ['mute', 'mute', 'home', 'nope' as never, 'power'], maxActions: 2 }));
    expect(s.buttons.map((b) => b.action)).toEqual(['mute', 'home']);
    expect(pickWidgetActions(['power', 'volume-up', 'volume-down', 'mute', 'next-input', 'home', 'play-pause'], 99)).toHaveLength(MAX_WIDGET_ACTIONS);
    expect(pickWidgetActions(undefined, 0)).toEqual([]);
    expect(pickWidgetActions(undefined, -3)).toEqual([]);
    expect(pickWidgetActions(undefined, Number.NaN)).toHaveLength(MAX_WIDGET_ACTIONS);
    expect(pickWidgetActions(['home'], 2.9)).toEqual(['home']);
  });

  it('maps connection states', () => {
    expect(widgetConnection('connected')).toBe('connected');
    expect(widgetConnection('connecting')).toBe('connecting');
    expect(widgetConnection('off')).toBe('off');
    expect(widgetConnection('disconnected')).toBe('offline');
    expect(widgetConnection('error')).toBe('offline');
    expect(widgetConnection(null)).toBe('offline');
    expect(widgetConnection('connected', true)).toBe('connecting');
    expect(buildWidgetSnapshot(base({ state: 'off' })).tv?.connectionLabel).toBe('Off');
    expect(buildWidgetSnapshot(base({ state: 'error' })).tv?.connectionLabel).toBe('Not connected');
    expect(buildWidgetSnapshot(base({ reconnecting: true })).tv?.connectionLabel).toBe('Connecting…');
  });

  it('cleans and shortens TV names', () => {
    expect(widgetTvName('  Bedroom   TV ')).toBe('Bedroom TV');
    expect(widgetTvName('   ')).toBe('Your TV');
    const long = widgetTvName('A very long television name that goes on and on');
    expect(Array.from(long)).toHaveLength(MAX_WIDGET_TV_NAME);
    expect(long.endsWith('…')).toBe(true);
    expect(widgetTvName('x'.repeat(MAX_WIDGET_TV_NAME))).toBe('x'.repeat(MAX_WIDGET_TV_NAME));
    // counts characters, not UTF-16 units
    expect(Array.from(widgetTvName('テレビ'.repeat(20)))).toHaveLength(MAX_WIDGET_TV_NAME);
  });

  it('translates labels in the active language when built', () => {
    setLocale('fr');
    const s = buildWidgetSnapshot(base());
    expect(s.openLabel).toBe('Ouvrir Couch');
    expect(s.tv?.connectionLabel).toBe('Connectée');
    expect(s.buttons.find((b) => b.action === 'next-input')?.label).toBe('Entrée suivante');
  });

  it('carries nothing secret', () => {
    const json = serializeWidgetSnapshot(buildWidgetSnapshot(base()));
    expect(json).not.toMatch(/"(host|mac|token|key|clientKey|psk)"/i);
  });

  it('round-trips through JSON', () => {
    for (const input of [base(), base({ plus: false }), base({ tv: null }), base({ state: 'off', actions: ['home'] })]) {
      const s = buildWidgetSnapshot(input);
      expect(parseWidgetSnapshot(serializeWidgetSnapshot(s))).toEqual(s);
    }
  });

  it('parse rejects malformed or tampered snapshots', () => {
    const good = JSON.parse(serializeWidgetSnapshot(buildWidgetSnapshot(base()))) as Record<string, unknown>;
    const bad = (patch: Record<string, unknown>) => JSON.stringify({ ...good, ...patch });
    expect(parseWidgetSnapshot(null)).toBeNull();
    expect(parseWidgetSnapshot('not json')).toBeNull();
    expect(parseWidgetSnapshot('[]')).toBeNull();
    expect(parseWidgetSnapshot(bad({ version: 2 }))).toBeNull();
    expect(parseWidgetSnapshot(bad({ plus: 'yes' }))).toBeNull();
    expect(parseWidgetSnapshot(bad({ openUrl: 'https://example.com' }))).toBeNull();
    expect(parseWidgetSnapshot(bad({ message: 3 }))).toBeNull();
    expect(parseWidgetSnapshot(bad({ tv: { ...(good['tv'] as object), connection: 'weird' } }))).toBeNull();
    expect(parseWidgetSnapshot(bad({ tv: { ...(good['tv'] as object), id: 'a b' } }))).toBeNull();
    // buttons without Plus or without a TV
    expect(parseWidgetSnapshot(bad({ plus: false }))).toBeNull();
    expect(parseWidgetSnapshot(bad({ tv: null }))).toBeNull();
    // a button whose link points at another TV or another action
    const buttons = good['buttons'] as Array<Record<string, unknown>>;
    expect(parseWidgetSnapshot(bad({ buttons: [{ ...buttons[0], url: 'couch://widget/power?tv=demo-2' }] }))).toBeNull();
    expect(parseWidgetSnapshot(bad({ buttons: [{ ...buttons[0], url: 'couch://widget/mute?tv=samsung-192.168.1.20' }] }))).toBeNull();
    expect(parseWidgetSnapshot(bad({ buttons: [{ ...buttons[0], url: 'https://evil.example/' }] }))).toBeNull();
    expect(parseWidgetSnapshot(bad({ buttons: Array(MAX_WIDGET_ACTIONS + 1).fill(buttons[0]) }))).toBeNull();
  });

  it('sameWidgetContent ignores updatedAt only', () => {
    const a = buildWidgetSnapshot(base({ now: 1 }));
    const b = buildWidgetSnapshot(base({ now: 2 }));
    expect(sameWidgetContent(a, b)).toBe(true);
    expect(sameWidgetContent(a, buildWidgetSnapshot(base({ state: 'off' })))).toBe(false);
    expect(sameWidgetContent(a, buildWidgetSnapshot(base({ plus: false })))).toBe(false);
    expect(sameWidgetContent(null, null)).toBe(true);
    expect(sameWidgetContent(a, null)).toBe(false);
  });
});
