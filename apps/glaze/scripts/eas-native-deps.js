// EAS build hook (package.json "eas-build-post-install"): runs on Expo's build servers after the
// normal npm install and before prebuild. For native builds only (GLAZE_NATIVE=1) it adds the
// widget build tool @bacons/apple-targets, which stays OUT of package.json so the Expo Go trial
// install can never fail on it (trialkit.test.ts guard; docs/WIDGETS.md "Testing on a dev build").
// `npx expo install` picks the version that matches the app's Expo SDK.
// D145-2 (25 Oct): fails the build LOUDLY when the tool can't be installed or resolved. A native
// build without it would silently drop the widget target (app.config.ts skips a piece whose plugin
// is missing), which is exactly the "same widgets, same colours" fault the owner can't diagnose.
// The App Group entitlement no longer depends on it (native-plugins/appgroup.json is always applied).
const { execSync } = require('node:child_process');

if (process.env.GLAZE_NATIVE !== '1') {
  console.log('[glaze] GLAZE_NATIVE is not 1: widget tool not needed for this build.');
  process.exit(0);
}

try {
  execSync('npx expo install @bacons/apple-targets', { stdio: 'inherit' });
  require.resolve('@bacons/apple-targets/package.json', { paths: [process.cwd()] });
  console.log('[glaze] @bacons/apple-targets installed for the widget target.');
} catch (err) {
  console.error('[glaze] FAILED: could not install @bacons/apple-targets, so the Glaze widgets would be missing.');
  console.error('[glaze] Stopping this native build instead of shipping one without widgets.', err && err.message);
  process.exit(1);
}
process.exit(0);
