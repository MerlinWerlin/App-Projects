import assert from 'node:assert/strict';
import { test } from 'node:test';
import { netStatus, showOfflineBanner } from './network.ts';

test('no connection at all is offline', () => {
  assert.equal(netStatus({ type: 'NONE', isConnected: false, isInternetReachable: false }), 'offline');
  assert.equal(netStatus({ isConnected: false }), 'offline');
  assert.equal(netStatus({ type: 'NONE' }), 'offline');
});

test('connected is online, even when the internet is not reachable (never claim flight mode we cannot see)', () => {
  assert.equal(netStatus({ type: 'WIFI', isConnected: true, isInternetReachable: true }), 'online');
  assert.equal(netStatus({ type: 'WIFI', isConnected: true, isInternetReachable: false }), 'online');
  assert.equal(netStatus({ type: 'CELLULAR', isConnected: true }), 'online');
});

test('anything unreadable is unknown', () => {
  assert.equal(netStatus(null), 'unknown');
  assert.equal(netStatus(undefined), 'unknown');
  assert.equal(netStatus('offline'), 'unknown');
  assert.equal(netStatus({}), 'unknown');
  assert.equal(netStatus({ type: 'UNKNOWN' }), 'unknown');
  assert.equal(netStatus({ isConnected: 'no' }), 'unknown');
});

test('the banner shows only when offline is known', () => {
  assert.equal(showOfflineBanner('offline'), true);
  assert.equal(showOfflineBanner('online'), false);
  assert.equal(showOfflineBanner('unknown'), false);
});
