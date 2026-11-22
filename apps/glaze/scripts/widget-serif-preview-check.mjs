// Pixel regression for Georgia, including existing themes and every candidate source.
// The macOS CI runner supplies Georgia; local Windows review uses the same installed font.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { APP_ROOT } from './packs/build_packs.mjs';
import { loadExtraordinaryDirections } from './packs/extraordinary_themes.mjs';
import { designedWidget, withWidgetIdentity } from '../src/core/designedWidgets.ts';
import { designedWidgetSvg } from '../src/core/designedWidgetPreview.ts';
import { remoteArtTheme } from '../src/core/remoteCatalog.ts';

const sharp = createRequire(resolve(process.env.GLAZE_RENDER_MODULES, 'package.json'))('sharp');
assert.ok(['C:/Windows/Fonts/georgia.ttf', '/System/Library/Fonts/Supplemental/Georgia.ttf', '/Library/Fonts/Georgia.ttf'].some(existsSync), 'Install Georgia: a fallback serif font cannot validate its old-style numerals');
const output = resolve(process.argv[2]); mkdirSync(output, { recursive: true });
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const themes = json(join(APP_ROOT, 'docs/designed-widget-fixtures.json')).themes.map(t => ({
  id: t.id, designs: t.designs.map(d => withWidgetIdentity(t.id, d)), source: 'existing',
}));
for (const { id, folder } of loadExtraordinaryDirections().records) {
  const meta = json(join(folder, 'meta.json')), palette = json(join(folder, 'palette.json'));
  const theme = remoteArtTheme({ ...meta, id, name: meta.name, palette, tags: meta.tags ?? [], packVersion: 1, plus: true, bytes: 1, manifest: `art/${id}/v1/manifest.json`, thumb: `art/${id}/v1/thumb.0000abcd.webp`, thumbhash: 'AbCd' }, null);
  themes.push({ id, designs: ['battery'].map(kind => designedWidget(theme, kind)), source: 'candidate' });
}
const tags = svg => [...svg.matchAll(/<text\b[^>]*>[^<]*<\/text>/g)].map(m => m[0]);
const measured = new Map();
async function bounds(tag, w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g font-family="Georgia,serif">${tag.replace(/fill="[^"]+"/, 'fill="#FFFFFF"')}</g></svg>`;
  if (measured.has(svg)) return measured.get(svg);
  const { data, info } = await sharp(Buffer.from(svg)).resize({ width: w * 4 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] >= 16) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  assert.ok(x1 >= x0 && y1 >= y0, 'text must really render');
  const scale = info.width / w;
  const result = [x0 / scale, y0 / scale, (x1 + 1) / scale, (y1 + 1) / scale];
  measured.set(svg, result); return result;
}
let batteryCases = 0; const records = [];
const readings = { date: new Date(2026, 9, 22, 10, 8), battery: 73, locale: 'en-AU' };
for (const theme of themes.filter(t => t.designs.some(d => d.font === 'serif'))) {
  const battery = theme.designs.find(d => d.kind === 'battery');
  assert.ok(battery?.identity, theme.id);
  for (const level of [0, 73, 100]) {
    const svg = designedWidgetSvg(battery, 'medium', { ...readings, battery: level });
    const tag = tags(svg).find(t => t.endsWith(`>${level}%</text>`)); assert.ok(tag, theme.id);
    const b = await bounds(tag, 364, 170);
    // The highest horizontal gauge starts at y=98 with a .6pt stroke.
    // Column gauges are beside the number; the same exclusion protects its area.
    assert.ok(b[3] <= 95.7, `${theme.id}/${level}: percentage reaches ${b[3]}, less than 2pt clear of the gauge`);
    assert.ok(b[1] >= 20 && b[0] >= 155 && b[2] <= 346, `${theme.id}/${level}: number left its original value area`);
    records.push({ id: theme.id, level, bounds: b }); batteryCases++;
    if (['c-electron-mossbank', 'flutecut-woodland', 'raspnest-heath', 'amber-archive'].includes(theme.id)) writeFileSync(join(output, `${theme.id}-battery-${level}.svg`), svg);
  }
}
const result = { serifThemes: batteryCases / 3, existingSerifThemes: themes.filter(t => t.source === 'existing' && t.designs.some(d => d.font === 'serif')).length, candidateSerifThemes: themes.filter(t => t.source === 'candidate' && t.designs.some(d => d.font === 'serif')).length, batteryCases, allChecksPassed: true, font: 'Georgia', physicalDeviceTest: false, records };
writeFileSync(join(output, 'serif-preview-validation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, records: undefined }));
