// T237 (owner-1101g #2, TestFlight build 18: "widgets that LOOK functional must WORK"): theme widget
// art whose subject is a clock, a date, a battery level, a countdown or a focus timer gets the REAL
// value drawn over it by the Glaze "Seamless" widget (targets/widget/LiveArtOverlay.swift), and the
// focus piece is interactive (Start / Pause, iOS 17 Button(intent:)). Everything else is labelled
// "Art" in the menu so nothing pretends to work. docs/WIDGETS.md "Live values over art".
//
// How a piece becomes live:
//  1. A known production piece (KNOWN_LIVE_PIECES: its value is painted in, e.g. '25:00 FOCUS',
//     '29 THU OCT', '78%', fixed clock hands) gets a COVER: a plate in the piece's own palette laid
//     exactly over the painted value, with the live value on it. No doubled numbers.
//  2. A piece a pack marks `numberFree` (nothing painted in) of a live kind gets a small badge in
//     its lower part (DEFAULT_BADGE_RECT), so the value never sits on the subject.
//  3. Anything else (a value painted somewhere we don't know, habits, photo, quote, plain art) stays
//     Art. A countdown needs a real target day (YYYY-MM-DD); without one it stays Art too.
//     T245: the person picks that day per piece on the Widgets tab (ThemeWidgetArt), stored by
//     src/store/countdownArtTargets.ts and passed as `targets`.
// The widget reads the result from the piece's record in widget-art/index.json (`live`, see
// widgetArtLibrary.ts); rects there are 0..1 of the COMPOSED image (art fitted with placeArt).
//
// Pure TS (Node runs it directly), tested in liveArt.test.ts.

import { fullBleedArt } from './widgetPreview.ts';
import { placeArt, type Box, type WidgetOption, type WidgetOptionFit, type WidgetOptionKind } from './widgetOptions.ts';

/** What the widget can draw live over art. */
export type LiveArtKind = 'clock' | 'date' | 'countdown' | 'battery' | 'focus';
export const LIVE_ART_KINDS: readonly LiveArtKind[] = Object.freeze(['clock', 'date', 'countdown', 'battery', 'focus'] as LiveArtKind[]);

/** Length of a focus session the widget's Start button runs (keep in sync with FocusIntents.swift). */
export const FOCUS_MINUTES = 25;

/** 0..1 rectangle (of the art, or of the composed image in a LiveArtSpec). */
export type NRect = { x: number; y: number; w: number; h: number };
/** `circle`: a round plate (dials, rings); `plate`: a rounded rectangle (dates, numbers). */
export type LiveArtShape = 'circle' | 'plate';

/** A known piece: its live kind and where its painted value sits in the art (0..1 of the art). */
export type KnownLivePiece = { kind: LiveArtKind; rect: NRect; shape: LiveArtShape };

/**
 * Production pieces whose value is painted in (docs/widget_snapshots, packs as of run 208), keyed
 * `<themeId>/<optionId>`. Rects measured from the 1024 px art: the plate covers the painted value
 * (and for the clock the painted hands) and sits inside any ring / dial edge so the art stays whole.
 * Habits pieces ('3/5') are not here: the widget has no habit data to draw, so they stay Art.
 */
export const KNOWN_LIVE_PIECES: Readonly<Record<string, KnownLivePiece>> = Object.freeze({
  // Fixed hands on a starry dial: a round plate inside the tick ring, live time on it.
  'alpine-starlight/constellation-clock': { kind: 'clock', rect: { x: 0.175, y: 0.14, w: 0.66, h: 0.66 }, shape: 'circle' },
  // '25:00 FOCUS' inside a paper ring (the pack lists it as plain art).
  'indigo-current/harbour-focus': { kind: 'focus', rect: { x: 0.24, y: 0.19, w: 0.5, h: 0.5 }, shape: 'circle' },
  // '29 THU OCT' and friends.
  'cloud-atelier/cloud-date': { kind: 'date', rect: { x: 0.14, y: 0.12, w: 0.72, h: 0.58 }, shape: 'plate' },
  'meadowglow/meadow-date': { kind: 'date', rect: { x: 0.24, y: 0.13, w: 0.54, h: 0.52 }, shape: 'plate' },
  'rainlight/rainlight-date': { kind: 'date', rect: { x: 0.22, y: 0.15, w: 0.56, h: 0.53 }, shape: 'plate' },
  // '78% BATTERY' inside a glass ring.
  'opal-abyss/abyss-battery': { kind: 'battery', rect: { x: 0.305, y: 0.25, w: 0.44, h: 0.44 }, shape: 'circle' },
  // '14 DAYS': live only with a real target day (liveArtPlan countdownTo).
  'desert-afterglow/dune-countdown': { kind: 'countdown', rect: { x: 0.24, y: 0.16, w: 0.54, h: 0.52 }, shape: 'plate' },
  'rosewater-reverie/rehearsal-countdown': { kind: 'countdown', rect: { x: 0.5, y: 0.14, w: 0.44, h: 0.5 }, shape: 'plate' },
});

/** Where a number-free piece's live value goes (0..1 of the art): a badge in the lower part. */
export const DEFAULT_BADGE_RECT: NRect = Object.freeze({ x: 0.2, y: 0.72, w: 0.6, h: 0.2 });

/** The live kind a pack option kind maps to (calendar pieces show today's date), or null. */
export function liveArtKindOf(kind: WidgetOptionKind): LiveArtKind | null {
  switch (kind) {
    case 'clock':
      return 'clock';
    case 'date':
    case 'calendar':
      return 'date';
    case 'countdown':
      return 'countdown';
    case 'battery':
      return 'battery';
    case 'focus':
      return 'focus';
    default:
      return null;
  }
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A valid calendar day `YYYY-MM-DD`, or null. */
export function validTargetDay(day: unknown): string | null {
  if (typeof day !== 'string') return null;
  const m = DAY.exec(day);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return null;
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= days ? day : null;
}

export type LiveArtPlan = {
  kind: LiveArtKind;
  /** 0..1 of the art. */
  rect: NRect;
  shape: LiveArtShape;
  /** true: the plate hides a value painted into the art; false: a badge on a number-free piece. */
  cover: boolean;
  /** Countdown target day (YYYY-MM-DD). */
  target?: string;
};

/**
 * T245: target days the person chose for countdown art pieces, keyed `<themeId>/<optionId>`
 * (the KNOWN_LIVE_PIECES key). Stored by the app (src/store/countdownArtTargets.ts); the day
 * travels to the widget inside the piece's `live` spec (`target`), which LiveArtOverlay.swift
 * already counts down to. No day = the piece stays Art (never a made-up number).
 */
export type CountdownArtTargets = Readonly<Record<string, string>>;

/** Options for liveArtPlan / withLiveArt. */
export type LiveArtOpts = {
  /** One target day for every countdown piece (null = none). */
  countdownTo?: string | null;
  /** T245: per-piece target days (win over `countdownTo`). */
  targets?: CountdownArtTargets;
};

/** The key a countdown art piece's target day is stored under. */
export function countdownArtKey(themeId: string, optionId: string): string {
  return `${themeId}/${optionId}`;
}

/** The chosen target day of a piece, or null. */
export function countdownArtTarget(targets: CountdownArtTargets, themeId: string, optionId: string): string | null {
  return validTargetDay(targets[countdownArtKey(themeId, optionId)]);
}

/**
 * T245: true when this piece counts down once it has a target day (a known countdown piece such as
 * dune-countdown / rehearsal-countdown, or a number-free piece of the countdown kind), so the UI
 * offers the day field for it.
 */
export function isCountdownArtPiece(themeId: string, option: Pick<WidgetOption, 'id' | 'kind' | 'numberFree'>): boolean {
  const known = KNOWN_LIVE_PIECES[countdownArtKey(themeId, option.id)];
  if (known) return known.kind === 'countdown';
  return option.numberFree === true && liveArtKindOf(option.kind) === 'countdown';
}

/** Max stored targets (a person sets a few; this only bounds a corrupt store). */
export const COUNTDOWN_ART_TARGETS_MAX = 200;

/** Tolerant read of stored targets: keeps only `key: valid day` pairs. */
export function parseCountdownArtTargets(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= COUNTDOWN_ART_TARGETS_MAX) break;
    if (typeof k !== 'string' || k.length === 0 || k.length > 240 || !k.includes('/')) continue;
    const day = validTargetDay(v);
    if (!day) continue;
    out[k] = day;
    n++;
  }
  return out;
}

/** A copy of `targets` with this piece's day set (a valid day) or cleared (null / invalid). */
export function withCountdownArtTarget(targets: CountdownArtTargets, themeId: string, optionId: string, day: string | null): Record<string, string> {
  const next: Record<string, string> = { ...targets };
  const key = countdownArtKey(themeId, optionId);
  const valid = validTargetDay(day);
  if (valid) next[key] = valid;
  else delete next[key];
  return next;
}

/**
 * Whole days from `now`'s local day to `target` (the number the widget's plate shows; matches
 * LiveArtOverlay.swift: never below 0, so the day itself and after show 0). Null without a valid
 * day: the caller shows the "pick a day" state, never a number. `utcOffsetMinutes` for tests.
 */
export function countdownArtDays(target: string | null | undefined, now: Date, utcOffsetMinutes?: number): number | null {
  const day = validTargetDay(target);
  if (!day) return null;
  const off = utcOffsetMinutes ?? -now.getTimezoneOffset();
  const local = new Date(now.getTime() + off * 60000);
  const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const [y, m, d] = day.split('-').map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
  return days < 0 ? 0 : days;
}

/**
 * How the widget makes this piece live, or null (it is Art). `themeId` is the pack / theme id.
 * `countdownTo`: the user's target day for countdown pieces (null = none, so they stay Art).
 */
export function liveArtPlan(
  themeId: string,
  option: Pick<WidgetOption, 'id' | 'kind' | 'numberFree'>,
  opts: LiveArtOpts = {},
): LiveArtPlan | null {
  const known = KNOWN_LIVE_PIECES[`${themeId}/${option.id}`];
  let plan: LiveArtPlan | null = null;
  if (known) {
    plan = { kind: known.kind, rect: { ...known.rect }, shape: known.shape, cover: true };
  } else if (option.numberFree === true) {
    const kind = liveArtKindOf(option.kind);
    if (kind) plan = { kind, rect: { ...DEFAULT_BADGE_RECT }, shape: 'plate', cover: false };
  }
  if (!plan) return null;
  if (plan.kind === 'countdown') {
    const target = validTargetDay(opts.targets ? countdownArtTarget(opts.targets, themeId, option.id) ?? opts.countdownTo : opts.countdownTo);
    if (!target) return null;
    plan.target = target;
  }
  return plan;
}

/**
 * The menu view of a theme's options: a piece the widget makes live (liveArtPlan) is marked
 * `liveArt` and listed under its live kind (harbour-focus becomes a `focus` piece); every other
 * option is returned unchanged (and is shown as Art when it has values painted in: fixedValues).
 */
export function withLiveArt<T extends Pick<WidgetOption, 'id' | 'kind' | 'numberFree'>>(themeId: string, options: readonly T[], opts: LiveArtOpts = {}): T[] {
  return options.map((o) => {
    const plan = liveArtPlan(themeId, o, opts);
    if (!plan) return o;
    const kind: WidgetOptionKind = o.kind === 'calendar' && plan.kind === 'date' ? 'calendar' : plan.kind;
    return { ...o, kind, liveArt: true };
  });
}

/** Hex colour `#RRGGBB` or null. */
function hex(v: unknown): string | null {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null;
}

const r4 = (n: number): number => Math.round(n * 10000) / 10000;
const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Stored with the piece (widget-art/index.json `live`); read by LiveArtOverlay.swift. */
export type LiveArtSpec = {
  kind: LiveArtKind;
  /** [x, y, w, h], 0..1 of the composed image the widget shows (Fill layout). */
  rect: [number, number, number, number];
  /**
   * T246: the same plate as [x, y, w, h], 0..1 of the ART itself (the plan rect), so the Fit layout,
   * which shows the raw art (<id>-art.png, same framing as the art) inset, can place it too
   * (src/core/liveArtFit.ts). Optional: older records lack it. Unknown to LiveArtOverlay.swift today.
   */
  art?: [number, number, number, number];
  shape: LiveArtShape;
  cover: boolean;
  /** Plate and text colours (#RRGGBB) from the piece's theme. */
  plate: string;
  ink: string;
  /** Countdown target day. */
  target?: string;
  /** Focus session length in minutes. */
  minutes?: number;
};

/**
 * The spec for a plan once the art is composed into an image of `composed` px with `fit`
 * (the same placeArt geometry as the bridge's compositor and seamlessWidget.heroRect).
 */
export function liveArtSpec(plan: LiveArtPlan, art: Box, composed: Box, fit: WidgetOptionFit | 'bleed', palette: { bg: string; ink: string }): LiveArtSpec | null {
  if (!(composed.w > 0 && composed.h > 0)) return null;
  // T236: the bridge composes "theme" / "blur" art full bleed (no inset): 'bleed'. The wallpaper
  // path still fits the hero with its inset (placeArt).
  const place = fit === 'bleed' ? fullBleedArt(art, composed).rect : placeArt(art, composed, fit).rect;
  const x = clamp01((place.x + plan.rect.x * place.w) / composed.w);
  const y = clamp01((place.y + plan.rect.y * place.h) / composed.h);
  const w = clamp01((plan.rect.w * place.w) / composed.w);
  const h = clamp01((plan.rect.h * place.h) / composed.h);
  const spec: LiveArtSpec = {
    kind: plan.kind,
    rect: [r4(x), r4(y), r4(Math.min(w, 1 - x)), r4(Math.min(h, 1 - y))],
    shape: plan.shape,
    cover: plan.cover,
    plate: hex(palette.bg) ?? '#000000',
    ink: hex(palette.ink) ?? '#FFFFFF',
  };
  const ax = clamp01(plan.rect.x);
  const ay = clamp01(plan.rect.y);
  const aw = Math.min(clamp01(plan.rect.w), 1 - ax);
  const ah = Math.min(clamp01(plan.rect.h), 1 - ay);
  if (aw > 0 && ah > 0) spec.art = [r4(ax), r4(ay), r4(aw), r4(ah)];
  if (plan.target) spec.target = plan.target;
  if (plan.kind === 'focus') spec.minutes = FOCUS_MINUTES;
  return spec;
}

/** [x, y, w, h] inside 0..1 with a positive size, or null. */
function unitRect(raw: unknown): [number, number, number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) return null;
  const [x, y, w, h] = raw as number[];
  if (w <= 0 || h <= 0 || x + w > 1.0001 || y + h > 1.0001) return null;
  return [x, y, w, h];
}

/** Tolerant read of a stored spec (index.json is written by older and newer app versions). */
export function parseLiveArtSpec(raw: unknown): LiveArtSpec | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.kind !== 'string' || !(LIVE_ART_KINDS as readonly string[]).includes(r.kind)) return null;
  const kind = r.kind as LiveArtKind;
  const rect = unitRect(r.rect);
  if (!rect) return null;
  const spec: LiveArtSpec = {
    kind,
    rect,
    shape: r.shape === 'circle' ? 'circle' : 'plate',
    cover: r.cover === true,
    plate: hex(r.plate) ?? '#000000',
    ink: hex(r.ink) ?? '#FFFFFF',
  };
  // T246: a broken art rect is dropped on its own (the Fill rect still works).
  const art = unitRect(r.art);
  if (art) spec.art = art;
  if (kind === 'countdown') {
    const t = validTargetDay(r.target);
    if (!t) return null;
    spec.target = t;
  }
  if (kind === 'focus') spec.minutes = FOCUS_MINUTES;
  return spec;
}
