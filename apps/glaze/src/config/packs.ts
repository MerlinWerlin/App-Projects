// Where downloadable theme packs live (T46, docs/THEME_PACKS.md; owner-1030 A, T160; T169).
// Hosting is GitHub Release assets on the public repo MerlinWerlin/App-Projects (owner decision
// 30 Oct 2026, replacing the Cloudflare R2 plan; docs/PACK_HOSTING.md). The app stays
// host-agnostic: a base URL plus a host kind read from it (src/core/packHost.ts):
//  - 'github-release': https://github.com/<owner>/<repo>/releases/download/<tag>. Release assets are
//    flat, so art/<id>/v<n>/<file> is fetched as <base>/art__<id>__v<n>__<file> (packObjectUrl).
//  - 'folder': any other HTTPS base (a bucket, a CDN, a custom domain): <base>/art/<id>/v<n>/<file>.
// Integrity never depends on the host: every file is checked against the SHA-256 in its manifest.
// While a release does not exist yet, catalog.json 404s and the app treats it exactly like being
// offline (cached or empty catalogue, no error shown). An empty URL disables packs (no network
// call at all; Settings › Storage shows PACKS_DISABLED_MESSAGE).
// The environment comes from Expo extra `packEnv` ('staging' | 'production'; set in app.json, or from
// an env var in an app.config), read in src/native/packs.ts; missing or anything else = production.
// Pure data + the URL helpers: no React Native / Expo imports, so src/core tests can read it too.

export { flatAssetName, packHostKind, packObjectUrl, type PackHostKind } from '../core/packHost.ts';

export type PackEnv = 'staging' | 'production';

/** The public repo whose releases hold the packs. */
export const PACK_RELEASE_REPO = 'MerlinWerlin/App-Projects';
/** Release tags: production packs, and a separate release for testing a pack set before it ships. */
export const PACK_RELEASE_TAGS: Readonly<Record<PackEnv, string>> = Object.freeze({
  staging: 'glaze-packs-staging',
  production: 'glaze-packs-v1',
});

/** The download base of a release: https://github.com/<repo>/releases/download/<tag>. */
export function githubReleaseBase(repo: string, tag: string): string {
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}`;
}

export const PACK_BASE_URLS: Readonly<Record<PackEnv, string>> = Object.freeze({
  /** Test release (build with app.json extra.packEnv = "staging"). */
  staging: githubReleaseBase(PACK_RELEASE_REPO, PACK_RELEASE_TAGS.staging),
  /** The store build. */
  production: githubReleaseBase(PACK_RELEASE_REPO, PACK_RELEASE_TAGS.production),
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
