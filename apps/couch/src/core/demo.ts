import { withCopy } from '../i18n/lazyCopy';
import { MockTv } from './drivers/mock';
import { STORE_SERVICES } from './storeIcons';
import type { Tv, TvApp } from './types';

/**
 * Demo TVs, same names and models as the prototype (in English). Platform is 'mock': nothing reaches a
 * real TV. Name and model translate on read; createDemoSession copies them in the active language.
 */
export const DEMO_TVS: ReadonlyArray<Tv & { baseMs: number; on: boolean }> = [
  withCopy(
    { id: 'demo-1', name: '', model: '', platform: 'mock' as const, host: '192.168.1.21', baseMs: 38, on: true },
    { name: 'core.demo.livingRoom', model: 'core.demo.smartTv' },
  ),
  withCopy(
    { id: 'demo-2', name: '', model: '', platform: 'mock' as const, host: '192.168.1.22', baseMs: 24, on: true },
    { name: 'core.demo.bedroom', model: 'core.demo.streamingStick' },
  ),
  withCopy(
    { id: 'demo-3', name: '', model: '', platform: 'mock' as const, host: '192.168.1.23', baseMs: 30, on: false },
    { name: 'core.demo.study', model: 'core.demo.tv' },
  ),
];

// ---------- demo apps ----------
//
// Owner decision 22 Oct 2026: demo mode shows the real streaming apps (names from the service
// catalogue in storeIcons.ts) so the Apps tab looks like it will on a real TV. Their icons are the
// services' own App Store artwork fetched at runtime (src/core/storeIcons.ts), never bundled or
// redrawn; offline they fall back to the house tile. The older abstract demo art below is kept for
// any saved demo session that still uses the invented ids.

/** Pinned on first run. */
const DEMO_PINNED = new Set(['svc.netflix', 'svc.youtube', 'svc.disneyplus', 'svc.stan']);
const DEMO_SERVICE_IDS = [
  // Australia (the owner's market) first
  'svc.netflix', 'svc.youtube', 'svc.disneyplus', 'svc.primevideo', 'svc.stan', 'svc.binge', 'svc.kayo',
  'svc.iview', 'svc.sbs', 'svc.7plus', 'svc.9now', 'svc.10play', 'svc.paramountplus', 'svc.appletv',
  'svc.spotify', 'svc.foxtelgo',
  // Popular in the USA and Europe (owner-1022)
  'svc.max', 'svc.hulu', 'svc.peacock', 'svc.youtubetv', 'svc.espn', 'svc.crunchyroll', 'svc.ted', 'svc.tubi',
  'svc.plutotv', 'svc.bbciplayer', 'svc.itvx', 'svc.channel4', 'svc.nowtv', 'svc.canalplus', 'svc.ardmediathek',
  'svc.zdf', 'svc.rtlplus', 'svc.raiplay', 'svc.viaplay', 'svc.dazn', 'svc.twitch', 'svc.plex',
];

/** Demo apps: the real services (names are product names, not translated). */
export const DEMO_TV_APPS: readonly TvApp[] = DEMO_SERVICE_IDS.map((id) => {
  const svc = STORE_SERVICES.find((x) => x.id === id)!;
  return DEMO_PINNED.has(id) ? { id, name: svc.name, pinned: true } : { id, name: svc.name };
});

/**
 * Invented apps with original abstract art, used only by the store-screenshot prototype
 * (prototype/index.html) until the owner approves real logos in screenshots (docs/MARKET.md).
 */
export const SCREENSHOT_DEMO_APPS: readonly TvApp[] = [
  withCopy({ id: 'demo.cinema', name: '', pinned: true }, { name: 'ui.apps.demo.cinema' }),
  withCopy({ id: 'demo.sports', name: '', pinned: true }, { name: 'ui.apps.demo.sports' }),
  withCopy({ id: 'demo.music', name: '', pinned: true }, { name: 'ui.apps.demo.music' }),
  withCopy({ id: 'demo.news', name: '' }, { name: 'ui.apps.demo.news' }),
  withCopy({ id: 'demo.kids', name: '' }, { name: 'ui.apps.demo.kids' }),
  withCopy({ id: 'demo.photos', name: '' }, { name: 'ui.apps.demo.photos' }),
];

/** Shapes for demo tile art, in a 120 x 90 (4:3) box. Colours are plain hex. */
export type DemoArtShape =
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { kind: 'ring'; cx: number; cy: number; r: number; stroke: string; width: number; opacity?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number; fill: string; opacity?: number; rotate?: number }
  | { kind: 'poly'; points: readonly (readonly [number, number])[]; fill: string; opacity?: number };

export interface DemoArt {
  /** Background gradient, top-left to bottom-right. */
  from: string;
  to: string;
  shapes: readonly DemoArtShape[];
}

export const DEMO_ART_W = 120;
export const DEMO_ART_H = 90;

const W = '#FFFFFF';

/** Original abstract art per demo app id. Not modelled on any real service's mark. */
export const DEMO_APP_ART: Readonly<Record<string, DemoArt>> = {
  // Soft light beams fanning from the lower left over dusk indigo.
  'demo.cinema': {
    from: '#3B2F7A',
    to: '#14123A',
    shapes: [
      { kind: 'poly', points: [[0, 90], [120, 10], [120, 40]], fill: W, opacity: 0.16 },
      { kind: 'poly', points: [[0, 90], [120, 48], [120, 70]], fill: W, opacity: 0.1 },
      { kind: 'circle', cx: 92, cy: 22, r: 6, fill: '#FFD59A', opacity: 0.9 },
      { kind: 'circle', cx: 104, cy: 34, r: 3, fill: '#FFD59A', opacity: 0.6 },
    ],
  },
  // Offset rings and a lane stripe on fresh green.
  'demo.sports': {
    from: '#2FA36B',
    to: '#145C46',
    shapes: [
      { kind: 'ring', cx: 30, cy: 70, r: 34, stroke: W, width: 3, opacity: 0.28 },
      { kind: 'ring', cx: 30, cy: 70, r: 18, stroke: W, width: 3, opacity: 0.4 },
      { kind: 'rect', x: 62, y: -10, w: 10, h: 120, r: 2, fill: W, opacity: 0.18, rotate: 24 },
      { kind: 'circle', cx: 96, cy: 26, r: 9, fill: '#F6F1C8', opacity: 0.95 },
    ],
  },
  // Rounded bars of different heights over coral to plum.
  'demo.music': {
    from: '#F2786A',
    to: '#7A2E73',
    shapes: [
      { kind: 'rect', x: 22, y: 44, w: 9, h: 30, r: 4.5, fill: W, opacity: 0.85 },
      { kind: 'rect', x: 37, y: 28, w: 9, h: 46, r: 4.5, fill: W, opacity: 0.7 },
      { kind: 'rect', x: 52, y: 50, w: 9, h: 24, r: 4.5, fill: W, opacity: 0.85 },
      { kind: 'rect', x: 67, y: 20, w: 9, h: 54, r: 4.5, fill: W, opacity: 0.6 },
      { kind: 'rect', x: 82, y: 38, w: 9, h: 36, r: 4.5, fill: W, opacity: 0.75 },
      { kind: 'ring', cx: 104, cy: 14, r: 22, stroke: W, width: 2, opacity: 0.2 },
    ],
  },
  // Stacked text-like lines and a column block on slate blue.
  'demo.news': {
    from: '#4E6E9E',
    to: '#1E2D4E',
    shapes: [
      { kind: 'rect', x: 16, y: 20, w: 40, h: 34, r: 4, fill: W, opacity: 0.22 },
      { kind: 'rect', x: 64, y: 22, w: 40, h: 5, r: 2.5, fill: W, opacity: 0.8 },
      { kind: 'rect', x: 64, y: 33, w: 32, h: 5, r: 2.5, fill: W, opacity: 0.5 },
      { kind: 'rect', x: 64, y: 44, w: 36, h: 5, r: 2.5, fill: W, opacity: 0.5 },
      { kind: 'rect', x: 16, y: 62, w: 88, h: 5, r: 2.5, fill: W, opacity: 0.35 },
      { kind: 'rect', x: 16, y: 72, w: 60, h: 5, r: 2.5, fill: W, opacity: 0.25 },
    ],
  },
  // Playful bubbles in different sizes on sunny yellow to orange.
  'demo.kids': {
    from: '#FFD25E',
    to: '#F2884B',
    shapes: [
      { kind: 'circle', cx: 30, cy: 34, r: 16, fill: '#FFFFFF', opacity: 0.55 },
      { kind: 'circle', cx: 62, cy: 58, r: 22, fill: '#5BC8D8', opacity: 0.75 },
      { kind: 'circle', cx: 96, cy: 30, r: 12, fill: '#8C6FE0', opacity: 0.7 },
      { kind: 'circle', cx: 100, cy: 72, r: 7, fill: '#FFFFFF', opacity: 0.6 },
      { kind: 'circle', cx: 22, cy: 74, r: 5, fill: '#FFFFFF', opacity: 0.6 },
    ],
  },
  // Overlapping prints and a low sun on sky blue to teal.
  'demo.photos': {
    from: '#8CC9F0',
    to: '#2F8C9A',
    shapes: [
      { kind: 'circle', cx: 90, cy: 24, r: 10, fill: '#FFF2C4', opacity: 0.95 },
      { kind: 'rect', x: 24, y: 26, w: 46, h: 40, r: 5, fill: W, opacity: 0.35, rotate: -8 },
      { kind: 'rect', x: 40, y: 32, w: 46, h: 40, r: 5, fill: W, opacity: 0.6, rotate: 6 },
      { kind: 'poly', points: [[44, 66], [58, 50], [70, 60], [78, 52], [86, 66]], fill: '#2F8C9A', opacity: 0.55 },
    ],
  },
};

/** Demo art for an app id, or null for anything that is not a demo app. */
export function demoArtFor(appId: string): DemoArt | null {
  return Object.prototype.hasOwnProperty.call(DEMO_APP_ART, appId) ? DEMO_APP_ART[appId]! : null;
}

export interface DemoSession {
  tvs: Tv[];
  drivers: Map<string, MockTv>;
}

/** Build the demo session: one MockTv per demo TV, already connected. */
export async function createDemoSession(opts: { sleep?: (ms: number) => Promise<void>; random?: () => number } = {}): Promise<DemoSession> {
  const drivers = new Map<string, MockTv>();
  for (const t of DEMO_TVS) {
    const d = new MockTv({
      baseMs: t.baseMs,
      on: t.on,
      sleep: opts.sleep,
      random: opts.random,
      // Spread now so names are copied in the active language (withCopy getters).
      apps: DEMO_TV_APPS.map((a) => ({ ...a })),
    });
    await d.connect();
    drivers.set(t.id, d);
  }
  return { tvs: DEMO_TVS.map(({ baseMs: _b, on: _o, ...tv }) => ({ ...tv })), drivers };
}

/** Demo mode is chosen automatically when no saved TV exists, or explicitly by the user. */
export function shouldUseDemo(savedTvCount: number, userChoice: boolean | null): boolean {
  if (userChoice !== null) return userChoice;
  return savedTvCount === 0;
}
