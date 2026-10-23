import { tileView } from './tileModel';

describe('tileView', () => {
  it('demo apps show their abstract art', () => {
    expect(tileView({ demo: true, iconUri: null, failed: false, loaded: false })).toEqual({ base: 'demo', image: false, shimmer: false });
  });

  it('shimmers while the icon is resolving, then while the image loads', () => {
    expect(tileView({ demo: false, iconUri: undefined, failed: false, loaded: false })).toEqual({ base: 'backdrop', image: false, shimmer: true });
    expect(tileView({ demo: false, iconUri: 'http://tv/i', failed: false, loaded: false })).toEqual({ base: 'backdrop', image: true, shimmer: true });
    expect(tileView({ demo: false, iconUri: 'http://tv/i', failed: false, loaded: true })).toEqual({ base: 'backdrop', image: true, shimmer: false });
  });

  it('falls back to the house tile with no icon or a failed image', () => {
    expect(tileView({ demo: false, iconUri: null, failed: false, loaded: false }).base).toBe('house');
    expect(tileView({ demo: false, iconUri: '', failed: false, loaded: false }).base).toBe('house');
    expect(tileView({ demo: false, iconUri: 'http://tv/i', failed: true, loaded: false })).toEqual({ base: 'house', image: false, shimmer: false });
  });
});
