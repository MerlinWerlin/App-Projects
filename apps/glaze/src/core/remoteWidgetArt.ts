import { isReplacedArtEdition } from './designedWidgets.ts';
import type { RemoteArtManifest } from './packCatalog.ts';
import { withSeamlessHeroes, type WidgetOption } from './widgetOptions.ts';

export type RemoteWidgetArtRef = { id: string; packVersion: number; release?: string };
export type LocalWidgetOption = { option: WidgetOption; uri: string };

/** Keep original editions and heroes. The native Clock, Battery and Calendar replace generated editions. */
export function remoteWidgetArtOptions(manifest: Pick<RemoteArtManifest, 'assets' | 'widgets'>): WidgetOption[] {
  return withSeamlessHeroes(manifest.widgets ?? [], manifest.assets)
    .filter(option => !isReplacedArtEdition(option) && option.sizes.some(size => size !== 'lock'));
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
