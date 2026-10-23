import type { Key } from '../../core/keys';
import { WidgetTapGate } from '../../core/widget/tapGate';
import { createWidgetLinkHandler, type WidgetLinkTarget } from './linkHandler';

function fakeTarget(init: { ids?: string[]; active?: string | null; demo?: boolean; fail?: boolean } = {}) {
  const sent: Array<{ tv: string | null; key: Key }> = [];
  const state = { ids: init.ids ?? ['demo-1', 'roku-a:b'], active: init.active ?? 'demo-1', demo: init.demo ?? false, fail: init.fail ?? false };
  const target: WidgetLinkTarget = {
    tvIds: () => state.ids,
    activeId: () => state.active,
    isDemo: () => state.demo,
    select: (id) => {
      if (state.ids.includes(id)) state.active = id;
    },
    sendKey: async (key) => {
      sent.push({ tv: state.active, key });
      return !state.fail;
    },
  };
  return { target, sent, state };
}

describe('widget link handler', () => {
  it('sends the key for a valid link to the active TV', async () => {
    const { target, sent } = fakeTarget();
    const h = createWidgetLinkHandler(target, { now: () => 0 });
    expect(await h.handle('couch://widget/volume-up?tv=demo-1')).toBe('sent');
    expect(sent).toEqual([{ tv: 'demo-1', key: 'VOL_UP' }]);
  });

  it('switches to the TV named in the link first', async () => {
    const { target, sent, state } = fakeTarget();
    const h = createWidgetLinkHandler(target, { now: () => 0 });
    expect(await h.handle('couch://widget/power?tv=roku-a%3Ab')).toBe('sent');
    expect(state.active).toBe('roku-a:b');
    expect(sent).toEqual([{ tv: 'roku-a:b', key: 'POWER' }]);
  });

  it('leaves other links to the router and swallows malformed widget links', async () => {
    const { target, sent } = fakeTarget();
    const h = createWidgetLinkHandler(target, { now: () => 0 });
    expect(await h.handle('couch://remote')).toBe('notWidget');
    expect(await h.handle(null)).toBe('notWidget');
    expect(await h.handle(undefined)).toBe('notWidget');
    expect(await h.handle('couch://widget/reboot?tv=demo-1')).toBe('rejected');
    expect(await h.handle('couch://widget/power?tv=demo-1&x=1')).toBe('rejected');
    expect(sent).toEqual([]);
  });

  it('never sends to a TV it does not know, nor in demo mode', async () => {
    const a = fakeTarget();
    const h = createWidgetLinkHandler(a.target, { now: () => 0 });
    expect(await h.handle('couch://widget/power?tv=lg-gone')).toBe('unknownTv');
    expect(a.sent).toEqual([]);
    expect(a.state.active).toBe('demo-1');

    const d = fakeTarget({ demo: true });
    const hd = createWidgetLinkHandler(d.target, { now: () => 0 });
    expect(await hd.handle('couch://widget/power?tv=demo-1')).toBe('unknownTv');
    expect(d.sent).toEqual([]);
  });

  it('refuses when select() does not take (driver missing)', async () => {
    const { target, sent } = fakeTarget();
    const h = createWidgetLinkHandler({ ...target, select: () => {} }, { now: () => 0 });
    expect(await h.handle('couch://widget/mute?tv=roku-a:b')).toBe('unknownTv');
    expect(sent).toEqual([]);
  });

  it('dedupes identical taps within 250 ms', async () => {
    let t = 0;
    const { target, sent } = fakeTarget();
    const h = createWidgetLinkHandler(target, { now: () => t });
    expect(await h.handle('couch://widget/mute?tv=demo-1')).toBe('sent');
    t = 100;
    expect(await h.handle('couch://widget/mute?tv=demo-1')).toBe('duplicate');
    t = 120;
    expect(await h.handle('couch://widget/volume-down?tv=demo-1')).toBe('sent');
    t = 400;
    expect(await h.handle('couch://widget/mute?tv=demo-1')).toBe('sent');
    expect(sent.map((s) => s.key)).toEqual(['MUTE', 'VOL_DOWN', 'MUTE']);
  });

  it('rate-limits floods', async () => {
    const { target, sent } = fakeTarget();
    const h = createWidgetLinkHandler(target, { now: () => 0, gate: new WidgetTapGate({ maxPerWindow: 2 }) });
    expect(await h.handle('couch://widget/mute?tv=demo-1')).toBe('sent');
    expect(await h.handle('couch://widget/home?tv=demo-1')).toBe('sent');
    expect(await h.handle('couch://widget/power?tv=demo-1')).toBe('rateLimited');
    expect(sent).toHaveLength(2);
  });

  it('reports failure when the session could not send', async () => {
    const { target } = fakeTarget({ fail: true });
    const h = createWidgetLinkHandler(target, { now: () => 0 });
    expect(await h.handle('couch://widget/home?tv=demo-1')).toBe('failed');
    const throwing = createWidgetLinkHandler({ ...target, sendKey: () => Promise.reject(new Error('x')) }, { now: () => 0 });
    expect(await throwing.handle('couch://widget/home?tv=demo-1')).toBe('failed');
  });

  it('holds a cold-start link until the saved TVs load', async () => {
    let t = 0;
    const { target, sent, state } = fakeTarget({ ids: [], active: null });
    const h = createWidgetLinkHandler(target, { now: () => t });
    expect(await h.handle('couch://widget/power?tv=roku-a:b')).toBe('pending');
    expect(h.hasPending()).toBe(true);
    expect(await h.retryPending()).toBeNull(); // still nothing loaded
    t = 1500;
    state.ids = ['demo-1', 'roku-a:b'];
    state.active = 'demo-1';
    expect(await h.retryPending()).toBe('sent');
    expect(sent).toEqual([{ tv: 'roku-a:b', key: 'POWER' }]);
    expect(h.hasPending()).toBe(false);
    expect(await h.retryPending()).toBeNull();
  });

  it('drops a pending link that waited too long', async () => {
    let t = 0;
    const { target, sent, state } = fakeTarget({ ids: [], active: null });
    const h = createWidgetLinkHandler(target, { now: () => t, pendingMs: 1000 });
    expect(await h.handle('couch://widget/power?tv=demo-1')).toBe('pending');
    t = 1001;
    state.ids = ['demo-1'];
    state.active = 'demo-1';
    expect(await h.retryPending()).toBeNull();
    expect(h.hasPending()).toBe(false);
    expect(sent).toEqual([]);
  });

  it('a pending link for a TV that does not load is not sent elsewhere', async () => {
    const { target, sent, state } = fakeTarget({ ids: [], active: null });
    const h = createWidgetLinkHandler(target, { now: () => 0 });
    await h.handle('couch://widget/power?tv=lg-gone');
    state.ids = ['demo-1'];
    state.active = 'demo-1';
    expect(await h.retryPending()).toBe('unknownTv');
    expect(sent).toEqual([]);
  });
});
