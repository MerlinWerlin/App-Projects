const fs = require('node:fs');
const path = require('node:path');

function assertIosReleaseAllowed(app, policy) {
  if (!/^[a-z0-9-]+$/.test(app || '')) throw new Error('Invalid app folder');
  if (app !== 'cue') return;
  if (policy?.target !== 'ios' || policy?.iosReleaseEnabled !== true) {
    throw new Error('Cue is Android-only by Jared\'s 2026-11-04 decision. TestFlight/iOS build and OTA release blocked. Use cue-play-production; source changes do not authorise an iOS release.');
  }
}

if (require.main === module) {
  try {
    const app = process.env.APP_FOLDER;
    const policy = app === 'cue'
      ? JSON.parse(fs.readFileSync(path.join(__dirname, '../apps/cue/ops/release-policy.json'), 'utf8'))
      : undefined;
    assertIosReleaseAllowed(app, policy);
    console.log(`iOS release policy permits ${app}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { assertIosReleaseAllowed };
