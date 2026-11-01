// T257: the Settings › About "Startup" line, from the T250 deferred-work timings
// (src/core/deferredWork.ts). Pure: the screen passes the timings in and translates the result.
// Nothing here throws; any odd input gives `null` ("No startup data yet").

import type { StepTiming } from './deferredWork.ts';

/** Two runs further apart than this (gap between one's end and the next's start) belong to different bursts. */
export const BURST_GAP_MS = 10_000;

/** Plain-words label keys for the known steps (settings.about.startupSteps.*). Unknown names show as-is. */
export const STARTUP_STEP_LABEL = Object.freeze({
  packRestore: 'packRestore',
  widgetTheme: 'widgetTheme',
  themeArt: 'themeArt',
  installedProbe: 'installedProbe',
  packUpdates: 'packUpdates',
} as const);
export type StartupStepKey = keyof typeof STARTUP_STEP_LABEL;

export type Duration = { unit: 'ms' | 's'; value: number };

export type StartupSummary = {
  /** Wall time of the latest burst of background work (first start to last end, ms). */
  totalMs: number;
  /** The slowest run in that burst. */
  slowest: { name: string; key: StartupStepKey | null; ms: number; ok: boolean };
  /** Runs in that burst that failed. */
  failed: number;
};

function isTiming(t: unknown): t is StepTiming {
  if (!t || typeof t !== 'object') return false;
  const x = t as Record<string, unknown>;
  return typeof x.name === 'string' && typeof x.ms === 'number' && Number.isFinite(x.ms) && x.ms >= 0 && typeof x.at === 'number' && Number.isFinite(x.at);
}

/** Whole milliseconds under a second (120 -> 120 ms), otherwise seconds with one decimal (1234 -> 1.2 s). */
export function formatDuration(ms: number): Duration {
  const n = Number.isFinite(ms) && ms > 0 ? ms : 0;
  if (n < 1000) return { unit: 'ms', value: Math.round(n) };
  return { unit: 's', value: Math.round(n / 100) / 10 };
}

/**
 * Summarise the latest burst of deferred work (the last launch, or the work after the last theme
 * apply): runs whose start is within BURST_GAP_MS of the previous run's end. `null` when nothing
 * usable was recorded.
 */
export function summarizeStartup(timings: readonly unknown[] | null | undefined): StartupSummary | null {
  try {
    if (!Array.isArray(timings)) return null;
    const runs = timings.filter(isTiming).sort((a, b) => a.at - b.at);
    if (runs.length === 0) return null;
    let start = runs.length - 1;
    while (start > 0) {
      const prev = runs[start - 1]!;
      if (runs[start]!.at - (prev.at + prev.ms) > BURST_GAP_MS) break;
      start--;
    }
    const burst = runs.slice(start);
    const first = burst[0]!.at;
    const end = Math.max(...burst.map((r) => r.at + r.ms));
    let slow = burst[0]!;
    for (const r of burst) if (r.ms > slow.ms) slow = r;
    const key = Object.prototype.hasOwnProperty.call(STARTUP_STEP_LABEL, slow.name) ? (slow.name as StartupStepKey) : null;
    return {
      totalMs: Math.max(0, Math.round(end - first)),
      slowest: { name: slow.name, key, ms: Math.round(slow.ms), ok: slow.ok !== false },
      failed: burst.filter((r) => r.ok === false).length,
    };
  } catch {
    return null;
  }
}

export type StartupLineStrings = {
  /** Already-formatted "{total}" / "{step}" / "{time}" filler. */
  line(vars: { total: string; step: string; time: string }): string;
  failed(vars: { count: number }): string;
  empty: string;
  duration(d: Duration): string;
  step(key: StartupStepKey | null, raw: string): string;
};

/**
 * The finished line, e.g. "Last launch: background work done in 0.4 s · slowest step: theme packs 120 ms",
 * or `strings.empty` when there is no data. Never throws (falls back to `strings.empty`, then '').
 */
export function formatDeferredDiagnostics(timings: readonly unknown[] | null | undefined, strings: StartupLineStrings): string {
  try {
    const s = summarizeStartup(timings);
    if (!s) return strings.empty;
    let out = strings.line({
      total: strings.duration(formatDuration(s.totalMs)),
      step: strings.step(s.slowest.key, s.slowest.name),
      time: strings.duration(formatDuration(s.slowest.ms)),
    });
    if (s.failed > 0) out += ` · ${strings.failed({ count: s.failed })}`;
    return out;
  } catch {
    try {
      return strings.empty;
    } catch {
      return '';
    }
  }
}
