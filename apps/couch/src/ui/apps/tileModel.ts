/**
 * What an app tile's artwork shows, as a pure function (no React Native) so it can be tested.
 *
 * - demo: original abstract demo art (demo mode only; never a real service).
 * - house: the typographic house-style tile (app name on a Couch gradient).
 * - backdrop: the neutral tile backdrop the TV-supplied icon sits on (cover or contain).
 *
 * While the TV icon is still being resolved or the image is loading, a shimmer plays over the
 * backdrop; the image fades in once loaded. A TV with no icon, or an image that fails, falls back
 * to the house tile.
 */
export interface TileInputs {
  /** Demo art is available for this app (demo mode). */
  demo: boolean;
  /** undefined = still resolving, null = the TV gave none, string = URI as the TV supplied it. */
  iconUri: string | null | undefined;
  /** The image for iconUri failed to load. */
  failed: boolean;
  /** The image for iconUri has loaded. */
  loaded: boolean;
}

export interface TileView {
  base: 'demo' | 'house' | 'backdrop';
  /** Render the TV image (hidden until loaded, then faded in). */
  image: boolean;
  shimmer: boolean;
}

export function tileView({ demo, iconUri, failed, loaded }: TileInputs): TileView {
  if (demo) return { base: 'demo', image: false, shimmer: false };
  if (iconUri === undefined) return { base: 'backdrop', image: false, shimmer: true };
  if (iconUri === null || iconUri === '' || failed) return { base: 'house', image: false, shimmer: false };
  return { base: 'backdrop', image: true, shimmer: !loaded };
}
