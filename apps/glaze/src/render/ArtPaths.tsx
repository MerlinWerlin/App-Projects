// ArtPaths: draws artwork primitives from src/core/artwork (motifs, textures, frames,
// compositions). Every transform is already baked into the path data, so this is plain <Path>s.

import { memo } from 'react';
import { G, Path } from 'react-native-svg';
import type { ArtPath } from '../core/artwork';

export const ArtPaths = memo(function ArtPaths({ paths }: { paths: readonly ArtPath[] }) {
  if (paths.length === 0) return null;
  return (
    <G>
      {paths.map((p, i) => (
        <Path
          key={i}
          d={p.d}
          fill={p.fill ?? 'none'}
          fillOpacity={p.fill ? p.opacity : 0}
          stroke={p.stroke ?? 'none'}
          strokeOpacity={p.stroke ? p.opacity : 0}
          strokeWidth={p.stroke ? p.strokeWidth ?? 1 : 0}
          strokeLinecap={p.round ? 'round' : 'butt'}
          strokeLinejoin={p.round ? 'round' : 'miter'}
        />
      ))}
    </G>
  );
});
