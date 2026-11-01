// T131 (owner brief themes-1024): "Seamless widget" maths. A Home Screen widget whose background
// is the piece of the wallpaper it sits on, with transparent hero art on top, so the hero seems to
// float on the wallpaper. Pure TS (Node-testable, no React Native imports).
//
// The device table holds the Home Screen widget slots in NATIVE screen pixels (a screenshot's
// pixels). Values are community-measured (the figures transparent-widget tools use), not from
// any Apple API: verify on device; the user's nudge fine-tunes. Rows flagged `estimated` were
// scaled from the nearest measured neighbour and have never been measured at all.
//
// Pipeline: device (lookupDevice) → widget rect on screen (widgetScreenRect, nudge applied) →
// wallpaper aspect-fill mapping (wallpaperFill) → crop rect in WALLPAPER pixels (seamlessCrop),
// which the native bridge cuts with CGImage.cropping(to:). heroRect places the hero art inside the
// widget. docs/WIDGETS.md "Seamless widget".

export type SeamlessSize = 'small' | 'medium' | 'large';
export type SmallSlot = 'top-left' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-right';
export type MediumSlot = 'top' | 'middle' | 'bottom';
export type LargeSlot = 'top' | 'bottom';
export type SeamlessSlot = SmallSlot | MediumSlot;

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };
export type Nudge = { dx: number; dy: number };

export type SeamlessDevice = {
  /** Stable id: the native screen height in px (e.g. "2796"). */
  id: string;
  /** Generic name (screen size class + pixel height); never a product name. */
  label: string;
  /** Native screen size in pixels (portrait). */
  px: Size;
  /** Screen size in points (portrait), as Dimensions reports it. */
  pt: Size;
  /** Points → pixels as PixelRatio reports it (3 or 2). */
  scale: number;
  /** Widget sizes in native px. */
  small: number;
  medium: Size;
  large: Size;
  /** Widget column x (left edge) in native px. */
  left: number;
  right: number;
  /** Widget row y (top edge) in native px. */
  top: number;
  middle: number;
  bottom: number;
  /** Scaled from a neighbour, never measured. */
  estimated?: boolean;
};

/** The table is community-measured: verify on device; the nudge fine-tunes. */
export const SEAMLESS_TABLE_NOTE = 'community-measured, verify on device; the nudge fine-tunes';

/** Largest nudge either way, in points. */
export const MAX_NUDGE_PT = 40;

/** Widget corner radius in points (approximate; iOS draws its own mask on device). */
export const WIDGET_CORNER_PT = 22;

const sq = (n: number): Size => ({ w: n, h: n });

// Community-measured widget positions (native px). Order: largest screen first.
export const SEAMLESS_DEVICES: readonly SeamlessDevice[] = [
  {
    id: '2868', label: '6.9-inch 2868', px: { w: 1320, h: 2868 }, pt: { w: 440, h: 956 }, scale: 3,
    // Scaled from 2796 (x by 1320/1290, y by 2868/2796).
    small: 522, medium: { w: 1117, h: 522 }, large: { w: 1117, h: 1173 },
    left: 101, right: 697, top: 289, middle: 942, bottom: 1594, estimated: true,
  },
  {
    id: '2796', label: '6.7-inch 2796', px: { w: 1290, h: 2796 }, pt: { w: 430, h: 932 }, scale: 3,
    small: 510, medium: { w: 1092, h: 510 }, large: { w: 1092, h: 1146 },
    left: 99, right: 681, top: 282, middle: 918, bottom: 1554,
  },
  {
    id: '2778', label: '6.7-inch 2778', px: { w: 1284, h: 2778 }, pt: { w: 428, h: 926 }, scale: 3,
    small: 510, medium: { w: 1092, h: 510 }, large: { w: 1092, h: 1146 },
    left: 96, right: 678, top: 246, middle: 882, bottom: 1518,
  },
  {
    id: '2688', label: '6.5-inch 2688', px: { w: 1242, h: 2688 }, pt: { w: 414, h: 896 }, scale: 3,
    small: 507, medium: { w: 1080, h: 507 }, large: { w: 1080, h: 1137 },
    left: 81, right: 654, top: 228, middle: 858, bottom: 1488,
  },
  {
    id: '2622', label: '6.3-inch 2622', px: { w: 1206, h: 2622 }, pt: { w: 402, h: 874 }, scale: 3,
    // Scaled from 2556 (x by 1206/1179, y by 2622/2556).
    small: 485, medium: { w: 1037, h: 485 }, large: { w: 1037, h: 1086 },
    left: 84, right: 636, top: 277, middle: 880, bottom: 1483, estimated: true,
  },
  {
    id: '2556', label: '6.1-inch 2556', px: { w: 1179, h: 2556 }, pt: { w: 393, h: 852 }, scale: 3,
    small: 474, medium: { w: 1014, h: 474 }, large: { w: 1014, h: 1062 },
    left: 82, right: 622, top: 270, middle: 858, bottom: 1446,
  },
  {
    id: '2532', label: '6.1-inch 2532', px: { w: 1170, h: 2532 }, pt: { w: 390, h: 844 }, scale: 3,
    small: 474, medium: { w: 1014, h: 474 }, large: { w: 1014, h: 1062 },
    left: 78, right: 618, top: 231, middle: 819, bottom: 1407,
  },
  {
    id: '2436', label: '5.8-inch 2436', px: { w: 1125, h: 2436 }, pt: { w: 375, h: 812 }, scale: 3,
    small: 465, medium: { w: 987, h: 465 }, large: { w: 987, h: 1035 },
    left: 69, right: 591, top: 213, middle: 783, bottom: 1353,
  },
  {
    // Reports the same points and scale as 2436 (it renders at 3x and downsamples), so a
    // Dimensions lookup lands on 2436; pass the native pixel size to pick this row.
    id: '2340', label: '5.4-inch 2340', px: { w: 1080, h: 2340 }, pt: { w: 375, h: 812 }, scale: 3,
    small: 436, medium: { w: 936, h: 436 }, large: { w: 936, h: 980 },
    left: 72, right: 570, top: 212, middle: 756, bottom: 1300,
  },
  {
    id: '1792', label: '6.1-inch 1792', px: { w: 828, h: 1792 }, pt: { w: 414, h: 896 }, scale: 2,
    small: 338, medium: { w: 720, h: 338 }, large: { w: 720, h: 758 },
    left: 54, right: 436, top: 160, middle: 580, bottom: 1000,
  },
  {
    id: '1334', label: '4.7-inch 1334', px: { w: 750, h: 1334 }, pt: { w: 375, h: 667 }, scale: 2,
    small: 296, medium: { w: 642, h: 296 }, large: { w: 642, h: 648 },
    left: 54, right: 400, top: 60, middle: 412, bottom: 764,
  },
];

export const DEFAULT_DEVICE_ID = '2796';

export const SEAMLESS_SIZES: readonly SeamlessSize[] = ['small', 'medium', 'large'];

const SLOTS: { [K in SeamlessSize]: readonly SeamlessSlot[] } = {
  small: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
  medium: ['top', 'middle', 'bottom'],
  large: ['top', 'bottom'],
};

/** Grid positions a widget of `size` can take, top to bottom, left before right. */
export function slotsFor(size: SeamlessSize): readonly SeamlessSlot[] {
  return SLOTS[size] ?? SLOTS.small;
}

/** `slot` when valid for `size`, otherwise the first slot of that size. */
export function normaliseSlot(size: SeamlessSize, slot: string | null | undefined): SeamlessSlot {
  const list = slotsFor(size);
  return list.find((s) => s === slot) ?? list[0];
}

export function deviceById(id: string | null | undefined): SeamlessDevice | null {
  return SEAMLESS_DEVICES.find((d) => d.id === id) ?? null;
}

function defaultDevice(): SeamlessDevice {
  return deviceById(DEFAULT_DEVICE_ID) ?? SEAMLESS_DEVICES[0];
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Device for a screen. `screen` is what Dimensions / PixelRatio report (points + scale); orientation
 * does not matter. An exact native pixel size (`nativePx`, e.g. from a screenshot) wins when it
 * matches a row. Otherwise: exact points + scale, then the nearest row by pixel size (scale first).
 * Never null: unknown input gives the nearest row, garbage gives the default.
 */
export function lookupDevice(
  screen: { width: number; height: number; scale: number } | null | undefined,
  nativePx?: { width: number; height: number } | null,
): { device: SeamlessDevice; exact: boolean } {
  if (nativePx && finite(nativePx.width) && finite(nativePx.height)) {
    const w = Math.min(nativePx.width, nativePx.height);
    const h = Math.max(nativePx.width, nativePx.height);
    const hit = SEAMLESS_DEVICES.find((d) => d.px.w === w && d.px.h === h);
    if (hit) return { device: hit, exact: true };
  }
  if (!screen || !finite(screen.width) || !finite(screen.height) || screen.width <= 0 || screen.height <= 0) {
    return { device: defaultDevice(), exact: false };
  }
  const ptW = Math.min(screen.width, screen.height);
  const ptH = Math.max(screen.width, screen.height);
  const scale = finite(screen.scale) && screen.scale > 0 ? screen.scale : 3;
  const exact = SEAMLESS_DEVICES.find(
    (d) => !d.estimated && Math.abs(d.pt.w - ptW) < 0.5 && Math.abs(d.pt.h - ptH) < 0.5 && d.scale === scale,
  ) ?? SEAMLESS_DEVICES.find((d) => Math.abs(d.pt.w - ptW) < 0.5 && Math.abs(d.pt.h - ptH) < 0.5 && d.scale === scale);
  if (exact) return { device: exact, exact: true };
  // Nearest by pixel size; rows with the same scale are preferred. The 2340 row shares its points
  // with 2436 and is never chosen from points alone.
  const pxW = ptW * scale;
  const pxH = ptH * scale;
  let best = defaultDevice();
  let bestScore = Number.POSITIVE_INFINITY;
  for (const d of SEAMLESS_DEVICES) {
    if (d.id === '2340') continue;
    const score = Math.hypot(d.px.w - pxW, d.px.h - pxH) + (d.scale === scale ? 0 : 1e6);
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return { device: best, exact: false };
}

/** Widget size in native px. */
export function widgetSizePx(device: SeamlessDevice, size: SeamlessSize): Size {
  if (size === 'medium') return { ...device.medium };
  if (size === 'large') return { ...device.large };
  return sq(device.small);
}

/** Clamp a nudge to ±MAX_NUDGE_PT on each axis; non-numbers become 0. */
export function clampNudge(n: Partial<Nudge> | null | undefined): Nudge {
  const c = (v: unknown) => (finite(v) ? Math.max(-MAX_NUDGE_PT, Math.min(MAX_NUDGE_PT, v)) : 0);
  return { dx: c(n?.dx), dy: c(n?.dy) };
}

/** Nudge after one arrow press of `step` points; clamped. */
export function stepNudge(n: Nudge, dir: 'up' | 'down' | 'left' | 'right', step: number): Nudge {
  const s = finite(step) ? Math.abs(step) : 0;
  const base = clampNudge(n);
  if (dir === 'up') return clampNudge({ ...base, dy: base.dy - s });
  if (dir === 'down') return clampNudge({ ...base, dy: base.dy + s });
  if (dir === 'left') return clampNudge({ ...base, dx: base.dx - s });
  return clampNudge({ ...base, dx: base.dx + s });
}

/**
 * The widget's rectangle on the Home Screen in native px, from the table. Small widgets take a row
 * and a column; medium widgets a row (left column, full width); large widgets 'top' (top row) or
 * 'bottom' (starts at the middle row). An invalid slot falls back to the size's first slot.
 */
export function widgetTableRect(device: SeamlessDevice, size: SeamlessSize, slot: string): Rect {
  const s = normaliseSlot(size, slot);
  const dim = widgetSizePx(device, size);
  if (size === 'small') {
    const [row, col] = s.split('-') as ['top' | 'middle' | 'bottom', 'left' | 'right'];
    return { x: device[col], y: device[row], ...dim };
  }
  if (size === 'large') return { x: device.left, y: s === 'bottom' ? device.middle : device.top, ...dim };
  return { x: device.left, y: device[s as MediumSlot], ...dim };
}

/** widgetTableRect moved by a nudge in points (clamped to ±MAX_NUDGE_PT), in native px. */
export function widgetScreenRect(device: SeamlessDevice, size: SeamlessSize, slot: string, nudge?: Partial<Nudge> | null): Rect {
  const r = widgetTableRect(device, size, slot);
  const n = clampNudge(nudge);
  return { x: r.x + n.dx * device.scale, y: r.y + n.dy * device.scale, w: r.w, h: r.h };
}

/** How a wallpaper of `image` px covers a screen of `screen` px (aspect fill, centred). */
export type FillMapping = {
  /** Wallpaper px → screen px multiplier. */
  scale: number;
  /** Screen px position of the wallpaper's top-left corner (≤ 0 on the overflowing axis). */
  offsetX: number;
  offsetY: number;
};

export function wallpaperFill(image: Size, screen: Size): FillMapping {
  const iw = finite(image.w) && image.w > 0 ? image.w : 1;
  const ih = finite(image.h) && image.h > 0 ? image.h : 1;
  const scale = Math.max(screen.w / iw, screen.h / ih);
  return { scale, offsetX: (screen.w - iw * scale) / 2, offsetY: (screen.h - ih * scale) / 2 };
}

/** A screen-px rect in wallpaper px (unrounded, unclamped). */
export function screenToWallpaper(rect: Rect, fill: FillMapping): Rect {
  return {
    x: (rect.x - fill.offsetX) / fill.scale,
    y: (rect.y - fill.offsetY) / fill.scale,
    w: rect.w / fill.scale,
    h: rect.h / fill.scale,
  };
}

/** A wallpaper-px rect back in screen px. */
export function wallpaperToScreen(rect: Rect, fill: FillMapping): Rect {
  return {
    x: rect.x * fill.scale + fill.offsetX,
    y: rect.y * fill.scale + fill.offsetY,
    w: rect.w * fill.scale,
    h: rect.h * fill.scale,
  };
}

/** Round a rect to whole px and keep it inside `bounds` (size first, then position). */
export function clampRect(rect: Rect, bounds: Size): Rect {
  const bw = Math.max(1, Math.floor(bounds.w));
  const bh = Math.max(1, Math.floor(bounds.h));
  const w = Math.max(1, Math.min(bw, Math.round(rect.w)));
  const h = Math.max(1, Math.min(bh, Math.round(rect.h)));
  const x = Math.max(0, Math.min(bw - w, Math.round(rect.x)));
  const y = Math.max(0, Math.min(bh - h, Math.round(rect.y)));
  return { x, y, w, h };
}

export type SeamlessCrop = {
  device: SeamlessDevice;
  size: SeamlessSize;
  slot: SeamlessSlot;
  nudge: Nudge;
  /** Widget rect on the screen, native px, nudge applied. */
  screenRect: Rect;
  /** Crop in WALLPAPER px: whole numbers, inside the image. Hand this to the native bridge. */
  cropPx: Rect;
  fill: FillMapping;
  /** True when the crop had to be moved to stay inside the wallpaper. */
  clamped: boolean;
};

/**
 * The part of a `wallpaper` (px) that sits under the widget, assuming iOS shows the wallpaper
 * aspect-filled and centred on the screen (no Perspective Zoom, no user crop).
 */
export function seamlessCrop(input: {
  device: SeamlessDevice;
  wallpaper: Size;
  size: SeamlessSize;
  slot: string;
  nudge?: Partial<Nudge> | null;
}): SeamlessCrop {
  const { device, wallpaper, size } = input;
  const slot = normaliseSlot(size, input.slot);
  const nudge = clampNudge(input.nudge);
  const screenRect = widgetScreenRect(device, size, slot, nudge);
  const fill = wallpaperFill(wallpaper, device.px);
  const raw = screenToWallpaper(screenRect, fill);
  const cropPx = clampRect(raw, wallpaper);
  const clamped = Math.abs(cropPx.x - raw.x) > 0.5 || Math.abs(cropPx.y - raw.y) > 0.5;
  return { device, size, slot, nudge, screenRect, cropPx, fill, clamped };
}

/**
 * Where the hero art goes inside a widget of `widget` size: fitted (contain) inside the widget
 * minus `padding` (a fraction of the shorter side, 0–0.4), centred. Same units as `widget`.
 */
export function heroRect(widget: Size, hero: Size, padding = 0.06): Rect {
  const ww = Math.max(0, finite(widget.w) ? widget.w : 0);
  const wh = Math.max(0, finite(widget.h) ? widget.h : 0);
  const p = Math.max(0, Math.min(0.4, finite(padding) ? padding : 0)) * Math.min(ww, wh);
  const bw = Math.max(0, ww - p * 2);
  const bh = Math.max(0, wh - p * 2);
  const hw = finite(hero.w) && hero.w > 0 ? hero.w : 1;
  const hh = finite(hero.h) && hero.h > 0 ? hero.h : 1;
  const k = Math.min(bw / hw, bh / hh);
  const w = hw * k;
  const h = hh * k;
  return { x: (ww - w) / 2, y: (wh - h) / 2, w, h };
}

/** Widget corner radius in native px for a device. */
export function widgetCornerPx(device: SeamlessDevice): number {
  return WIDGET_CORNER_PT * device.scale;
}

/** Long edge cap of the composed image the bridge writes (keeps the extension in its memory budget). */
export const SEAMLESS_MAX_EDGE_PX = 1200;

/** App Group file the bridge writes per widget family; keep in sync with SeamlessWidget.swift. */
export function seamlessFileName(size: SeamlessSize): `seamless-${SeamlessSize}.png` {
  return `seamless-${size}.png`;
}

/** WidgetKit kind of the Seamless widget (targets/widget/SeamlessWidget.swift). */
export const SEAMLESS_WIDGET_KIND = 'GlazeSeamless';
