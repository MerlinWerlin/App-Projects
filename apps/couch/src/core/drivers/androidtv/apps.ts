import type { TvApp } from '../../types';

/**
 * Apps for Google TV / Android TV (owner 1 Nov 2026, TCL C7K: "the apps tab isn't working" — the
 * remote protocol can open an app by link but cannot list what is installed). This is a fixed list
 * of common apps; the id is the app link sent with remote_app_link_launch_request. A link for an
 * app that isn't installed does nothing (or opens its store page). Names only, never logos.
 * Links follow the forms the Android TV Remote v2 protocol is known to accept (https / scheme /
 * market://launch?id=<package>); which each TV resolves is UNVERIFIED per model.
 */
export const ANDROIDTV_APPS: readonly TvApp[] = [
  { id: 'netflix://', name: 'Netflix', pinned: true },
  { id: 'https://www.youtube.com', name: 'YouTube', pinned: true },
  { id: 'https://app.primevideo.com', name: 'Prime Video', pinned: true },
  { id: 'https://www.disneyplus.com', name: 'Disney+', pinned: true },
  { id: 'market://launch?id=au.com.stan.and', name: 'Stan', pinned: true },
  { id: 'market://launch?id=com.google.android.youtube.tvmusic', name: 'YouTube Music' },
  { id: 'spotify://', name: 'Spotify' },
  { id: 'plexapp://', name: 'Plex' },
  { id: 'https://tv.apple.com', name: 'Apple TV' },
  { id: 'https://play.max.com', name: 'Max' },
  { id: 'market://launch?id=au.net.abc.iview', name: 'ABC iview' },
  { id: 'market://launch?id=com.sbs.ondemand.tv', name: 'SBS On Demand' },
  { id: 'market://launch?id=au.com.seven.inferno', name: '7plus' },
];

export function androidTvApps(): TvApp[] {
  return ANDROIDTV_APPS.map((a) => ({ ...a }));
}
