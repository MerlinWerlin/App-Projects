#!/usr/bin/env node
// Additive local new-theme builds and native identities. No downloads or publication.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildPacks, APP_ROOT } from './build_packs.mjs';
import { parseCatalog, parseRemoteArtManifest } from '../../src/core/packCatalog.ts';
import { readPngHeader, unsupportedPng } from '../../src/core/artPack.ts';
import { FACES, MARKS, HANDS, GAUGES, CALENDARS, WIDGET_IDENTITY_RECIPES } from '../../src/core/widgetIdentityRecipes.ts';
import { IDENTITY_ART } from '../../src/core/widgetIdentityArt.ts';
import { EXTRAORDINARY_ART, EXTRAORDINARY_RECIPES } from '../../src/core/extraordinaryThemeIdentities.ts';
import { identityForTheme, parseWidgetIdentity } from '../../src/core/widgetIdentity.ts';
import { parseWidgetOptions } from '../../src/core/widgetOptions.ts';
import { plannedArtworkOptionIds } from '../../src/core/artworkCoverage.ts';
import { remoteArtTheme } from '../../src/core/remoteCatalog.ts';
import { plannedDesignedWidgets } from '../../src/core/designedWidgetLibrary.ts';
import { parseDesignedWidget } from '../../src/core/designedWidgets.ts';
import { designedWidgetSvg } from '../../src/core/designedWidgetPreview.ts';
import { parseBrowseCategory } from '../../src/core/themeBrowse.ts';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + '\n'); };
export const REGISTRY_FILE = 'src/core/extraordinaryThemeIdentities.ts';

export function validateNewThemeBrowseCategory(category) {
  assert.ok(typeof category === 'string' && category.trim().length > 0, 'new theme needs an explicit browse category');
  const parsed = parseBrowseCategory(category);
  assert.ok(parsed !== 'more' || category.trim().toLowerCase() === 'more', `unsupported browse category: ${category}`);
  return parsed;
}

export function validateNewIdentityPath(path) {
  assert.ok(typeof path === 'string' && path.length <= 2400 && /^M [MLQTCZ0-9 .-]+$/.test(path), 'unsupported native drawing path');
  const tokens = path.match(/[MLQTCZ]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  assert.equal(tokens.join(''), path.replaceAll(' ', ''), 'malformed native drawing number');
  const arity = { M: 2, L: 2, Q: 4, T: 2, C: 6, Z: 0 };
  let index = 0;
  while (index < tokens.length) {
    const command = tokens[index++]; assert.ok(Object.hasOwn(arity, command), 'native drawing command missing');
    const values = [];
    while (index < tokens.length && !Object.hasOwn(arity, tokens[index])) values.push(Number(tokens[index++]));
    assert.ok(values.every((n) => Number.isFinite(n) && n >= -5 && n <= 105), 'native drawing leaves the authored canvas');
    assert.ok(arity[command] === 0 ? values.length === 0 : values.length >= arity[command] && values.length % arity[command] === 0, 'incomplete native drawing command');
  }
}

export function loadExtraordinaryDirections(app = APP_ROOT) {
  const root = join(app, 'theme-sources');
  const themes = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const art = {}, recipes = {}, records = [];
  for (const id of themes) {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(id.length <= 40, `${id}: invalid theme id`);
    const folder = join(root, id), descriptor = json(join(folder, 'native-widget-identity.json'));
    assert.equal(descriptor.themeId ?? descriptor.theme, id, `${id}: descriptor id mismatch`);
    const recipe = descriptor.recipe;
    assert.equal(recipe?.length, 7, `${id}: native recipe requires seven fields`);
    for (const [index, choices] of [[0, FACES], [3, MARKS], [4, HANDS], [5, GAUGES], [6, CALENDARS]]) assert.ok(choices.includes(recipe[index]), `${id}: invalid native recipe field ${index}`);
    for (const key of recipe.slice(1, 3)) assert.ok(Object.hasOwn(descriptor.art, key), `${id}: missing authored identity art ${key}`);
    for (const [key, path] of Object.entries(descriptor.art)) {
      assert.match(key, /^[a-zA-Z][a-zA-Z0-9]*$/);
      assert.ok(!Object.hasOwn(art, key), `${id}: duplicate new illustration key ${key}`);
      assert.ok(!Object.hasOwn(IDENTITY_ART, key) || Object.hasOwn(EXTRAORDINARY_ART, key), `${id}: overwrites an existing illustration`);
      validateNewIdentityPath(path);
      art[key] = path;
    }
    assert.ok(!Object.hasOwn(WIDGET_IDENTITY_RECIPES, id) || Object.hasOwn(EXTRAORDINARY_RECIPES, id), `${id}: overwrites an existing native theme identity`);
    recipes[id] = recipe; records.push({ id, folder, descriptor });
  }
  assert.ok(records.length, 'no new theme source folders');
  return { art, recipes, records };
}

export function extraordinaryRegistrySource(directions) {
  return '// Generated by scripts/packs/extraordinary_themes.mjs --sync-identities.\n' +
    '// Canonical art direction lives in theme-sources/*/native-widget-identity.json.\n' +
    `export const EXTRAORDINARY_ART = ${JSON.stringify(directions.art, null, 2)} as const;\n` +
    `export const EXTRAORDINARY_RECIPES = ${JSON.stringify(directions.recipes, null, 2)} as const;\n`;
}

function checkedFile(folder, file) {
  assert.ok(typeof file === 'string' && !file.includes('\\') && !file.startsWith('/') && !file.includes(':') && file.split('/').every((p) => p && p !== '.' && p !== '..'), 'unsafe new-theme source path');
  return join(folder, file);
}

export function auditExtraordinaryBuild({ app = APP_ROOT, dir }) {
  const directions = loadExtraordinaryDirections(app);
  assert.ok(readFileSync(join(app, REGISTRY_FILE), 'utf8').replaceAll('\r\n', '\n') === extraordinaryRegistrySource(directions), 'run --sync-identities and commit the generated native data');
  const catalog = json(join(dir, 'catalog.json')), parsedCatalog = parseCatalog(catalog);
  assert.ok(parsedCatalog.ok && parsedCatalog.value.packs.length === directions.records.length, 'new-theme catalogue is incomplete');
  const selectedHashes = new Set(), nativeCompositions = new Set(), perTheme = [];
  for (const { id, folder, descriptor } of directions.records) {
    const entry = parsedCatalog.value.packs.find((p) => p.id === id);
    assert.ok(entry, `${id}: absent from candidate catalogue`);
    const browseCategory = validateNewThemeBrowseCategory(json(join(folder, 'meta.json')).category);
    assert.equal(validateNewThemeBrowseCategory(entry.category), browseCategory, `${id}: catalogue browse category differs from source`);
    const m = json(checkedFile(dir, entry.manifest)), parsed = parseRemoteArtManifest(m, id);
    assert.ok(parsed.ok, `${id}: candidate manifest fails the app parser`);
    const options = parseWidgetOptions(m.widgets, m.assets);
    assert.deepEqual(options.errors, [], `${id}: widget options rejected`);
    const ids = plannedArtworkOptionIds(id, options.options);
    assert.equal(ids.length, 5, `${id}: actual app selector must produce five artworks`);
    assert.equal(new Set(ids).size, 5, `${id}: repeated artwork selection`);
    const manifestFolder = dirname(checkedFile(dir, entry.manifest));
    for (const asset of m.assets) {
      const data = readFileSync(checkedFile(manifestFolder, asset.path));
      assert.equal(data.length, asset.bytes, `${id}/${asset.path}: wrong byte length`);
      assert.equal(sha(data), asset.sha256, `${id}/${asset.path}: hash mismatch`);
    }
    const sourceOptions = json(join(folder, 'widgets/widget-options.json'));
    assert.ok(Array.isArray(sourceOptions));
    const provenance = json(join(folder, 'provenance.json'));
    const records = provenance.artworks ?? provenance.assets;
    assert.ok(Array.isArray(records), `${id}: missing prompt provenance records`);
    const selected = sourceOptions.filter((o) => o.kind === 'art');
    assert.equal(selected.length, 5, `${id}: five separately generated art sources required`);
    for (const option of selected) {
      assert.deepEqual(option.sizes, ['small', 'large']);
      assert.equal(option.fit, 'fit'); assert.equal(option.background, 'wallpaper');
      const file = checkedFile(join(folder, 'widgets'), option.image), data = readFileSync(file), digest = sha(data);
      const header = readPngHeader(data);
      assert.ok(header.ok && !unsupportedPng(header.header), `${id}/${option.id}: bad PNG input`);
      assert.ok(header.header.width >= 1024 && header.header.width === header.header.height, `${id}/${option.id}: source must be square and at least 1024px`);
      assert.ok(!selectedHashes.has(digest), `${id}/${option.id}: duplicate artwork bytes`); selectedHashes.add(digest);
      const record = records.find((r) => r.id === option.id);
      assert.ok(record && typeof record.prompt === 'string' && record.prompt.trim().length > 40, `${id}/${option.id}: original prompt missing`);
      assert.equal(record.sha256 ?? record.sourceSha256, digest, `${id}/${option.id}: source provenance hash mismatch`);
      const original = record.source ?? record.sourceImage;
      if (original && !/^(?:[A-Z]:|\/)/i.test(original)) assert.equal(sha(readFileSync(checkedFile(folder, original))), record.sourceSha256, `${id}/${option.id}: retained original does not match`);
    }
    const identity = identityForTheme(id);
    assert.ok(identity && parseWidgetIdentity(identity), `${id}: actual native identity registry did not resolve`);
    assert.equal(identity.subject, descriptor.art[descriptor.recipe[1]]);
    const theme = remoteArtTheme(entry, 'https://example.invalid/glaze-new-themes');
    assert.equal(theme.browseCategory, browseCategory, `${id}: theme falls into the wrong app browse category`);
    const planned = plannedDesignedWidgets(theme, (kind, size) => `${kind} ${size}`);
    assert.equal(planned.length, 9, `${id}: expected Clock/Battery/Calendar at every Home Screen size`);
    for (const piece of planned) {
      const design = piece.live?.design;
      assert.ok(design?.identity && parseDesignedWidget(design), `${id}/${piece.id}: invalid working native design`);
      const values = { date: new Date(2026, 10, 22, 10, 8), battery: 73, locale: 'en-AU' };
      const svg = designedWidgetSvg(design, piece.size, values);
      assert.ok(svg.startsWith('<svg') && !/NaN|undefined/.test(svg));
      const changed = designedWidgetSvg(design, piece.size, { ...values, date: new Date(2027, 1, 3, 7, 41), battery: 14 });
      assert.notEqual(svg, changed, `${id}/${piece.id}: native value does not change`);
      const monochrome = `${piece.size}/${design.kind}/` + svg.replace(/#[0-9a-fA-F]{6}/g, '#808080').replace(/font-family="[^"]*"/g, '');
      assert.ok(!nativeCompositions.has(monochrome), `${id}/${piece.id}: repeats another new theme's native composition`); nativeCompositions.add(monochrome);
      if (design.kind === 'battery') for (const battery of [null, 0, 100]) assert.doesNotMatch(designedWidgetSvg(design, piece.size, { ...values, battery }), /NaN|undefined/);
      const target = join(dir, 'native-review', id, `${design.kind}-${piece.size}.svg`);
      mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, svg);
    }
    perTheme.push({ id, name: m.name, packVersion: m.packVersion, artworks: ids, nativePlans: planned.length, assetBytes: m.totalBytes, nativeIdentity: true });
  }
  const report = { themes: perTheme.length, artworks: perTheme.length * 5, nativePlans: perTheme.length * 9, allChecksPassed: true, catalogueScope: 'new-theme-supplement-only', requiresAppIdentityUpdate: true, published: false, deviceValidated: false, perTheme };
  save(join(dir, 'new-theme-validation.json'), report);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), directions = loadExtraordinaryDirections();
    if (args.includes('--sync-identities')) {
      writeFileSync(join(APP_ROOT, REGISTRY_FILE), extraordinaryRegistrySource(directions));
      console.log(`Synchronized native identities for ${directions.records.length} themes. Run the build in a new process.`);
    } else {
      assert.ok(readFileSync(join(APP_ROOT, REGISTRY_FILE), 'utf8').replaceAll('\r\n', '\n') === extraordinaryRegistrySource(directions), 'run --sync-identities before building new themes');
      const at = args.indexOf('--out'), dir = resolve(at >= 0 ? args[at + 1] : join(APP_ROOT, 'dist/extraordinary-packs'));
      const minAppVersion = json(join(APP_ROOT, 'app.json')).expo.version;
      const result = await buildPacks({ themesDir: join(APP_ROOT, 'theme-sources'), outDir: dir, versionsFile: null, releasesFile: null, plus: new Set(directions.records.map((r) => r.id)), minAppVersion, encoder: 'pillow', log: console.log });
      assert.deepEqual(result.failed, [], 'new-theme pack build failed');
      const report = auditExtraordinaryBuild({ dir });
      console.log(JSON.stringify({ ...report, perTheme: undefined }));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
