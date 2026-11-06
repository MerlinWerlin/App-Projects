import type { RemoteArtAsset } from './packCatalog.ts';
import { WIDGET_IDENTITY_RECIPES } from './widgetIdentityRecipes.ts';

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

export type PackClockFace = { id: string; darkInk: boolean };
export const CLOCK_COMPANION_RELEASE = 'glaze-packs-v15';
export const CLOCK_COMPANION_FOLDER = 'clock-faces';

export function pilotClockFace(id: unknown): PackClockFace | undefined {
  if (typeof id !== 'string' || !Object.hasOwn(PILOT_INK, id)) return undefined;
  const key = id as keyof typeof PILOT_INK;
  return { id: key, darkInk: PILOT_INK[key] };
}

export function packClockFace(id: unknown, darkInk: boolean): PackClockFace | undefined {
  if (typeof id !== 'string' || id === 'alpine-starlight' || !Object.hasOwn(WIDGET_IDENTITY_RECIPES, id)) return undefined;
  return pilotClockFace(id) ?? { id, darkInk };
}

/** Reserved content-addressed widget-art asset. Older apps keep the file without listing it as an edition. */
export function packClockFaceAsset(assets: readonly RemoteArtAsset[] | undefined): RemoteArtAsset | undefined {
  return assets?.find(a => a.role === 'widget-art' && a.mime === 'image/png' &&
    /^[0-9a-f]{64}$/.test(a.sha256) && a.path === `clock-face.${a.sha256.slice(0, 8)}.png` &&
    Number.isInteger(a.width) && a.width === a.height && a.width >= 510 && a.width <= 1024 &&
    Number.isInteger(a.bytes) && a.bytes > 0 && a.bytes <= 1024 * 1024);
}

export function parseClockCompanion(raw: unknown, id: string): RemoteArtAsset | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { v, id: owner, asset } = raw as Record<string, unknown>;
  if (v !== 1 || owner !== id || !asset || typeof asset !== 'object') return undefined;
  return packClockFaceAsset([asset as RemoteArtAsset]);
}
