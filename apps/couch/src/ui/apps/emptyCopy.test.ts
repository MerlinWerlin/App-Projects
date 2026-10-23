import { APPS_EMPTY_COPY, appsEmptyCopy, appsEmptyKind, type AppsEmptyKind } from './emptyCopy';

describe('appsEmptyKind', () => {
  it('shows nothing while loading', () => {
    expect(appsEmptyKind({ kind: null, appCount: 0, demo: false })).toBeNull();
    expect(appsEmptyKind({ kind: null, appCount: 0, demo: true })).toBeNull();
  });

  it('maps no TV, unsupported and error', () => {
    expect(appsEmptyKind({ kind: 'none', appCount: 0, demo: false })).toBe('noTv');
    expect(appsEmptyKind({ kind: 'unsupported', appCount: 0, demo: false })).toBe('unsupported');
    expect(appsEmptyKind({ kind: 'error', appCount: 0, demo: true })).toBe('error');
  });

  it('distinguishes the demo with no apps from a real TV with none', () => {
    expect(appsEmptyKind({ kind: 'ok', appCount: 0, demo: true })).toBe('demoEmpty');
    expect(appsEmptyKind({ kind: 'ok', appCount: 0, demo: false })).toBe('empty');
  });

  it('shows no empty state when there are apps', () => {
    expect(appsEmptyKind({ kind: 'ok', appCount: 3, demo: true })).toBeNull();
    expect(appsEmptyKind({ kind: 'ok', appCount: 1, demo: false })).toBeNull();
  });
});

describe('appsEmptyCopy', () => {
  const kinds: AppsEmptyKind[] = ['noTv', 'demoEmpty', 'unsupported', 'error', 'empty'];

  it('has short, non-empty copy for every state', () => {
    for (const k of kinds) {
      const c = APPS_EMPTY_COPY[k];
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.title.length).toBeLessThanOrEqual(32);
      expect(c.body.length).toBeGreaterThan(0);
      expect(c.body.length).toBeLessThanOrEqual(120);
    }
  });

  it('offers retry on error and a way to the TVs tab when there is no TV', () => {
    expect(APPS_EMPTY_COPY.error.action).toEqual({ label: 'Try again', does: 'retry' });
    expect(APPS_EMPTY_COPY.noTv.action?.does).toBe('openTvs');
    expect(APPS_EMPTY_COPY.unsupported.action).toBeUndefined();
  });

  it("keeps the TV-doesn't-share wording", () => {
    expect(APPS_EMPTY_COPY.unsupported.body).toContain("doesn't share its app list");
  });

  it('uses the error message as the body when there is one', () => {
    expect(appsEmptyCopy('error', 'TV timed out').body).toBe('TV timed out');
    expect(appsEmptyCopy('error', '   ').body).toBe(APPS_EMPTY_COPY.error.body);
    expect(appsEmptyCopy('error', null).body).toBe(APPS_EMPTY_COPY.error.body);
    expect(appsEmptyCopy('error', 'x').action?.does).toBe('retry');
  });

  it('ignores an error message for other states', () => {
    expect(appsEmptyCopy('empty', 'boom')).toBe(APPS_EMPTY_COPY.empty);
  });
});
