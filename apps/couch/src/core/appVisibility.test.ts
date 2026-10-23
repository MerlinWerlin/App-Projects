import {
  hiddenCount,
  hideAllExcept,
  normaliseVisibility,
  parseVisibilityDoc,
  setFavouritesOnly,
  setHidden,
  showAll,
  VisibilityRepo,
  VISIBILITY_KEY,
  visibleSections,
} from './appVisibility';
import { MemoryKv } from './store';
import { STORE_SERVICES, servicesIn, serviceFor } from './storeIcons';

const a = (id: string) => ({ id, name: id });
const sections = { favourites: [a('f1')], others: [a('o1'), a('o2'), a('o3')] };

describe('app visibility (owner-1022)', () => {
  it('normalises untrusted data', () => {
    expect(normaliseVisibility(null)).toEqual({ hidden: [], favouritesOnly: false });
    expect(normaliseVisibility({ hidden: ['x', 'x', 3, ''], favouritesOnly: 'yes' })).toEqual({ hidden: ['x'], favouritesOnly: false });
    expect(parseVisibilityDoc('nope')).toEqual({});
    expect(parseVisibilityDoc('{"tv":{"hidden":["a"],"favouritesOnly":true}}')).toEqual({ tv: { hidden: ['a'], favouritesOnly: true } });
  });

  it('hides and shows apps, favourites always visible', () => {
    let v = normaliseVisibility({});
    v = setHidden(v, 'o2', true);
    v = setHidden(v, 'f1', true);
    const vis = visibleSections(sections, v);
    expect(vis.favourites.map((x) => x.id)).toEqual(['f1']);
    expect(vis.others.map((x) => x.id)).toEqual(['o1', 'o3']);
    expect(hiddenCount(v, sections.others)).toBe(1);
    expect(visibleSections(sections, setHidden(v, 'o2', false)).others).toHaveLength(3);
    expect(visibleSections(sections, showAll(v)).others).toHaveLength(3);
  });

  it('favourites only, hide all except favourites, and edit mode shows everything', () => {
    const fo = setFavouritesOnly(normaliseVisibility({}), true);
    expect(visibleSections(sections, fo).others).toEqual([]);
    expect(visibleSections(sections, fo, true).others).toHaveLength(3);
    const only = hideAllExcept(normaliseVisibility({}), ['f1', 'o1', 'o2', 'o3'], ['f1']);
    expect(only.hidden).toEqual(['o1', 'o2', 'o3']);
  });

  it('persists per TV', async () => {
    const kv = new MemoryKv();
    const r1 = new VisibilityRepo(kv);
    await r1.save('tv-1', { hidden: ['o1'], favouritesOnly: true });
    const r2 = new VisibilityRepo(kv);
    expect(await r2.load('tv-1')).toEqual({ hidden: ['o1'], favouritesOnly: true });
    expect(await r2.load('tv-2')).toEqual({ hidden: [], favouritesOnly: false });
    expect(JSON.parse(kv.data.get(VISIBILITY_KEY)!)).toHaveProperty('tv-1');
  });
});

describe('service catalogue covers the US and Europe (owner-1022)', () => {
  it('has unique ids and every region', () => {
    expect(new Set(STORE_SERVICES.map((s) => s.id)).size).toBe(STORE_SERVICES.length);
    for (const r of ['global', 'au', 'us', 'uk', 'eu'] as const) expect(servicesIn(r).length).toBeGreaterThanOrEqual(7);
  });

  it('matches common TV names', () => {
    expect(serviceFor({ id: 'x', name: 'BBC iPlayer' })?.id).toBe('svc.bbciplayer');
    expect(serviceFor({ id: 'x', name: 'TED' })?.id).toBe('svc.ted');
    expect(serviceFor({ id: 'x', name: 'HBO Max' })?.id).toBe('svc.max');
    expect(serviceFor({ id: 'x', name: 'Canal+' })?.id).toBe('svc.canalplus');
    expect(serviceFor({ id: 'x', name: 'ZDF' })?.id).toBe('svc.zdf');
  });
});
