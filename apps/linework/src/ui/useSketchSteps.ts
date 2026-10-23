// Sketch steps on the trace screen: coarse -> fine overlays.
// Photos: each step is the outline pipeline run at that step's detail; PNGs are cached per step.
// Templates: the biggest paths show first (core/sketchSteps revealPaths).
// The source image never leaves the device; step PNGs go to the cache folder like Prepare's outline.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  STEP_COUNT,
  clampStep,
  getStep,
  nextStep,
  prevStep,
  revealPaths,
  stepCacheKey,
  stepOutlineOptions,
  type StepBase,
} from '../core/sketchSteps';
import type { Template } from '../core/templates';
import { parseStyleParam } from '../core/outlineStyleParam';
import { isAbortError, type OutlineResult } from '../native/outlinePipeline';
import { getOutlinePipeline } from '../native/outlineDeps';
import { select } from '../native/haptics';
import { t as tNow, tDynamic, useT } from '../i18n';

const KIND_IDS = ['auto', 'portrait', 'pet', 'object', 'landscape', 'drawing'] as const;

/** "Step 2 of 4 — main shapes" in the current language. */
function stepText(i: number): string {
  const k = clampStep(i);
  const s = getStep(k);
  return tNow('trace.steps.step', { step: k + 1, count: STEP_COUNT, name: tDynamic(`trace.steps.name.${s.id}`, s.name) });
}

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s !== 'undefined' ? s : undefined;
}

export type SketchSteps = {
  /** Steps can run for this overlay (templates, or raster photos). */
  available: boolean;
  active: boolean;
  /** Current step index (0 when off). */
  step: number;
  count: number;
  label: string;
  /** Outline PNG for the current step (photos), once generated. */
  uri?: string;
  /** Template with only this step's paths (templates). */
  template?: Template;
  /** 0..1 while a step's outline is being made, else null. */
  progress: number | null;
  error: string | null;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  retry: () => void;
};

/**
 * `uri` is the trace overlay. Prepare may pass `src` (the original photo), `turns`, `invert` and
 * `style` (the line engine) when the overlay is an outline, so steps re-outline the original the same way.
 */
export function useSketchSteps(uri: string, template?: Template): SketchSteps {
  // Re-renders (and re-labels) when the language changes.
  useT();
  const params = useLocalSearchParams<{ src?: string; turns?: string; invert?: string; kind?: string; bg?: string; style?: string }>();
  const src = template ? '' : (str(params.src) ?? uri);
  const turns = Number(str(params.turns) ?? 0) || 0;
  const invert = str(params.invert) === '1';
  const kindParam = str(params.kind);
  const kind: StepBase['kind'] = KIND_IDS.includes(kindParam as never) ? (kindParam as StepBase['kind']) : undefined;
  const bgParam = str(params.bg);
  const background: StepBase['background'] = bgParam === 'subject' || bgParam === 'soft' || bgParam === 'all' ? bgParam : undefined;
  // T54: the line engine chosen on Prepare (Sketch / Line art / Bold), so steps match the overlay.
  const style: StepBase['style'] = parseStyleParam(params.style);
  const available = !!template || (!!src && !/\.svg($|[?#])/i.test(src) && !src.startsWith('template:'));

  const [step, setStep] = useState<number | null>(null);
  const [result, setResult] = useState<{ key: string; res: OutlineResult } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const cache = useRef(new Map<string, OutlineResult>());

  useEffect(() => {
    if (step === null || template || !available) {
      setProgress(null);
      return;
    }
    const base: StepBase = { invert, rotateTurns: turns, kind, background, style };
    const key = stepCacheKey(src, step, base);
    const hit = cache.current.get(key);
    if (hit) {
      setResult({ key, res: hit });
      setProgress(null);
      setError(null);
      return;
    }
    const token = { aborted: false };
    let lastPct = -1;
    setError(null);
    setProgress(0);
    getOutlinePipeline()
      .run(src, stepOutlineOptions(step, base), (p) => {
        const pct = Math.floor(p * 100);
        if (pct !== lastPct && !token.aborted) {
          lastPct = pct;
          setProgress(p);
        }
      }, token)
      .then((res) => {
        if (token.aborted) return;
        cache.current.set(key, res);
        setResult({ key, res });
        setProgress(null);
      })
      .catch((e: unknown) => {
        if (token.aborted || isAbortError(e)) return;
        setError(tNow('trace.steps.error'));
        setProgress(null);
      });
    return () => {
      token.aborted = true;
    };
  }, [step, src, turns, invert, kind, background, style, template, available, nonce]);

  const announce = useCallback((i: number) => {
    AccessibilityInfo.announceForAccessibility(stepText(i));
  }, []);

  const start = useCallback(() => {
    if (!available) return;
    select();
    setStep(0);
    announce(0);
  }, [available, announce]);

  const stop = useCallback(() => {
    select();
    setStep(null);
    setResult(null);
    setError(null);
    AccessibilityInfo.announceForAccessibility(tNow('trace.steps.offAnnounce'));
  }, []);

  const go = useCallback(
    (n: number) => {
      if (step === null || n === step) return;
      select();
      setStep(n);
      announce(n);
    },
    [step, announce],
  );
  const next = useCallback(() => go(nextStep(step ?? 0)), [go, step]);
  const prev = useCallback(() => go(prevStep(step ?? 0)), [go, step]);

  const retry = useCallback(() => {
    select();
    setNonce((n) => n + 1);
  }, []);

  const active = step !== null;
  const k = clampStep(step ?? 0);
  const stepTemplate = useMemo(
    () => (template && active ? { ...template, paths: revealPaths(template.paths, k), detail: k >= STEP_COUNT - 1 ? template.detail : [] } : undefined),
    [template, active, k],
  );
  // Keep showing the previous step's outline while the next one is made (no flash back to the photo).
  const uri2 = active && !template && result ? result.res.uri : undefined;

  return {
    available,
    active,
    step: k,
    count: STEP_COUNT,
    label: stepText(k),

    uri: uri2,
    template: stepTemplate,
    progress: active ? progress : null,
    error: active ? error : null,
    start,
    stop,
    next,
    prev,
    retry,
  };
}
