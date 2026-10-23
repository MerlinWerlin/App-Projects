// T82 wiring: a Templates grid card tap opens the detail sheet, Start tracing goes to /trace with the same params
// the card tap used before, long press still traces at once, and the sheet has one primary action and no Plus gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// The screen may live under a route group (app/(tabs)/templates.tsx, T81) or at app/templates.tsx.
const screenPath = [join(root, 'app', '(tabs)', 'templates.tsx'), join(root, 'app', 'templates.tsx')].find((p) => existsSync(p));
const sheet = readFileSync(join(root, 'src', 'ui', 'v2', 'TemplateDetailSheet.tsx'), 'utf8');

test('Templates: card tap opens the sheet, long press and Start tracing go to /trace', () => {
  assert.ok(screenPath, 'templates screen found');
  const screen = readFileSync(screenPath, 'utf8');
  assert.match(screen, /<TemplateDetailSheet\b/);
  assert.match(screen, /onOpen=\{showDetail\}/);
  assert.match(screen, /onQuickTrace=\{open\}/);
  assert.match(screen, /router\.push\(\{ pathname: '\/trace', params: \{ template: tpl\.id \} \}\)/);
  assert.match(screen, /const startFromSheet = useCallback\(\s*\(tpl: Template\) => \{\s*setDetail\(null\);\s*open\(tpl\);/);
});

test('detail sheet: one primary PillButton, thickness choice, no Plus gate', () => {
  assert.equal(sheet.match(/<PillButton\b/g)?.length, 1);
  assert.doesNotMatch(sheet, /variant="(secondary|plain)"/, 'the one button is the primary pill');
  assert.match(sheet, /<GlassSheet\b/);
  assert.match(sheet, /<PillSegmented\b/);
  assert.match(sheet, /LINE_WEIGHTS/);
  assert.doesNotMatch(sheet, /plus\//i);
  assert.match(sheet, /accessibilityLabel=\{\s*favorite \?/);
});
