// WidgetKit extension for Roamlings. Generated into the Xcode project by @bacons/apple-targets
// during prebuild, only for ROAMLINGS_NATIVE=1 builds (app.config.ts registers the plugin; the
// eas-build-post-install script installs it). Shares the App Group with the app
// (modules/roamlings-widget-bridge writes, this extension reads; the Feed/Pet intents write taps).
const APP_GROUP = 'group.com.jared797.roamlings';

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'RoamlingsWidgets',
  bundleIdentifier: '.widget',
  // 17.0: interactive Button(intent:) and containerBackground.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
  entitlements: {
    'com.apple.security.application-groups':
      (config.ios && config.ios.entitlements && config.ios.entitlements['com.apple.security.application-groups']) || [APP_GROUP],
  },
  colors: {
    $accent: { light: '#6C5CE7', dark: '#9C8FFF' },
    $widgetBackground: { light: '#FBF7F0', dark: '#16131C' },
    rlInk: { light: '#2B2233', dark: '#F4F0F8' },
    rlInk2: { light: '#5E5568', dark: '#C3BBCF' },
    rlSpark: { light: '#F4B740', dark: '#F7C65C' },
    rlTrack: { light: '#EEE6D9', dark: '#2E2939' },
  },
});
