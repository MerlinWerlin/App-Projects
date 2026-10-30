// T169 (owner instruction 30 Oct 2026): where a pack file lives on the host, for every host kind.
// The pack layout is always described by RELATIVE paths (src/core/packCatalog.ts):
//   catalog.json, art/<id>/v<n>/manifest.json, art/<id>/v<n>/<file>  (and legacy <packId>/<path>)
// and this file turns (base URL, relative path) into the URL to GET:
//  - 'folder' hosts (a bucket / CDN / any static folder): <base>/<relative path>, each segment
//    URL-encoded.
//  - 'github-release' hosts (base = https://github.com/<owner>/<repo>/releases/download/<tag>):
//    release assets are a FLAT namespace (no folders), so every "/" becomes "__":
//      art/deep-sea/v1/thumb.1a2b3c4d.webp -> <base>/art__deep-sea__v1__thumb.1a2b3c4d.webp
//      catalog.json                         -> <base>/catalog.json
//    The mapping is injective because pack ids, "art" and "v<n>" never contain "_" and the last
//    segment is the remainder; scripts/packs/release_assets.mjs (which writes the flat files)
//    uses this same function and refuses names GitHub would rewrite.
// The kind is read from the base URL itself (path ends /<owner>/<repo>/releases/download/<tag>),
// so config can never disagree with the URL. Pure TS, no imports.

export type PackHostKind = 'folder' | 'github-release';

/** Separator that replaces "/" in a flat (GitHub release) asset name. */
export const FLAT_SEPARATOR = '__';

/** Characters GitHub keeps as-is in a release asset name (anything else is rewritten to "."). */
const FLAT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;

const RELEASE_PATH = /^https?:\/\/[^/\s]+\/[^/\s]+\/[^/\s]+\/releases\/download\/[^/\s]+\/*$/i;

/** 'github-release' when the base URL is a release download folder, else 'folder'. */
export function packHostKind(baseUrl: string): PackHostKind {
  return RELEASE_PATH.test(baseUrl.trim()) ? 'github-release' : 'folder';
}

/** The flat release-asset name of a relative pack path ("/" -> "__"). */
export function flatAssetName(relPath: string): string {
  return relPath.replace(/^\/+/, '').split('/').join(FLAT_SEPARATOR);
}

/** True when `name` is a release-asset name GitHub stores unchanged (letters, digits, . - _). */
export function isValidFlatAssetName(name: string): boolean {
  return FLAT_NAME.test(name) && name !== '.' && name !== '..';
}

/** Absolute URL of a relative pack path on the host at `baseUrl` (trailing slashes ignored). */
export function packObjectUrl(baseUrl: string, relPath: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const rel = relPath.replace(/^\/+/, '');
  if (packHostKind(base) === 'github-release') return `${base}/${encodeURIComponent(flatAssetName(rel))}`;
  return `${base}/${rel.split('/').map(encodeURIComponent).join('/')}`;
}
