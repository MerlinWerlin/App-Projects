// Pack-only motifs (T47). A downloaded theme pack can bring motifs that aren't in the built-in
// library (src/core/artwork.ts MOTIFS): its art assets carry their vector layers. Once a pack is
// loaded on the phone, its motifs are registered here and the artwork layout functions draw them
// like built-in ones. Built-in ids always win (a pack can't redraw a built-in motif), and the
// registry is in memory only: it is filled again whenever a downloaded pack is read.
// Pure TS (no React Native / Expo) so Node can run and test it directly.

import type { MotifLayer } from './artwork.ts';

/** Same caps as the art asset decoder: ids are slugs, a motif has at most 5 layers. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_LAYERS = 5;
const MAX_PATH = 20000;
/** Mirrors artwork.ts FILL_ROLES (kept local so this module has no runtime import cycle). */
const ROLES: readonly string[] = ['primary', 'secondary', 'accent', 'ink', 'light'];

const byPack = new Map<string, ReadonlyMap<string, readonly MotifLayer[]>>();
let version = 0;
const listeners = new Set<() => void>();

function changed(): void {
  version++;
  for (const l of listeners) l();
}

function cleanLayers(layers: unknown): MotifLayer[] {
  if (!Array.isArray(layers)) return [];
  const out: MotifLayer[] = [];
  for (const l of layers) {
    if (out.length >= MAX_LAYERS) break;
    if (!l || typeof l !== 'object') continue;
    const { d, role, opacity } = l as Partial<MotifLayer>;
    if (typeof d !== 'string' || d.length === 0 || d.length >= MAX_PATH || typeof role !== 'string' || !ROLES.includes(role)) continue;
    out.push(typeof opacity === 'number' && Number.isFinite(opacity) ? { d, role, opacity } : { d, role });
  }
  return out;
}

/**
 * Register (or replace) a pack's motifs. `isBuiltIn` filters out ids the app already draws.
 * Returns the ids now registered for the pack.
 */
export function registerPackMotifs(
  packId: string,
  motifs: Readonly<Record<string, readonly MotifLayer[]>>,
  isBuiltIn: (id: string) => boolean = () => false,
): string[] {
  const m = new Map<string, readonly MotifLayer[]>();
  for (const [id, layers] of Object.entries(motifs)) {
    if (!SLUG.test(id) || isBuiltIn(id)) continue;
    const clean = cleanLayers(layers);
    if (clean.length) m.set(id, Object.freeze(clean));
  }
  const before = byPack.get(packId);
  if (m.size === 0 && !before) return [];
  if (m.size === 0) byPack.delete(packId);
  else byPack.set(packId, m);
  changed();
  return [...m.keys()];
}

/** Forget a pack's motifs (e.g. after Settings › Storage removes it). */
export function unregisterPackMotifs(packId: string): void {
  if (byPack.delete(packId)) changed();
}

/** Layers of a registered pack motif (the most recently registered pack wins on a clash). */
export function packMotifLayers(id: string): readonly MotifLayer[] | undefined {
  let found: readonly MotifLayer[] | undefined;
  for (const m of byPack.values()) {
    const l = m.get(id);
    if (l) found = l;
  }
  return found;
}

export function hasPackMotif(id: string): boolean {
  return packMotifLayers(id) !== undefined;
}

/** Every registered pack motif id. */
export function packMotifIds(): Set<string> {
  const out = new Set<string>();
  for (const m of byPack.values()) for (const id of m.keys()) out.add(id);
  return out;
}

/** Bumps whenever the registry changes (renderers can key memos on it). */
export function packMotifsVersion(): number {
  return version;
}

export function subscribePackMotifs(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Test helper: empty the registry. */
export function clearPackMotifs(): void {
  if (byPack.size === 0) return;
  byPack.clear();
  changed();
}
