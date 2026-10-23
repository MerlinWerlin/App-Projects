import { WIDGET_ACTIONS } from './actions';
import { MAX_WIDGET_LINK_LENGTH, buildWidgetLink, isValidWidgetTvId, looksLikeWidgetLink, parseWidgetLink } from './links';

const ROKU_ID = 'roku-uuid:roku:ecp:YJ00AB123456';

describe('widget deep links', () => {
  it('builds the documented shape', () => {
    expect(buildWidgetLink('power', 'demo-1')).toBe('couch://widget/power?tv=demo-1');
    expect(buildWidgetLink('volume-up', ROKU_ID)).toBe('couch://widget/volume-up?tv=roku-uuid%3Aroku%3Aecp%3AYJ00AB123456');
  });

  it('round-trips every action and realistic TV ids', () => {
    const ids = ['demo-1', ROKU_ID, 'samsung-192.168.1.20', 'lg-uuid_abc-def', 'ir-samsung32-07', 'a', 'x'.repeat(128)];
    for (const action of WIDGET_ACTIONS) {
      for (const tvId of ids) expect(parseWidgetLink(buildWidgetLink(action, tvId))).toEqual({ action, tvId });
    }
  });

  it('accepts an unencoded colon in the TV id', () => {
    expect(parseWidgetLink('couch://widget/mute?tv=roku-uuid:roku:ecp:1')).toEqual({ action: 'mute', tvId: 'roku-uuid:roku:ecp:1' });
  });

  it('refuses invalid ids when building', () => {
    expect(() => buildWidgetLink('power', '')).toThrow();
    expect(() => buildWidgetLink('power', 'a b')).toThrow();
    expect(() => buildWidgetLink('power', 'x'.repeat(129))).toThrow();
    expect(() => buildWidgetLink('nope' as never, 'demo-1')).toThrow();
  });

  it('validates TV ids', () => {
    expect(isValidWidgetTvId('demo-1')).toBe(true);
    expect(isValidWidgetTvId(ROKU_ID)).toBe(true);
    for (const bad of ['', ' ', 'a b', 'a/b', 'a?b', 'a&b', 'a#b', 'a%b', 'ü', 'x'.repeat(129), 'a\n', 3, null, undefined]) {
      expect(isValidWidgetTvId(bad)).toBe(false);
    }
  });

  it.each([
    // wrong scheme / host / shape
    ['https://widget/power?tv=demo-1'],
    ['couch:/widget/power?tv=demo-1'],
    ['couch:widget/power?tv=demo-1'],
    ['couch:///widget/power?tv=demo-1'],
    ['COUCH://widget/power?tv=demo-1'],
    ['couch://Widget/power?tv=demo-1'],
    ['couch://evil/power?tv=demo-1'],
    ['couch://widget.evil.com/power?tv=demo-1'],
    ['couch://user@widget/power?tv=demo-1'],
    ['couch://widget:80/power?tv=demo-1'],
    ['couch://widget/power/?tv=demo-1'],
    ['couch://widget//power?tv=demo-1'],
    ['couch://widget/power/extra?tv=demo-1'],
    ['couch://widget/?tv=demo-1'],
    ['couch://widget?tv=demo-1'],
    // actions
    ['couch://widget/Power?tv=demo-1'],
    ['couch://widget/reboot?tv=demo-1'],
    ['couch://widget/volume?tv=demo-1'],
    ['couch://widget/volume--up?tv=demo-1'],
    ['couch://widget/constructor?tv=demo-1'],
    ['couch://widget/%70ower?tv=demo-1'],
    // query
    ['couch://widget/power'],
    ['couch://widget/power?'],
    ['couch://widget/power?tv='],
    ['couch://widget/power?tv'],
    ['couch://widget/power?TV=demo-1'],
    ['couch://widget/power?id=demo-1'],
    ['couch://widget/power?tv=demo-1&tv=demo-2'],
    ['couch://widget/power?tv=demo-1&x=1'],
    ['couch://widget/power?x=1&tv=demo-1'],
    ['couch://widget/power?tv=demo-1#frag'],
    ['couch://widget/power?tv=demo-1;x'],
    ['couch://widget/power?tv=demo+1'],
    ['couch://widget/power?tv=demo 1'],
    ['couch://widget/power?tv=a%2Fb'],
    ['couch://widget/power?tv=a%20b'],
    ['couch://widget/power?tv=%E0%A4%A'],
    ['couch://widget/power?tv=%ZZ'],
    ['couch://widget/power?tv=%2525'],
    ['couch://widget/power?tv=%C3%BC'],
    // whitespace
    [' couch://widget/power?tv=demo-1'],
    ['couch://widget/power?tv=demo-1 '],
    ['couch://widget/power?tv=demo-1\n'],
    [''],
  ])('rejects %j', (url) => {
    expect(parseWidgetLink(url)).toBeNull();
  });

  it('rejects non-strings and over-long input without throwing', () => {
    for (const v of [null, undefined, 42, {}, ['couch://widget/power?tv=demo-1']]) expect(parseWidgetLink(v)).toBeNull();
    const long = `couch://widget/power?tv=${'a'.repeat(MAX_WIDGET_LINK_LENGTH)}`;
    expect(parseWidgetLink(long)).toBeNull();
    expect(parseWidgetLink(`couch://widget/power?tv=${'a'.repeat(129)}`)).toBeNull();
  });

  it('tells widget-path links from other links', () => {
    expect(looksLikeWidgetLink('couch://widget/power?tv=demo-1')).toBe(true);
    expect(looksLikeWidgetLink('couch://widget/reboot')).toBe(true);
    expect(looksLikeWidgetLink('couch://remote')).toBe(false);
    expect(looksLikeWidgetLink('https://example.com/widget/power')).toBe(false);
    expect(looksLikeWidgetLink(null)).toBe(false);
  });
});
