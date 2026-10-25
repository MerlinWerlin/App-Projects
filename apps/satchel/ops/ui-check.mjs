// Offline UI sanity check for when node_modules can't be installed (registry unreachable).
// 1) Parses every .ts/.tsx under app/ and src/ and reports syntax errors.
// 2) Checks every relative import resolves to a file and every named import is exported by it.
// 3) Hermes Intl gaps. 4) Touchables have accessibilityLabel/Role (+ State for tab/radio/switch/checkbox).
// 5) No raw colours on the themed (non-camera) screens.
// Usage: node ops/ui-check.mjs   (needs the `typescript` package somewhere: local node_modules or global)
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
let ts;
for (const base of [root, execSync('npm root -g').toString().trim()]) {
  try {
    ts = createRequire(join(base, 'noop.js'))('typescript');
    break;
  } catch {}
  try {
    ts = createRequire(join(base, 'typescript', 'noop.js'))('typescript');
    break;
  } catch {}
}
if (!ts) {
  console.error('typescript not found');
  process.exit(2);
}

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f) && !f.endsWith('.d.ts')) files.push(p);
  }
};
walk(join(root, 'app'));
walk(join(root, 'src'));

const exportsOf = new Map();
const parsed = new Map();
let problems = 0;
for (const f of files) {
  const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  parsed.set(f, sf);
  for (const d of sf.parseDiagnostics) {
    const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    console.log(`SYNTAX ${f.replace(root + '/', '')}:${line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
    problems++;
  }
  const names = new Set();
  sf.forEachChild((n) => {
    const mods = ts.canHaveModifiers(n) ? ts.getModifiers(n) ?? [] : [];
    const exported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefault = mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (exported && isDefault) names.add('default');
    if (exported && n.name && ts.isIdentifier(n.name)) names.add(n.name.text);
    if (exported && ts.isVariableStatement(n)) for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) names.add(d.name.text);
    if (ts.isExportDeclaration(n)) {
      if (n.exportClause && ts.isNamedExports(n.exportClause)) for (const e of n.exportClause.elements) names.add(e.name.text);
      else names.add('*');
    }
    if (ts.isExportAssignment(n)) names.add('default');
  });
  exportsOf.set(f, names);
}

const resolveLocal = (from, spec) => {
  const base = resolve(dirname(from), spec);
  for (const c of [base, base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
};

for (const [f, sf] of parsed) {
  sf.forEachChild((n) => {
    if (!ts.isImportDeclaration(n) || !ts.isStringLiteral(n.moduleSpecifier)) return;
    const spec = n.moduleSpecifier.text;
    if (!spec.startsWith('.')) return;
    const target = resolveLocal(f, spec);
    const rel = f.replace(root + '/', '');
    if (!target) {
      console.log(`IMPORT ${rel}: cannot resolve '${spec}'`);
      problems++;
      return;
    }
    const ex = exportsOf.get(target);
    if (!ex || ex.has('*')) return;
    const clause = n.importClause;
    if (!clause) return;
    if (clause.name && !ex.has('default')) {
      console.log(`IMPORT ${rel}: '${spec}' has no default export`);
      problems++;
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        const name = (el.propertyName ?? el.name).text;
        if (!ex.has(name)) {
          console.log(`IMPORT ${rel}: '${name}' is not exported by '${spec}'`);
          problems++;
        }
      }
    }
  });
}

// 3) fb-1017 F1: Hermes has no Intl.PluralRules / RelativeTimeFormat / ListFormat / Segmenter / DisplayNames.
//    Only guarded helpers (feature-detected constructor + fallback) may touch them; never `new Intl.X(` directly.
const HERMES_MISSING = /\bIntl\s*\.\s*(PluralRules|RelativeTimeFormat|ListFormat|Segmenter|DisplayNames)\s*\(|new\s+Intl\s*\.\s*(PluralRules|RelativeTimeFormat|ListFormat|Segmenter|DisplayNames)\b/;
for (const f of files) {
  if (/\.test\.tsx?$/.test(f)) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (HERMES_MISSING.test(l) && !/^\s*(\/\/|\*)/.test(l)) {
      console.log(`HERMES ${f.replace(root + '/', '')}:${i + 1} calls an Intl API Hermes lacks; use a guarded helper (src/i18n/core.ts)`);
      problems++;
    }
  });
}

// 4) T59 a11y: every raw touchable names itself to screen readers. A Pressable / PressableScale / Touchable* needs
//    accessibilityLabel + accessibilityRole (unless props are spread in from a wrapper that sets them), and a
//    tab / radio / switch / checkbox role needs accessibilityState so the selected / checked state is announced.
const TOUCHABLES = new Set(['Pressable', 'PressableScale', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback']);
for (const [f, sf] of parsed) {
  if (!f.endsWith('.tsx')) continue;
  const rel = f.replace(root + '/', '');
  const visit = (n) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && TOUCHABLES.has(n.tagName.getText(sf))) {
      const props = n.attributes.properties;
      const spread = props.some((p) => ts.isJsxSpreadAttribute(p));
      const attr = (name) => props.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === name);
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      const tag = n.tagName.getText(sf);
      if (!spread) {
        for (const need of ['accessibilityLabel', 'accessibilityRole']) {
          if (!attr(need)) {
            console.log(`A11Y ${rel}:${line + 1} <${tag}> has no ${need}`);
            problems++;
          }
        }
      }
      const role = attr('accessibilityRole')?.initializer?.getText(sf) ?? '';
      if (/['"](tab|radio|switch|checkbox)['"]/.test(role) && !attr('accessibilityState') && !spread) {
        console.log(`A11Y ${rel}:${line + 1} <${tag}> role ${role} needs accessibilityState`);
        problems++;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// 5) T59 dark mode: the themed (non-camera) screens take every colour from src/theme tokens. Camera / Trace /
//    Lightbox / Compare are intentionally dark glass or paper white and are not checked here.
const THEMED = /^(app\/.+|src\/ui\/.+)\.tsx$/; // every Satchel screen; essentials uses the essentials tokens
const RAW_COLOUR = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|['"](white|black)['"]/;
for (const f of files) {
  const rel = f.replace(root + '/', '');
  if (!THEMED.test(rel)) continue;
  readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    if (RAW_COLOUR.test(l) && !/^\s*(\/\/|\*)/.test(l) && !/theme-colour-ok/.test(l)) {
      console.log(`COLOUR ${rel}:${i + 1} hard-coded colour on a themed screen; use a src/theme token`);
      problems++;
    }
  });
}

// 6) T95: the camera controls take every translucent colour from cameraGlass (src/core/cameraGlass.ts), not raw rgba().
const CAMERA_CONTROLS = /^$a/; // Satchel has no camera screens; every screen takes colours from tokens
for (const f of files) {
  const rel = f.replace(root + '/', '');
  if (!CAMERA_CONTROLS.test(rel)) continue;
  readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    if (/\brgba?\(/.test(l) && !/^\s*(\/\/|\*)/.test(l)) {
      console.log(`COLOUR ${rel}:${i + 1} raw rgba() in a camera control; use a cameraGlass token`);
      problems++;
    }
  });
}

console.log(`ui-check: ${files.length} files, ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
