import assert from 'node:assert/strict';
import { test } from 'node:test';
import { permissions } from '../i18n/en/permissions.ts';
import {
  authState,
  canProceed,
  fallbackKey,
  PERMISSION_KINDS,
  permissionActions,
  permissionState,
  reasonKey,
  titleKey,
  type PermissionState,
} from './permissions.ts';

test('granted, limited and the photo access levels', () => {
  assert.equal(permissionState({ status: 'granted', granted: true, canAskAgain: true }), 'granted');
  assert.equal(permissionState({ status: 'granted', accessPrivileges: 'all' }), 'granted');
  assert.equal(permissionState({ status: 'granted', accessPrivileges: 'limited' }), 'limited');
  assert.equal(permissionState({ status: 'granted', accessPrivileges: 'none', canAskAgain: false }), 'blocked');
  assert.equal(permissionState({ status: 'granted', accessPrivileges: 'none', canAskAgain: true }), 'ask');
  // Some modules set granted without a matching status string.
  assert.equal(permissionState({ status: 'whatever', granted: true }), 'granted');
});

test('undetermined asks, unless the system says it will not', () => {
  assert.equal(permissionState({ status: 'undetermined', canAskAgain: true }), 'ask');
  assert.equal(permissionState({ status: 'undetermined' }), 'ask');
  assert.equal(permissionState({ status: 'undetermined', canAskAgain: false }), 'blocked');
});

test('denied is blocked unless the system will ask again (Android)', () => {
  assert.equal(permissionState({ status: 'denied', canAskAgain: false }), 'blocked');
  assert.equal(permissionState({ status: 'denied' }), 'blocked');
  assert.equal(permissionState({ status: 'denied', canAskAgain: true }), 'ask');
  assert.equal(permissionState({ status: 'denied', granted: false, canAskAgain: true, accessPrivileges: 'none' }), 'ask');
});

test('missing or malformed responses are unavailable, never a throw', () => {
  assert.equal(permissionState(null), 'unavailable');
  assert.equal(permissionState(undefined), 'unavailable');
  assert.equal(permissionState({ status: 'restricted' }), 'unavailable');
  assert.equal(permissionState({} as never), 'unavailable');
  assert.equal(permissionState('granted' as never), 'unavailable');
});

test('canProceed only for granted and limited', () => {
  const all: PermissionState[] = ['granted', 'limited', 'ask', 'blocked', 'unavailable'];
  assert.deepEqual(all.filter(canProceed), ['granted', 'limited']);
});

test('actions: blocked always offers Open Settings first, then retry and the fallback', () => {
  for (const k of PERMISSION_KINDS) {
    assert.deepEqual(permissionActions(k, 'blocked'), ['settings']);
    assert.deepEqual(permissionActions(k, 'blocked', { hasFallback: true }), ['settings', 'fallback']);
    assert.deepEqual(permissionActions(k, 'blocked', { hasRetry: true, hasFallback: true }), ['settings', 'retry', 'fallback']);
  }
});

test('actions: ask retries when it can, else Settings; granted needs nothing', () => {
  assert.deepEqual(permissionActions('contacts', 'ask', { hasRetry: true, hasFallback: true }), ['retry', 'fallback']);
  assert.deepEqual(permissionActions('contacts', 'ask', { hasFallback: true }), ['settings', 'fallback']);
  assert.deepEqual(permissionActions('photos', 'granted', { hasRetry: true, hasFallback: true }), []);
  assert.deepEqual(permissionActions('photos', 'limited', { hasFallback: true }), ['settings', 'fallback']);
});

test('actions: unavailable offers Settings only where Settings can fix it', () => {
  assert.deepEqual(permissionActions('faceid', 'unavailable', { hasFallback: true }), ['settings', 'fallback']);
  assert.deepEqual(permissionActions('location', 'unavailable'), ['settings']);
  assert.deepEqual(permissionActions('contacts', 'unavailable', { hasFallback: true }), ['fallback']);
  assert.deepEqual(permissionActions('photos', 'unavailable', { hasRetry: true, hasFallback: true }), ['retry', 'fallback']);
  assert.deepEqual(permissionActions('files', 'unavailable'), []);
});

test('Face ID failures map to states', () => {
  assert.equal(authState('not-enrolled'), 'unavailable');
  assert.equal(authState('no-hardware'), 'unavailable');
  assert.equal(authState('unavailable'), 'unavailable');
  assert.equal(authState('cancelled'), 'ask');
  assert.equal(authState('error'), 'ask');
});

test('every kind has a reason and heading for every state, and a fallback label', () => {
  const cat = permissions as Record<string, string>;
  const states = ['limited', 'ask', 'blocked', 'unavailable'] as const;
  for (const k of PERMISSION_KINDS) {
    for (const s of states) {
      assert.ok(cat[reasonKey(k, s)], reasonKey(k, s));
      assert.ok(cat[titleKey(k, s)], titleKey(k, s));
    }
    assert.ok(cat[fallbackKey(k)], fallbackKey(k));
  }
  for (const key of Object.keys(cat)) assert.ok(key.startsWith('permissions.'), key);
});

test('blocked reasons mention Settings in plain words', () => {
  for (const k of PERMISSION_KINDS) assert.match((permissions as Record<string, string>)[reasonKey(k, 'blocked')], /Settings/);
});
