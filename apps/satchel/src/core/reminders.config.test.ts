// Trip reminders, app config (docs/REMINDERS.md): local notifications only, custom sounds bundled, no push.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { REMINDER_SOUNDS } from './reminders.ts';

const root = new URL('../../', import.meta.url);
const app = JSON.parse(readFileSync(new URL('app.json', root), 'utf8')).expo as {
  plugins: (string | [string, Record<string, unknown>])[];
  ios: { infoPlist: Record<string, unknown>; entitlements?: Record<string, unknown> };
};
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { dependencies: Record<string, string> };
const pluginName = (p: string | [string, unknown]) => (Array.isArray(p) ? p[0] : p);
const require = createRequire(import.meta.url);

test('expo-notifications is a dependency and its plugin bundles the three sounds, which exist on disk', () => {
  assert.match(pkg.dependencies['expo-notifications'] ?? '', /^~58\./);
  const entry = app.plugins.find((p) => pluginName(p) === 'expo-notifications');
  assert.ok(Array.isArray(entry), 'expo-notifications is listed with options');
  const opts = (entry as [string, { sounds?: string[]; enableRemoteNotifications?: boolean; enableBackgroundRemoteNotifications?: boolean }])[1];
  assert.equal(opts.enableRemoteNotifications, false, 'no push: the plugin must not add aps-environment');
  assert.notEqual(opts.enableBackgroundRemoteNotifications, true);
  const sounds = opts.sounds ?? [];
  assert.deepEqual(sounds.map((s) => s.split('/').pop()).sort(), Object.values(REMINDER_SOUNDS).sort());
  for (const s of sounds) {
    const file = new URL(s.replace(/^\.\//, ''), root);
    assert.ok(existsSync(file), `${s} exists`);
    const buf = readFileSync(file);
    // RIFF/WAVE, PCM (1), mono, 44.1 kHz, 16-bit, and well under iOS's 30 s limit.
    assert.equal(buf.toString('ascii', 0, 4), 'RIFF', s);
    assert.equal(buf.toString('ascii', 8, 12), 'WAVE', s);
    assert.equal(buf.readUInt16LE(20), 1, `${s} PCM`);
    assert.equal(buf.readUInt16LE(22), 1, `${s} mono`);
    assert.equal(buf.readUInt32LE(24), 44_100, `${s} 44.1 kHz`);
    assert.equal(buf.readUInt16LE(34), 16, `${s} 16-bit`);
    const seconds = (buf.length - 44) / (44_100 * 2);
    assert.ok(seconds >= 0.8 && seconds <= 2, `${s} is ${seconds.toFixed(2)} s`);
  }
  assert.ok(existsSync(new URL('assets/sounds/README.md', root)));
  assert.ok(existsSync(new URL('tools/sounds/make_sounds.py', root)));
});

test('no push: no aps-environment, no UIBackgroundModes, and the guard plugin runs after expo-notifications', () => {
  const raw = readFileSync(new URL('app.json', root), 'utf8');
  assert.doesNotMatch(raw, /aps-environment/);
  assert.doesNotMatch(raw, /UIBackgroundModes/);
  assert.doesNotMatch(raw, /remote-notification/);
  assert.equal(app.ios.entitlements?.['aps-environment'], undefined);
  const names = app.plugins.map(pluginName);
  const guard = names.indexOf('./plugins/with-local-notifications-only');
  const notif = names.indexOf('expo-notifications');
  assert.ok(guard >= 0 && notif >= 0);
  // Expo runs the callbacks of later-listed plugins first, so the guard is listed BEFORE to run AFTER.
  assert.ok(guard < notif, 'guard listed before expo-notifications so its mod runs last');
});

test('the guard strips the push entitlement and the remote-notification background mode, idempotently', () => {
  const g = require('../../plugins/with-local-notifications-only.js') as {
    stripApsEnvironment: (e: Record<string, unknown>) => Record<string, unknown>;
    stripRemoteBackgroundMode: (p: Record<string, unknown>) => Record<string, unknown>;
  };
  assert.deepEqual(g.stripApsEnvironment({ 'aps-environment': 'development', 'com.apple.developer.x': true }), { 'com.apple.developer.x': true });
  assert.deepEqual(g.stripApsEnvironment({}), {});
  assert.deepEqual(g.stripApsEnvironment(undefined as unknown as Record<string, unknown>), {});
  assert.deepEqual(g.stripRemoteBackgroundMode({ UIBackgroundModes: ['remote-notification'], A: 1 }), { A: 1 });
  assert.deepEqual(g.stripRemoteBackgroundMode({ UIBackgroundModes: ['audio', 'remote-notification'] }), { UIBackgroundModes: ['audio'] });
  assert.deepEqual(g.stripRemoteBackgroundMode({ B: 2 }), { B: 2 });
});

test('the native layer stays local and quiet: no push token, no critical or time-sensitive alerts, capture builds do nothing', () => {
  const src = readFileSync(new URL('src/native/notifications.ts', root), 'utf8');
  assert.doesNotMatch(src, /getExpoPushTokenAsync|getDevicePushTokenAsync|registerTaskAsync/);
  assert.doesNotMatch(src, /allowCriticalAlerts|interruptionLevel|timeSensitive|defaultCritical/);
  assert.match(src, /process\.env\.EXPO_PUBLIC_SATCHEL_CAPTURE === '1'/);
  assert.match(src, /assets\/mascot\/notify\.png/);
  assert.ok(existsSync(new URL('assets/mascot/notify.png', root)));
  // Only our own notifications are ever cancelled.
  assert.doesNotMatch(src, /cancelAllScheduledNotificationsAsync/);
  // The reminders hook is mounted once, in the root Shell.
  const layout = readFileSync(new URL('app/_layout.tsx', root), 'utf8');
  assert.equal(layout.match(/useTripReminders\(/g)?.length, 1);
  assert.match(readFileSync(new URL('app/settings.tsx', root), 'utf8'), /<RemindersSection \/>/);
});

test('the privacy page and the reminders doc say reminders stay on the phone', () => {
  const privacy = readFileSync(new URL('../../docs/satchel/privacy.html', root), 'utf8');
  assert.match(privacy, /reminders/i);
  const doc = readFileSync(new URL('docs/REMINDERS.md', root), 'utf8');
  assert.match(doc, /Data Not Collected/);
  assert.match(doc, /silent switch/i);
});
