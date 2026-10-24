// useWallpaperPalette (T85): when a theme's background is the user's own photo, sample the photo's
// colours (as it is drawn: crop and theme tint included) so widget looks are contrast-checked
// against it. The photo is drawn off screen at PHOTO_SAMPLE_SIZE, read through the
// src/native/wallpaperPixels adapter and reduced with src/core/wallpaperPalette (k-means palette +
// bounds). Results are cached per photo for the session. On any failure `sampled` stays null and
// widgets treat the wallpaper as unknown (panes bounded over black and white). Nothing leaves the
// phone.
// T118 (fb-1024 B): a focus reload that finds the same background keeps the old state object, so
// coming back to the Widgets tab no longer re-renders the screen for nothing.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { defaultBackground, usesPhoto, type ThemeBackground } from '../core/background';
import { keepIfSame, sameJson } from '../core/perfCache';
import { DEFAULT_TRANSFORM } from '../core/photoCrop';
import type { Theme } from '../core/themes';
import { PHOTO_SAMPLE_SIZE, photoPaletteFromPixels } from '../core/wallpaperPalette';
import { readViewPixels } from '../native/wallpaperPixels';
import { nextFrames } from '../render/capture';
import { PhotoWallpaperView, type PhotoWallpaperData } from '../render/PhotoWallpaperView';
import { loadBackground } from '../store/background';

export type WallpaperPalette = {
  /** The theme's background is the user's photo. */
  usesPhoto: boolean;
  /** Colours sampled from the photo; null while sampling, when it failed, or for a theme design. */
  sampled: string[] | null;
  /** The photo (for drawing behind see-through previews); null for a theme design. */
  photoUri: string | null;
  /** Hidden view used for sampling; render it once anywhere in the screen (null when idle). */
  probe: ReactNode;
};

/** Photo key → sampled colours ([] = sampling failed). Session only. */
const CACHE = new Map<string, string[]>();
const SAMPLE_TIMEOUT_MS = 5000;

function keyOf(p: PhotoWallpaperData): string {
  return JSON.stringify([p.uri, p.transform, p.overlay, p.palette.bg, p.palette.surface, p.palette.accent]);
}

export function useWallpaperPalette(theme: Theme): WallpaperPalette {
  const [bg, setBg] = useState<ThemeBackground>(() => defaultBackground());
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadBackground(theme.id)
        .then((b) => {
          if (alive) setBg((prev) => keepIfSame(prev, b, sameJson));
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [theme.id]),
  );

  const photo: PhotoWallpaperData | null = useMemo(
    () =>
      usesPhoto(bg)
        ? {
            uri: bg.photoUri,
            imageW: bg.imageW,
            imageH: bg.imageH,
            transform: bg.transform ?? DEFAULT_TRANSFORM,
            overlay: bg.overlay,
            palette: theme.palette,
          }
        : null,
    [bg, theme.palette],
  );
  const key = photo ? keyOf(photo) : null;
  const [result, setResult] = useState<{ key: string; colours: string[] } | null>(null);
  const ref = useRef<View>(null);
  const alive = useRef(true);
  const started = useRef<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const cached = key ? CACHE.get(key) : undefined;
  const done = cached !== undefined || (result !== null && result.key === key);
  const sampling = !!photo && !!key && !done;

  const finish = useCallback((k: string, colours: string[], remember: boolean) => {
    if (remember) CACHE.set(k, colours);
    if (alive.current) setResult({ key: k, colours });
  }, []);

  const onLoad = useCallback(() => {
    if (!key || started.current === key) return;
    started.current = key;
    const k = key;
    void (async () => {
      await nextFrames(2);
      const img = await readViewPixels(ref, PHOTO_SAMPLE_SIZE.width, PHOTO_SAMPLE_SIZE.height);
      finish(k, img ? photoPaletteFromPixels(img.rgba).colours : [], true);
    })();
  }, [key, finish]);

  const onError = useCallback(() => {
    if (key) finish(key, [], true);
  }, [key, finish]);

  // An image that never reports back counts as a failed sample (not cached: retried next time).
  useEffect(() => {
    if (!sampling || !key) return undefined;
    const k = key;
    const id = setTimeout(() => {
      if (started.current !== k) finish(k, [], false);
    }, SAMPLE_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [sampling, key, finish]);

  const colours = cached ?? (result && result.key === key ? result.colours : null);
  const probe: ReactNode =
    sampling && photo ? (
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: -10000, top: 0, width: PHOTO_SAMPLE_SIZE.width, height: PHOTO_SAMPLE_SIZE.height }}
      >
        <PhotoWallpaperView
          ref={ref}
          photo={photo}
          width={PHOTO_SAMPLE_SIZE.width}
          height={PHOTO_SAMPLE_SIZE.height}
          maxGrain={0}
          onLoad={onLoad}
          onError={onError}
        />
      </View>
    ) : null;

  return {
    usesPhoto: !!photo,
    sampled: colours && colours.length > 0 ? colours : null,
    photoUri: photo ? photo.uri : null,
    probe,
  };
}
