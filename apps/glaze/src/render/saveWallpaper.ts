// Save a wallpaper to Photos at exact device pixels.
// Shared by /wallpaper, the theme detail "Apply this look" flow and photo backgrounds (T25).
//
// Usage (generated wallpaper):
//   const saver = useWallpaperSaver();
//   ...
//   <OffscreenWallpaper ref={saver.ref} job={saver.job} />
//   const res = await saver.save(params, size);
//
// Usage (anything else, e.g. a photo that must finish loading before capture):
//   const saver = useOffscreenCapture<MyData>({ waitForReady: true });
//   <MyOffscreenView ref={saver.ref} job={saver.job} onReady={saver.markReady} />
//
// Capture uses react-native-view-shot with result 'tmpfile'. The view is laid out at
// pixels / PixelRatio points; view-shot's width/height are points on iOS (× screen scale) and
// pixels on Android, so exportPlan() picks the right numbers for each (unit-tested in core).

import * as MediaLibrary from 'expo-media-library';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Linking, PixelRatio, Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { runPhotoSave, type CaptureAttempt, type PhotoAccess, type SaveFailure } from '../core/photoSave';
import { exportPlan, type WallpaperParams } from '../core/wallpaper';
import { copyAsync } from '../native/fs';
import { nextFrames } from './capture';

export type WallpaperSaveSize = { width: number; height: number };

export type SaveWallpaperResult =
  | { ok: true; width: number; height: number; uri: string }
  | { ok: false; reason: 'denied' | 'error'; message?: string; why?: SaveFailure };

export type WallpaperJob = {
  params: WallpaperParams;
  layout: { width: number; height: number };
  capture: { width: number; height: number };
  pixels: { width: number; height: number };
  key: number;
};

const MOUNT_TIMEOUT_MS = 3000;

/**
 * Ask for add-only Photos access ("Add Photos Only" on iOS; writeOnly = true never asks to read the library, which
 * Expo Go and the store build both allow with NSPhotoLibraryAddUsageDescription). Throws only if the module fails.
 */
export async function photosWriteAccess(): Promise<PhotoAccess> {
  const current = await MediaLibrary.getPermissionsAsync(true);
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const res = await MediaLibrary.requestPermissionsAsync(true);
  if (res.granted) return 'granted';
  return res.canAskAgain ? 'denied' : 'blocked';
}

/** Ask for add-only Photos access. True when granted (or limited). */
export async function ensurePhotosWriteAccess(): Promise<boolean> {
  try {
    return (await photosWriteAccess()) === 'granted';
  } catch {
    return false;
  }
}

/** Open this app's page in the Settings app (for a denied Photos permission). */
export function openAppSettings(): void {
  Linking.openSettings().catch(() => {});
}

function asFileUri(uri: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(uri) ? uri : `file://${uri}`;
}

/**
 * Capture a mounted wallpaper view to a PNG temp file at the job's pixel size. The view is parked off screen, so on
 * iOS the first attempt uses renderInContext (the default drawViewHierarchyInRect fails for views outside the window,
 * fb-1024 C); see captureAttempts in core/photoSave.
 */
export async function captureWallpaper(
  ref: { current: View | null },
  job: Pick<WallpaperJob, 'capture'>,
  attempt: CaptureAttempt = { useRenderInContext: Platform.OS === 'ios' },
): Promise<string> {
  if (!ref.current) throw new Error('Wallpaper view is not mounted');
  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: job.capture.width,
    height: job.capture.height,
    useRenderInContext: attempt.useRenderInContext,
  });
  return asFileUri(uri);
}

export type CaptureJob<T> = {
  data: T;
  layout: { width: number; height: number };
  capture: { width: number; height: number };
  pixels: { width: number; height: number };
  key: number;
};

export type OffscreenCaptureOptions = {
  /**
   * After mounting, wait for `markReady()` (e.g. an Image's onLoad) before capturing.
   * `markReady(false)` (e.g. the Image's onError) fails the save with reason 'unreadable'.
   */
  waitForReady?: boolean;
  readyTimeoutMs?: number;
};

export type SaveCaptureResult =
  | { ok: true; width: number; height: number; uri: string }
  | { ok: false; reason: 'denied' | 'error' | 'unreadable'; message?: string; why?: SaveFailure };

/**
 * Generic hook: mounts `data` off screen at full size (render it from the returned `job`),
 * captures it and saves the PNG to Photos.
 */
export function useOffscreenCapture<T>(options: OffscreenCaptureOptions = {}) {
  const ref = useRef<View>(null);
  const [job, setJob] = useState<CaptureJob<T> | null>(null);
  const onMounted = useRef<(() => void) | null>(null);
  const onReady = useRef<((ok: boolean) => void) | null>(null);
  const counter = useRef(0);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const waitForReady = options.waitForReady === true;
  const readyTimeoutMs = options.readyTimeoutMs ?? 8000;

  useLayoutEffect(() => {
    if (job && onMounted.current) {
      const done = onMounted.current;
      onMounted.current = null;
      done();
    }
  }, [job]);

  const markReady = useCallback((ok: boolean = true) => {
    const done = onReady.current;
    onReady.current = null;
    if (done) done(ok);
  }, []);

  const save = useCallback(
    async (data: T, size: WallpaperSaveSize): Promise<SaveCaptureResult> => {
      if (busy.current) return { ok: false, reason: 'error', message: 'Already saving', why: 'busy' };
      busy.current = true;
      setSaving(true);
      try {
        const plan = exportPlan(size, PixelRatio.get(), Platform.OS);
        counter.current += 1;
        const next: CaptureJob<T> = { data, ...plan, key: counter.current };
        const out = await runPhotoSave({
          platform: Platform.OS,
          access: photosWriteAccess,
          render: async () => {
            // Armed before mounting so an onLoad that fires immediately is not missed.
            const ready = waitForReady
              ? new Promise<void>((resolve, reject) => {
                  const timer = setTimeout(() => {
                    onReady.current = null;
                    reject(new Error('Image did not load in time'));
                  }, readyTimeoutMs);
                  onReady.current = (ok) => {
                    clearTimeout(timer);
                    if (ok) resolve();
                    else reject(new Error('Image could not be read'));
                  };
                })
              : Promise.resolve();
            ready.catch(() => undefined); // handled below; avoids an unhandled rejection if mounting fails first
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => {
                onMounted.current = null;
                reject(new Error('Wallpaper did not render in time'));
              }, MOUNT_TIMEOUT_MS);
              onMounted.current = () => {
                clearTimeout(timer);
                resolve();
              };
              setJob(next);
            });
            await ready;
            // The render has finished painting before the capture.
            await nextFrames(3);
          },
          capture: (attempt) => captureWallpaper(ref, next, attempt),
          rename: (from, to) => copyAsync({ from, to }),
          save: (uri) => MediaLibrary.saveToLibraryAsync(uri),
        });
        if (out.ok) return { ok: true, width: plan.pixels.width, height: plan.pixels.height, uri: out.uri };
        const reason = out.reason === 'denied' ? 'denied' : out.reason === 'unreadable' ? 'unreadable' : 'error';
        return { ok: false, reason, message: out.detail, why: out.reason };
      } catch (e) {
        return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e), why: 'unknown' };
      } finally {
        onReady.current = null;
        setJob(null);
        busy.current = false;
        setSaving(false);
      }
    },
    [waitForReady, readyTimeoutMs],
  );

  return { ref, job, save, saving, markReady };
}

/** Hook: mounts the generated wallpaper off screen at full size, captures it and saves it to Photos. */
export function useWallpaperSaver() {
  const inner = useOffscreenCapture<WallpaperParams>();
  const job: WallpaperJob | null = inner.job
    ? {
        params: inner.job.data,
        layout: inner.job.layout,
        capture: inner.job.capture,
        pixels: inner.job.pixels,
        key: inner.job.key,
      }
    : null;
  const saveData = inner.save;
  const save = useCallback(
    async (params: WallpaperParams, size: WallpaperSaveSize): Promise<SaveWallpaperResult> => {
      const res = await saveData(params, size);
      if (res.ok) return res;
      return { ok: false, reason: res.reason === 'denied' ? 'denied' : 'error', message: res.message, why: res.why };
    },
    [saveData],
  );
  return { ref: inner.ref, job, save, saving: inner.saving };
}
