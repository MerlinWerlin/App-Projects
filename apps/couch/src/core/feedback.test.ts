// Owner 24 Oct 2026: Send feedback / request a feature by email.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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
} from './feedback';

const root = join(__dirname, '..', '..');
const diag = { appVersion: '1.0.0', os: 'ios', osVersion: '26.1', deviceModel: 'iPhone16,2', language: 'en' };

test('goes to the owner, three types', () => {
  expect(FEEDBACK_ADDRESS).toBe('jaredbradley272@gmail.com');
  expect([...FEEDBACK_TYPES]).toEqual(['idea', 'bug', 'other']);
  expect(isFeedbackType('bug')).toBe(true);
  expect(isFeedbackType('theme')).toBe(false);
});

test('subject: app, English type label, version', () => {
  expect(buildSubject('Couch', { type: 'idea', message: 'x' }, '1.0.0')).toBe('Couch feedback – Idea – v1.0.0');
  expect(buildSubject('Couch', { type: 'bug', message: 'x' }, 'v2')).toBe('Couch feedback – Bug – v2');
});

test('body: message first, then one line per device fact', () => {
  const body = buildBody('Couch', { type: 'bug', message: '  Line one\r\nline two  ' }, diag);
  expect(body.startsWith('Line one\nline two\n\n-----\n')).toBe(true);
  for (const line of ['app: Couch', 'type: bug', 'app_version: 1.0.0', 'os: ios', 'os_version: 26.1', 'device_model: iPhone16,2', 'language: en']) {
    expect(body).toContain(`${line}\n`);
  }
  expect(oneLine('a\n\tb')).toBe('a b');
});

test('mailto encodes subject and body; empty drafts are not sent', () => {
  expect(buildMailtoUrl('o@example.com', 'A – B', 'x & y\nz')).toBe('mailto:o@example.com?subject=A%20%E2%80%93%20B&body=x%20%26%20y%0Az');
  expect(feedbackMailto('Couch', { type: 'idea', message: 'hi' }, diag).startsWith('mailto:jaredbradley272@gmail.com?subject=Couch%20feedback')).toBe(true);
  expect(draftReady({ type: 'idea', message: '  ' })).toBe(false);
});

test('Settings links to the feedback screen, which opens a mailto: link (no native mail module)', () => {
  expect(readFileSync(join(root, 'app', 'settings.tsx'), 'utf8')).toMatch(/router\.push\('\/feedback'\)/);
  expect(existsSync(join(root, 'app', 'feedback.tsx'))).toBe(true);
  const screen = readFileSync(join(root, 'app', 'feedback.tsx'), 'utf8');
  expect(screen).toMatch(/feedbackMailto\(/);
  expect(screen).toMatch(/Linking\.openURL\(/);
  expect(readFileSync(join(root, 'app', '_layout.tsx'), 'utf8')).toMatch(/name="feedback"/);
});
