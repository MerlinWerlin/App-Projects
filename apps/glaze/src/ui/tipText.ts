// Catalogue keys for the tips in src/core/tips.ts (core keeps its English copy as the source; the UI
// shows the translated text). Shared by the Tips library and anything else that renders a tip.
import type { TipId, TipPlacement } from '../core/tips';
import type { MessageKey, TFunction } from '../i18n';

const ITEM: Record<TipId, string> = {
  'icons-added': 'iconsAdded',
  'bulk-install': 'bulkInstall',
  'live-lock': 'liveLock',
  'theme-pick': 'themePick',
  'photo-background': 'photoBackground',
  'wallpaper-save': 'wallpaperSave',
  'icon-shapes': 'iconShapes',
  'icon-override': 'iconOverride',
  'missing-app': 'missingApp',
  'install-not-verified': 'installNotVerified',
  'live-loop': 'liveLoop',
};

const PLACE: Record<TipPlacement, string> = {
  'first-run': 'firstRun',
  themes: 'themes',
  wallpaper: 'wallpaper',
  icons: 'icons',
  install: 'install',
  live: 'live',
  shapes: 'shapes',
  override: 'override',
  'add-app': 'addApp',
};

// Narrow key unions (none has placeholders), so t(key) needs no params.
export type TipTitleKey = Extract<MessageKey, `tips.items.${string}.title`>;
export type TipBodyKey = Extract<MessageKey, `tips.items.${string}.body`>;
export type TipPlaceKey = Extract<MessageKey, `tips.places.${string}`>;
export type TipGroupKey = Extract<MessageKey, `tips.groups.${string}`>;

export function tipTitleKey(id: TipId): TipTitleKey {
  return `tips.items.${ITEM[id]}.title` as TipTitleKey;
}

export function tipBodyKey(id: TipId): TipBodyKey {
  return `tips.items.${ITEM[id]}.body` as TipBodyKey;
}

export function tipPlaceKey(placement: TipPlacement): TipPlaceKey {
  return `tips.places.${PLACE[placement]}` as TipPlaceKey;
}

/** Group keys from core tipGroups() (start, themes, wallpaper, icons, install, live). */
export function tipGroupKey(groupKey: string): TipGroupKey {
  return `tips.groups.${groupKey}` as TipGroupKey;
}

/** Translated title and body for a tip. */
export function tipText(t: TFunction, id: TipId): { title: string; body: string } {
  return { title: t(tipTitleKey(id)), body: t(tipBodyKey(id)) };
}
