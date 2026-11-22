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
  themes.push({ id, designs: ['battery', 'calendar'].map(kind => designedWidget(theme, kind)), source: 'candidate' });
}
const tags = svg => [...svg.matchAll(/<text\b[^>]*>[^<]*<\/text>/g)].map(m => m[0]);
const attr = (tag, key) => tag.match(new RegExp(` ${key}="([^"]+)"`))?.[1];
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
let batteryCases = 0, calendarCases = 0, pointSizeEqualityCases = 0; const records = [], nativeContours = new Map(), calendarFontSizes = new Set();
const readings = { date: new Date(2026, 9, 22, 10, 8), battery: 73, locale: 'en-AU' };
// Every published/bundled/candidate theme, every widget size and both one-/two-digit dates.
// The highlighted label must use precisely the ordinary grid point size, in bold.
for (const theme of themes) {
  const calendar = theme.designs.find(d => d.kind === 'calendar'); assert.ok(calendar, theme.id);
  for (const size of ['small', 'medium', 'large']) for (const day of [1, 22, 30]) {
    const svg = designedWidgetSvg(calendar, size, { ...readings, date: new Date(2026, 9, day) });
    const labels = tags(svg);
    const today = labels.filter(t => attr(t, 'font-weight') === '700' && t.endsWith(`>${day}</text>`)).at(-1); assert.ok(today, `${theme.id}/${size}/${day}`);
    const ordinary = labels.find(t => attr(t, 'font-weight') === '550' && /^\d{1,2}$/.test(t.match(/>([^<]+)</)?.[1] ?? '')); assert.ok(ordinary);
    const nominal = size === 'large' ? 19 : 12;
    assert.equal(Number(attr(today, 'font-size')), nominal, `${theme.id}/${size}/${day}: today shrank`);
    assert.equal(attr(today, 'font-size'), attr(ordinary, 'font-size'), `${theme.id}/${size}/${day}: today differs from ordinary dates`);
    calendarFontSizes.add(nominal); pointSizeEqualityCases++;
  }
}
for (const theme of themes.filter(t => t.designs.some(d => d.font === 'serif'))) {
  const battery = theme.designs.find(d => d.kind === 'battery'), calendar = theme.designs.find(d => d.kind === 'calendar');
  assert.ok(battery?.identity && calendar?.identity, theme.id);
  nativeContours.set(calendar.identity.outline, { id: theme.id, outline: calendar.identity.outline, points: calendar.identity.outline.match(/-?(?:\d+\.?\d*|\.\d+)/g).map(Number) });
  for (const level of [0, 73, 100]) {
    const svg = designedWidgetSvg(battery, 'medium', { ...readings, battery: level });
    const tag = tags(svg).find(t => t.endsWith(`>${level}%</text>`)); assert.ok(tag, theme.id);
    const b = await bounds(tag, 364, 170);
    // Basin is the highest horizontal gauge, starting at y=98 with a .6pt stroke.
    // Column gauges are beside the number; checking the same exclusion still protects it.
    assert.ok(b[3] <= 95.7, `${theme.id}/${level}: percentage reaches ${b[3]}, less than 2pt clear of the gauge`);
    assert.ok(b[1] >= 20 && b[0] >= 155 && b[2] <= 346, `${theme.id}/${level}: number left its original value area`);
    records.push({ id: theme.id, level, bounds: b }); batteryCases++;
    if (['c-electron-mossbank', 'flutecut-woodland', 'raspnest-heath', 'amber-archive'].includes(theme.id)) writeFileSync(join(output, `${theme.id}-battery-${level}.svg`), svg);
  }
  // Every real day, including old-style ascenders and descenders, in the small today marker.
  for (let day = 1; day <= 31; day++) {
    const svg = designedWidgetSvg(calendar, 'small', { ...readings, date: new Date(2026, 9, day) });
    const tag = tags(svg).filter(t => attr(t, 'fill') === calendar.onAccent && attr(t, 'font-weight') === '700' && t.endsWith(`>${day}</text>`)).at(-1); assert.ok(tag, theme.id);
    assert.equal(Number(attr(tag, 'font-size')), 12, `${theme.id}/${day}: keep the ordinary date size`);
    calendarFontSizes.add(Number(attr(tag, 'font-size')));
    const marker = [...svg.matchAll(/<path\b[^>]*\/>/g)].map(m => m[0]).find(p => attr(p, 'fill') === calendar.accent && /scale\(0\.18 0\.18\)/.test(p)); assert.ok(marker, theme.id);
    const [mx, my] = marker.match(/translate\(([^ ]+) ([^)]+)\)/).slice(1).map(Number);
    const b = await bounds(tag, 170, 170), cx = mx + 9, cy = my + 9;
    assert.ok(b[0] > mx + 1 && b[2] < mx + 17 && b[1] > my + 1 && b[3] < my + 17, `${theme.id}/${day}: day outside its marker box`);
    assert.ok(Math.abs((b[1] + b[3]) / 2 - cy) <= 1.6, `${theme.id}/${day}: day sits low/high in the marker`);
    assert.ok(Math.abs((b[0] + b[2]) / 2 - cx) <= 1, `${theme.id}/${day}: day not centred horizontally`);
    calendarCases++;
    if (day === 22 && ['c-electron-mossbank', 'flutecut-woodland', 'raspnest-heath', 'amber-archive'].includes(theme.id)) writeFileSync(join(output, `${theme.id}-calendar-small.svg`), svg);
  }
}
const result = { serifThemes: batteryCases / 3, existingSerifThemes: themes.filter(t => t.source === 'existing' && t.designs.some(d => d.font === 'serif')).length, candidateSerifThemes: themes.filter(t => t.source === 'candidate' && t.designs.some(d => d.font === 'serif')).length, batteryCases, calendarCases, pointSizeEqualityThemes: themes.length, pointSizeEqualityCases, calendarFontSizes: [...calendarFontSizes].sort((a,b) => a-b), todaySamePointSizeAsOrdinaryDates: true, perPixelContourContainmentEnforced: false, allChecksPassed: true, font: 'Georgia', physicalDeviceTest: false, records };
writeFileSync(join(output, 'native-font-contours.json'), JSON.stringify([...nativeContours.values()], null, 2) + '\n');
writeFileSync(join(output, 'serif-preview-validation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, records: undefined }));
