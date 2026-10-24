// Owner 24 Oct 2026: Send feedback / request a feature by email.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FEEDBACK_ADDRESS,
  FEEDBACK_TYPES,
  buildBody,
  buildMailtoUrl,
  buildSubject,
  draftReady,
  feedbackMailto,
  isFeedbackType,
  oneLine,
} from './feedback.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const diag = { appVersion: '1.0.0', os: 'ios', osVersion: '26.1', deviceModel: 'iPhone16,2', language: 'en' };

test('goes to the owner, three types', () => {
  assert.equal(FEEDBACK_ADDRESS, 'jaredbradley272@gmail.com');
  assert.deepEqual([...FEEDBACK_TYPES], ['idea', 'bug', 'other']);
  assert.ok(isFeedbackType('bug'));
  assert.ok(!isFeedbackType('theme'));
});

test('subject: app, English type label, version', () => {
  assert.equal(buildSubject('Linework', { type: 'idea', message: 'x' }, '1.0.0'), 'Linework feedback – Idea – v1.0.0');
  assert.equal(buildSubject('Linework', { type: 'bug', message: 'x' }, 'v2'), 'Linework feedback – Bug – v2');
  assert.equal(buildSubject('', { type: 'other', message: 'x' }, ''), 'App feedback – Other – vunknown');
});

test('body: message first, then one line per device fact', () => {
  const body = buildBody('Linework', { type: 'bug', message: '  Line one\r\nline two  ' }, diag);
  assert.ok(body.startsWith('Line one\nline two\n\n-----\n'));
  for (const line of ['app: Linework', 'type: bug', 'app_version: 1.0.0', 'os: ios', 'os_version: 26.1', 'device_model: iPhone16,2', 'language: en']) {
    assert.ok(body.includes(`${line}\n`), line);
  }
  assert.ok(buildBody('Linework', { type: 'idea', message: 'x' }, { ...diag, deviceModel: '' }).includes('device_model: unknown'));
});

test('oneLine strips control characters and caps length', () => {
  assert.equal(oneLine('a\n\tb'), 'a b');
  assert.equal(oneLine('x'.repeat(100), 10).length, 10);
});

test('mailto encodes subject and body', () => {
  const url = buildMailtoUrl('o@example.com', 'A – B', 'x & y\nz');
  assert.equal(url, 'mailto:o@example.com?subject=A%20%E2%80%93%20B&body=x%20%26%20y%0Az');
  assert.ok(feedbackMailto('Linework', { type: 'idea', message: 'hi' }, diag).startsWith('mailto:jaredbradley272@gmail.com?subject=Linework%20feedback'));
});

test('empty drafts are not sent', () => {
  assert.equal(draftReady({ type: 'idea', message: '   ' }), false);
  assert.equal(draftReady({ type: 'idea', message: 'more angles please' }), true);
});

test('Settings links to the feedback screen, which sends a mailto: link (no native mail module needed)', () => {
  const settings = readFileSync(join(root, 'app', '(tabs)', 'settings.tsx'), 'utf8');
  assert.match(settings, /router\.push\('\/feedback'\)/);
  assert.ok(existsSync(join(root, 'app', 'feedback.tsx')));
  const screen = readFileSync(join(root, 'app', 'feedback.tsx'), 'utf8');
  assert.match(screen, /feedbackMailto\(/);
  assert.match(screen, /Linking\.openURL\(/);
  assert.match(screen, /selectable/);
});
