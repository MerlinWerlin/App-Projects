// T118 (fb-1024 B): module-level caches for gallery previews (keyed by the theme object, which is
// a stable module constant), so a card that mounts again reuses its icon specs.
import type { IconSpec } from '../core/iconspec';
import { weakKeyedCache } from '../core/perfCache';
import { previewSpecs, type Theme } from '../core/themes';

const SPECS = weakKeyedCache<Theme, IconSpec[]>();

/** previewSpecs(theme, count), computed once per theme and count. Treat the result as read-only. */
export function cachedPreviewSpecs(theme: Theme, count: number): IconSpec[] {
  return SPECS.get(theme, String(count), () => previewSpecs(theme, count));
}
