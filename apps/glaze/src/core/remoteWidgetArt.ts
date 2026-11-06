import { isReplacedArtEdition } from './designedWidgets.ts';
import { WIDGET_ART_PICTURE_ALIASES } from './widgetArtPictureAliases.ts';
import type { RemoteArtManifest } from './packCatalog.ts';
import { withSeamlessHeroes, type WidgetOption } from './widgetOptions.ts';

export type RemoteWidgetArtRef = { id: string; packVersion: number; release?: string };
// The catalogue release may be a different host folder from the pack's assets. An old
// installed manifest can supply the version without the release that hosted it.
export async function resolveRemoteWidgetArtRef(
  current: () => RemoteWidgetArtRef | null,
  fallback: RemoteWidgetArtRef,
  loadCatalogue: () => Promise<void>,
  splitReleases: boolean,
): Promise<RemoteWidgetArtRef | null> {
  const listed = current();
  if (listed) return listed;
  if (fallback.release || !splitReleases) return fallback;
  await loadCatalogue();
  return current();
}

export type LocalWidgetOption = { option: WidgetOption; uri: string };

/** Prefer original standalone art to its wallpaper crop or functional variant. */
function pictureRank(option: WidgetOption): number {
  if (option.kind === 'art' && !option.id.startsWith('hero-')) return 4;
  if (option.id.startsWith('hero-')) return 3;
  return option.id.startsWith('live-') || option.id.startsWith('themed-live-') ? 1 : 2;
}

export function remoteWidgetArtOptions(manifest: Pick<RemoteArtManifest, 'assets' | 'widgets'>): WidgetOption[] {
  const options = withSeamlessHeroes(manifest.widgets ?? [], manifest.assets)
    .filter(option => !isReplacedArtEdition(option) && option.sizes.some(size => size !== 'lock'));
  const hashes = new Map(manifest.assets.map(asset => [asset.path, asset.sha256]));
  const pictures = new Map<string, { option: WidgetOption; canonical: boolean }>();
  for (const option of options) {
    const hash = hashes.get(option.image) ?? option.image;
    const picture = WIDGET_ART_PICTURE_ALIASES[hash] ?? hash;
    const canonical = hash === picture;
    const previous = pictures.get(picture);
    if (!previous) {
      pictures.set(picture, { option, canonical });
      continue;
    }
    const prefer = canonical === previous.canonical
      ? pictureRank(option) > pictureRank(previous.option)
      : canonical;
    const winner = prefer ? option : previous.option;
    const other = prefer ? previous.option : option;
    const sizes = [...new Set([...winner.sizes, ...other.sizes])];
    pictures.set(picture, { option: { ...winner, sizes }, canonical: prefer ? canonical : previous.canonical });
  }
  return [...pictures.values()].map(({ option }) => option);
}

export function localWidgetArtOptions(
  options: readonly WidgetOption[],
  uriFor: (asset: string) => string | null,
): LocalWidgetOption[] {
  return options.flatMap(option => {
    const uri = uriFor(option.image);
    return uri ? [{ option, uri }] : [];
  });
}
