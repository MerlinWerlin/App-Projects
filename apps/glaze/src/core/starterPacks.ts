// Glaze 1.0.38 (owner 2026-11-15: "keep Cloudflare R2 AND bundle a small starter set"): a few complete
// theme packs ship inside the app (scripts/packs/bundle_starters.mjs writes assets/starter-packs and
// src/generated/starterPacks.ts). They are installed through the SAME downloader as a real download
// (downloadRemoteArtPack: manifest, per-file SHA-256, the same folder and local manifest), only with a
// transport that reads the bundled files instead of the network. So a starter looks and behaves exactly
// like a downloaded pack, updates like one when the catalogue moves on, and is never fetched over the
// network while the catalogue still lists the bundled version.
// Pure: no React Native imports (src/native/starterPacks.ts is the device side).
import type { Catalog, CatalogPack, RemoteArtManifest } from './packCatalog.ts';
import type { Transport } from './packDownloader.ts';
import { utf8Encode } from './bytes.ts';

/** The (never contacted) folder-host base the bundled transport answers for. */
export const STARTER_BASE = 'https://starter-packs.glaze.invalid';

export type StarterPackData = {
  entry: CatalogPack;
  manifest: RemoteArtManifest;
  /** File name in the pack's version folder -> bundled module. */
  files: Readonly<Record<string, number>>;
};

/** The starter to install from for this catalogue entry: same pack AND same version, else null. */
export function starterFor<T extends StarterPackData>(starters: readonly T[], id: string, packVersion: number | null | undefined): T | null {
  const s = starters.find((x) => x.entry.id === id);
  return s && s.entry.packVersion === packVersion ? s : null;
}

/**
 * What a bundled-transport URL asks for: the manifest or one file of a starter, or null for anything
 * else (another host, another pack or version, a path outside the version folder).
 */
export function starterRequest(
  starters: readonly StarterPackData[],
  url: string,
): { kind: 'manifest'; starter: StarterPackData } | { kind: 'file'; starter: StarterPackData; module: number } | null {
  if (!url.startsWith(`${STARTER_BASE}/`)) return null;
  const rel = url.slice(STARTER_BASE.length + 1).split('?')[0];
  const m = /^art\/([a-z0-9-]+)\/v(\d+)\/([A-Za-z0-9._-]+)$/.exec(rel.split('/').map(decodeURIComponent).join('/'));
  if (!m) return null;
  const starter = starterFor(starters, m[1], Number(m[2]));
  if (!starter) return null;
  if (m[3] === 'manifest.json') return { kind: 'manifest', starter };
  const module = Object.prototype.hasOwnProperty.call(starter.files, m[3]) ? starter.files[m[3]] : undefined;
  return typeof module === 'number' ? { kind: 'file', starter, module } : null;
}

/**
 * The catalogue to list when the phone has none of its own yet (first launch, host unreachable):
 * just the starters, so the Themes tab is never empty. Never saved as the cached catalogue; the
 * real one replaces it as soon as it arrives.
 */
export function starterCatalog(starters: readonly StarterPackData[]): Catalog | null {
  if (!starters.length) return null;
  return { format: 'glaze-catalog', version: 1, generatedAt: '1970-01-01T00:00:00.000Z', packs: starters.map((s) => s.entry) } as Catalog;
}

/**
 * The starters to install on this launch: not on the phone yet and never installed before (a starter
 * the person removed in Settings is not put back; tapping it again installs it from the bundle).
 */
export function starterInstallPlan(starters: readonly StarterPackData[], onPhone: ReadonlySet<string>, offered: ReadonlySet<string>): string[] {
  return starters.map((s) => s.entry.id).filter((id) => !onPhone.has(id) && !offered.has(id));
}

/** A starter's bundled thumbnail module for a catalogue theme at the bundled version, else null. */
export function starterThumb(starters: readonly StarterPackData[], id: string, packVersion: number | null | undefined): number | null {
  const s = starterFor(starters, id, packVersion);
  if (!s) return null;
  const thumb = s.manifest.assets.find((a) => a.role === 'thumb');
  const mod = thumb ? s.files[thumb.path] : undefined;
  return typeof mod === 'number' ? mod : null;
}

/**
 * Dreamroom stage (DESIGN.md §5): a starter's bundled full-size wallpaper module (the widest one
 * bundled) for a catalogue theme at the bundled version, else null. The stage shows art far larger
 * than the 240 px thumbnails, so it only uses art the app carries at full size.
 */
export function starterWallpaper(starters: readonly StarterPackData[], id: string, packVersion: number | null | undefined): number | null {
  const s = starterFor(starters, id, packVersion);
  if (!s) return null;
  let best: { width: number; mod: number } | null = null;
  for (const a of s.manifest.assets) {
    if (a.role !== 'wallpaper') continue;
    const mod = s.files[a.path];
    if (typeof mod !== 'number') continue;
    const width = typeof a.width === 'number' ? a.width : 0;
    if (!best || width > best.width) best = { width, mod };
  }
  return best ? best.mod : null;
}

/**
 * The downloader transport for installing a starter: GETs under STARTER_BASE are answered from the app
 * bundle (`readModule` reads a bundled file's bytes; the manifest is the bundled copy), everything else
 * (writes, reads, moves of the pack store) goes to the phone's own transport. Any other URL rejects,
 * so installing a starter can never reach the network.
 */
export function starterTransport(starters: readonly StarterPackData[], device: Transport, readModule: (module: number) => Promise<Uint8Array>): Transport {
  const one = (bytes: Uint8Array): AsyncIterable<Uint8Array> => ({
    [Symbol.asyncIterator]() {
      let sent = false;
      return { next: async () => (sent ? { done: true as const, value: undefined } : ((sent = true), { done: false as const, value: bytes })) };
    },
  });
  return {
    async fetchRange(url, start) {
      const req = starterRequest(starters, url);
      if (!req) throw new Error('not a bundled starter file');
      const bytes = req.kind === 'manifest' ? utf8Encode(JSON.stringify(req.starter.manifest)) : await readModule(req.module);
      // A resumed partial file: hand over the rest (the downloader appends from `start`).
      return start > 0 && start < bytes.length ? { offset: start, chunks: one(bytes.subarray(start)) } : { offset: 0, chunks: one(bytes) };
    },
    writeAppend: (p, c) => device.writeAppend(p, c),
    readFile: (p) => device.readFile(p),
    remove: (p) => device.remove(p),
    ...(device.move ? { move: (a: string, b: string) => device.move!(a, b) } : {}),
    ...(device.size ? { size: (p: string) => device.size!(p) } : {}),
  };
}
