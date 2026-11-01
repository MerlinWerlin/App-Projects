import { ANDROIDTV_APPS, androidTvApps } from './apps';

describe('Google TV app list', () => {
  it('includes the owner\'s remote buttons and has unique, non-empty links', () => {
    const names = ANDROIDTV_APPS.map((a) => a.name);
    for (const n of ['Netflix', 'YouTube', 'Prime Video', 'Disney+', 'Stan']) expect(names).toContain(n);
    const ids = ANDROIDTV_APPS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^(https:\/\/|market:\/\/launch\?id=|[a-z]+:\/\/)/);
  });
  it('returns copies', () => {
    const a = androidTvApps();
    a[0]!.name = 'x';
    expect(ANDROIDTV_APPS[0]!.name).toBe('Netflix');
  });
});
