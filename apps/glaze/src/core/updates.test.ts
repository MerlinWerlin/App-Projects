import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPlaceholderUpdatesUrl,
  updateCheckMessage,
  updatesEnabled,
  updatesOffReason,
  type UpdatesEnvironment,
} from './updates.ts';

const build: UpdatesEnvironment = {
  executionEnvironment: 'standalone',
  isDev: false,
  moduleLoaded: true,
  moduleEnabled: true,
  updatesUrl: 'https://u.expo.dev/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0',
};

test('a configured release build checks for updates', () => {
  assert.equal(updatesOffReason(build), null);
  assert.equal(updatesEnabled(build), true);
});

test('Expo Go never touches expo-updates, even with everything else on', () => {
  assert.equal(updatesOffReason({ ...build, executionEnvironment: 'storeClient' }), 'expo-go');
  assert.equal(updatesEnabled({ ...build, executionEnvironment: 'storeClient', isDev: true }), false);
});

test('dev runs, missing module and disabled module are off', () => {
  assert.equal(updatesOffReason({ ...build, isDev: true }), 'dev');
  assert.equal(updatesOffReason({ ...build, moduleLoaded: false }), 'no-module');
  assert.equal(updatesOffReason({ ...build, moduleEnabled: false }), 'disabled');
});

test('placeholder or missing URL counts as not configured; unknown URL is left to the module', () => {
  assert.equal(updatesOffReason({ ...build, updatesUrl: 'https://u.expo.dev/REPLACE_WITH_EAS_PROJECT_ID' }), 'not-configured');
  assert.equal(updatesOffReason({ ...build, updatesUrl: null }), 'not-configured');
  const { updatesUrl: _omit, ...noUrl } = build;
  assert.equal(updatesOffReason(noUrl), null);
});

test('placeholder URL detection', () => {
  assert.equal(isPlaceholderUpdatesUrl('https://u.expo.dev/REPLACE_WITH_EAS_PROJECT_ID'), true);
  assert.equal(isPlaceholderUpdatesUrl(''), true);
  assert.equal(isPlaceholderUpdatesUrl('https://example.com/x'), true);
  assert.equal(isPlaceholderUpdatesUrl(build.updatesUrl), false);
});

test('every check outcome has a message', () => {
  for (const o of ['none', 'downloaded', 'unavailable', 'error'] as const) {
    assert.ok(updateCheckMessage(o).length > 0);
  }
});
