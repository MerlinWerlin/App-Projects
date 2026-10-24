// fb-1024 A (T117): no route may ever render its raw file name ("index", "widget-studio", "theme/[id]") as a title.
// Every route file under app/ must be registered in its layout with a real title or with no header, and the root
// stack's default title is empty so an unregistered route (e.g. an unmatched link) shows no name either.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const appDir = fileURLToPath(new URL('../../app/', import.meta.url));

/** Route names (expo-router style) for files directly under a directory, grouping folders with an index or [param]. */
function routesUnder(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith('(')) continue; // a group has its own layout
      out.push(...routesUnder(full, `${prefix}${name}/`));
      continue;
    }
    if (!/\.tsx?$/.test(name) || name.startsWith('_layout') || name.startsWith('+')) continue;
    out.push(prefix + name.replace(/\.tsx?$/, ''));
  }
  return out;
}

function screenBlock(src: string, tag: string, name: string): string | null {
  const re = new RegExp(`<${tag}\\s+name="${name.replace(/[[\]]/g, '\\$&')}"[\\s\\S]*?/>`);
  const m = src.match(re);
  return m ? m[0] : null;
}

test('every root route has a real title or no header', () => {
  const layout = readFileSync(join(appDir, '_layout.tsx'), 'utf8');
  const routes = routesUnder(appDir);
  assert.ok(routes.includes('index'));
  for (const r of routes) {
    const block = screenBlock(layout, 'Stack.Screen', r);
    assert.ok(block, `app/${r} is registered in app/_layout.tsx`);
    assert.ok(/headerShown:\s*false/.test(block!) || /title:\s*t\(/.test(block!), `app/${r} has a translated title or no header`);
  }
  assert.ok(/<Stack\.Screen\s+name="\(tabs\)"[^>]*headerShown:\s*false/.test(layout), '(tabs) has no stack header');
});

test('index (the redirect to Themes) never shows a header or animates', () => {
  const layout = readFileSync(join(appDir, '_layout.tsx'), 'utf8');
  const block = screenBlock(layout, 'Stack.Screen', 'index')!;
  assert.match(block, /headerShown:\s*false/);
  assert.match(block, /animation:\s*'none'/);
  const index = readFileSync(join(appDir, 'index.tsx'), 'utf8');
  assert.match(index, /<Redirect/);
  assert.match(index, /backgroundColor/); // paints the app background, not a blank frame
});

test("the stack's default title is empty, so no route can show its file name", () => {
  const layout = readFileSync(join(appDir, '_layout.tsx'), 'utf8');
  const opts = layout.slice(layout.indexOf('screenOptions={{'), layout.indexOf('}}', layout.indexOf('screenOptions={{')));
  assert.match(opts, /title:\s*''/);
});

test('every tab has a translated title and the tab navigator shows no header', () => {
  const tabs = readFileSync(join(appDir, '(tabs)', '_layout.tsx'), 'utf8');
  assert.match(tabs, /headerShown:\s*false/);
  for (const r of routesUnder(join(appDir, '(tabs)'))) {
    const block = screenBlock(tabs, 'Tabs.Screen', r);
    assert.ok(block, `(tabs)/${r} is registered`);
    assert.ok(/tab\(t\(|title:\s*t\(/.test(block!), `(tabs)/${r} has a translated title`);
  }
});
