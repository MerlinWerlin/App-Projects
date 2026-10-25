// Starter standard: no route can render its raw file name as a header (the "index" flash). Every stack route
// file is registered in app/_layout.tsx with headerShown:false or a translated title, and every tab has a title.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const app = fileURLToPath(new URL('../../app/', import.meta.url)); // not .pathname: that breaks on Windows (C:\C:\...)
const read = (p: string) => readFileSync(join(app, p), 'utf8');

function routes(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const f of readdirSync(join(app, dir))) {
    const rel = dir ? `${dir}/${f}` : f;
    if (statSync(join(app, rel)).isDirectory()) {
      if (!f.startsWith('(')) out.push(...routes(rel, `${prefix}${f}/`));
    } else if (f.endsWith('.tsx') && !f.startsWith('_')) out.push(`${prefix}${f.replace(/\.tsx$/, '')}`);
  }
  return out;
}

test('every stack route is registered with headerShown:false or a translated title', () => {
  const root = read('_layout.tsx');
  assert.match(root, /screenOptions=\{\{\s*headerShown: false/);
  for (const r of routes('')) {
    const m = root.match(new RegExp(`<Stack\\.Screen name="${r.replace(/[[\]]/g, '\\$&')}" options=\\{([^\\n]+)\\} />`));
    assert.ok(m, `route ${r} is not registered in app/_layout.tsx`);
    assert.ok(/headerShown: false/.test(m[1]) || /title: t\('/.test(m[1]), `route ${r} has neither headerShown:false nor a title`);
  }
});

test('every tab screen has a translated title and accessibility label', () => {
  const tabs = read('(tabs)/_layout.tsx');
  for (const f of readdirSync(join(app, '(tabs)')).filter((x) => x.endsWith('.tsx') && !x.startsWith('_'))) {
    const name = f.replace(/\.tsx$/, '');
    assert.match(tabs, new RegExp(`name="${name}" options=\\{\\{ title: t\\('[^']+'\\), tabBarAccessibilityLabel`), `tab ${name}`);
  }
});

test('splash is held until ready', () => {
  const root = read('_layout.tsx');
  assert.match(root, /preventAutoHideAsync/);
  assert.match(root, /hideAsync/);
});
