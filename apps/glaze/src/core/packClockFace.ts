import type { RemoteArtAsset } from './packCatalog.ts';

const PILOT_INK = {
  'blueprint-bureau': false,
  'cherry-arcade': false,
  'espresso-hour': false,
  'fern-and-brass': false,
  honeywood: true,
  'nebula-veil': false,
  'porcelain-tide': true,
  rainlight: false,
} as const;

export type PackClockFace = { id: keyof typeof PILOT_INK; darkInk: boolean };

export function pilotClockFace(id: unknown): PackClockFace | undefined {
  if (typeof id !== 'string' || !Object.hasOwn(PILOT_INK, id)) return undefined;
  const key = id as PackClockFace['id'];
  return { id: key, darkInk: PILOT_INK[key] };
}

/** Reserved content-addressed widget-art asset. Older apps keep the file without listing it as an edition. */
export function packClockFaceAsset(assets: readonly RemoteArtAsset[] | undefined): RemoteArtAsset | undefined {
  return assets?.find(a => a.role === 'widget-art' && a.mime === 'image/png' &&
    a.path === `clock-face.${a.sha256.slice(0, 8)}.png` && a.width === a.height &&
    a.width >= 510 && a.width <= 1024 && a.bytes <= 1024 * 1024);
}
