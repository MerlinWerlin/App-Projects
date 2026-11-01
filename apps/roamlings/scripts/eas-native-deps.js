// EAS build hook (package.json "eas-build-post-install"): runs after npm install on the build server.
// For widget builds only (ROAMLINGS_NATIVE=1) it adds @bacons/apple-targets, which stays out of
// package.json so ordinary installs and checks never depend on it. Fails the build loudly if the
// tool can't be installed, instead of shipping a "widget build" without the widget (Glaze lesson D145-2).
const { execSync } = require('node:child_process');

if (process.env.ROAMLINGS_NATIVE !== '1') {
  console.log('[roamlings] ROAMLINGS_NATIVE is not 1: widget tool not needed for this build.');
  process.exit(0);
}

try {
  execSync('npx expo install @bacons/apple-targets', { stdio: 'inherit' });
  require.resolve('@bacons/apple-targets/package.json', { paths: [process.cwd()] });
  console.log('[roamlings] @bacons/apple-targets installed for the widget target.');
} catch (err) {
  console.error('[roamlings] FAILED: could not install @bacons/apple-targets, so the widget would be missing.');
  console.error('[roamlings] Stopping this native build.', err && err.message);
  process.exit(1);
}
process.exit(0);
