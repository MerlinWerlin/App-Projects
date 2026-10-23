// OffscreenIconRenderer: mounts icons one at a time outside the visible screen and captures
// each to a PNG. Mount it once (e.g. on the install screen) and call renderAll through its ref,
// or use useIconBatchRenderer() which wires the ref for you.

import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { captureIcon, nextFrames, pointsForPixels, type CaptureSize } from './capture';
import { IconCanvas, type IconDrawSpec } from './IconCanvas';

export type BatchSpec = IconDrawSpec & { appId: string };
export type RenderedIcon = { appId: string; pngBase64: string };
export type RenderProgress = (done: number, total: number, appId: string) => void;
/** Set `cancelled = true` to stop a batch before its next icon. renderAll then rejects with a RenderCancelledError. */
export type RenderCancelToken = { cancelled: boolean };

export class RenderCancelledError extends Error {
  constructor() {
    super('Icon rendering was cancelled');
    this.name = 'RenderCancelledError';
  }
}

export function isRenderCancelled(e: unknown): boolean {
  return e instanceof Error && e.name === 'RenderCancelledError';
}

export type OffscreenIconRendererHandle = {
  /**
   * Render and capture every spec in order, one mounted icon at a time (memory stays flat).
   * Calls are queued, never interleaved. onProgress fires once per captured icon.
   */
  renderAll(
    specs: BatchSpec[],
    size: CaptureSize,
    onProgress?: RenderProgress,
    cancel?: RenderCancelToken,
  ): Promise<RenderedIcon[]>;
};

export type OffscreenIconRendererProps = {
  /** Colour behind the shape in every capture (fills transparent corners). Default: transparent. */
  backdrop?: string;
};

type Job = { spec: BatchSpec; size: CaptureSize; key: number };

const MOUNT_TIMEOUT_MS = 3000;
/** Extra settle time for user images, which load asynchronously. */
const IMAGE_SETTLE_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const OffscreenIconRenderer = forwardRef<OffscreenIconRendererHandle, OffscreenIconRendererProps>(
  function OffscreenIconRenderer({ backdrop }, ref) {
    const viewRef = useRef<View>(null);
    const [job, setJob] = useState<Job | null>(null);
    const onMounted = useRef<(() => void) | null>(null);
    const queue = useRef<Promise<unknown>>(Promise.resolve());
    const counter = useRef(0);

    // Fires after the new job's view is committed.
    useLayoutEffect(() => {
      if (job && onMounted.current) {
        const done = onMounted.current;
        onMounted.current = null;
        done();
      }
    }, [job]);

    const show = useCallback((spec: BatchSpec, size: CaptureSize) => {
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          onMounted.current = null;
          reject(new Error('OffscreenIconRenderer: icon did not mount (is the renderer mounted?)'));
        }, MOUNT_TIMEOUT_MS);
        onMounted.current = () => {
          clearTimeout(timer);
          resolve();
        };
        counter.current += 1;
        setJob({ spec, size, key: counter.current });
      });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        renderAll(specs: BatchSpec[], size: CaptureSize, onProgress?: RenderProgress, cancel?: RenderCancelToken) {
          const run = async (): Promise<RenderedIcon[]> => {
            const out: RenderedIcon[] = [];
            try {
              for (let i = 0; i < specs.length; i++) {
                if (cancel?.cancelled) throw new RenderCancelledError();
                const spec = specs[i];
                await show(spec, size);
                await nextFrames(2);
                // Only user images load asynchronously; glyph/gradient icons skip the settle wait.
                if (spec.overrideImage) {
                  await delay(IMAGE_SETTLE_MS);
                  await nextFrames(1);
                }
                let png: string;
                try {
                  png = await captureIcon(viewRef, size);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  throw new Error(`Could not capture icon "${spec.appId}": ${msg}`);
                }
                out.push({ appId: spec.appId, pngBase64: png });
                onProgress?.(i + 1, specs.length, spec.appId);
              }
              if (cancel?.cancelled) throw new RenderCancelledError();
            } finally {
              setJob(null);
            }
            return out;
          };
          const p = queue.current.then(run, run);
          queue.current = p.catch(() => undefined);
          return p;
        },
      }),
      [show],
    );

    if (!job) return null;
    const pts = pointsForPixels(job.size);
    return (
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: -10000, top: 0, width: pts, height: pts }}
      >
        <IconCanvas key={job.key} ref={viewRef} spec={job.spec} size={pts} backdrop={backdrop} />
      </View>
    );
  },
);

/**
 * Hook form: `const { ref, renderAll } = useIconBatchRenderer();` then render
 * `<OffscreenIconRenderer ref={ref} />` somewhere in the tree and call renderAll.
 */
export function useIconBatchRenderer() {
  const ref = useRef<OffscreenIconRendererHandle>(null);
  const renderAll = useCallback(
    (
      specs: BatchSpec[],
      size: CaptureSize,
      onProgress?: RenderProgress,
      cancel?: RenderCancelToken,
    ): Promise<RenderedIcon[]> => {
      const h = ref.current;
      if (!h) return Promise.reject(new Error('Mount <OffscreenIconRenderer ref={ref} /> before rendering'));
      return h.renderAll(specs, size, onProgress, cancel);
    },
    [],
  );
  return { ref, renderAll };
}
