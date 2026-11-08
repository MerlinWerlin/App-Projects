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
// Colours mirror the retired v1 tokens (light/dark porcelain + plum; see git history of src/theme/tokens.ts). They're only the fallback
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
  // owner-1102b: EventKit (Next event widget, T280) and CoreLocation (Weather widget, T281).
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents', 'EventKit', 'CoreLocation'],
  // T281: lets the Weather widget read the location the app was allowed (When-In-Use). The app's
  // usage strings live in native-plugins/datawidgets.json. VERIFY after prebuild: the GlazeWidgets
  // Info.plist has NSWidgetWantsLocation = YES (apple-targets merges `infoPlist` into it).
  infoPlist: {
    NSWidgetWantsLocation: true,
    // Same wording as the app (native-plugins/datawidgets.json); the extension never prompts, but
    // some iOS versions want the strings present in an extension that uses EventKit / CoreLocation.
    NSLocationWhenInUseUsageDescription:
      'Glaze uses your approximate location only for the Weather widget. It is rounded to about 1 km and sent only to Open-Meteo to get the forecast.',
    NSCalendarsFullAccessUsageDescription:
      'Glaze reads your calendars only to show your next event in the Next event widget. Your events stay on this iPhone.',
  },
  entitlements: {
    'com.apple.security.application-groups':
      (config.ios && config.ios.entitlements && config.ios.entitlements['com.apple.security.application-groups']) || [
        APP_GROUP,
      ],
  },
  images: { AlpineClockFace: '../../assets/widgets/alpine-clock-face.jpg' },
  colors: {
    // Special names: $accent -> AccentColor, $widgetBackground -> WidgetBackground asset.
    $accent: { light: '#7A2E6B', dark: '#E59AD3' },
    $widgetBackground: { light: '#F6F3F5', dark: '#121013' },
    glazeA: '#7A2E6B',
    glazeB: '#E0794F',
  },
});
