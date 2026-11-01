// T266 (owner-1101i #3): App Store release prep guards.
// - Export compliance: app.json declares no non-exempt encryption (Expo's documented key
//   ios.config.usesNonExemptEncryption, which writes ITSAppUsesNonExemptEncryption=false into Info.plist),
//   and nothing else in the config contradicts it.
// - docs/STORE.md listing fields stay inside App Store limits and carry their real character counts.
// - docs/site/privacy.html is the same page as docs/privacy.html; the site pages load nothing external.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

type AppJson = {
  expo: {
    version: string;
    runtimeVersion?: { policy?: string };
    ios: { config?: { usesNonExemptEncryption?: boolean }; infoPlist?: Record<string, unknown> };
  };
};

test('T266: export compliance - no non-exempt encryption declared in app.json', () => {
  const app = JSON.parse(read('app.json')) as AppJson;
  assert.equal(app.expo.ios.config?.usesNonExemptEncryption, false, 'ios.config.usesNonExemptEncryption must be false');
  const plistValue = app.expo.ios.infoPlist?.ITSAppUsesNonExemptEncryption;
  assert.ok(plistValue === undefined || plistValue === false, 'infoPlist must not set ITSAppUsesNonExemptEncryption to true');
});

test('T266: no native piece turns non-exempt encryption on', () => {
  const dir = join(ROOT, 'native-plugins');
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    assert.doesNotMatch(read(`native-plugins/${f}`), /ITSAppUsesNonExemptEncryption"\s*:\s*true|usesNonExemptEncryption"\s*:\s*true/, f);
  }
});

test('T266: version decision - App Store release keeps the TestFlight train 1.0.1', () => {
  const app = JSON.parse(read('app.json')) as AppJson;
  const checklist = read('docs/RELEASE_CHECKLIST.md');
  assert.match(checklist, /## 0\. Version decision/);
  assert.ok(checklist.includes(`\`${app.expo.version}\``), 'checklist names the app.json version');
  assert.equal(app.expo.runtimeVersion?.policy, 'appVersion');
});

const LIMITS: Record<string, number> = {
  Name: 30,
  Subtitle: 30,
  Keywords: 100,
  'Promotional text': 170,
};

const COMPETITORS = ['Themify', 'Icon Themer', 'MyScreen', 'ScreenKit', 'Widgetsmith', 'intoLive', 'Loopy', 'Lockio'];

test('T266: STORE.md listing fields fit App Store limits and state their real counts', () => {
  const store = read('docs/STORE.md');
  const copy: string[] = [];
  for (const [field, limit] of Object.entries(LIMITS)) {
    const m = store.match(new RegExp(`^\\| ${field} \\| \`([^\`]*)\` \\| (\\d+) \\|`, 'm'));
    assert.ok(m, `STORE.md has a "${field}" row`);
    const [, text, count] = m;
    copy.push(text);
    assert.equal(text.length, Number(count), `${field}: stated count matches`);
    assert.ok(text.length <= limit, `${field}: ${text.length} > ${limit}`);
    if (field === 'Keywords') {
      assert.doesNotMatch(text, /, /, 'no spaces after commas');
      assert.doesNotMatch(text, /,,|^,|,$/);
    }
  }
  const desc = store.match(/<!-- description:start -->\n```text\n([\s\S]*?)\n```\n<!-- description:end -->/);
  assert.ok(desc, 'STORE.md has the description block');
  assert.ok(desc[1].length <= 4000, 'description <= 4000 characters');
  copy.push(desc[1]);
  const lower = store.toLowerCase();
  for (const name of COMPETITORS) assert.ok(!lower.includes(name.toLowerCase()), `STORE.md must not name ${name}`);
  // Customer-facing copy: no ranks, badges or invented popularity, no live-wallpaper promise.
  for (const text of copy) {
    assert.doesNotMatch(text, /#1\b|number one|downloads|million|editor'?s choice|award/i, text.slice(0, 40));
    assert.doesNotMatch(text, /live wallpaper|moves on (?:your|the) Lock Screen|when you wake/i, text.slice(0, 40));
  }
});

test('T266: support and privacy pages for publishing', () => {
  assert.equal(read('docs/site/privacy.html'), read('docs/privacy.html'), 'docs/site/privacy.html is a copy of docs/privacy.html');
  for (const f of ['docs/site/index.html', 'docs/site/privacy.html']) {
    const html = read(f);
    assert.match(html, /<title>[^<]+<\/title>/, f);
    assert.doesNotMatch(html, /<(script|link|img|iframe)\b[^>]*\b(src|href)="https?:/i, `${f} loads no external assets`);
  }
  assert.match(read('docs/site/index.html'), /href="privacy\.html"/);
});
