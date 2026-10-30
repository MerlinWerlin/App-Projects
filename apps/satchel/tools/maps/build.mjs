// Builds Satchel's offline city map packs in GitHub Actions (see ops/github/satchel-maps-publish.yml).
// For each city in cities.json:
//   1. cut the city bbox out of the latest Protomaps OpenStreetMap build with `pmtiles extract` (range requests),
//   2. render 256-pt raster tiles (PNG, @2x by default) z=minzoom..maxzoom with MapLibre Native and the
//      Protomaps basemap style (BSD-3), with a gutter that is cropped away so labels aren't cut mid-tile,
//   3. fetch toilets and the map POI categories for the bbox from the Overpass API (OSM, ODbL),
//   4. write meta.json, pois.json and tiles/{z}/{x}/{y}.png and pack them as an uncompressed ustar <id>.tar.
// Then writes out/catalog.json (upload it LAST). Contract: docs/MAP_PACKS.md and src/core/citymaps.ts.
//
// Usage: node build.mjs [--only kyoto] [--ratio 2] [--out out] [--pmtiles <url or file>]
// Needs: the `pmtiles` CLI on PATH (go-pmtiles), xvfb on Linux (run under xvfb-run), npm deps in package.json.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import mbgl from '@maplibre/maplibre-gl-native';
import { layers, namedFlavor } from '@protomaps/basemaps';
import { PMTiles } from 'pmtiles';
import sharp from 'sharp';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? '']] : acc), []),
);
const here = resolve(new URL('.', import.meta.url).pathname);
const cfg = JSON.parse(readFileSync(join(here, 'cities.json'), 'utf8'));
const OUT = resolve(args.out || join(here, 'out'));
const RATIO = Number(args.ratio || 2);
const GUTTER = 64; // points rendered around each tile, cropped away
const BUILT = new Date().toISOString().slice(0, 10);
const UA = 'SatchelMapPacks/1 (+https://github.com/MerlinWerlin/App-Projects)';
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- source build
async function latestBuildUrl() {
  if (args.pmtiles) return args.pmtiles;
  try {
    const r = await fetch('https://build-metadata.protomaps.dev/builds.json', { headers: { 'User-Agent': UA } });
    const builds = await r.json();
    const keys = builds.map((b) => b.key).filter((k) => /^\d{8}\.pmtiles$/.test(k)).sort();
    if (keys.length) return `https://build.protomaps.com/${keys[keys.length - 1]}`;
  } catch (e) {
    console.warn('builds.json unavailable, probing recent dates', e.message);
  }
  for (let d = 0; d < 14; d++) {
    const day = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10).replaceAll('-', '');
    const url = `https://build.protomaps.com/${day}.pmtiles`;
    const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } }).catch(() => null);
    if (r && r.ok) return url;
  }
  throw new Error('no Protomaps build found');
}

class FileSource {
  constructor(path) {
    this.path = path;
    this.fd = openSync(path, 'r');
  }
  getKey() {
    return this.path;
  }
  async getBytes(offset, length) {
    const buf = Buffer.alloc(length);
    const n = readSync(this.fd, buf, 0, length, offset);
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + n) };
  }
  close() {
    closeSync(this.fd);
  }
}

// ---------------------------------------------------------------- tile maths
const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180;
const y2lat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};
function tilesFor(bbox, z) {
  const [w, s, e, n] = bbox;
  const out = [];
  for (let x = lon2x(w, z); x <= lon2x(e, z); x++) for (let y = lat2y(n, z); y <= lat2y(s, z); y++) out.push([z, x, y]);
  return out;
}

// ---------------------------------------------------------------- rendering
function makeRenderer(pm) {
  const style = {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: { protomaps: { type: 'vector', tiles: ['pmt://{z}/{x}/{y}'], maxzoom: 15, attribution: cfg.attribution } },
    layers: layers('protomaps', namedFlavor('light'), { lang: 'en' }),
  };
  const map = new mbgl.Map({
    ratio: RATIO,
    request: (req, cb) => {
      const m = /^pmt:\/\/(\d+)\/(\d+)\/(\d+)/.exec(req.url);
      if (m) {
        pm.getZxy(+m[1], +m[2], +m[3])
          .then((t) => cb(null, t ? { data: Buffer.from(t.data) } : {}))
          .catch((e) => cb(e));
        return;
      }
      fetch(req.url, { headers: { 'User-Agent': UA } })
        .then(async (r) => (r.ok ? cb(null, { data: Buffer.from(await r.arrayBuffer()) }) : cb(null, {})))
        .catch((e) => cb(e));
    },
  });
  map.load(style);
  const size = 256 + 2 * GUTTER;
  return {
    render: (z, x, y) =>
      new Promise((res, rej) => {
        const center = [x2lon(x + 0.5, z), y2lat(y + 0.5, z)];
        map.render({ zoom: Math.max(0, z - 1), center, width: size, height: size }, (err, buf) => {
          if (err) return rej(err);
          sharp(buf, { raw: { width: size * RATIO, height: size * RATIO, channels: 4 } })
            .extract({ left: GUTTER * RATIO, top: GUTTER * RATIO, width: 256 * RATIO, height: 256 * RATIO })
            .png({ compressionLevel: 9, palette: true, quality: 90 })
            .toBuffer()
            .then(res, rej);
        });
      }),
    release: () => map.release(),
  };
}

// ---------------------------------------------------------------- POIs (Overpass)
const POI_TAGS = {
  drinking_water: [['amenity', 'drinking_water']],
  fuel: [['amenity', 'fuel']],
  pharmacy: [['amenity', 'pharmacy']],
  hospital_clinic: [['amenity', 'hospital'], ['amenity', 'clinic']],
  atm_bank: [['amenity', 'atm'], ['amenity', 'bank']],
  transport: [['railway', 'station'], ['amenity', 'bus_station'], ['amenity', 'ferry_terminal']],
};
const TOILET_KEYS = ['name', 'fee', 'wheelchair', 'changing_table', 'opening_hours', 'access', 'unisex', 'operator'];

async function overpass(bbox) {
  const [w, s, e, n] = bbox;
  const b = `${s},${w},${n},${e}`;
  const parts = [`nwr["amenity"="toilets"](${b});`];
  for (const tags of Object.values(POI_TAGS)) for (const [k, v] of tags) parts.push(`nwr["${k}"="${v}"](${b});`);
  const q = `[out:json][timeout:120];(${parts.join('')});out center tags;`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: 'data=' + encodeURIComponent(q),
    }).catch(() => null);
    if (r && r.ok) return (await r.json()).elements ?? [];
    await new Promise((ok) => setTimeout(ok, 15000 * (attempt + 1)));
  }
  throw new Error('Overpass failed');
}

function toPois(elements) {
  const toilets = [];
  const places = [];
  const seen = new Set();
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const tags = el.tags ?? {};
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const id = el.type[0] + el.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const ll = { lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
    if (tags.amenity === 'toilets') {
      if (tags.access === 'private' || tags.access === 'no') continue;
      const t = { id, ...ll };
      for (const k of TOILET_KEYS) if (tags[k]) t[k] = tags[k];
      if (!t.changing_table && tags.diaper) t.changing_table = tags.diaper === 'no' ? 'no' : 'yes';
      toilets.push(t);
      continue;
    }
    const cat = Object.entries(POI_TAGS).find(([, list]) => list.some(([k, v]) => tags[k] === v));
    if (cat) places.push({ id, ...ll, category: cat[0], ...(tags.name ? { name: tags['name:en'] || tags.name } : {}) });
  }
  return { built: BUILT, attribution: '© OpenStreetMap contributors (ODbL)', toilets, places };
}

// ---------------------------------------------------------------- main
const only = args.only ? new Set(args.only.split(',')) : null;
const source = await latestBuildUrl();
console.log('Protomaps build:', source);
const catalog = { version: 1, release: cfg.release, built: BUILT, attribution: cfg.attribution, cities: [] };

for (const city of cfg.cities) {
  if (only && !only.has(city.id)) continue;
  const dir = join(OUT, 'work', city.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'tiles'), { recursive: true });
  const [w, s, e, n] = city.bbox;
  const pad = 0.02; // a little more vector data around the edges for labels
  const extract = join(OUT, 'work', `${city.id}.pmtiles`);
  execFileSync('pmtiles', ['extract', source, extract, `--bbox=${w - pad},${s - pad},${e + pad},${n + pad}`, '--maxzoom=15'], { stdio: 'inherit' });
  const src = new FileSource(extract);
  const pm = new PMTiles(src);
  const r = makeRenderer(pm);
  let count = 0;
  for (let z = city.minzoom; z <= city.maxzoom; z++) {
    for (const [tz, x, y] of tilesFor(city.bbox, z)) {
      const png = await r.render(tz, x, y);
      mkdirSync(join(dir, 'tiles', String(tz), String(x)), { recursive: true });
      writeFileSync(join(dir, 'tiles', String(tz), String(x), `${y}.png`), png);
      count++;
    }
    console.log(city.id, 'z', z, 'tiles so far', count);
  }
  r.release();
  src.close();
  const pois = toPois(await overpass(city.bbox));
  const center = [+((w + e) / 2).toFixed(5), +((s + n) / 2).toFixed(5)];
  const file = `${city.id}.tar`;
  const meta = { id: city.id, name: city.name, country: city.country, bbox: city.bbox, center, minzoom: city.minzoom, maxzoom: city.maxzoom, file, tiles: count, pois: pois.toilets.length + pois.places.length, attribution: cfg.attribution, built: BUILT };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta));
  writeFileSync(join(dir, 'pois.json'), JSON.stringify(pois));
  const tar = join(OUT, file);
  // Regular files only (no directory entries), meta.json first, ustar so the app's parser reads it.
  const list = execFileSync('find', ['tiles', '-type', 'f', '-name', '*.png'], { cwd: dir }).toString().trim().split('\n').sort();
  writeFileSync(join(OUT, 'work', `${city.id}.list`), ['meta.json', 'pois.json', ...list].join('\n') + '\n');
  execFileSync('tar', ['--format=ustar', '--owner=0', '--group=0', '--numeric-owner', '--no-recursion', '-cf', tar, '-C', dir, '-T', join(OUT, 'work', `${city.id}.list`)]);
  const bytes = statSync(tar).size;
  const sha256 = createHash('sha256').update(readFileSync(tar)).digest('hex');
  catalog.cities.push({ ...meta, bytes, sha256 });
  console.log(`${file}: ${count} tiles, ${pois.toilets.length} toilets, ${(bytes / 1e6).toFixed(1)} MB`);
}

if (!catalog.cities.length) throw new Error('no cities built');
writeFileSync(join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 1));
writeFileSync(join(OUT, 'upload-1-packs.txt'), catalog.cities.map((c) => c.file).join('\n') + '\n');
console.log('catalog.json written with', catalog.cities.length, 'cities');
if (!existsSync(join(OUT, 'catalog.json'))) process.exit(1);
