import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FEEDBACK_ADDRESS } from '../config/feedback.ts';
import {
  buildBody,
  buildFeedbackEmail,
  buildFrom,
  buildMailtoUrl,
  buildSubject,
  DIAG_BEGIN,
  DIAG_END,
  deviceModelFrom,
  draftProblem,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  isFeedbackType,
  osName,
  parseDiagnostics,
  runtimeFrom,
  type FeedbackDiagnostics,
} from './feedback.ts';

const diag: FeedbackDiagnostics = {
  appVersion: '1.0.0',
  build: '12',
  os: 'iOS',
  osVersion: '18.1',
  deviceModel: 'unknown',
  themeId: 'peach-fuzz',
  iconShape: 'squircle',
  runtime: 'expo-go',
};

test('subject always starts with "Glaze feedback" for every type', () => {
  for (const type of FEEDBACK_TYPES) {
    const s = buildSubject({ type, message: 'hi', appName: 'Notes' }, diag);
    assert.ok(s.startsWith('Glaze feedback – '), s);
    assert.ok(s.includes(FEEDBACK_TYPE_LABELS[type]), s);
    assert.ok(s.endsWith(' – v1.0.0 (build 12)'), s);
  }
});

test('subject matches the owner example exactly', () => {
  assert.equal(buildSubject({ type: 'bug', message: 'x' }, diag), 'Glaze feedback – Bug – v1.0.0 (build 12)');
  assert.equal(
    buildSubject({ type: 'theme', message: 'x' }, diag),
    'Glaze feedback – Theme request – v1.0.0 (build 12)',
  );
});

test('Icon request subject carries the app name, single-line and bounded', () => {
  assert.equal(
    buildSubject({ type: 'icon', message: 'x', appName: '  My Bank\nApp ' }, diag),
    'Glaze feedback – Icon request (My Bank App) – v1.0.0 (build 12)',
  );
  const long = buildSubject({ type: 'icon', message: 'x', appName: 'A'.repeat(200) }, diag);
  assert.ok(long.length < 120, long);
  assert.equal(buildSubject({ type: 'icon', message: 'x', appName: '' }, diag).includes('Icon request –'), true);
  // The app name is ignored for other types.
  assert.ok(!buildSubject({ type: 'bug', message: 'x', appName: 'Notes' }, diag).includes('Notes'));
});

test('subject tolerates missing version/build and a leading v', () => {
  assert.equal(
    buildSubject({ type: 'other', message: 'x' }, { appVersion: 'v2.1', build: '' }),
    'Glaze feedback – Other – v2.1 (build unknown)',
  );
});

test('body = message, blank line, delimited key: value block', () => {
  const body = buildBody({ type: 'bug', message: '  It crashed\r\non install.  ' }, diag);
  assert.ok(body.startsWith('It crashed\non install.\n\n' + DIAG_BEGIN + '\n'), body);
  assert.ok(body.trimEnd().endsWith(DIAG_END));
  const kv = parseDiagnostics(body);
  assert.deepEqual(kv, {
    type: 'bug',
    app_version: '1.0.0',
    build: '12',
    os: 'iOS',
    os_version: '18.1',
    device_model: 'unknown',
    theme_id: 'peach-fuzz',
    icon_shape: 'squircle',
    runtime: 'expo-go',
  });
});

test('body block: icon request adds app_name, missing values are explicit', () => {
  const body = buildBody(
    { type: 'icon', message: 'Please', appName: 'Bus Times' },
    { ...diag, themeId: null, iconShape: null, deviceModel: '', runtime: 'standalone' },
  );
  const kv = parseDiagnostics(body);
  assert.equal(kv?.app_name, 'Bus Times');
  assert.equal(kv?.theme_id, 'none');
  assert.equal(kv?.icon_shape, 'unknown');
  assert.equal(kv?.device_model, 'unknown');
  assert.equal(kv?.runtime, 'standalone');
});

test('a hostile value cannot inject extra diagnostic lines', () => {
  const body = buildBody({ type: 'bug', message: 'x' }, { ...diag, deviceModel: 'Pixel\nruntime: fake' });
  const lines = body.split('\n').filter((l) => l.startsWith('runtime: '));
  assert.deepEqual(lines, ['runtime: expo-go']);
});

test('buildFeedbackEmail bundles subject and body', () => {
  const e = buildFeedbackEmail({ type: 'idea', message: 'More pastel' }, diag);
  assert.ok(e.subject.startsWith('Glaze feedback'));
  assert.ok(e.body.startsWith('More pastel\n\n'));
});

test('mailto URL encodes subject and body', () => {
  const { subject, body } = buildFeedbackEmail({ type: 'bug', message: 'A & B?\nC=D' }, diag);
  const url = buildMailtoUrl('owner@example.com', subject, body);
  assert.ok(url.startsWith('mailto:owner@example.com?subject=Glaze%20feedback%20%E2%80%93%20Bug'));
  assert.ok(!/[\s\n]/.test(url));
  const q = new URL(url).searchParams;
  assert.equal(q.get('subject'), subject);
  assert.equal(q.get('body'), body);
});

test('draftProblem: message required, icon request needs an app name', () => {
  assert.equal(draftProblem({ type: 'bug', message: 'ok' }), null);
  assert.ok(draftProblem({ type: 'bug', message: '   ' }));
  assert.ok(draftProblem({ type: 'icon', message: 'ok', appName: ' ' }));
  assert.equal(draftProblem({ type: 'icon', message: 'ok', appName: 'Notes' }), null);
});

test('runtime, OS, device model and build helpers', () => {
  assert.equal(runtimeFrom('storeClient'), 'expo-go');
  assert.equal(runtimeFrom('standalone'), 'standalone');
  assert.equal(runtimeFrom('bare'), 'standalone');
  assert.equal(runtimeFrom(undefined), 'standalone');
  assert.equal(osName('ios'), 'iOS');
  assert.equal(osName('android'), 'Android');
  assert.equal(deviceModelFrom({ interfaceIdiom: 'phone', osVersion: '18.1' }), 'unknown');
  assert.equal(deviceModelFrom({ Manufacturer: 'Google', Model: 'Pixel 8' }), 'Google Pixel 8');
  assert.equal(deviceModelFrom({ Manufacturer: 'samsung', Model: 'SAMSUNG SM-S911B' }), 'SAMSUNG SM-S911B');
  assert.equal(deviceModelFrom(null), 'unknown');
  assert.equal(buildFrom('ios', { ios: { buildNumber: '7' } }), '7');
  assert.equal(buildFrom('android', { ios: { buildNumber: '7' }, android: { versionCode: 9 } }), '9');
  assert.equal(buildFrom('ios', null), 'dev');
  assert.ok(isFeedbackType('idea'));
  assert.ok(!isFeedbackType('spam'));
});

// Guard (owner requirement): the address lives in one constant so it can switch before release.
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'docs' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (st.size < 2_000_000) out.push(p);
  }
  return out;
}

test('feedback address is a plain email and appears only in src/config/feedback.ts', () => {
  assert.match(FEEDBACK_ADDRESS, /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/);
  const root = process.cwd();
  const allowed = join('src', 'config', 'feedback.ts');
  const offenders = walk(root)
    .map((f) => relative(root, f))
    .filter((rel) => rel !== allowed && !/\.test\.tsx?$/.test(rel))
    .filter((rel) => readFileSync(join(root, rel), 'utf8').includes(FEEDBACK_ADDRESS));
  assert.deepEqual(offenders, []);
});
