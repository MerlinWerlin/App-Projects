// T246 (follow-up to T236/T237, owner-1101g): live values in the widget's Fit layout too.
//
// Edit Widget > Layout has two looks (targets/widget/SeamlessWidget.swift):
//   Fill (default): the composed image edge to edge. A piece's `live` spec rect is 0..1 of that
//     composed image, so the plate lines up (LiveArtOverlay.swift LiveArtLayer).
//   Fit: the RAW art (<id>-art.png / seamless-<size>-art.png: the blended art, same framing as the
//     art file) scaledToFit inside the widget, inset by 6 % of the widget's short side; with no raw
//     art file the composed image is fitted the same way. The composed-image rect does not line up
//     there, which is why T237 drew live values in Fill only.
// This file maps the plate onto the inset art: contain the art in the inset box, then place the
// plate (0..1 of the art: LiveArtSpec.art, the plan rect) on that contained rect. The result is 0..1
// of the widget, the same unit LiveArtLayer multiplies by the widget size.
//
// Native status: LiveArtOverlay.swift / SeamlessWidget.swift do NOT draw live values in Fit yet
// (SeamlessWidget.swift `if let image = image, !fit`), and new Swift is held (overseer D225-3). So
// FIT_LAYOUT_LIVE_IN_WIDGET is false and the app says live values show in Fill only. When a native
// build draws them in Fit (read `art` from the record, place it with fitLayoutPlate's geometry: the
// same as LiveArtLayer.fitted on a box inset by FIT_LAYOUT_INSET), flip the flag. docs/WIDGETS.md.
//
// Pure TS (Node runs it directly), tested in liveArtFit.test.ts.

import type { LiveArtSpec, NRect } from './liveArt.ts';
import { WIDGET_ART_PADDING, type Box, type Rect } from './widgetOptions.ts';

/** Fit inset, a fraction of the widget's short side (SeamlessWidget.swift Fit: `min(w, h) * 0.06`). */
export const FIT_LAYOUT_INSET = WIDGET_ART_PADDING;

/** Edit Widget > Layout (WidgetArtLibrary.swift ArtLayout). */
export type WidgetArtLayout = 'fill' | 'fit';

/**
 * Whether the installed widget draws live values in the Fit layout. false: SeamlessWidget.swift
 * skips LiveArtLayer in Fit and D225-3 holds new Swift. Flip only with the native change.
 */
export const FIT_LAYOUT_LIVE_IN_WIDGET = false;

/** Whether the widget shows a piece's live value in this layout (Fill always does). */
export function liveValueShowsIn(layout: WidgetArtLayout): boolean {
  return layout === 'fill' || FIT_LAYOUT_LIVE_IN_WIDGET;
}

const ok = (b: Box | null | undefined): b is Box => !!b && Number.isFinite(b.w) && Number.isFinite(b.h) && b.w > 0 && b.h > 0;
const r4 = (n: number): number => Math.round(n * 10000) / 10000;
const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Where Fit draws art of `art` size in a widget of `widget` size (same units as the widget):
 * centred, whole (contain), inside the widget inset by FIT_LAYOUT_INSET of its short side.
 * null when either size is empty or the inset leaves no room.
 */
export function fitLayoutArtRect(art: Box, widget: Box, inset: number = FIT_LAYOUT_INSET): Rect | null {
  if (!ok(art) || !ok(widget)) return null;
  const pad = Math.min(widget.w, widget.h) * Math.max(0, inset);
  const bw = widget.w - pad * 2;
  const bh = widget.h - pad * 2;
  if (!(bw > 0 && bh > 0)) return null;
  const k = Math.min(bw / art.w, bh / art.h);
  const w = art.w * k;
  const h = art.h * k;
  return { x: (widget.w - w) / 2, y: (widget.h - h) / 2, w, h };
}

/**
 * The plate in the Fit layout, 0..1 of the widget: `plate` (0..1 of the art) placed on the art
 * contained in the inset widget. Parts outside the art are clipped to it (a plate never leaves the
 * art). null for empty sizes or a plate with no area left.
 */
export function fitLayoutPlate(plate: NRect, art: Box, widget: Box, inset: number = FIT_LAYOUT_INSET): NRect | null {
  const place = fitLayoutArtRect(art, widget, inset);
  if (!place) return null;
  const vals = [plate.x, plate.y, plate.w, plate.h];
  if (!vals.every((n) => Number.isFinite(n))) return null;
  const x0 = clamp01(plate.x);
  const y0 = clamp01(plate.y);
  const x1 = clamp01(plate.x + plate.w);
  const y1 = clamp01(plate.y + plate.h);
  if (!(x1 > x0 && y1 > y0)) return null;
  const x = (place.x + x0 * place.w) / widget.w;
  const y = (place.y + y0 * place.h) / widget.h;
  const w = ((x1 - x0) * place.w) / widget.w;
  const h = ((y1 - y0) * place.h) / widget.h;
  return { x: r4(x), y: r4(y), w: r4(Math.min(w, 1 - x)), h: r4(Math.min(h, 1 - y)) };
}

/**
 * The Fit plate for a stored spec, 0..1 of the widget, matching what Fit shows:
 *  - a raw art file (`rawArt` size) and a spec with `art`: the art rect on the inset raw art;
 *  - a raw art file but an older spec without `art`: null (the composed rect would not line up);
 *  - no raw art file: Fit shows the composed image (`composed` size) inset, so the composed rect goes on that.
 * null when the widget would not draw a live value in Fit at all (FIT_LAYOUT_LIVE_IN_WIDGET false)
 * unless `ignoreWidgetSupport` (geometry checks and the future native port).
 */
export function fitLayoutPlateForSpec(
  spec: Pick<LiveArtSpec, 'rect' | 'art'>,
  sizes: { rawArt: Box | null; composed: Box; widget: Box },
  opts: { ignoreWidgetSupport?: boolean } = {},
): NRect | null {
  if (!opts.ignoreWidgetSupport && !liveValueShowsIn('fit')) return null;
  const fromArr = (a: [number, number, number, number]): NRect => ({ x: a[0], y: a[1], w: a[2], h: a[3] });
  if (ok(sizes.rawArt)) {
    // An older record (no `art`) over a raw art file: the composed rect would not line up, so none.
    return spec.art ? fitLayoutPlate(fromArr(spec.art), sizes.rawArt, sizes.widget) : null;
  }
  return fitLayoutPlate(fromArr(spec.rect), sizes.composed, sizes.widget);
}
