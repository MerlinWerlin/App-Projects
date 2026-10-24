// Template catalogue: counts, ids, path sanity, bounds, SVG export and asset files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATEGORIES,
  TEMPLATES,
  getTemplate,
  parseCategory,
  templateLevel,
  templatesIn,
  toSvgString,
  type Template,
} from './templates.ts';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'templates');
const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

type Cmd = { cmd: string; args: number[] };

function parse(d: string): Cmd[] {
  const tokens = d.match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: Cmd[] = [];
  let i = 0;
  let cmd = '';
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) {
      cmd = tokens[i++];
      if (cmd.toUpperCase() === 'Z') {
        out.push({ cmd, args: [] });
        continue;
      }
    }
    const n = ARGS[cmd.toUpperCase()];
    assert.ok(n, `unknown command ${cmd}`);
    const args = tokens.slice(i, i + n).map(Number);
    assert.equal(args.length, n, `command ${cmd} needs ${n} numbers`);
    assert.ok(args.every(Number.isFinite), `non-numeric args for ${cmd}`);
    out.push({ cmd, args });
    i += n;
  }
  return out;
}

/** x/y coordinate pairs used by absolute commands (control points included). */
function absolutePoints(cmds: Cmd[]): [number, number][] {
  const pts: [number, number][] = [];
  for (const { cmd, args } of cmds) {
    if (cmd === 'A') pts.push([args[5], args[6]]);
    else if (cmd === 'H' || cmd === 'V') continue;
    else if ('MLCSQT'.includes(cmd)) for (let k = 0; k < args.length; k += 2) pts.push([args[k], args[k + 1]]);
  }
  return pts;
}

test('catalogue: every template has a known category and level; the 24 starter templates stay', () => {
  assert.ok(TEMPLATES.length >= 24);
  const cats = new Set(CATEGORIES.map((c) => c.id));
  for (const t of TEMPLATES) {
    assert.ok(cats.has(t.category), `${t.id}: unknown category ${t.category}`);
    assert.ok(['beginner', 'intermediate', 'advanced'].includes(templateLevel(t)), t.id);
    for (const tag of t.tags ?? []) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
  }
  assert.equal(templatesIn(null).length, TEMPLATES.length);
  for (const c of CATEGORIES) assert.ok(c.label.length > 0);
});

test('ids are unique kebab-case and lookup works', () => {
  const ids = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(getTemplate(id)?.id, id);
  }
  assert.equal(getTemplate('nope'), undefined);
  assert.equal(getTemplate(undefined), undefined);
  const names = TEMPLATES.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, 'names are unique');
});

test('every path is non-empty, starts with M and uses only valid path syntax', () => {
  for (const t of TEMPLATES) {
    assert.ok(t.paths.length > 0, t.id);
    assert.equal(t.viewBox, '0 0 400 400', t.id);
    for (const d of [...t.paths, ...(t.detail ?? [])]) {
      assert.ok(d.trim().length > 0, `${t.id}: empty path`);
      assert.match(d.trim(), /^M/, `${t.id}: path must start with M`);
      assert.match(d, /^[MLHVCSQTAZmlhvcsqtaz0-9.,eE+\-\s]+$/, `${t.id}: invalid characters`);
      const cmds = parse(d);
      assert.ok(cmds.length >= 2, `${t.id}: path needs at least a move and a draw`);
    }
  }
});

test('absolute coordinates stay inside the viewBox (with a small margin)', () => {
  const margin = 4;
  for (const t of TEMPLATES) {
    const [minX, minY, w, h] = t.viewBox.split(/\s+/).map(Number);
    for (const d of [...t.paths, ...(t.detail ?? [])]) {
      for (const [x, y] of absolutePoints(parse(d))) {
        assert.ok(x >= minX - margin && x <= minX + w + margin, `${t.id}: x=${x} out of bounds`);
        assert.ok(y >= minY - margin && y <= minY + h + margin, `${t.id}: y=${y} out of bounds`);
      }
    }
  }
});

test('toSvgString builds a standalone stroked SVG with every path', () => {
  const t = TEMPLATES[0];
  const svg = toSvgString(t, { stroke: '#123456', strokeWidth: 7, background: '#FFFFFF' });
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes(`viewBox="${t.viewBox}"`));
  assert.ok(svg.includes('stroke="#123456"'));
  assert.ok(svg.includes('stroke-width="7"'));
  assert.ok(svg.includes('fill="none"'));
  assert.ok(svg.includes('<rect width="100%" height="100%" fill="#FFFFFF"/>'));
  assert.ok(svg.trimEnd().endsWith('</svg>'));
  for (const tpl of TEMPLATES) {
    const doc = toSvgString(tpl);
    assert.ok(doc.includes('xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(!doc.includes('<rect'), 'no background by default');
    for (const d of tpl.paths) assert.ok(doc.includes(`<path d="${d}"/>`), `${tpl.id}: path missing`);
    assert.equal((doc.match(/<path /g) ?? []).length, tpl.paths.length + (tpl.detail?.length ?? 0));
  }
});

test('toSvgString escapes attribute and title text', () => {
  const t: Template = { id: 'x', name: 'A & <B>', category: 'shapes', viewBox: '0 0 10 10', paths: ['M 0 0 L 10 10'] };
  const svg = toSvgString(t, { stroke: '"red"' });
  assert.ok(svg.includes('<title>A &amp; &lt;B&gt;</title>'));
  assert.ok(svg.includes('stroke="&quot;red&quot;"'));
});

// T128 (fb-1023b): review SVGs are exported on demand and no longer committed for new templates (bundle headroom).
// Any SVG present must match its template exactly, and none may be stray.
test('assets/templates/<id>.svg, where present, matches toSvgString; no stray files', () => {
  const ids = new Set(TEMPLATES.map((t) => t.id));
  for (const t of TEMPLATES) {
    const file = join(ASSETS, `${t.id}.svg`);
    if (!existsSync(file)) continue;
    assert.equal(readFileSync(file, 'utf8'), toSvgString(t), `${t.id}.svg is stale — re-export`);
  }
  const files = readdirSync(ASSETS).filter((f) => f.endsWith('.svg'));
  assert.deepEqual(files.filter((f) => !ids.has(f.slice(0, -4))), [], 'no stray SVG files');
});

// docs/TEMPLATE_BUDGET.md (fb-1022b): base app targets ~600 templates; 6 MB of SVG ≈ 900 at today's average.
test('bundled art stays within budget (per template and < 6 MB total)', () => {
  const bytes = TEMPLATES.reduce((sum, t) => sum + Buffer.byteLength(toSvgString(t)), 0);
  assert.ok(bytes < 6 * 1024 * 1024, `${bytes} bytes`);
  for (const t of TEMPLATES) {
    const all = [...t.paths, ...(t.detail ?? [])];
    assert.ok(all.length <= 300, `${t.id}: ${all.length} paths`);
    assert.ok(all.join('').length <= 30000, `${t.id}: ${all.join('').length} chars`);
  }
});

test('parseCategory accepts labels or ids and falls back to All', () => {
  assert.equal(parseCategory('Animals'), 'animals');
  assert.equal(parseCategory('mandalas'), 'mandalas');
  assert.equal(parseCategory(['Faces']), 'faces');
  assert.equal(parseCategory('dragons'), null);
  assert.equal(parseCategory(undefined), null);
});

test('no template name or id mentions a competitor', () => {
  const banned = ['ar drawing', 'artrace', 'pictrace', 'sketchar'];
  for (const t of TEMPLATES) {
    const hay = `${t.name} ${t.id.replace(/-/g, ' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
  for (const c of CATEGORIES) {
    for (const b of banned) assert.ok(!c.label.toLowerCase().includes(b));
  }
});
