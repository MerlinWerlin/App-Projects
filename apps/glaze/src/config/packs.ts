// Where downloadable theme packs live (T46, docs/THEME_PACKS.md; owner-1030 A, T160; T169; 1.0.37).
// Production (Glaze 1.0.37+) is Cloudflare R2 (Jared's choice, 15 Nov 2026; docs/PACK_HOSTING.md):
// one folder tree, published by .github/workflows/glaze-publish-r2.yml. Builds up to 1.0.36 keep
// reading the GitHub Release assets on MerlinWerlin/App-Projects, which stay published untouched.
// The app stays host-agnostic: a base URL plus a host kind read from it (src/core/packHost.ts):
//  - 'folder': any HTTPS base that is not a GitHub release (R2, a CDN, a custom domain):
//    <base>/catalog.json, <base>/art/<id>/v<n>/<file>. A catalogue entry's `release` is ignored.
//  - 'github-release': https://github.com/<owner>/<repo>/releases/download/<tag>. Release assets are
//    flat, so art/<id>/v<n>/<file> is fetched as <base>/art__<id>__v<n>__<file> (packObjectUrl).
// Integrity never depends on the host: every file is checked against the SHA-256 in its manifest.
// There is deliberately no automatic GitHub fallback: GitHub's catalogue is older, and since a pack
// "update" is any version change, falling back would roll packs back to versions without the new
// artwork. If the host is unreachable the app behaves exactly as offline (cached catalogue, no error).
// An empty URL disables packs (no network call at all; Settings › Storage shows PACKS_DISABLED_MESSAGE).
// The environment comes from Expo extra `packEnv` ('staging' | 'production'; set in app.json, or from
// an env var in an app.config), read in src/native/packs.ts; missing or anything else = production.
// Pure data + the URL helpers: no React Native / Expo imports, so src/core tests can read it too.

export { flatAssetName, isPackReleaseTag, packHostKind, packObjectUrl, packReleaseBase, type PackHostKind } from '../core/packHost.ts';

export type PackEnv = 'staging' | 'production';

/** The public repo whose releases hold the packs for builds up to 1.0.36 (and staging). */
export const PACK_RELEASE_REPO = 'MerlinWerlin/App-Projects';
/** Release tags: production packs, and a separate release for testing a pack set before it ships. */
export const PACK_RELEASE_TAGS: Readonly<Record<PackEnv, string>> = Object.freeze({
  staging: 'glaze-packs-staging',
  production: 'glaze-packs-v5',
});
// T274: production packs may also live in glaze-packs-v2, -v3, ... (a catalogue entry's `release`);
// catalog.json is always on PACK_RELEASE_TAGS.production. See packReleaseBase.

/** The download base of a release: https://github.com/<repo>/releases/download/<tag>. */
export function githubReleaseBase(repo: string, tag: string): string {
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}`;
}

/**
 * The production pack host. To move to a custom domain later, change this one line (e.g.
 * 'https://packs.example.com'), publish the same tree there, and ship a build.
 */
export const PACK_R2_PUBLIC_URL = 'https://pub-cffeea0b1da4434db6daadc18078e71c.r2.dev';

/** The GitHub release production base that builds up to 1.0.36 read (kept published, unchanged). */
export const GITHUB_PRODUCTION_BASE = githubReleaseBase(PACK_RELEASE_REPO, PACK_RELEASE_TAGS.production);

export const PACK_BASE_URLS: Readonly<Record<PackEnv, string>> = Object.freeze({
  /** Test release (build with app.json extra.packEnv = "staging"). */
  staging: githubReleaseBase(PACK_RELEASE_REPO, PACK_RELEASE_TAGS.staging),
  /** The store build: Cloudflare R2 (folder host). */
  production: PACK_R2_PUBLIC_URL,
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
