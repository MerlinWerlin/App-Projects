import { isWidgetSystemPath, redirectSystemPath } from './nativeIntent';

describe('widget system-path redirect', () => {
  it('sends widget links to the start screen', () => {
    for (const path of ['couch://widget/power?tv=demo-1', '/widget/power?tv=demo-1', 'widget/mute?tv=x', '/widget', 'couch://widget/bogus']) {
      expect(isWidgetSystemPath(path)).toBe(true);
      expect(redirectSystemPath({ path, initial: true })).toBe('/');
    }
  });

  it('leaves every other path alone', () => {
    for (const path of ['/', '/remote', '/settings', 'couch://remote', '/widgets', '/widgetry', 'https://example.com/widget/power']) {
      expect(isWidgetSystemPath(path)).toBe(false);
      expect(redirectSystemPath({ path, initial: false })).toBe(path);
    }
  });
});
