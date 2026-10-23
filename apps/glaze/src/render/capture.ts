// Capture a mounted IconCanvas to a PNG (base64, no data: prefix) with react-native-view-shot.

import type { RefObject } from 'react';
import { PixelRatio, Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export type CaptureSize = 180 | 360;
export const CAPTURE_SIZES: readonly CaptureSize[] = [180, 360];

/** Strip a `data:image/png;base64,` prefix and whitespace if present. */
export function stripDataPrefix(b64: string): string {
  const i = b64.indexOf('base64,');
  return (i >= 0 ? b64.slice(i + 7) : b64).replace(/\s+/g, '');
}

/** Resolve after two animation frames so fonts, glyphs and SVG have painted. */
export function nextFrames(count: number = 2): Promise<void> {
  return new Promise((resolve) => {
    let left = Math.max(1, count);
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Points to lay an icon out at so it maps 1:1 to `px` device pixels (no resampling). */
export function pointsForPixels(px: number): number {
  return px / PixelRatio.get();
}

/**
 * Capture `ref` (an IconCanvas or any View with collapsable={false}) as a size×size PNG.
 * Returns base64 without the data: prefix.
 * view-shot's width/height are pixels on Android but points (× screen scale) on iOS,
 * so iOS gets size / PixelRatio to land on exactly size×size pixels.
 */
export async function captureIcon(ref: RefObject<View | null>, size: CaptureSize): Promise<string> {
  if (!ref.current) throw new Error('captureIcon: view is not mounted');
  const dim = Platform.OS === 'ios' ? pointsForPixels(size) : size;
  const out = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'base64',
    width: dim,
    height: dim,
  });
  return stripDataPrefix(out);
}
