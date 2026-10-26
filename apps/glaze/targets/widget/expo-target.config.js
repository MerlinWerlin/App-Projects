// WidgetKit extension for Glaze (docs/WIDGETS.md). Generated into the Xcode project by
// @bacons/apple-targets during `GLAZE_NATIVE=1 npx expo prebuild` (the plugin is registered in
// native-plugins/widgets.json, so Expo Go never sees it).
//
// T86: widget copy is localised with one `<lang>.lproj/Localizable.strings` per app language in
// this folder (en, es, fr, de, it, pt-BR, ja, ko, zh-Hans, hi, ar; docs/I18N.md "Widget extension").
// apple-targets adds the target folder's files to the extension, .lproj folders as localised
// resources. VERIFY after prebuild: the Xcode project lists the 11 regions under the GlazeWidgets
// target's Copy Bundle Resources, and the gallery shows a widget name in a non-English language.
//
// Colours mirror src/theme/tokens.ts (light/dark porcelain + plum). They're only the fallback
// look: at runtime every widget reads the active theme JSON from the App Group (ThemeStore.swift).

const APP_GROUP = 'group.com.jared797.glaze';

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'GlazeWidgets',
  // VERIFY: bundle id suffix. apple-targets defaults to `<app bundle id>.<target dir name>`.
  bundleIdentifier: '.widget',
  // 17.0 is also the floor for interactive widgets (Button(intent:), T73). Do not lower it
  // without wrapping the habit widgets in availability checks.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents', 'ActivityKit'],
  entitlements: {
    'com.apple.security.application-groups':
      (config.ios && config.ios.entitlements && config.ios.entitlements['com.apple.security.application-groups']) || [
        APP_GROUP,
      ],
  },
  colors: {
    // Special names: $accent -> AccentColor, $widgetBackground -> WidgetBackground asset.
    $accent: { light: '#7A2E6B', dark: '#E59AD3' },
    $widgetBackground: { light: '#F6F3F5', dark: '#121013' },
    glazeA: '#7A2E6B',
    glazeB: '#E0794F',
  },
});
