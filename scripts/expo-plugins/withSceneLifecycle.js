// Expo config plugin: adopt the UIScene life cycle that iOS 27 requires.
//
// An app linked against the iOS 27 SDK that still uses the app-delegate window crashes at launch in
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption (Linework 1.0.4 build 21, 21 Nov 2026).
// Expo ships ExpoAppSceneDelegate (objc name EXExpoAppSceneDelegate). This plugin:
//   1. declares it as the window scene delegate in Info.plist (single scene), and
//   2. makes the generated AppDelegate conform to ExpoReactNativeFactoryProvider and stop creating its own window;
//      the scene delegate creates the window and starts React Native from the app delegate's factory.
// It fails the prebuild if the AppDelegate doesn't look as expected, so it can never half-apply.
// Resolved from the app folder (prebuild's cwd): this file lives outside every app's node_modules.
const { withInfoPlist, withAppDelegate } = require(require.resolve('expo/config-plugins', { paths: [process.cwd()] }));

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate' },
    ],
  },
};

function patchAppDelegate(src) {
  if (src.includes('ExpoReactNativeFactoryProvider')) return src; // already patched
  let out = src.replace(
    /(class\s+AppDelegate\s*:\s*ExpoAppDelegate)(\s*\{)/,
    '$1, ExpoReactNativeFactoryProvider$2'
  );
  if (out === src) throw new Error('withSceneLifecycle: could not find "class AppDelegate: ExpoAppDelegate" in AppDelegate.swift');
  // Remove the app-delegate window and the React Native start; the scene delegate does both.
  const before = out;
  out = out.replace(/\n[ \t]*window\s*=\s*UIWindow\(frame:\s*UIScreen\.main\.bounds\)[ \t]*\n/, '\n');
  out = out.replace(/\n[ \t]*factory\.startReactNative\([\s\S]*?launchOptions:\s*launchOptions\s*\)[ \t]*\n/, '\n');
  if (out === before || /factory\.startReactNative\(/.test(out) || /UIWindow\(frame:/.test(out)) {
    throw new Error('withSceneLifecycle: could not remove the app-delegate window / startReactNative from AppDelegate.swift');
  }
  if (!/var\s+reactNativeFactory\s*:\s*RCTReactNativeFactory\?/.test(out)) {
    throw new Error('withSceneLifecycle: AppDelegate.swift has no "var reactNativeFactory: RCTReactNativeFactory?"');
  }
  if (!/var\s+window\s*:\s*UIWindow\?/.test(out)) {
    throw new Error('withSceneLifecycle: AppDelegate.swift has no "var window: UIWindow?"');
  }
  return out;
}

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return c;
  });
  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') throw new Error('withSceneLifecycle: AppDelegate is not Swift');
    c.modResults.contents = patchAppDelegate(c.modResults.contents);
    return c;
  });
  return config;
};
module.exports.patchAppDelegate = patchAppDelegate;
