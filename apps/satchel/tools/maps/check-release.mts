// T52: checks downloaded satchel-maps-v1 files with the app's own parsers (catalog, tar walk, meta, pois, toilets, help).
// Usage: curl the release's catalog.json + <city>.tar into a folder, then: node tools/maps/check-release.mts . <folder>
// Network-free on purpose (the download is done outside); prints one JSON row per city.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = pathToFileURL(resolve(process.argv[2] ?? '.')).href, dl = resolve(process.argv[3] ?? '.');
const cm = await import(`${repo}/src/core/citymaps.ts`);
const tar = await import(`${repo}/src/core/tar.ts`);
const pp = await import(`${repo}/src/core/packpois.ts`);
const tl = await import(`${repo}/src/core/toilets.ts`);
const cat = cm.parseCatalog(JSON.parse(readFileSync(`${dl}/catalog.json`, 'utf8')));
if (!cat) throw new Error('catalog does not parse');
const out: unknown[] = [];
for (const c of cat.cities) {
  const buf = new Uint8Array(readFileSync(`${dl}/${c.file}`));
  const sha = createHash('sha256').update(buf).digest('hex');
  let off = 0, tiles = 0, png = 0, bad = 0; const files: Record<string, Uint8Array> = {};
  const zooms = new Set<number>(); const others: string[] = [];
  while (off + tar.BLOCK <= buf.length) {
    const h = tar.parseTarHeader(buf.subarray(off, off + tar.BLOCK));
    if (typeof h === 'string') { if (h !== 'end') bad++; break; }
    const body = buf.subarray(off + tar.BLOCK, off + tar.BLOCK + h.size);
    const p = h.type === 'file' ? cm.packEntryPath(h.name) : null; if (h.type !== 'file' && h.type !== 'dir') others.push(h.typeflag);
    if (h.size > 0) {
      if (p === null) bad++;
      else if (/\.png$/.test(p)) { tiles++; zooms.add(Number(p.split('/').at(-3))); if (body[0] === 0x89 && body[1] === 0x50) png++; }
      else files[p] = body.slice();
    }
    off = tar.nextHeaderOffset(off, h.size);
  }
  const td = new TextDecoder();
  const meta = files['meta.json'] ? cm.parsePackMeta(JSON.parse(td.decode(files['meta.json'])), c) : null;
  const poiRaw = files['pois.json'] ? JSON.parse(td.decode(files['pois.json'])) : null;
  const pois = poiRaw ? pp.parsePackPoiFile(poiRaw) : null;
  const counts = pois ? pp.poiCategoryCounts(pois.pois) : null;
  const toilets = files['toilets.json'] ? tl.parsePackToilets(JSON.parse(td.decode(files['toilets.json']))) : null;
  out.push({ id: c.id, bytesOk: buf.length === c.bytes, shaOk: sha === c.sha256, tiles, catalogTiles: c.tiles, png, rejectedEntries: bad, nonFileTypes: [...new Set(others)],
    zooms: [...zooms].sort((a,b)=>a-b), meta: !!meta, otherFiles: Object.keys(files), pois: pois?.pois.length, counts,
    toilets: Array.isArray(toilets) ? toilets.length : toilets && typeof toilets === 'object' ? Object.keys(toilets) : toilets });
}
console.log(JSON.stringify(out, null, 1));
