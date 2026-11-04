import { unpackArt } from './unpack.ts';

/** A gallery holds metadata/covers. Only drawings actually opened need decoded path strings. */
export function lazyArtwork<T>(packed: Record<string, string>, capacity = 6): Record<string, T> {
  const cache = new Map<string, T>();
  const out: Record<string, T> = {};
  for (const id of Object.keys(packed)) Object.defineProperty(out, id, {
    enumerable: true,
    get() {
      let art = cache.get(id);
      if (art) cache.delete(id);
      else art = unpackArt<T>(packed[id]!);
      cache.set(id, art);
      if (cache.size > capacity) cache.delete(cache.keys().next().value!);
      return art;
    },
  });
  return out;
}
