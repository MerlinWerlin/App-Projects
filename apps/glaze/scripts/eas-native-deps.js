// EAS build hook (package.json "eas-build-post-install"): runs on Expo's build servers after the
// normal npm install and before prebuild. For native builds only (GLAZE_NATIVE=1) it adds the
// widget build tool @bacons/apple-targets, which stays OUT of package.json so the Expo Go trial
// install can never fail on it (trialkit.test.ts guard; docs/WIDGETS.md "Testing on a dev build").
// `npx expo install` picks the version that matches the app's Expo SDK.
// Never fails the build: without the tool, prebuild skips the widget target and the rest of the
// native build (Live Lock Screen, Live Photo) still goes through.
const { execSync } = require('node:child_process');

if (process.env.GLAZE_NATIVE !== '1') {
  console.log('[glaze] GLAZE_NATIVE is not 1: widget tool not needed for this build.');
  process.exit(0);
}

try {
  execSync('npx expo install @bacons/apple-targets', { stdio: 'inherit' });
  console.log('[glaze] @bacons/apple-targets installed for the widget target.');
} catch (err) {
  console.warn('[glaze] Could not install @bacons/apple-targets; building without widgets.', err && err.message);
}
process.exit(0);
