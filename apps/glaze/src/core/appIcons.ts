// One resolver tying app ids, theme ids, theme artwork and the user's overrides together:
// which icon does app A show in theme T? (owner review §6: "app identifiers, theme identifiers,
// icon assets and user overrides" in one place.)
//
// Precedence (same as the Icon Studio v2 model in ./studio.ts):
//   the theme's own override > the "all themes" override > the theme's artwork.
// Apps with nothing good to draw (a user-added app without an image, or a glyph that only
// resolves to the generic fallback) come back as 'needs-icon' so the UI can point to the
// "Missing an app?" workflow. Glaze never ships brand logos: theme artwork is glyph + frame + stickers.
// Pure TS (no React Native / Expo).

import { getById, support, type SupportStatus } from './catalogue.ts';
import { resolveGlyph } from './glyphnames.ts';
import type { IconOverride } from './iconspec.ts';
import { ALL_THEMES_KEY, NO_THEME_KEY, type CustomApp } from './studio.ts';

export type IconSource =
  | {
      kind: 'override';
      /** 'theme' = this theme's own override; 'all-themes' = the "use in all themes" one. */
      scope: 'theme' | 'all-themes';
      override: IconOverride;
      /** The user's image, or null when the override only changes glyph / colours / label. */
      image: string | null;
      support: SupportStatus;
    }
  | { kind: 'theme-art'; glyph: string; support: SupportStatus }
  | {
      kind: 'needs-icon';
      reason: 'custom-app' | 'generic-glyph' | 'unknown-app';
      /** The glyph that would be drawn meanwhile (null for an unknown app). */
      glyph: string | null;
      support: SupportStatus;
    };

/** The parts of the studio state the resolver reads. */
export type IconLookupState = {
  themeOverrides: Record<string, Record<string, IconOverride>>;
  customApps: readonly CustomApp[];
};

/**
 * Resolve the icon an app shows in a theme. `themeId` null means "no theme applied"
 * (the user's own Icon Studio style, stored under NO_THEME_KEY).
 */
export function iconFor(appId: string, themeId: string | null, state: IconLookupState): IconSource {
  const key = typeof themeId === 'string' && themeId.trim() ? themeId.trim() : NO_THEME_KEY;
  const own = key === ALL_THEMES_KEY ? undefined : state.themeOverrides[key]?.[appId];
  const all = state.themeOverrides[ALL_THEMES_KEY]?.[appId];
  const override = own ?? all;
  const scope: 'theme' | 'all-themes' = own ? 'theme' : 'all-themes';

  const custom = state.customApps.find((c) => c.id === appId);
  const entry = custom ? undefined : getById(appId);
  const status: SupportStatus = custom ? support({ urlScheme: custom.urlScheme }) : entry ? support(entry) : 'shortcuts';

  if (override?.overrideImage) {
    return { kind: 'override', scope, override, image: override.overrideImage, support: status };
  }
  if (custom) {
    // A user-added app has no theme artwork of its own: it needs the user's image.
    return { kind: 'needs-icon', reason: 'custom-app', glyph: override?.glyph ?? custom.glyph, support: status };
  }
  if (!entry) return { kind: 'needs-icon', reason: 'unknown-app', glyph: null, support: status };
  if (override) return { kind: 'override', scope, override, image: null, support: status };
  const glyph = resolveGlyph(entry.glyph);
  if (glyph.fallback) return { kind: 'needs-icon', reason: 'generic-glyph', glyph: glyph.name, support: status };
  return { kind: 'theme-art', glyph: glyph.name, support: status };
}

/** App ids (in the given order) that still need the user's own icon in `themeId`. */
export function appsNeedingIcons(appIds: readonly string[], themeId: string | null, state: IconLookupState): string[] {
  return appIds.filter((id) => iconFor(id, themeId, state).kind === 'needs-icon');
}
