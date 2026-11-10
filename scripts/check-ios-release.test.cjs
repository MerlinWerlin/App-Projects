const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { assertIosReleaseAllowed } = require('./check-ios-release.cjs');
const fs = require('node:fs');
const path = require('node:path');

test('both legacy iOS entrypoints enforce policy before Expo access', () => {
  for (const file of ['ship.yml', 'ship-mac.yml']) {
    const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows', file), 'utf8');
    const guard = workflow.indexOf('run: node scripts/check-ios-release.cjs');
    assert.ok(guard > 0 && guard < workflow.indexOf('uses: expo/expo-github-action'));
    assert.match(workflow.slice(guard - 160, guard), /working-directory: \./);
  }
});

test('Cue Android policy blocks both old iOS release modes', () => {
  for (const mode of ['build', 'update']) {
    assert.throws(() => assertIosReleaseAllowed('cue', { target: 'android', iosReleaseEnabled: false, mode }), /Android-only/);
  }
});
test('missing or partial Cue approval fails closed', () => {
  for (const policy of [undefined, {}, { target: 'ios' }, { iosReleaseEnabled: true }]) {
    assert.throws(() => assertIosReleaseAllowed('cue', policy), /Android-only/);
  }
});
test('explicit later iOS policy can permit Cue', () => {
  assert.doesNotThrow(() => assertIosReleaseAllowed('cue', { target: 'ios', iosReleaseEnabled: true }));
});
test('other apps retain their existing release route', () => {
  for (const app of ['glaze', 'backspin', 'linework', 'couch', 'travel']) {
    assert.doesNotThrow(() => assertIosReleaseAllowed(app));
  }
});
test('shipping CLI follows the checked-in Cue policy', () => {
  const policy = JSON.parse(fs.readFileSync(path.join(__dirname, '../apps/cue/ops/release-policy.json'), 'utf8'));
  const allowed = policy.target === 'ios' && policy.iosReleaseEnabled === true;
  // Enabling iOS needs a recorded owner decision in the policy file itself.
  if (allowed) assert.match(policy.ownerDecision || '', /^\d{4}-\d{2}-\d{2}: Jared/);
  const result = spawnSync(process.execPath, [require.resolve('./check-ios-release.cjs')], {
    env: { ...process.env, APP_FOLDER: 'cue' }, encoding: 'utf8',
  });
  assert.equal(result.status, allowed ? 0 : 1);
  if (!allowed) assert.match(result.stderr, /Android-only/);
});
test('other-app CLI passes and invalid app fails', () => {
  for (const [app, status] of [['glaze', 0], ['../cue', 1]]) {
    const result = spawnSync(process.execPath, [require.resolve('./check-ios-release.cjs')], {
      env: { ...process.env, APP_FOLDER: app }, encoding: 'utf8',
    });
    assert.equal(result.status, status);
  }
});
