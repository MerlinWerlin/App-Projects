// Offline UI sanity check for when node_modules can't be installed (registry unreachable).
// 1) Parses every .ts/.tsx under app/ and src/ and reports syntax errors.
// 2) Checks every relative import resolves to a file and every named import is exported by it.
// 3) Hermes Intl gaps. 4) Touchables have accessibilityLabel/Role (+ State for tab/radio/switch/checkbox).
// 5) No raw colours on the themed (non-camera) screens.
// 7-12) T160 release pass: TextInput / Switch labels, touch targets, images / SVGs named or hidden, header text that
//    clips under Dynamic Type, developer wording in the English catalogue, and Reduce Motion around every animation.
// 13) T164: one-line text inside a touchable must shrink to fit (adjustsFontSizeToFit) or wrap.
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

// 7) T160: every TextInput / Switch names itself (VoiceOver reads the label, not the placeholder).
const LABELLED_INPUTS = new Set(['TextInput', 'Switch']);
// 8) T160 touch targets: a raw Pressable / Touchable* needs hitSlop, a minHeight, or flex: 1 (a full-screen scrim);
//    PressableScale already gives minHeight TOUCH + hitSlop 8, so its style must not shrink that below 48 pt.
// 9) T160: an <Image> / <Svg> carries its own label or hiding, or sits inside an element that does (or a touchable,
//    which VoiceOver reads as one element). Checked lexically within a file.
// 10) T160 Dynamic Type: a header with numberOfLines must shrink to fit (adjustsFontSizeToFit), never clip.
// 13) T164 Dynamic Type: a <Text numberOfLines={1}> inside a touchable (a button / row / control, lexically in the same
//    file) must shrink to fit (adjustsFontSizeToFit), or drop / raise numberOfLines and wrap. At the largest text
//    sizes a one-line cap would cut the control's name or number off with an ellipsis.
const COVERING = ['accessibilityLabel', 'accessible', 'accessibilityElementsHidden', 'importantForAccessibility', 'aria-label', 'aria-hidden'];
for (const [f, sf] of parsed) {
  if (!f.endsWith('.tsx')) continue;
  const rel = f.replace(root + '/', '');
  const opening = (n) => (ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null);
  const attrOf = (o, name) => o.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === name);
  const spreads = (o) => o.attributes.properties.some((p) => ts.isJsxSpreadAttribute(p));
  const report = (o, msg) => {
    const { line } = sf.getLineAndCharacterOfPosition(o.getStart(sf));
    console.log(`${msg[0]} ${rel}:${line + 1} ${msg[1]}`);
    problems++;
  };
  const visit = (n, covered, inControl) => {
    const o = opening(n);
    let cov = covered;
    let ctl = inControl;
    if (o) {
      const tag = o.tagName.getText(sf);
      const touchable = TOUCHABLES.has(tag);
      if (LABELLED_INPUTS.has(tag) && !spreads(o) && !attrOf(o, 'accessibilityLabel')) report(o, ['A11Y', `<${tag}> has no accessibilityLabel`]);
      if (touchable && !spreads(o)) {
        const style = attrOf(o, 'style')?.getText(sf) ?? '';
        if (tag !== 'PressableScale' && !attrOf(o, 'hitSlop') && !/\bminHeight\s*:|\bflex\s*:\s*1\b/.test(style)) report(o, ['TOUCH', `<${tag}> needs hitSlop or minHeight (48 pt targets)`]);
        if (tag === 'PressableScale') {
          for (const m of style.matchAll(/\b(minHeight|height)\s*:\s*(\d+)\b/g)) if (Number(m[2]) < 48) report(o, ['TOUCH', `<${tag}> ${m[1]} ${m[2]} is under 48 pt`]);
        }
      }
      if ((tag === 'Image' || tag === 'Svg') && !covered && !COVERING.some((a) => attrOf(o, a))) report(o, ['A11Y', `<${tag}> needs a label, or accessibilityElementsHidden + importantForAccessibility="no-hide-descendants"`]);
      if (tag === 'Text' && /['"]header['"]/.test(attrOf(o, 'accessibilityRole')?.getText(sf) ?? '') && attrOf(o, 'numberOfLines') && !attrOf(o, 'adjustsFontSizeToFit'))
        report(o, ['TYPE', 'header clips with numberOfLines; drop it or add adjustsFontSizeToFit']);
      if (tag === 'Text' && inControl && /^\{\s*1\s*\}$/.test(attrOf(o, 'numberOfLines')?.initializer?.getText(sf) ?? '') && !attrOf(o, 'adjustsFontSizeToFit'))
        report(o, ['TYPE', 'one-line text inside a control clips at large text sizes; add adjustsFontSizeToFit + minimumFontScale, or let it wrap']);
      cov = covered || touchable || COVERING.some((a) => attrOf(o, a));
      ctl = inControl || touchable;
    }
    ts.forEachChild(n, (k) => visit(k, cov, ctl));
  };
  visit(sf, false, false);
}

// 11) T160: no developer wording in what the user reads. Checks the string values of the English catalogue.
const DEV_WORDS = /\b(Expo Go|full build|dev(elopment)? build|this build|test build|TODO|FIXME|lorem ipsum|placeholder text|simulator|debug)\b/i;
for (const f of files) {
  const rel = f.replace(root + '/', '');
  if (!/^src\/i18n\/(en\/[^/]+|en)\.ts$/.test(rel)) continue;
  const sf = parsed.get(f);
  const visit = (n) => {
    if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer)) && DEV_WORDS.test(n.initializer.text)) {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      console.log(`COPY ${rel}:${line + 1} developer wording in a UI string: ${n.initializer.text.match(DEV_WORDS)[0]}`);
      problems++;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// 12) T160 motion: springs are banned by src/theme/motion.test.ts; here, any file that animates must read Reduce Motion.
const ANIMATES = /\bAnimated\s*\.\s*(timing|sequence|parallel|loop|decay)\s*\(|\b(timed|fadeIn|fadeOut|useFadeRise|useFocusEntrance)\s*\(|\bLayoutAnimation\s*\.\s*configureNext\b|\bwith(Timing|Repeat|Sequence)\s*\(/;
for (const f of files) {
  const rel = f.replace(root + '/', '');
  if (!f.endsWith('.tsx') || /\.test\.tsx?$/.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  const code = text.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  if (ANIMATES.test(code) && !/reduceMotion|ReduceMotion|useReducedMotion/.test(code)) {
    console.log(`MOTION ${rel} animates without reading Reduce Motion (useApp().reduceMotion)`);
    problems++;
  }
}

console.log(`ui-check: ${files.length} files, ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
