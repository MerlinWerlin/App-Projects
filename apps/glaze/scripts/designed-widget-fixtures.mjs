// Export the ACTUAL bundled + current downloaded catalogue palettes, never hand-picked examples.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ALL_THEMES } from '../src/core/plusThemes.ts';
import { ART_PACK_THEMES } from '../src/core/artPackThemes.ts';
import { parseCatalog } from '../src/core/packCatalog.ts';
import { remoteArtTheme } from '../src/core/remoteCatalog.ts';
import { DESIGNED_KINDS, designedWidget } from '../src/core/designedWidgets.ts';
import { minContrast } from '../src/core/colour.ts';
const path = process.argv[2];
if (!path) throw Error('Usage: node scripts/designed-widget-fixtures.mjs <current catalog.json>');
const source = readFileSync(path), parsed = parseCatalog(JSON.parse(source));
if (!parsed.ok) throw Error(parsed.error);
const unique = new Map();
for (const theme of [...ALL_THEMES, ...ART_PACK_THEMES, ...parsed.value.packs.map(p => remoteArtTheme(p, null))]) {
  if (!unique.has(theme.id)) unique.set(theme.id, theme);
}
const themes = [...unique.values()].map(theme => ({
  id: theme.id, name: theme.name, palette: theme.palette,
  designs: DESIGNED_KINDS.map(kind => designedWidget(theme, kind)),
}));
for (const t of themes) for (const d of t.designs) {
  for (const key of ['ink', 'secondary']) if (minContrast(d[key], d.background) < 4.5) throw Error(`${t.id} ${key} contrast`);
  if (minContrast(d.accent, d.background) < 3 || minContrast(d.onAccent, [d.accent]) < 4.5) throw Error(`${t.id} accent contrast`);
}
const data = { schema: 'GLAZE_DESIGNED_WIDGETS_V1', catalogueSHA256: createHash('sha256').update(source).digest('hex'),
  catalogueThemes: parsed.value.packs.length, themes: themes.sort((a,b) => a.id.localeCompare(b.id)) };
writeFileSync('docs/designed-widget-fixtures.json', JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({ catalogueThemes: data.catalogueThemes, totalThemes: themes.length, designs: themes.length * 3, sizeLayouts: themes.length * 9 }));
