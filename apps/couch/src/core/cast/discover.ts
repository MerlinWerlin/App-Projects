/**
 * Renderer discovery (T76): SSDP search, then each LOCATION's device description, deduped by USN
 * and then by UDN (one device can answer with several USNs). Devices whose description is not on
 * the LAN or has no AVTransport are skipped and noted in `errors` (diagnostics only).
 */
import type { FetchLike } from '../driver';
import { fetchRenderer, type CastRenderer } from './description';
import { searchRenderers, type RendererSearchDeps, type RendererSearchOptions } from './ssdp';

export interface DiscoverRenderersDeps extends RendererSearchDeps {
  fetch: FetchLike;
}

export interface DiscoverRenderersResult {
  renderers: CastRenderer[];
  errors: string[];
}

export async function discoverRenderers(
  deps: DiscoverRenderersDeps,
  opts: RendererSearchOptions & { descriptionTimeoutMs?: number } = {},
): Promise<DiscoverRenderersResult> {
  const { hits, errors } = await searchRenderers(deps, opts);
  const results = await Promise.all(
    hits.map(async (h) => {
      try {
        return await fetchRenderer(deps.fetch, h.location, opts.descriptionTimeoutMs ?? 3000);
      } catch (e) {
        errors.push(`description ${h.location}: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    }),
  );
  const seen = new Set<string>();
  const renderers: CastRenderer[] = [];
  for (const r of results) {
    if (!r) continue;
    const k = (r.udn ?? r.avTransportUrl).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    renderers.push(r);
  }
  return { renderers, errors };
}
