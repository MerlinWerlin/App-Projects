// Read the actual archives through the same catalog/tar/POI parsers the phone uses. No network needed.
// T166: a city whose catalog entry has `dark` also gets its <id>-dark.tar checked the way the phone installs it
// (darkPackEntryPath / darkPackMetaOk): size, hash, every tile present at 256*ratio px, and a darker downtown preview.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { MAPS_RELEASE, darkPackEntryPath, darkPackMetaOk, latToTileY, lonToTileX, packEntryPath, parseCatalog, parsePackMeta, tileCountEstimate } from '../../src/core/citymaps.ts';
import { BLOCK, nextHeaderOffset, parseTarHeader } from '../../src/core/tar.ts';
import { parsePackPoiFile } from '../../src/core/packpois.ts';

const out = resolve(process.argv[2] || 'out');
const ratio = Number(process.argv[3] || 2);
assert.ok(ratio === 1 || ratio === 2);
const config = JSON.parse(readFileSync(new URL('cities.json', import.meta.url), 'utf8'));
const raw = JSON.parse(readFileSync(join(out, 'catalog.json'), 'utf8'));
const catalog = parseCatalog(raw);
assert.ok(catalog);
assert.equal(catalog.release, MAPS_RELEASE);
assert.equal(catalog.cities.length, config.cities.length, 'all configured cities must be built');
assert.deepEqual(catalog.cities.map((city) => city.id).sort(), config.cities.map((city) => city.id).sort());
const results = [];

/** Reads one tar like the phone does: every entry must be one it keeps, no duplicates, nothing truncated. */
function readPack(file, bytes, sha256) {
  const tar = readFileSync(join(out, file));
  assert.equal(tar.length, bytes, `${file} size`);
  assert.equal(createHash('sha256').update(tar).digest('hex'), sha256, `${file} sha256`);
  const files = new Map();
  let offset = 0;
  while (offset + BLOCK <= tar.length) {
    const h = parseTarHeader(tar.subarray(offset, offset + BLOCK));
    if (h === 'end') break;
    assert.equal(typeof h, 'object', 'invalid tar header');
    assert.equal(h.type, 'file');
    assert.ok(offset + BLOCK + h.size <= tar.length, 'truncated tar entry');
    const path = packEntryPath(h.name);
    assert.ok(path, `phone would skip ${h.name}`);
    assert.ok(!files.has(path), `duplicate entry ${path}`);
    files.set(path, tar.subarray(offset + BLOCK, offset + BLOCK + h.size));
    offset = nextHeaderOffset(offset, h.size);
  }
  return files;
}

/** Every tile of the city's bbox is there, as a PNG of 256*ratio px; returns the tile count. */
async function checkTiles(city, files) {
  const tiles = [...files.keys()].filter((path) => path.endsWith('.png'));
  for (let z = city.minzoom; z <= city.maxzoom; z++) {
    for (let x = lonToTileX(city.bbox[0], z); x <= lonToTileX(city.bbox[2], z); x++) {
      for (let y = latToTileY(city.bbox[3], z); y <= latToTileY(city.bbox[1], z); y++) {
        assert.ok(files.has(`tiles/${z}/${x}/${y}.png`), `missing map tile ${z}/${x}/${y}`);
      }
    }
  }
  for (const path of tiles) {
    const image = await sharp(files.get(path)).metadata();
    assert.equal(image.format, 'png');
    assert.equal(image.width, 256 * ratio);
    assert.equal(image.height, 256 * ratio);
  }
  return tiles.length;
}

/** A downtown 3x3 mosaic makes streets, labels and tile alignment reviewable, independent of Apple Maps. */
async function preview(city, files, name) {
  const z = 14;
  const x = lonToTileX(city.center[0], z);
  const y = latToTileY(city.center[1], z);
  const images = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const tile = files.get(`tiles/${z}/${x + dx}/${y + dy}.png`);
    if (tile) images.push({ input: tile, left: (dx + 1) * 256 * ratio, top: (dy + 1) * 256 * ratio });
  }
  assert.ok(images.length >= 4);
  const png = await sharp({ create: { width: 768 * ratio, height: 768 * ratio, channels: 4, background: '#eeeeee' } })
    .composite(images).resize(768, 768).png().toBuffer();
  const stats = await sharp(png).stats();
  assert.ok(stats.channels.slice(0, 3).some((channel) => channel.stdev > 10), 'rendered map must not be blank');
  writeFileSync(join(out, name), png);
  return stats.channels.slice(0, 3).reduce((sum, c) => sum + c.mean, 0) / 3;
}

for (const city of catalog.cities) {
  const cfg = config.cities.find((c) => c.id === city.id);
  assert.ok(cfg, `unexpected city ${city.id}`);
  assert.deepEqual(city.bbox, cfg.bbox);
  const rawCity = raw.cities.find((c) => c && c.id === city.id);
  assert.ok(!rawCity?.dark || city.dark, `${city.id}: the phone would drop this dark entry`);
  const files = readPack(city.file, city.bytes, city.sha256);
  const meta = parsePackMeta(JSON.parse(files.get('meta.json').toString('utf8')), city);
  assert.ok(meta, 'phone must accept the unpacked metadata');
  assert.equal(meta.tiles, tileCountEstimate(city.bbox, city.minzoom, city.maxzoom));
  const parsedPois = parsePackPoiFile(files.get('pois.json').toString('utf8'));
  assert.ok(parsedPois.ok, 'phone must accept the city places');
  const pois = parsedPois.pois;
  assert.ok(pois.length > 0, 'real city must contain usable places');
  assert.equal(parsedPois.truncated, false, 'phone must be able to read all places');
  const tiles = await checkTiles(city, files);
  assert.equal(tiles, meta.tiles);
  const lightMean = await preview(city, files, `${city.id}-preview.png`);
  const result = { city: city.id, bytes: city.bytes, sha256: city.sha256, tiles, usablePlaces: pois.length, preview: `${city.id}-preview.png` };
  if (city.dark) {
    assert.ok(city.dark.sha256, `${city.id}: dark pack needs a sha256`);
    const darkFiles = readPack(city.dark.file, city.dark.bytes, city.dark.sha256);
    // what the phone keeps from a dark pack (meta.json + tiles), and its meta must say dark and this city
    for (const path of darkFiles.keys()) assert.ok(path === 'pois.json' || darkPackEntryPath(path), `phone would skip ${path} in ${city.dark.file}`);
    assert.ok(darkPackMetaOk(JSON.parse(darkFiles.get('meta.json').toString('utf8')), city.id), `${city.dark.file}: meta.json must be flavor dark for ${city.id}`);
    const darkTiles = await checkTiles(city, darkFiles);
    assert.equal(darkTiles, tiles, 'dark pack has the same tiles as the light one');
    assert.equal(city.dark.tiles, darkTiles);
    const darkMean = await preview(city, darkFiles, `${city.id}-dark-preview.png`);
    assert.ok(darkMean < lightMean - 40, `${city.id}: dark preview (mean ${darkMean.toFixed(0)}) must be clearly darker than light (${lightMean.toFixed(0)})`);
    result.dark = { bytes: city.dark.bytes, sha256: city.dark.sha256, tiles: darkTiles, meanBrightness: Math.round(darkMean), lightMeanBrightness: Math.round(lightMean), preview: `${city.id}-dark-preview.png` };
  }
  results.push(result);
}
writeFileSync(join(out, 'verification.json'), JSON.stringify({ release: MAPS_RELEASE, verified: true, cities: results }, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
