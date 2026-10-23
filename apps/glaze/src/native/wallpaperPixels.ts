// Wallpaper pixel adapter (T85). Reads the pixels of a small mounted view (the user's wallpaper
// photo drawn at a few dozen pixels) so its colours can be sampled for widget contrast.
//
// Expo Go-safe: react-native-view-shot ships in Expo Go and the PNG is decoded in pure TS
// (src/core/png.ts), so no native image library is needed. Every failure (view not mounted,
// capture unsupported, unreadable PNG) resolves to null and callers fall back to "wallpaper
// unknown" (src/core/wallpaperPalette.ts), so this never throws or crashes.
import type { RefObject } from 'react';
import { PixelRatio, Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { base64Decode } from '../core/bytes';
import { decodePng, type RgbaImage } from '../core/png';

/** Capture `ref` as a width × height pixel PNG and decode it. Null on any failure. */
export async function readViewPixels(ref: RefObject<View | null>, width: number, height: number): Promise<RgbaImage | null> {
  try {
    if (!ref.current) return null;
    // view-shot sizes are pixels on Android but points (× screen scale) on iOS.
    const scale = Platform.OS === 'ios' ? PixelRatio.get() : 1;
    const out = await captureRef(ref, { format: 'png', quality: 1, result: 'base64', width: width / scale, height: height / scale });
    if (typeof out !== 'string' || out.length === 0) return null;
    const i = out.indexOf('base64,');
    const b64 = (i >= 0 ? out.slice(i + 7) : out).replace(/\s+/g, '');
    return decodePng(base64Decode(b64));
  } catch {
    return null;
  }
}
