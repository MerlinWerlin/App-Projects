// T160: the picture of a remote art-pack theme (catalogue pack from the pack host, GitHub Releases): the downloaded
// file (file:// URI) when there is one, otherwise the small remote thumbnail, with the pack's
// ThumbHash as an instant blurred placeholder and expo-image's memory + disk cache (so a seen
// thumbnail still shows offline). Expo Go safe (expo-image is in Expo Go). Never throws: a failed
// load leaves the placeholder on the palette background.
import { Image } from 'expo-image';
import { memo } from 'react';
import type { RemoteArtTheme } from '../core/remoteCatalog';
import { starterThumb } from '../core/starterPacks';
import { STARTERS } from '../native/starterPacks';

type Props = {
  theme: RemoteArtTheme;
  width: number;
  height: number;
  /** A downloaded file (file://) to prefer over the remote thumbnail. */
  localUri?: string | null;
};

export const RemoteArtImage = memo(function RemoteArtImage({ theme, width, height, localUri }: Props) {
  const uri = localUri ?? theme.remoteArt.thumbUrl;
  // 1.0.38: a bundled starter at the listed version shows its thumbnail from the app (offline too).
  const bundled = localUri ? null : starterThumb(STARTERS, theme.remoteArt.packId, theme.remoteArt.packVersion);
  return (
    <Image
      source={bundled ?? (uri ? { uri } : undefined)}
      placeholder={theme.remoteArt.thumbhash ? { thumbhash: theme.remoteArt.thumbhash } : undefined}
      placeholderContentFit="cover"
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={theme.id}
      transition={localUri ? 0 : 150}
      style={{ width, height, backgroundColor: theme.palette.bg }}
    />
  );
});
