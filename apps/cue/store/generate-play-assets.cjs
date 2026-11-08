// Deterministic exports of existing branding and actual Android UI captures.
// Tool dependencies stay outside the app; see store/README.md.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const [modules, captureRoot, captureRun] = process.argv.slice(2);
assert(modules && captureRoot && /^\d+$/.test(captureRun || ''), 'Expected tool modules, capture folder and run ID');
const { Resvg } = require(path.join(path.resolve(modules), '@resvg/resvg-js'));
const opentype = require(path.join(path.resolve(modules), 'opentype.js'));
const { PNG } = require(path.join(path.resolve(modules), 'pngjs'));
const app = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'assets');
fs.mkdirSync(output, { recursive: true });
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const proof = JSON.parse(fs.readFileSync(path.join(captureRoot, 'verification.json'), 'utf8'));
assert.equal(proof.sourceCommit, 'c809ffd86b5e30014e798409c2f5d996ca3a9d0b');
assert.equal(proof.sha256, '7b2205a5920af4fb26d4c05ee6a3a2c01ebaae157d4990a356aa58ee1b3b98ec');
const asset = name => path.join(output, name);
const fontFile = (family, weight, name) => path.join(app, 'node_modules/@expo-google-fonts', family, weight, name);
const titlePath = fontFile('bricolage-grotesque', '700Bold', 'BricolageGrotesque_700Bold.ttf');
const bodyPath = fontFile('atkinson-hyperlegible', '400Regular', 'AtkinsonHyperlegible_400Regular.ttf');
function loadFont(file) {
  const b = fs.readFileSync(file);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
const title = loadFont(titlePath), body = loadFont(bodyPath);
function text(font, words, x, y, size, fill) {
  // These English headlines need no contextual substitutions. Lay out direct
  // font glyphs to avoid opentype's unsupported CCMP table in the Google font.
  assert(/^[\x20-\x7e]+$/.test(words));
  const scale = size / font.unitsPerEm;
  let previous;
  const paths = [];
  for (const character of words) {
    const glyph = font.charToGlyph(character);
    if (previous) x += font.getKerningValue(previous, glyph) * scale;
    paths.push(`<path fill="${fill}" d="${glyph.getPath(x, y, size).toPathData(2)}"/>`);
    x += glyph.advanceWidth * scale;
    previous = glyph;
  }
  return paths.join('');
}
function savePng(name, png, colorType) {
  const bytes = PNG.sync.write(png, { colorType, inputColorType: 6, inputHasAlpha: true, bitDepth: 8 });
  fs.writeFileSync(asset(name), bytes);
  return bytes;
}
function rasterize(svg, name, colorType) {
  return savePng(name, PNG.sync.read(new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng()), colorType);
}
const icon = fs.readFileSync(path.join(app, 'assets/brand/icon.png'));
rasterize(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#10131C"/><image href="data:image/png;base64,${icon.toString('base64')}" width="512" height="512"/></svg>`, 'icon-512.png', 6);
function findFile(root, name) {
  const found = [];
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) walk(file);
      else if (item.name === name) found.push(file);
    }
  }
  walk(root);
  assert.equal(found.length, 1, 'Expected one capture: ' + name);
  return found[0];
}
const screenshots = [];
for (const [number, screen] of [['01', 'library'], ['02', 'editor'], ['03', 'prompter'], ['04', 'settings']]) {
  const source = findFile(path.join(captureRoot, 'captures'), `store-${number}-${screen}.png`);
  const bytes = fs.readFileSync(source), png = PNG.sync.read(bytes);
  assert.equal(png.width, 1080); assert.equal(png.height, 1920);
  for (let i = 3; i < png.data.length; i += 4) assert.equal(png.data[i], 255, 'Capture must be opaque');
  const name = `phone-${number}-${screen}.png`;
  const exported = savePng(name, png, 2);
  assert(PNG.sync.read(exported).data.equals(png.data), 'Screenshot RGB pixels changed');
  screenshots.push({ file: name, sourceFile: path.relative(captureRoot, source), sourceSha256: sha(bytes),
    rgbaPixelSha256: sha(png.data), transform: 'Lossless opaque RGB PNG export; no crop, overlays or UI edits' });
}
const preview = fs.readFileSync(asset('phone-03-prompter.png')).toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
<title>Cue — Your words. Your pace.</title>
<defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#E9CD9D"/><stop offset="1" stop-color="#D7AA63"/></linearGradient><clipPath id="screen"><rect x="690" y="50" width="225" height="400" rx="18"/></clipPath></defs>
<rect width="1024" height="500" fill="url(#gold)"/>
${text(title, 'Cue', 90, 120, 32, '#403222')}
${text(title, 'Your words.', 87, 245, 72, '#10131C')}
${text(title, 'Your pace.', 87, 325, 72, '#10131C')}
${text(body, 'Stay close to the lens.', 92, 392, 27, '#433823')}
<image href="data:image/png;base64,${preview}" x="690" y="50" width="225" height="400" clip-path="url(#screen)"/>
</svg>`;
fs.writeFileSync(asset('feature-1024x500.svg'), svg);
rasterize(svg, 'feature-1024x500.png', 2);
const files = ['icon-512.png', 'feature-1024x500.png', ...screenshots.map(s => s.file)].map(file => {
  const bytes = fs.readFileSync(asset(file));
  const png = PNG.sync.read(bytes);
  assert(bytes.length < 8 * 1024 * 1024);
  if (file === 'icon-512.png') { assert(bytes.length <= 1024 * 1024); assert.equal(bytes[25], 6); }
  else assert.equal(bytes[25], 2);
  return { file, width: png.width, height: png.height, colorType: bytes[25], bytes: bytes.length, sha256: sha(bytes) };
});
fs.writeFileSync(asset('MANIFEST.json'), JSON.stringify({ status: 'draft_not_uploaded_awaiting_visual_review',
  sourceCommit: proof.sourceCommit, apkSha256: proof.sha256,
  captureRun: `https://github.com/MerlinWerlin/App-Projects/actions/runs/${captureRun}`,
  brandIconSha256: sha(icon), titleFontSha256: sha(fs.readFileSync(titlePath)), bodyFontSha256: sha(fs.readFileSync(bodyPath)),
  renderers: { resvg: '2.6.2', opentype: '2.0.0', pngjs: '7.0.0' }, screenshots, files }, null, 2) + '\n');
fs.writeFileSync(asset('README.md'), '# Cue English Google Play listing assets\n\nDraft exports from the existing Cue icon/fonts and actual source-bound Android UI. Open MANIFEST.json for source, capture run, pixel provenance and hashes. Screenshots are opaque RGB exports with unchanged pixels; the feature graphic is composed from vector typography and the captured prompter. These files have not been uploaded. Visual review is recorded separately.\n');
console.log(JSON.stringify(files.map(({ file, width, height, colorType, bytes }) => ({ file, width, height, colorType, bytes })), null, 2));
