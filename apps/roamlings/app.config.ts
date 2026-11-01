// Expo config. Base settings live in app.json; this adds the home-screen widget for native builds.
//
// ROAMLINGS_NATIVE=1 (eas.json "production-native" profile) adds the WidgetKit extension
// (targets/widget, via @bacons/apple-targets) and the App Group the app and widget share.
// Plain "production" builds stay without them, so a widget problem can never block a TestFlight build.
// The widget tool is installed on Expo's build servers by scripts/eas-native-deps.js.
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const APP_GROUP = 'group.com.jared797.roamlings';

function installed(name: string): boolean {
  try {
    createRequire(join(__dirname, 'package.json')).resolve(`${name}/package.json`);
    return true;
  } catch {
    return false;
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  if (process.env.ROAMLINGS_NATIVE !== '1') return base;
  if (!installed('@bacons/apple-targets')) {
    console.error('[roamlings] WARNING: @bacons/apple-targets is not installed, so this build has no widget.');
    return base;
  }
  const groups = new Set<string>(
    ((base.ios?.entitlements?.['com.apple.security.application-groups'] as string[] | undefined) ?? []).concat(APP_GROUP),
  );
  return {
    ...base,
    plugins: [...(base.plugins ?? []), '@bacons/apple-targets'],
    ios: {
      ...base.ios,
      entitlements: { ...(base.ios?.entitlements ?? {}), 'com.apple.security.application-groups': Array.from(groups) },
    },
  };
};
