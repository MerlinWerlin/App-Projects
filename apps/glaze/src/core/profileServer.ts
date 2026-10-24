// Profile delivery through Safari (T126). Pure TS (no React Native / Expo): constants shared with
// modules/glaze-profile-server (Swift) and the checks the adapter (src/native/profileServer.ts)
// applies to whatever the native module returns.
//
// Why Safari: iOS registers a configuration profile as "Profile Downloaded" when Safari (or Mail,
// or AirDrop) hands it over. A .mobileconfig saved to Files from the share sheet is just a file:
// opening it there does not reliably register it, which is what the owner saw (T126). In-app
// browsers (SFSafariViewController) are not a documented install route either, so the app opens
// the real Safari with Linking.openURL. See docs/OWNER_1024E.md (part B) for sources.

import { PROFILE_MIME } from './install.ts';

export { PROFILE_MIME };

/** Path the native server serves the profile on (keep in sync with the Swift module). */
export const PROFILE_SERVER_PATH = '/glaze.mobileconfig';
/** Seconds the server stays up after start (iOS may end background time sooner). */
export const PROFILE_SERVER_TIMEOUT_S = 90;
/** Name of the native module (modules/glaze-profile-server, expo-module.config.json). */
export const PROFILE_SERVER_MODULE = 'GlazeProfileServer';

/** How the profile reaches iOS: served to Safari (native build) or the share sheet (fallback). */
export type ProfileRoute = 'safari' | 'share';

export function profileRoute(serverAvailable: boolean): ProfileRoute {
  return serverAvailable ? 'safari' : 'share';
}

export type ServerStart = { url: string; profileUrl: string; port: number };

/** True for http://127.0.0.1:<port>/... or http://localhost:<port>/... only. */
export function isLoopbackHttpUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 200) return false;
  const m = /^http:\/\/(127\.0\.0\.1|localhost):(\d{1,5})(\/[^\s]*)?$/.exec(url);
  if (!m) return false;
  const port = Number(m[2]);
  return port >= 1024 && port <= 65535;
}

/** Validate what the native start() resolved with; null when it is not a loopback URL set. */
export function parseServerStart(raw: unknown): ServerStart | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const port = typeof r.port === 'number' ? r.port : Number.NaN;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return null;
  if (!isLoopbackHttpUrl(r.url)) return null;
  const profileUrl = isLoopbackHttpUrl(r.profileUrl) ? r.profileUrl : `${r.url.replace(/\/+$/, '')}${PROFILE_SERVER_PATH}`;
  if (!profileUrl.endsWith(PROFILE_SERVER_PATH)) return null;
  return { url: r.url, profileUrl, port };
}

/** Texts for the landing page Safari shows (the Swift side escapes them). */
export type LandingPageText = { lang: string; dir: 'ltr' | 'rtl'; title: string; body: string; button: string };

export function landingPageJson(text: LandingPageText): string {
  const clip = (s: string, n: number) => (typeof s === 'string' ? s.slice(0, n) : '');
  return JSON.stringify({
    lang: clip(text.lang, 20) || 'en',
    dir: text.dir === 'rtl' ? 'rtl' : 'ltr',
    title: clip(text.title, 120),
    body: clip(text.body, 600),
    button: clip(text.button, 60),
  });
}
