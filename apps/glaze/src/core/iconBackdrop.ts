import { isHex, normalizeHex } from './colour.ts';
import type { IconBackground } from './iconspec.ts';

/** iOS masks every installed icon to a rounded square. Never leave alpha for it to fill black. */
export function iconBackdrop(background: IconBackground, wallpaper?: string | null): string {
  if (wallpaper && isHex(wallpaper)) return normalizeHex(wallpaper);
  const colour = background.kind === 'solid' ? background.colour : background.kind === 'gradient' ? background.from : background.tint;
  return isHex(colour) ? normalizeHex(colour) : '#F6F3F5';
}
