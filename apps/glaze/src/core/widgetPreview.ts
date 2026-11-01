// T207 / T208 (run 208 widget snapshot review): the maths behind the Widgets tab menu previews
// (src/ui/WidgetArtMenu.tsx) and the theme page's Seamless card, so what the app shows matches what
// the native bridge composes (modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift):
//
//   background "wallpaper" → setSeamless: the wallpaper CROPPED under the widget's slot
//                            (seamlessCrop), then the art fitted. The preview draws the whole
//                            wallpaper at the crop's scale and offset inside the clipped card, so
//                            only the crop shows (wallpaperUnderSlot).
//   background "blur"      → setWidgetArt: CIGaussianBlur of the art with radius
//                            max(12, 6 % of the art's short side) in art pixels, aspect-filled, under
//                            a 25 % veil of the theme colour (blurBackdrop).
//
// Also the stable menu names ("Art n" numbered once per theme, not per size) and the menu caption
// layout, and the real pixel size of a downloaded pack's hero piece per size (remoteHeroPx).
// Pure TS (Node runs it directly), tested in widgetPreview.test.ts.

import type { HeroSize } from './artPack.ts';
import type { RemoteArtManifest } from './packCatalog.ts';
import { remoteArtFiles } from './remoteCatalog.ts';
import type { Box, HomeOptionSize, Rect, WidgetOption } from './widgetOptions.ts';

/** GlazeWidgetBridgeModule.setWidgetArt: `max(12, min(w, h) * 0.06)` (art px). */
export const NATIVE_BLUR_MIN_RADIUS = 12;
export const NATIVE_BLUR_RADIUS_SHARE = 0.06;
/** GlazeWidgetBridgeModule.setWidgetArt: `base.withAlphaComponent(0.25)` over the blurred copy. */
export const NATIVE_BLUR_VEIL_ALPHA = 0.25;

/**
 * T223: GlazeWidgetBridgeModule.setWidgetArt draws fit "fill" edge to edge only when the REAL art
 * aspect is within this match of the output (`min/max >= 0.98`, i.e. 1 - FILL_ASPECT_TOLERANCE);
 * otherwise it fits the art whole, so a pack whose declared size is wrong can't stretch or crop.
 */
export const NATIVE_FILL_MIN_ASPECT_MATCH = 0.98;

const pos = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 1);

/** The CIGaussianBlur radius the bridge uses for art of `artPx` (in art pixels). */
export function nativeBlurRadiusPx(artPx: Box): number {
  return Math.max(NATIVE_BLUR_MIN_RADIUS, Math.min(pos(artPx.w), pos(artPx.h)) * NATIVE_BLUR_RADIUS_SHARE);
}

/** Aspect-fill `inner` over `outer` (scale = max), centred. Same units as `outer`. */
export function coverRect(inner: Box, outer: Box): Rect & { scale: number } {
  const iw = pos(inner.w);
  const ih = pos(inner.h);
  const ow = Math.max(0, outer.w);
  const oh = Math.max(0, outer.h);
  const scale = Math.max(ow / iw, oh / ih);
  const w = iw * scale;
  const h = ih * scale;
  return { x: (ow - w) / 2, y: (oh - h) / 2, w, h, scale };
}

export type BlurBackdrop = {
  /** Where the (blurred) art copy goes in the preview box: aspect-filled, centred. */
  rect: Rect;
  /** Blur radius in preview units: the native radius scaled with the art. */
  radius: number;
  /** Opacity of the theme-colour veil drawn over the blurred copy. */
  veil: number;
};

/**
 * The blurred-art background of a "blur" option in a preview box of `box` (points): the native
 * blur radius (art px) scaled by the same factor the art is aspect-filled with, so a small card
 * looks as soft as the widget, plus the 25 % veil.
 */
export function blurBackdrop(artPx: Box, box: Box): BlurBackdrop {
  const c = coverRect(artPx, box);
  const radius = Math.round(nativeBlurRadiusPx(artPx) * c.scale * 100) / 100;
  return { rect: { x: c.x, y: c.y, w: c.w, h: c.h }, radius, veil: NATIVE_BLUR_VEIL_ALPHA };
}

/**
 * Where to draw the WHOLE wallpaper (`wallpaperPx`) inside a clipped preview box (`box`, points)
 * so that exactly the seamless crop (`crop`, wallpaper px, from seamlessCrop) fills the box, like
 * the file the bridge writes. The crop is scaled to cover the box (its aspect is the widget's, so
 * nothing visible is lost) and centred.
 */
export function wallpaperUnderSlot(wallpaperPx: Box, crop: Rect, box: Box): Rect {
  const cw = pos(crop.w);
  const ch = pos(crop.h);
  const s = Math.max(Math.max(0, box.w) / cw, Math.max(0, box.h) / ch);
  const ox = (box.w - cw * s) / 2;
  const oy = (box.h - ch * s) / 2;
  return { x: ox - crop.x * s, y: oy - crop.y * s, w: pos(wallpaperPx.w) * s, h: pos(wallpaperPx.h) * s };
}

/**
 * T207: stable numbers for the menu's "Art n" names. Each option WITHOUT a label gets one number,
 * in the theme's own (pack) order, so the same piece keeps its name in small, medium and large
 * (the menu re-orders options per size). Labelled options get no number.
 */
export function stableArtNumbers(options: readonly Pick<WidgetOption, 'id' | 'label'>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const o of options) {
    if (o.label || out.has(o.id)) continue;
    out.set(o.id, out.size + 1);
  }
  return out;
}

/** The menu name of an option: its label, or "Art n" (`numbered` with `{n}`) from stableArtNumbers. */
export function optionMenuName(option: Pick<WidgetOption, 'id' | 'label'>, numbers: ReadonlyMap<string, number>, numbered: (n: number) => string): string {
  return option.label ?? numbered(numbers.get(option.id) ?? 1);
}

export type CaptionLayout = {
  /** Name and "Live" badge on separate lines (true) or side by side (false). */
  stacked: boolean;
  /** Lines the name may use before it truncates. */
  nameLines: number;
};

/**
 * T207: the menu card caption. Small cards (two per row, ~170 pt) put the "Live" badge under the
 * name and let the name wrap to two lines ("Rehearsal countdown" + Live no longer truncates);
 * wide cards keep one line with the badge beside it.
 */
export function menuCaptionLayout(size: HomeOptionSize): CaptionLayout {
  return size === 'small' ? { stacked: true, nameLines: 2 } : { stacked: false, nameLines: 1 };
}

/**
 * T208: the real pixel size of the hero piece a downloaded pack shows per widget size (the file
 * remoteArtFiles picks: a v2 option's image or the v1 widget-* asset), from the manifest. A size
 * without a hero, or a file with no known size, is left out (callers fall back to the reference size).
 */
export function remoteHeroPx(m: Pick<RemoteArtManifest, 'assets'> & { widgets?: RemoteArtManifest['widgets'] }): Partial<Record<HeroSize, Box>> {
  const files = remoteArtFiles(m);
  const out: Partial<Record<HeroSize, Box>> = {};
  for (const [s, path] of Object.entries(files.heroes) as [HeroSize, string][]) {
    const asset = m.assets.find((a) => a.path === path);
    const opt = (m.widgets ?? []).find((o) => o.image === path);
    const w = asset?.width ?? opt?.width;
    const h = asset?.height ?? opt?.height;
    if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) out[s] = { w, h };
  }
  return out;
}
