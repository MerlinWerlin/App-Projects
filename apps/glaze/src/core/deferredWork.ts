// T250 (owner-1101h #1): deferred, crash-safe follow-up work. After "Use this theme" (Firefly Grove)
// and coming back into Glaze the app froze, took long to start and then crashed: too much JS-thread
// work at launch / foreground / right after a theme apply (installed-app probe, widget art index,
// App Group write + timeline reloads, pack restore / verification, pack updates).
//
// This is the queue all of that now goes through. Pure TypeScript (Node runs it in tests); the React
// Native wrapper (src/store/deferredWork.ts) gives it storage, a clock and a "yield" that waits for
// interactions + a macrotask, and starts it only after the first screen has drawn.
//
// - Named steps, registered once. `request(name, arg?)` queues a step; requests for a step that is
//   already waiting are coalesced (the latest `arg` wins); a request while it runs re-runs it once after.
// - One step at a time, by priority (lower first) then request order, with a yield between steps.
// - Every step runs inside try/catch: a failure is recorded, never thrown, never stops the queue.
// - Crash-safe: a requested step is persisted as pending (with an attempt count) before it runs and
//   cleared only when it finished. A step interrupted by a crash / kill, or one that failed, runs
//   again on the next launch (without its in-memory `arg`, so steps must work from stored state), and
//   is dropped after MAX_ATTEMPTS so a step that itself crashes the app can never crash-loop it.
// - Budget accounting: each run's wall time is recorded against the step's budget; the last
//   TIMING_KEEP timings are kept (and persisted) for a Settings diagnostics line / __DEV__ log.
//   Nothing is sent anywhere.

export const DEFERRED_KEY = 'glaze.deferredWork.v1';

/**
 * The app's step names (registered in src/store/launchWork.ts). Lower priority runs first:
 * packRestore 10, widgetTheme 20, themeArt 30, installedProbe 50, packUpdates 80.
 */
export const DEFERRED_STEPS = Object.freeze({
  /** Register downloaded packs' pack-only motifs (memoised; screens that need it await the same promise). */
  packRestore: 'packRestore',
  /** App Group write of the remembered widget theme + reloadAllTimelines. */
  widgetTheme: 'widgetTheme',
  /** "My widget art": the theme in use replaces the previous theme's auto-added art (T238 / T252). */
  themeArt: 'themeArt',
  /** canOpenURL installed-apps check (throttled on launch, chunked). */
  installedProbe: 'installedProbe',
  /** T222 background updates of downloaded remote packs. */
  packUpdates: 'packUpdates',
} as const);
/** A step is tried at most this many launches in a row before it is dropped. */
export const MAX_ATTEMPTS = 3;
/** Timings kept (newest last). */
export const TIMING_KEEP = 20;
/** Default per-step budget (ms of wall time). Over-budget runs are flagged in the timings. */
export const DEFAULT_BUDGET_MS = 250;
/** A run that has not settled after this long counts as failed and the queue moves on (ms). */
export const DEFAULT_TIMEOUT_MS = 20_000;
/** Default slice for chunked work inside a step before it should yield (ms). */
export const DEFAULT_SLICE_MS = 12;

export type StepTiming = {
  name: string;
  /** Wall time of the run (ms, rounded). */
  ms: number;
  budgetMs: number;
  overBudget: boolean;
  ok: boolean;
  /** When the run started (ms since epoch, host clock). */
  at: number;
};

export type DeferredState = {
  /** Step name -> launches it has been started in without finishing. */
  pending: Record<string, number>;
  timings: StepTiming[];
};

/** Handed to every run: cooperative yielding for chunked work. */
export type StepContext = {
  /** True once this step has run DEFAULT_SLICE_MS (or its sliceMs) since its last yield. */
  shouldYield(): boolean;
  /** Give the JS thread back (frames, touches), then continue. */
  pause(): Promise<void>;
  /** True on a run restored from a previous launch (no in-memory arg). */
  resumed: boolean;
};

export type StepDef = {
  /** Lower runs first. Default 100. */
  priority?: number;
  budgetMs?: number;
  sliceMs?: number;
  timeoutMs?: number;
  /** false: never persisted (a step that only makes sense in this session). Default true. */
  persist?: boolean;
  run(arg: unknown, ctx: StepContext): Promise<unknown> | unknown;
};

export type DeferredHost = {
  now(): number;
  /** Resolve after the JS thread had a chance to draw / handle touches (between steps). */
  yieldTurn(): Promise<void>;
  load(): Promise<string | null>;
  save(raw: string): Promise<void>;
  /** Optional diagnostics sink (the RN wrapper logs in __DEV__ only). */
  log?(t: StepTiming): void;
};

export function emptyDeferredState(): DeferredState {
  return { pending: {}, timings: [] };
}

export function parseDeferredState(raw: string | null | undefined): DeferredState {
  if (!raw) return emptyDeferredState();
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return emptyDeferredState();
    const o = v as { pending?: unknown; timings?: unknown };
    const pending: Record<string, number> = {};
    if (o.pending && typeof o.pending === 'object' && !Array.isArray(o.pending)) {
      for (const [k, n] of Object.entries(o.pending as Record<string, unknown>)) {
        if (/^[a-zA-Z0-9:._-]{1,64}$/.test(k) && typeof n === 'number' && Number.isFinite(n) && n >= 0) pending[k] = Math.floor(n);
      }
    }
    const timings: StepTiming[] = [];
    if (Array.isArray(o.timings)) {
      for (const t of o.timings) {
        if (!t || typeof t !== 'object') continue;
        const x = t as Record<string, unknown>;
        if (typeof x.name !== 'string' || typeof x.ms !== 'number' || typeof x.at !== 'number') continue;
        const budgetMs = typeof x.budgetMs === 'number' ? x.budgetMs : DEFAULT_BUDGET_MS;
        timings.push({ name: x.name, ms: x.ms, budgetMs, overBudget: x.ms > budgetMs, ok: x.ok !== false, at: x.at });
      }
    }
    return { pending, timings: timings.slice(-TIMING_KEEP) };
  } catch {
    return emptyDeferredState();
  }
}

export function serializeDeferredState(s: DeferredState): string {
  return JSON.stringify({ pending: s.pending, timings: s.timings.slice(-TIMING_KEEP) });
}

/** The `n` slowest recorded runs, slowest first. */
export function slowestSteps(timings: readonly StepTiming[], n: number = 3): StepTiming[] {
  return [...timings].sort((a, b) => b.ms - a.ms || b.at - a.at).slice(0, Math.max(0, n));
}

/** One short line for Settings diagnostics, e.g. "Slowest: probe 420 ms, widgetTheme 90 ms". '' when nothing ran. */
export function diagnosticsLine(timings: readonly StepTiming[], n: number = 3): string {
  const top = slowestSteps(timings, n);
  if (top.length === 0) return '';
  return `Slowest: ${top.map((t) => `${t.name} ${Math.round(t.ms)} ms${t.ok ? '' : ' (failed)'}`).join(', ')}`;
}

/** Split `items` into chunks of `size` (>= 1). */
export function chunked<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size) || 1);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/** Run `fn` over `items` in chunks of `size`, awaiting `pause()` between chunks. Collects results in order. */
export async function mapInChunks<T, R>(
  items: readonly T[],
  size: number,
  fn: (chunk: T[]) => Promise<R[]> | R[],
  pause: () => Promise<void>,
): Promise<R[]> {
  const out: R[] = [];
  const parts = chunked(items, size);
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) await pause();
    out.push(...(await fn(parts[i]!)));
  }
  return out;
}

type Waiting = { name: string; seq: number; arg: unknown; hasArg: boolean; resumed: boolean };

export type DeferredQueue = {
  register(name: string, def: StepDef): void;
  /** Queue a step (coalesced). Before start() it only waits; it never runs on the launch path. */
  request(name: string, arg?: unknown): void;
  /** Load persisted pending steps (re-queued as resumed) and begin draining. Idempotent. */
  start(): Promise<void>;
  /** Resolves when nothing is waiting or running (after start). */
  idle(): Promise<void>;
  /** Names waiting to run, in run order. */
  waiting(): string[];
  running(): string | null;
  timings(): StepTiming[];
  /** Persisted pending names (for tests / diagnostics). */
  pendingPersisted(): Record<string, number>;
  /** Steps skipped this launch after MAX_ATTEMPTS unfinished runs. */
  dropped(): string[];
};

export function createDeferredQueue(host: DeferredHost): DeferredQueue {
  const defs = new Map<string, StepDef>();
  const waiting = new Map<string, Waiting>();
  let state: DeferredState = emptyDeferredState();
  let loaded = false;
  let started: Promise<void> | null = null;
  let draining: Promise<void> | null = null;
  let current: string | null = null;
  /** Requested again while running: run once more after (latest arg). */
  let again: Waiting | null = null;
  let seq = 0;
  let saveChain: Promise<void> = Promise.resolve();
  /** Skipped at this launch's start after MAX_ATTEMPTS unfinished runs (a later request, e.g. a new theme apply, runs it). */
  const dropped = new Set<string>();

  const persist = (): Promise<void> => {
    if (!loaded) return Promise.resolve();
    const raw = serializeDeferredState(state);
    saveChain = saveChain.then(() => host.save(raw)).catch(() => undefined);
    return saveChain;
  };

  const persists = (name: string) => defs.get(name)?.persist !== false;

  const markPending = (name: string) => {
    if (!persists(name)) return;
    if (!(name in state.pending)) {
      state = { ...state, pending: { ...state.pending, [name]: 0 } };
      void persist();
    }
  };

  const order = (): Waiting[] =>
    [...waiting.values()].sort((a, b) => (defs.get(a.name)?.priority ?? 100) - (defs.get(b.name)?.priority ?? 100) || a.seq - b.seq);

  const record = (t: StepTiming) => {
    state = { ...state, timings: [...state.timings, t].slice(-TIMING_KEEP) };
    try {
      host.log?.(t);
    } catch {
      // Diagnostics never break the queue.
    }
  };

  const runOne = async (w: Waiting): Promise<void> => {
    const def = defs.get(w.name);
    if (!def) return; // Unknown (renamed / removed step from an older build): just drop it.
    const keep = persists(w.name);
    const attempts = (state.pending[w.name] ?? 0) + 1;
    if (keep) {
      // Counted before it runs: a crash inside the run still counts as an attempt.
      state = { ...state, pending: { ...state.pending, [w.name]: attempts } };
      await persist();
    }
    const budgetMs = def.budgetMs ?? DEFAULT_BUDGET_MS;
    const sliceMs = def.sliceMs ?? DEFAULT_SLICE_MS;
    let sliceStart = host.now();
    const ctx: StepContext = {
      shouldYield: () => host.now() - sliceStart >= sliceMs,
      pause: async () => {
        try {
          await host.yieldTurn();
        } catch {
          // A broken yield still continues.
        }
        sliceStart = host.now();
      },
      resumed: w.resumed,
    };
    const at = host.now();
    let ok = true;
    current = w.name;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const run = Promise.resolve().then(() => def.run(w.hasArg ? w.arg : undefined, ctx));
      const timeoutMs = def.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      // A native call that never answers must not hold the queue: after timeoutMs the run counts as
      // failed (pending for next launch) and the queue moves on.
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('deferred step timed out')), timeoutMs);
      });
      await Promise.race([run, timeout]);
    } catch {
      ok = false;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    current = null;
    const ms = Math.max(0, Math.round(host.now() - at));
    record({ name: w.name, ms, budgetMs, overBudget: ms > budgetMs, ok, at });
    if (keep) {
      const { [w.name]: _n, ...rest } = state.pending;
      // A failed run stays pending for the next launch unless it is out of attempts.
      const pending = !ok && attempts < MAX_ATTEMPTS ? { ...rest, [w.name]: attempts } : rest;
      // Re-requested while it ran: it is pending again (fresh attempt count).
      if (again && again.name === w.name && !(w.name in pending)) pending[w.name] = 0;
      state = { ...state, pending };
    }
    await persist();
  };

  const drain = (): Promise<void> => {
    if (draining) return draining;
    draining = (async () => {
      // Never settle synchronously: `draining` must be assigned before the finally below clears it.
      await Promise.resolve();
      try {
        for (;;) {
          const next = order()[0];
          if (!next) break;
          waiting.delete(next.name);
          await runOne(next);
          if (again) {
            const a = again;
            again = null;
            if (!waiting.has(a.name)) waiting.set(a.name, a);
          }
          if (waiting.size > 0) {
            try {
              await host.yieldTurn();
            } catch {
              // Keep going.
            }
          }
        }
      } finally {
        draining = null;
      }
      // A request that arrived during the final step's bookkeeping.
      if (waiting.size > 0) await drain();
    })();
    return draining;
  };

  const queue: DeferredQueue = {
    register(name, def) {
      defs.set(name, def);
    },
    request(name: string, ...args: unknown[]) {
      const hasArg = args.length > 0;
      const arg = args[0];
      if (current === name) {
        again = { name, seq: ++seq, arg, hasArg, resumed: false };
        markPending(name);
        return;
      }
      const prev = waiting.get(name);
      if (prev) {
        // Coalesced: keep its place, take the newest argument.
        if (hasArg) waiting.set(name, { ...prev, arg, hasArg, resumed: false });
      } else {
        waiting.set(name, { name, seq: ++seq, arg, hasArg, resumed: false });
      }
      markPending(name);
      // T264: a drain can never surface as an unhandled rejection.
      if (started && loaded) drain().catch(() => undefined);
    },
    start() {
      if (started) return started;
      started = (async () => {
        let raw: string | null = null;
        try {
          raw = await host.load();
        } catch {
          raw = null;
        }
        const saved = parseDeferredState(raw);
        // Requests made before start() (this launch) were pending in memory only; merge them in.
        const pending: Record<string, number> = { ...saved.pending };
        for (const [name, n] of Object.entries(state.pending)) pending[name] = Math.max(pending[name] ?? 0, n);
        state = { pending, timings: [...saved.timings, ...state.timings].slice(-TIMING_KEEP) };
        loaded = true;
        for (const [name, attempts] of Object.entries(saved.pending)) {
          if (attempts >= MAX_ATTEMPTS || !defs.has(name)) {
            // Out of attempts (it may itself be what crashed the app) or no longer exists: skip it for
            // this launch, even if this launch asked for it again, so it can never crash-loop the app.
            // Its count is cleared, so a later launch tries it afresh.
            const { [name]: _x, ...rest } = state.pending;
            state = { ...state, pending: rest };
            waiting.delete(name);
            dropped.add(name);
            continue;
          }
          const w = waiting.get(name);
          if (w) {
            // Asked for again this launch: one run, which knows it is also a resumed one.
            waiting.set(name, { ...w, resumed: true });
            continue;
          }
          waiting.set(name, { name, seq: ++seq, arg: undefined, hasArg: false, resumed: true });
        }
        await persist();
        await drain();
      })();
      return started;
    },
    async idle() {
      if (started) await started;
      while (draining) await draining;
      await saveChain;
    },
    waiting: () => order().map((w) => w.name),
    running: () => current,
    timings: () => [...state.timings],
    pendingPersisted: () => ({ ...state.pending }),
    dropped: () => [...dropped],
  };
  return queue;
}
