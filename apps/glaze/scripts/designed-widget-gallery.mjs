// Review artifact, not a product screen. All thumbnails come from the real app preview renderer.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { designedWidgetSvg } from '../src/core/designedWidgetPreview.ts';
import { DESIGNED_SIZE, withWidgetIdentity } from '../src/core/designedWidgets.ts';
const output = resolve(process.argv[2] ?? 'docs/designed-widget-review');
const sharp = createRequire(import.meta.url)(process.argv[3] ?? 'sharp');
mkdirSync(join(output, 'previews'), { recursive: true });
const data = JSON.parse(readFileSync('docs/designed-widget-fixtures.json', 'utf8'));
const originalArtwork = 'data:image/jpeg;base64,' + readFileSync('assets/widgets/alpine-clock-face.jpg').toString('base64');
const escape = s => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]));
const now = new Date(2026, 10, 4, 10, 8);
const rows = [], pngs = [];
for (const theme of data.themes) {
  let cards = '';
  for (const size of ['small', 'medium', 'large']) for (const d of theme.designs) {
    const file = `${theme.id}_${d.kind}_${size}.svg`;
    const design = withWidgetIdentity(theme.id, d);
    const svg = designedWidgetSvg(design, size, { date: now, battery: 73, locale: 'en-AU', originalArtwork });
    writeFileSync(join(output, 'previews', file), svg);
    cards += `<figure data-size="${size}" data-kind="${d.kind}"><img loading="lazy" src="previews/${file}" width="${DESIGNED_SIZE[size].w}" height="${DESIGNED_SIZE[size].h}" alt="${escape(theme.name)} ${d.kind}"><figcaption>${d.kind} · ${size}</figcaption></figure>`;
    if (size === 'small') pngs.push({ theme: theme.id, name: theme.name, kind: d.kind, bytes: await sharp(Buffer.from(svg)).resize(170,170).png().toBuffer() });
  }
  rows.push(`<section data-name="${escape(theme.id+' '+theme.name)}"><h2>${escape(theme.name)}</h2><div class="widgets">${cards}</div></section>`);
}
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Glaze designed widgets · full library</title><style>*{box-sizing:border-box}body{margin:0;background:#12151b;color:#f1efec;font:16px system-ui}header{padding:25px;position:sticky;top:0;background:#12151bf5;z-index:2;border-bottom:1px solid #343840}h1{font-size:26px;margin:0 0 8px}p{color:#b4bbc6;margin:8px 0}nav{display:flex;gap:12px;flex-wrap:wrap;margin-top:15px}input,select{font:inherit;padding:10px;border-radius:8px;border:1px solid #59616f;background:#202630;color:inherit}main{max-width:1250px;margin:auto;padding:15px}section{padding:18px 5px;border-bottom:1px solid #303640}h2{font-size:18px}.widgets{display:flex;flex-wrap:wrap;gap:18px}figure{margin:0;max-width:100%}img{display:block;max-width:100%;height:auto;border-radius:22px}figcaption{padding:8px 2px;color:#aeb7c6;font-size:13px}figure:not([data-size=small]){display:none}[hidden]{display:none!important}@media(max-width:600px){header{padding:15px}.widgets{gap:12px}figure[data-size=small]{width:calc(50% - 6px)}h1{font-size:22px}}</style><header><h1>Glaze · designed functional widgets</h1><p>${data.catalogueThemes} catalogue themes + bundled styles · ${data.themes.length} distinct entries · ${data.themes.length*9} size layouts.</p><p>App preview renderer. Fixed review time and battery are sample data; installed widgets use real readings. Native iOS captures are verified separately.</p><nav><input id="search" placeholder="Find a theme" aria-label="Find a theme"><select id="size" aria-label="Widget size"><option>small</option><option>medium</option><option>large</option></select><select id="kind" aria-label="Widget function"><option value="all">All functions</option><option>clock</option><option>battery</option><option>calendar</option></select></nav></header><main>${rows.join('')}</main><script>const search=document.querySelector('#search'),size=document.querySelector('#size'),kind=document.querySelector('#kind');function filter(){for(const s of document.querySelectorAll('section')){s.hidden=!s.dataset.name.toLowerCase().includes(search.value.toLowerCase());for(const f of s.querySelectorAll('figure')){f.style.display=f.dataset.size===size.value&&(kind.value==='all'||f.dataset.kind===kind.value)?'block':'none'}}}search.oninput=size.onchange=kind.onchange=filter;filter();</script></html>`;
writeFileSync(join(output, 'index.html'), html);
// Twelve themes/page: all palettes and functions visible at readable widget dimensions.
const sheetFiles=[];
for(let offset=0;offset<data.themes.length;offset+=12){
  const themes=data.themes.slice(offset,offset+12),height=themes.length*208+54,width=630;
  const pieces=[];
  const label=Buffer.from(`<svg width="630" height="${height}"><rect width="630" height="${height}" fill="#151a22"/><g font-family="sans-serif" fill="#e7e9ee"><text x="20" y="28" font-size="18">Glaze • all-theme design review ${Math.floor(offset/12)+1}</text>${themes.map((t,i)=>`<text x="20" y="${65+i*208}" font-size="13">${escape(t.name)}</text>`).join('')}</g></svg>`);
  for(let i=0;i<themes.length;i++)for(let j=0;j<3;j++){const p=pngs.find(p=>p.theme===themes[i].id&&p.kind===['clock','battery','calendar'][j]);pieces.push({input:p.bytes,left:20+j*201,top:76+i*208});}
  const file=`contact-${String(sheetFiles.length+1).padStart(2,'0')}.png`;
  await sharp(label).composite(pieces).png().toFile(join(output,file));sheetFiles.push(file);
}
const selected=['nebula-veil','fern-and-brass','rainlight','porcelain-tide','cherry-arcade','espresso-hour'];
const chosen=data.themes.filter(t=>selected.includes(t.id));
const composites=[];
for(let i=0;i<chosen.length;i++)for(let j=0;j<3;j++)composites.push({input:pngs.find(p=>p.theme===chosen[i].id&&p.kind===['clock','battery','calendar'][j]).bytes,left:24+j*190,top:52+i*214});
const overview=Buffer.from(`<svg width="600" height="${chosen.length*214+32}"><rect width="600" height="100%" fill="#151a22"/><g fill="#e7e9ee" font-family="sans-serif" font-size="14">${chosen.map((t,i)=>`<text x="24" y="${33+i*214}">${escape(t.name)}</text>`).join('')}</g></svg>`);
await sharp(overview).composite(composites).png().toFile(join(output,'selected-designs.png'));
writeFileSync(join(output,'preview-manifest.json'),JSON.stringify({themes:data.themes.length,layouts:data.themes.length*9,contactSheets:sheetFiles,source:'App SVG preview; native review separate'},null,2)+'\n');
console.log(JSON.stringify({output,themes:data.themes.length,layouts:data.themes.length*9,contactSheets:sheetFiles.length}));
