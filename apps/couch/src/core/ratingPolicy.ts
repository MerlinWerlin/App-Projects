import type { KvStore } from './store';

/**
 * T75 (run 42, market-1018 M2 gap; MARKET.md hate #8 "repeated pushy rating prompts"): a polite,
 * one-time rating prompt. Pure TS policy + a small controller, unit-tested in Node.
 *
 * We only ever hand over to the OS's own review sheet (src/native/storeReview.ts). We never show a
 * pre-prompt of our own and never ask "do you like Couch?". The OS may still decide not to show the
 * sheet (Apple rate-limits it); we cannot know, so an ask is recorded before the sheet is requested.
 *
 * Ask only when ALL hold:
 * - the first launch was at least 7 days ago;
 * - at least 3 successful sessions, counting the current one. A session is successful when at least
 *   one key (or text / app launch) reached a TV, the demo MockTv included, and no driver error or
 *   failed connect happened in that session;
 * - the current session has a success and no error (never in the same session as an error);
 * - the user is on the remote screen (never during onboarding / add-TV / settings sheets);
 * - not already asked for this app version (at most once per version), and at least
 *   MIN_DAYS_BETWEEN_ASKS since the last ask on any version (frequent releases must not re-ask).
 *
 * A session starts at a cold launch, or when the app returns after SESSION_GAP_MS in the background.
 */

export const RATING_KEY = 'couch.rating';
export const RATING_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MIN_DAYS_SINCE_FIRST_LAUNCH = 7;
export const MIN_SUCCESSFUL_SESSIONS = 3;
export const MIN_DAYS_BETWEEN_ASKS = 90;
/** Background time after which a return to the foreground starts a new session. */
export const SESSION_GAP_MS = 30 * 60 * 1000;
/** Kept so the stored list cannot grow without bound. */
const MAX_ASKED_VERSIONS = 20;

export interface OpenSession {
  success: boolean;
  error: boolean;
}

export interface RatingState {
  version: typeof RATING_VERSION;
  firstLaunchAt: number | null;
  /** Finished sessions that were successful (the open one is not counted here). */
  successfulSessions: number;
  askedVersions: string[];
  lastAskedAt: number | null;
  open: OpenSession | null;
}

export type RatingScreen = 'remote' | 'onboarding' | 'addTv' | 'other';

export type AskVerdict =
  | 'ask'
  | 'too_soon'
  | 'few_sessions'
  | 'no_success_now'
  | 'error_this_session'
  | 'wrong_screen'
  | 'asked_this_version'
  | 'asked_recently';

export function emptyRatingState(): RatingState {
  return { version: RATING_VERSION, firstLaunchAt: null, successfulSessions: 0, askedVersions: [], lastAskedAt: null, open: null };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Parses the stored JSON; anything malformed yields a fresh state (never throws). */
export function parseRatingState(raw: string | null): RatingState {
  if (!raw) return emptyRatingState();
  try {
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    if (!v || typeof v !== 'object' || v['version'] !== RATING_VERSION) return emptyRatingState();
    const open = v['open'] as Record<string, unknown> | null | undefined;
    const asked = Array.isArray(v['askedVersions']) ? v['askedVersions'].filter((x): x is string => typeof x === 'string') : [];
    return {
      version: RATING_VERSION,
      firstLaunchAt: isNum(v['firstLaunchAt']) ? v['firstLaunchAt'] : null,
      successfulSessions: isNum(v['successfulSessions']) && v['successfulSessions'] >= 0 ? Math.floor(v['successfulSessions']) : 0,
      askedVersions: asked.slice(-MAX_ASKED_VERSIONS),
      lastAskedAt: isNum(v['lastAskedAt']) ? v['lastAskedAt'] : null,
      open: open && typeof open === 'object' ? { success: open['success'] === true, error: open['error'] === true } : null,
    };
  } catch {
    return emptyRatingState();
  }
}

export function serializeRatingState(s: RatingState): string {
  return JSON.stringify(s);
}

const sessionCounts = (o: OpenSession | null): boolean => !!o && o.success && !o.error;

/** Closes the open session (counting it if it was successful) and opens a new one. */
export function startSession(s: RatingState, now: number): RatingState {
  return {
    ...s,
    firstLaunchAt: s.firstLaunchAt ?? now,
    successfulSessions: s.successfulSessions + (sessionCounts(s.open) ? 1 : 0),
    open: { success: false, error: false },
  };
}

export function recordSuccess(s: RatingState): RatingState {
  const open = s.open ?? { success: false, error: false };
  return open.success ? s : { ...s, open: { ...open, success: true } };
}

export function recordError(s: RatingState): RatingState {
  const open = s.open ?? { success: false, error: false };
  return open.error ? s : { ...s, open: { ...open, error: true } };
}

export function markAsked(s: RatingState, appVersion: string, now: number): RatingState {
  const asked = s.askedVersions.includes(appVersion) ? s.askedVersions : [...s.askedVersions, appVersion];
  return { ...s, askedVersions: asked.slice(-MAX_ASKED_VERSIONS), lastAskedAt: now };
}

/** Which screen an Expo Router pathname is (only 'remote' may ever show the prompt). */
export function ratingScreenFromPath(path: string | null | undefined): RatingScreen {
  if (!path) return 'other';
  const p = path.replace(/\/\([^)]*\)/g, '').replace(/\/+$/, '') || '/';
  if (/^\/add-tv/.test(p)) return 'addTv';
  if (/^\/onboarding/.test(p) || /^\/welcome/.test(p)) return 'onboarding';
  if (p === '/remote' || p === '/') return 'remote';
  return 'other';
}

export interface AskContext {
  now: number;
  appVersion: string;
  screen: RatingScreen;
}

/** The decision, with the first failing rule (for tests and diagnostics). */
export function ratingVerdict(s: RatingState, ctx: AskContext): AskVerdict {
  if (ctx.screen !== 'remote') return 'wrong_screen';
  if (s.askedVersions.includes(ctx.appVersion)) return 'asked_this_version';
  if (s.lastAskedAt !== null && ctx.now - s.lastAskedAt < MIN_DAYS_BETWEEN_ASKS * DAY_MS) return 'asked_recently';
  if (s.open?.error) return 'error_this_session';
  if (!s.open?.success) return 'no_success_now';
  if (s.firstLaunchAt === null || ctx.now - s.firstLaunchAt < MIN_DAYS_SINCE_FIRST_LAUNCH * DAY_MS) return 'too_soon';
  // The current session (successful, error-free so far) counts towards the 3.
  if (s.successfulSessions + 1 < MIN_SUCCESSFUL_SESSIONS) return 'few_sessions';
  return 'ask';
}

export function shouldAskForRating(s: RatingState, ctx: AskContext): boolean {
  return ratingVerdict(s, ctx) === 'ask';
}

export interface RatingDeps {
  kv: KvStore;
  now: () => number;
  appVersion: string;
  /**
   * Shows the OS review sheet. Resolves true if the sheet was requested, false when unavailable
   * (no module, Expo Go, no store). Must not throw; a throw is treated as false.
   */
  requestReview: () => Promise<boolean>;
}

/**
 * Stateful glue used by src/state/useRatingPrompt.ts. All persistence is best-effort: a failing
 * KV never throws out of here, and the worst case is that we do not ask.
 */
export class RatingController {
  private state: RatingState = emptyRatingState();
  private ready: Promise<void> | null = null;
  private asking = false;
  private backgroundAt: number | null = null;

  constructor(private readonly deps: RatingDeps) {}

  /** Loads state and starts the launch session. Idempotent. */
  start(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        let raw: string | null = null;
        try {
          raw = await this.deps.kv.getItem(RATING_KEY);
        } catch {
          raw = null;
        }
        // Events recorded before the load finished belong to this launch session.
        const early = this.state.open;
        let s = startSession(parseRatingState(raw), this.deps.now());
        if (early?.success) s = recordSuccess(s);
        if (early?.error) s = recordError(s);
        this.state = s;
        await this.save();
      })();
    }
    return this.ready;
  }

  getState(): RatingState {
    return this.state;
  }

  onSuccess(): void {
    const next = recordSuccess(this.state);
    if (next === this.state) return;
    this.state = next;
    void this.afterLoad(() => this.save());
  }

  onError(): void {
    const next = recordError(this.state);
    if (next === this.state) return;
    this.state = next;
    void this.afterLoad(() => this.save());
  }

  onBackground(): void {
    this.backgroundAt = this.deps.now();
  }

  /**
   * App came back to the foreground. A long absence starts a new session. Resolves true when a new
   * session was started (then there is nothing to ask yet).
   */
  async resume(): Promise<boolean> {
    await this.start();
    const away = this.backgroundAt;
    this.backgroundAt = null;
    if (away === null || this.deps.now() - away < SESSION_GAP_MS) return false;
    this.state = startSession(this.state, this.deps.now());
    await this.save();
    return true;
  }

  /** resume() then, unless a new session began, the calm moment to (maybe) ask. */
  async onForeground(screen: RatingScreen): Promise<AskVerdict | 'unavailable' | 'new_session'> {
    if (await this.resume()) return 'new_session';
    return this.maybeAsk(screen);
  }

  /** Asks if every rule holds. Records the ask before requesting the sheet. Never throws. */
  async maybeAsk(screen: RatingScreen): Promise<AskVerdict | 'unavailable'> {
    await this.start();
    if (this.asking) return 'asked_this_version';
    const now = this.deps.now();
    const verdict = ratingVerdict(this.state, { now, appVersion: this.deps.appVersion, screen });
    if (verdict !== 'ask') return verdict;
    this.asking = true;
    try {
      const before = this.state;
      // Persist the ask first, so a crash or kill while the sheet is up can never lead to a re-ask.
      this.state = markAsked(this.state, this.deps.appVersion, now);
      await this.save();
      let shown: boolean;
      try {
        shown = await this.deps.requestReview();
      } catch {
        shown = true; // unknown outcome: stay on the polite side and treat it as asked
      }
      if (!shown) {
        // Unavailable (no store / Expo Go): nothing was shown, so do not use up this version's ask.
        this.state = { ...this.state, askedVersions: before.askedVersions, lastAskedAt: before.lastAskedAt };
        await this.save();
        return 'unavailable';
      }
      return 'ask';
    } finally {
      this.asking = false;
    }
  }

  private async afterLoad(fn: () => Promise<void>): Promise<void> {
    if (!this.ready) return; // not started: kept in memory, folded in by start()
    await this.ready;
    await fn();
  }

  private async save(): Promise<void> {
    try {
      await this.deps.kv.setItem(RATING_KEY, serializeRatingState(this.state));
    } catch {
      // best-effort
    }
  }
}
