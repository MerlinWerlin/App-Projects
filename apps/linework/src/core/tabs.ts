// Bottom tab bar definition (T81, PLAN §3, MARKET "Design reference 18 Oct" §2). Pure data so node tests can check
// order, route files and catalogue keys; src/ui/v2/TabBarV2.tsx draws it and app/(tabs)/_layout.tsx registers it.
// Prepare / Trace / Lightbox / Plus are NOT tabs: they stay full-screen stack routes over the tab group.

export type TabSpec = {
  /** Route name inside app/(tabs)/ (file name without .tsx). URL is unchanged: groups don't add a path segment. */
  route: 'index' | 'templates' | 'workshop' | 'drawings' | 'settings';
  /** Feather icon name. */
  icon: 'edit-3' | 'grid' | 'tool' | 'image' | 'settings';
  /** Catalogue key for the visible label (also the spoken name). */
  label: 'common.nav.trace' | 'common.nav.templates' | 'common.nav.workshop' | 'common.nav.drawings' | 'common.nav.settings';
};

/** Tabs in reading order (start → end); a row layout mirrors them automatically for right-to-left languages. */
export const TABS: readonly TabSpec[] = [
  { route: 'index', icon: 'edit-3', label: 'common.nav.trace' },
  { route: 'templates', icon: 'grid', label: 'common.nav.templates' },
  // Owner 24 Oct 2026: Trade & workshop gets its own tab (blueprint style, quick sub-category tiles).
  { route: 'workshop', icon: 'tool', label: 'common.nav.workshop' },
  { route: 'drawings', icon: 'image', label: 'common.nav.drawings' },
  { route: 'settings', icon: 'settings', label: 'common.nav.settings' },
];

/** Full-screen stack routes that cover the tab bar (registered on the root Stack in app/_layout.tsx). */
export const STACK_ROUTES: readonly string[] = ['prepare', 'trace', 'lightbox', 'plus', 'feedback'];

/**
 * Minimum content height of the bar above the bottom safe-area inset (pt): pill + label + padding, so every tab
 * target is well over 44 pt. The bar sits in the layout flow under the tab screens (not absolutely positioned), so
 * the navigator sizes each screen above it and no content is hidden behind it.
 */
export const TAB_BAR_HEIGHT = 56;

/** The spec for a route name, or undefined for routes that are not tabs. */
export function tabFor(route: string): TabSpec | undefined {
  return TABS.find((t) => t.route === route);
}

/**
 * T92: bottom padding for a tab screen's scroll content. The tab bar already pads for the bottom safe area and the
 * navigator sizes the screen above it, so a screen inside the tab group adds only its own breathing room; a
 * full-screen stack route (no bar under it) still clears the home indicator itself.
 */
export function sceneBottomPad(insetBottom: number, inTabs: boolean, extra: number): number {
  return inTabs ? extra : Math.max(0, insetBottom) + extra;
}

/**
 * T92: Keyboard events the custom tab bar listens to so it can get out of the way while the keyboard is open
 * (the navigator's tabBarHideOnKeyboard only applies to its default bar). iOS announces the keyboard before it
 * animates in ("will"); Android only reports after the fact ("did").
 */
export function keyboardEvents(os: string): { show: string; hide: string } {
  return os === 'ios'
    ? { show: 'keyboardWillShow', hide: 'keyboardWillHide' }
    : { show: 'keyboardDidShow', hide: 'keyboardDidHide' };
}
