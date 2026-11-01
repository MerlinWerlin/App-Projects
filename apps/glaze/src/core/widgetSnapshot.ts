// T203 (owner-1101d #6): the widget render check (scripts/widget-snapshots.mjs). For one widget
// option of a theme in one Home Screen size, works out what the phone actually draws, using the same
// functions the app and the native compositor use, so the contact sheets in docs/widget_snapshots/
// show the real placement without a phone:
//
//   ThemeWidgetArt.onUse  background "wallpaper" → setSeamless: crop of the wallpaper under the
//                         widget's default slot (seamlessCrop), hero fitted with heroRect (6 % inset)
//                         background "theme" / "blur" → setWidgetArt at widgetSizePx, fit decided by
//                         placeArt on the option's declared size, art drawn fitted (or, for "fill",
//                         stretched edge to edge) by GlazeWidgetBridgeModule
//   SeamlessWidget.swift  the composed file scaledToFit inside the widget frame (corner mask 22 pt)
//
// The native bridge sizes the art from the decoded image, the app from the manifest / reference
// size, so the plan takes both and flags any difference. Pure TS, tested in widgetSnapshot.test.ts.

import { aspectMatch, placeArt, type Box, type HomeOptionSize, type Rect, type WidgetOption, type WidgetOptionFit } from './widgetOptions.ts';
import { heroRect, normaliseSlot, SEAMLESS_MAX_EDGE_PX, seamlessCrop, WIDGET_CORNER_PT, widgetSizePx, type SeamlessDevice } from './seamlessWidget.ts';

export type SnapshotSeverity = 'error' | 'warn' | 'info';
export type SnapshotFlagCode =
  | 'crop' // art reaches outside the widget frame
  | 'fill' // scale-to-fill: art drawn edge to edge instead of fitted
  | 'stretch' // fill drew the art at a different aspect (distorted)
  | 'metaAspect' // the app's declared art size has another aspect than the real image
  | 'cornerClip' // a corner of the art rectangle falls outside the rounded widget mask
  | 'letterbox' // fitted art covers little of the widget (bands of background around it)
  | 'notOffered' // the option does not list this size (rendered anyway for review)
  | 'noWallpaper' // background "wallpaper" without a wallpaper: the app's Use button fails
  | 'empty' // the rendered widget is one flat colour
  | 'white' // the rendered widget is (nearly) all white
  | 'edgeCut' // the art's own picture runs off its image edge (subject cut in the source file)
  | 'textOverflow'; // a label does not fit its line (truncated with an ellipsis in the app)

export type SnapshotFlag = { code: SnapshotFlagCode; severity: SnapshotSeverity; detail: string };

/** Fitted art covering less than this share of the widget is flagged `letterbox`. */
export const LETTERBOX_COVERAGE = 0.4;
/** Overreach (points) tolerated before `crop` (rounding). */
export const CROP_TOLERANCE_PT = 0.5;
/** Aspect difference tolerated before `metaAspect` / `stretch`. */
export const ASPECT_TOLERANCE = 0.01;

export type SnapshotInput = {
  option: Pick<WidgetOption, 'id' | 'sizes' | 'fit' | 'background' | 'width' | 'height'>;
  size: HomeOptionSize;
  device: SeamlessDevice;
  /** The decoded art's pixel size (what the native bridge draws with). */
  artPx: Box;
  /** The wallpaper's pixel size, or null when the theme has none on the phone. */
  wallpaperPx: Box | null;
};

export type SnapshotPlan = {
  /** Which bridge call the app makes. */
  path: 'seamless' | 'widgetArt';
  offered: boolean;
  /** Pixel size of the composed file (seamless-<size>.png). */
  targetPx: Box;
  /** Seamless path: the wallpaper crop (wallpaper px). */
  crop: Rect | null;
  /** What the bridge draws: `fill` stretches edge to edge, `fit` keeps the art whole. */
  mode: WidgetOptionFit;
  /** Art rectangle inside the composed file (target px). */
  artRect: Rect;
  /** The widget in points (device px / scale). */
  widgetPt: Box;
  /** Where SeamlessWidget.swift draws the composed file (scaledToFit), in widget points. */
  imageRectPt: Rect;
  /** The art rectangle on the widget, in points. */
  artRectPt: Rect;
  /** Share of the widget the art rectangle covers (0–1). */
  coverage: number;
  flags: SnapshotFlag[];
};

const aspect = (b: Box): number => (b.w > 0 && b.h > 0 ? b.w / b.h : 1);
const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Contain `inner` in `outer` with no inset (SwiftUI scaledToFit), centred. */
export function fitRect(inner: Box, outer: Box): Rect {
  const s = Math.min(outer.w / Math.max(1e-9, inner.w), outer.h / Math.max(1e-9, inner.h));
  const w = inner.w * s;
  const h = inner.h * s;
  return { x: (outer.w - w) / 2, y: (outer.h - h) / 2, w, h };
}

/** The bridge's 1200 px long-edge cap (floor, at least 1 px). */
export function capTarget(px: Box, maxEdge = SEAMLESS_MAX_EDGE_PX): Box {
  const longest = Math.max(px.w, px.h);
  const k = longest > maxEdge ? maxEdge / longest : 1;
  return { w: Math.max(1, Math.floor(px.w * k)), h: Math.max(1, Math.floor(px.h * k)) };
}

/** True when a corner of `r` lies outside a rounded rectangle of `box` with corner radius `radius`. */
export function cornerOutsideMask(r: Rect, box: Box, radius: number): boolean {
  const corners: [number, number][] = [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x, r.y + r.h],
    [r.x + r.w, r.y + r.h],
  ];
  return corners.some(([x, y]) => {
    const cx = x < radius ? radius : x > box.w - radius ? box.w - radius : x;
    const cy = y < radius ? radius : y > box.h - radius ? box.h - radius : y;
    if (cx === x || cy === y) return false;
    return Math.hypot(x - cx, y - cy) > radius + CROP_TOLERANCE_PT;
  });
}

/** How far (points) `r` reaches outside `box` on its worst side; 0 when inside. */
export function overreach(r: Rect, box: Box): number {
  return Math.max(0, -r.x, -r.y, r.x + r.w - box.w, r.y + r.h - box.h);
}

/** What the phone draws for one option in one size, with the geometry flags. */
export function snapshotPlan(input: SnapshotInput): SnapshotPlan {
  const { option, size, device } = input;
  const artPx: Box = { w: Math.max(1, input.artPx.w), h: Math.max(1, input.artPx.h) };
  const declared: Box = { w: option.width, h: option.height };
  const flags: SnapshotFlag[] = [];
  const offered = option.sizes.includes(size);
  if (!offered) flags.push({ code: 'notOffered', severity: 'info', detail: `${option.id} lists ${option.sizes.join('/')} only` });

  const metaDiff = 1 - aspectMatch(declared, artPx);
  if (metaDiff > ASPECT_TOLERANCE) {
    flags.push({
      code: 'metaAspect',
      severity: 'warn',
      detail: `declared ${declared.w}x${declared.h}, image is ${artPx.w}x${artPx.h} (aspect off by ${r2(metaDiff * 100)} %)`,
    });
  }

  let path: SnapshotPlan['path'];
  let targetPx: Box;
  let crop: Rect | null = null;
  let mode: WidgetOptionFit = 'fit';
  let artRect: Rect;
  if (option.background === 'wallpaper') {
    path = 'seamless';
    if (input.wallpaperPx) {
      const c = seamlessCrop({ device, wallpaper: input.wallpaperPx, size, slot: normaliseSlot(size, null), nudge: { dx: 0, dy: 0 } });
      crop = c.cropPx;
      targetPx = capTarget({ w: crop.w, h: crop.h });
    } else {
      flags.push({ code: 'noWallpaper', severity: 'error', detail: 'background "wallpaper" but the theme has no wallpaper: Use fails' });
      targetPx = capTarget(widgetSizePx(device, size));
    }
    artRect = heroRect(targetPx, artPx);
  } else {
    path = 'widgetArt';
    const px = widgetSizePx(device, size);
    mode = placeArt(declared, px, option.fit).mode;
    targetPx = capTarget(px);
    artRect = mode === 'fill' ? { x: 0, y: 0, w: targetPx.w, h: targetPx.h } : placeArt(artPx, targetPx, 'fit').rect;
    if (mode === 'fill') {
      flags.push({ code: 'fill', severity: 'warn', detail: `${option.id} drawn edge to edge (fit "fill")` });
      const stretch = 1 - aspectMatch(artPx, targetPx);
      if (stretch > ASPECT_TOLERANCE) flags.push({ code: 'stretch', severity: 'error', detail: `art stretched ${r2(stretch * 100)} % to the widget's aspect` });
    }
  }

  const widgetPt: Box = { w: widgetSizePx(device, size).w / device.scale, h: widgetSizePx(device, size).h / device.scale };
  const imageRectPt = fitRect(targetPx, widgetPt);
  const k = imageRectPt.w / targetPx.w;
  const artRectPt: Rect = { x: imageRectPt.x + artRect.x * k, y: imageRectPt.y + artRect.y * k, w: artRect.w * k, h: artRect.h * k };
  const over = overreach(artRectPt, widgetPt);
  if (over > CROP_TOLERANCE_PT) flags.push({ code: 'crop', severity: 'error', detail: `art reaches ${r2(over)} pt outside the widget` });
  else if (mode !== 'fill' && cornerOutsideMask(artRectPt, widgetPt, WIDGET_CORNER_PT)) {
    flags.push({ code: 'cornerClip', severity: 'warn', detail: `an art corner falls outside the ${WIDGET_CORNER_PT} pt rounded mask` });
  }
  const coverage = Math.min(1, (artRectPt.w * artRectPt.h) / Math.max(1e-9, widgetPt.w * widgetPt.h));
  if (mode === 'fit' && coverage < LETTERBOX_COVERAGE) {
    flags.push({ code: 'letterbox', severity: 'info', detail: `art covers ${Math.round(coverage * 100)} % of the widget` });
  }
  return { path, offered, targetPx, crop, mode, artRect, widgetPt, imageRectPt, artRectPt, coverage, flags };
}

/** Pixel statistics the renderer measures (0–1 luminance). */
export type PixelStats = { mean: number; std: number };
/** Below this luminance spread a widget is one flat colour. */
export const EMPTY_STD = 0.012;
export const WHITE_MEAN = 0.96;

/** Flags from the rendered widget's pixels. */
export function pixelFlags(stats: PixelStats): SnapshotFlag[] {
  const out: SnapshotFlag[] = [];
  if (stats.mean >= WHITE_MEAN) out.push({ code: 'white', severity: 'error', detail: `mean luminance ${r2(stats.mean)}` });
  else if (stats.std < EMPTY_STD) out.push({ code: 'empty', severity: 'error', detail: `flat colour (spread ${r2(stats.std)})` });
  return out;
}

/** Border statistics of a transparent art image: share of border pixels that are visible. */
export type EdgeStats = { transparent: boolean; edgeOpaque: number; worstSide: string };
/** A transparent art piece with more than this share of one side visible has its subject cut. */
export const EDGE_CUT_SHARE = 0.08;

export function edgeFlags(e: EdgeStats): SnapshotFlag[] {
  if (!e.transparent || e.edgeOpaque <= EDGE_CUT_SHARE) return [];
  return [{ code: 'edgeCut', severity: 'warn', detail: `${Math.round(e.edgeOpaque * 100)} % of the ${e.worstSide} edge is drawn: the picture runs off the image` }];
}

/** Worst severity of a list (null when empty). */
export function worstSeverity(flags: readonly SnapshotFlag[]): SnapshotSeverity | null {
  if (flags.some((f) => f.severity === 'error')) return 'error';
  if (flags.some((f) => f.severity === 'warn')) return 'warn';
  return flags.length ? 'info' : null;
}
