// Where downloadable theme packs live (T46, docs/THEME_PACKS.md; owner-1030 A, T160).
// Hosting is Cloudflare R2 (owner decision 30 Oct 2026), but the app stays host-agnostic: a base
// URL is just the folder that holds catalog.json and art/<id>/v<n>/ (src/core/packCatalog.ts).
//  - First: the bucket's public r2.dev URL, e.g. 'https://pub-<hash>.r2.dev' (no trailing slash needed).
//  - Later: a custom domain on the same bucket, e.g. 'https://packs.<domain>'. HTTPS only.
// While the chosen environment's URL is empty, packs are disabled and the app makes no network
// call at all; Settings › Storage shows PACKS_DISABLED_MESSAGE.
// The environment comes from Expo extra `packEnv` ('staging' | 'production'; set in app.json, or from
// an env var in an app.config), read in src/native/packs.ts; missing or anything else = production.
// Pure data: no React Native / Expo imports, so src/core tests can read it too.

export type PackEnv = 'staging' | 'production';

export const PACK_BASE_URLS: Readonly<Record<PackEnv, string>> = Object.freeze({
  /** Test bucket (or a folder of the same bucket) for builds before release. */
  staging: '',
  /** The store build. */
  production: '',
});

/** 'staging' only when asked for exactly; anything else (missing, typo) is production. */
export function packEnvFrom(raw: unknown): PackEnv {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'staging' ? 'staging' : 'production';
}

/** The base URL for an environment ('' = packs disabled). */
export function packBaseUrl(env: PackEnv, urls: Readonly<Record<PackEnv, string>> = PACK_BASE_URLS): string {
  return (urls[env] ?? '').trim();
}

/** Production base URL; kept for existing callers. Empty = disabled. */
export const PACK_BASE_URL = packBaseUrl('production');

export const PACKS_DISABLED_MESSAGE = 'Theme packs arrive with the store release';
