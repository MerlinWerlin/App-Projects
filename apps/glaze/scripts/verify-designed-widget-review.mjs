// Check downloaded original native evidence and build a separate browseable review gallery.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const source=resolve(process.argv[2]), output=resolve(process.argv[3]);
const sharp=createRequire(import.meta.url)(process.argv[4]??'sharp');
const r=JSON.parse(readFileSync(join(source,'_SUCCESS.json'),'utf8'));
if(r.records.length!==r.renders||r.baselineLayouts!==r.themes*9)throw Error('Incomplete native report');
const unique=new Set();
for(const record of r.records){
  if(unique.has(record.file))throw Error('Duplicate native render');unique.add(record.file);
  const data=readFileSync(join(source,record.file));
  if(createHash('sha256').update(data).digest('hex')!==record.sha256)throw Error('Native hash mismatch '+record.file);
  const m=await sharp(data).metadata();if(m.width!==record.width||m.height!==record.height)throw Error('Native size mismatch '+record.file);
}
const actual=readdirSync(source).filter(n=>/\.(png|jpg)$/.test(n));if(actual.length!==unique.size)throw Error('Unlisted or missing native images');
mkdirSync(output,{recursive:true});
const baseline=r.records.filter(p=>p.state==='default'&&p.locale==='en_AU');
if(baseline.length!==r.baselineLayouts)throw Error('Baseline coverage');
const themes=[...new Set(baseline.map(p=>p.theme))].sort(),esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const prefix=relative(output,source).replaceAll('\\','/');
const rows=themes.map(id=>`<section data-name="${esc(id)}"><h2>${esc(id)}</h2><div>${baseline.filter(p=>p.theme===id).map(p=>`<figure data-size="${p.size}"><img loading="lazy" src="${prefix}/${p.file}" width="${p.width/2}" height="${p.height/2}" alt="${esc(id)} ${p.kind}"><figcaption>${p.kind} · ${p.size}</figcaption></figure>`).join('')}</div></section>`);
writeFileSync(join(output,'native-gallery.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Glaze native widget review</title><style>*{box-sizing:border-box}body{margin:0;background:#141820;color:#eeeff2;font:16px system-ui}header{position:sticky;top:0;background:#141820f5;padding:20px;z-index:2}h1{font-size:24px}main{max-width:1200px;margin:auto;padding:20px}section{border-bottom:1px solid #38404c;padding:12px 0}section>div{display:flex;flex-wrap:wrap;gap:15px}h2{font-size:17px}figure{margin:0;max-width:100%}img{border-radius:22px;max-width:100%;height:auto}figcaption{font-size:12px;color:#adb8c7;padding:8px}input,select{font:inherit;background:#252c38;color:#fff;padding:10px;border:1px solid #606c7d;border-radius:8px}p{color:#b7c1ce}[hidden]{display:none!important}</style><header><h1>Glaze · actual native WidgetKit designs</h1><p>${r.themes} theme entries · ${r.baselineLayouts} size layouts · ${r.renders} renders · ${r.assertions} native assertions. All image hashes and dimensions verified.</p><p>Source ${r.sourceSHA}. Fixed review readings; physical-phone testing remains separate.</p><input id="search" placeholder="Find a theme" aria-label="Find a theme"><select id="size" aria-label="Widget size"><option>small</option><option>medium</option><option>large</option></select></header><main>${rows.join('')}</main><script>const q=document.querySelector('#search'),z=document.querySelector('#size');function filter(){for(const s of document.querySelectorAll('section')){s.hidden=!s.dataset.name.includes(q.value.toLowerCase());for(const f of s.querySelectorAll('figure'))f.hidden=f.dataset.size!==z.value}}q.oninput=z.onchange=filter;filter();</script></html>`);
const sheets=[];
for(let start=0;start<themes.length;start+=12){
  const page=themes.slice(start,start+12),height=page.length*208+54,pieces=[];
  const labels=Buffer.from(`<svg width="630" height="${height}"><rect width="630" height="${height}" fill="#151a22"/><g font-family="sans-serif" fill="#e7e9ee"><text x="20" y="28" font-size="18">Glaze · native review ${Math.floor(start/12)+1}</text>${page.map((t,i)=>`<text x="20" y="${65+i*208}" font-size="13">${esc(t)}</text>`).join('')}</g></svg>`);
  for(let i=0;i<page.length;i++)for(let j=0;j<3;j++){
    const record=baseline.find(p=>p.theme===page[i]&&p.size==='small'&&p.kind===['clock','battery','calendar'][j]);
    const image=await sharp(join(source,record.file)).resize(170,170).png().toBuffer();pieces.push({input:image,left:20+j*201,top:76+i*208});
  }
  const file=`native-contact-${String(sheets.length+1).padStart(2,'0')}.jpg`;
  await sharp(labels).composite(pieces).jpeg({quality:94}).toFile(join(output,file));sheets.push(file);
}
const chosen=['nebula-veil','alpine-starlight','blueprint-bureau','honeywood','paper-carnival','porcelain-tide'];
const pieces=[],height=chosen.length*390+45;
const labels=Buffer.from(`<svg width="1110" height="${height}"><rect width="1110" height="${height}" fill="#151a22"/><g font-family="sans-serif" fill="#e7e9ee" font-size="20">${chosen.map((t,i)=>`<text x="24" y="${28+i*390}">${esc(t)}</text>`).join('')}</g></svg>`);
for(let i=0;i<chosen.length;i++)for(let j=0;j<3;j++){
  const record=baseline.find(p=>p.theme===chosen[i]&&p.size==='small'&&p.kind===['clock','battery','calendar'][j]);
  pieces.push({input:join(source,record.file),left:24+j*362,top:43+i*390});
}
await sharp(labels).composite(pieces).jpeg({quality:95}).toFile(join(output,'native-selected-designs.jpg'));
await sharp({create:{width:1110,height:390,channels:3,background:'#151a22'}}).composite(pieces.slice(0,3)).jpeg({quality:95}).toFile(join(output,'native-nebula-widgets.jpg'));
await sharp({create:{width:1110,height:382,channels:3,background:'#151a22'}}).composite(pieces.slice(3,6).map(p=>({...p,top:21}))).jpeg({quality:95}).toFile(join(output,'native-alpine-widgets.jpg'));
const verified={...Object.fromEntries(['sourceSHA','themes','baselineLayouts','renders','assertions','catalogueThemes','physicalDeviceTest'].map(k=>[k,r[k]])),allFileHashesAndDimensionsVerified:true,nativeContactSheets:sheets};
writeFileSync(join(output,'native-verification.json'),JSON.stringify(verified,null,2)+'\n');console.log(JSON.stringify(verified));
