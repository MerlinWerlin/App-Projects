// T151 (owner brief 25 Oct 21:29: "remove ALL bounce animations everywhere"): no spring presets in
// the motion core, and every scroll view in app/ and src/ui opts out of the iOS overscroll bounce
// (bounces={false}) and the Android overscroll glow (overScrollMode="never"). Source guards.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as motion from './motion.ts';

const root = process.cwd();
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (rel.endsWith('.tsx')) out.push(rel);
  }
  return out;
}

test('T151: the motion core exports no spring preset', () => {
  assert.equal('spring' in motion, false);
});

test('T151: every ScrollView / FlatList / SectionList turns off overscroll bounce', () => {
  const tag = /(?<![\w.])<((?:Animated\.)?(?:ScrollView|FlatList|SectionList))(?=[\s>])([^>]*)/g;
  let count = 0;
  for (const f of [...walk('app'), ...walk('src/ui')]) {
    const src = readFileSync(join(root, f), 'utf8');
    for (const m of src.matchAll(tag)) {
      count++;
      // T177 (owner-1031 asks for pull to refresh on the Themes gallery): that one list allows the iOS
      // overscroll only while it rests at the very top (perfBudget.test.ts guards how `atTop` is set).
      const bounces = f.replace(/\\/g, '/') === 'app/(tabs)/themes.tsx' ? /bounces=\{(false|atTop)\}/ : /bounces=\{false\}/;
      assert.match(m[2], bounces, `${f}: <${m[1]}> must set bounces={false}`);
      assert.match(m[2], /overScrollMode="never"/, `${f}: <${m[1]}> must set overScrollMode="never"`);
    }
  }
  assert.ok(count >= 20, `expected the app's scroll views, found ${count}`);
});
