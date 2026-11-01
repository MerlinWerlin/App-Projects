#!/usr/bin/env node
// Technical flat icon prototypes and plain fallback UI faces, NOT final styled theme exports.
// Preserve original theme material/motifs when preparing the actual final artwork.
// No screenshots are cropped into icons; originals are never overwritten. Not a publication tool.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CATALOGUE, GLYPHS } from '../src/core/catalogue.ts';
import { INHOUSE_GLYPH_PATHS } from '../src/render/inhouse.ts';
import { parseWidgetOptions } from '../src/core/widgetOptions.ts';
import { liveArtPlan } from '../src/core/liveArt.ts';

const args=process.argv.slice(2),arg=(n)=>args[args.indexOf(n)+1];
if(!args.includes('--reviews'))throw Error('Required: --reviews <glaze-theme-reviews>; optional --playwright-module <module path> --channel msedge');
const root=resolve(arg('--reviews')),app=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(import.meta.url),{chromium}=require(args.includes('--playwright-module')?arg('--playwright-module'):'playwright');
const data=JSON.parse(readFileSync(join(root,'release-simulation/catalogue.json'),'utf8'));
const font=readFileSync(join(app,'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'));
const glyphmap=JSON.parse(readFileSync(join(app,'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const frames={
 clock:{rect:[.18,.18,.64,.64],shape:'circle'},
 date:{rect:[.18,.16,.64,.68],shape:'plate'},
 focus:{rect:[.2,.2,.6,.6],shape:'circle'},
 battery:{rect:[.22,.27,.56,.46],shape:'plate'},
};
const browser=await chromium.launch({headless:true,...(args.includes('--channel')?{channel:arg('--channel')}:{})});
const page=await browser.newPage();
await page.setContent('<canvas id="export" width="1024" height="1024"></canvas>');
await page.evaluate(async uri=>{let font=new FontFace('GlazeFeather',`url(${uri})`);document.fonts.add(await font.load())},'data:font/ttf;base64,'+font.toString('base64'));
const report=[];
try{
 for(const theme of data.themes){
  const dir=join(root,theme.id),icons=join(dir,'icons','exports-20261101');mkdirSync(icons,{recursive:true});mkdirSync(join(dir,'widgets'),{recursive:true});
  const entries=[];
  for(const glyph of GLYPHS){
   if(!glyphmap[glyph]&&!INHOUSE_GLYPH_PATHS[glyph])throw Error('Missing glyph '+glyph);
   const uri=await page.evaluate(({glyph,code,house,bg,ink})=>{
    let canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,1024,1024);ctx.fillStyle=bg;ctx.fillRect(0,0,1024,1024);ctx.fillStyle=ink;ctx.strokeStyle=ink;
    if(house){ctx.save();ctx.translate(252,252);ctx.scale(520/24,520/24);ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';for(const d of house.strokes)ctx.stroke(new Path2D(d));for(const d of house.dots||[])ctx.fill(new Path2D(d));ctx.restore()}
    else{ctx.font='520px GlazeFeather';const text=String.fromCodePoint(code),m=ctx.measureText(text);ctx.fillText(text,(1024-m.width)/2,(1024+m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2)}
    // Two quiet accents from the same ink: a tiny sun ray / photo corner, not repeated ornaments.
    if(glyph==='sun'||glyph==='image'){ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(775,250,14,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}
    return canvas.toDataURL('image/png').split(',')[1]
   },{glyph,code:glyphmap[glyph],house:INHOUSE_GLYPH_PATHS[glyph],bg:theme.background,ink:theme.foreground});
   const bytes=Buffer.from(uri,'base64'),name=glyph+'.png',dest=join(icons,name);
   if(existsSync(dest)&&sha(readFileSync(dest))!==sha(bytes))throw Error('Refusing to replace different icon '+dest);
   if(!existsSync(dest))writeFileSync(dest,bytes);
   entries.push({glyph,file:name,width:1024,height:1024,bytes:bytes.length,sha256:sha(bytes)});
  }
  writeFileSync(join(icons,'app-map.json'),JSON.stringify({theme:theme.id,designStatus:'technical_flat_prototype_not_final',source:'Glaze production catalogue generic glyphs; not brand logos',apps:CATALOGUE.map(a=>({id:a.id,name:a.name,glyph:a.glyph,file:a.glyph+'.png'})),icons:entries},null,2)+'\n');
  writeFileSync(join(icons,'README.md'),'Glaze production-style 1024px opaque square icons for '+theme.id+'. APP SEARCH exports the existing app Feather font and in-house glyph paths in the reviewed theme ink on a background-matched flat square. iOS supplies its own mask. app-map.json maps983 catalogue entries to shared glyph files; these are generic symbols, not brand logos or material-perfect copies of the concept boards. Feather is MIT licensed (https://github.com/feathericons/feather/blob/main/LICENSE); retain NOTICE.txt. Native installation is unverified. APPS A2 / Glaze.\n');
  writeFileSync(join(icons,'NOTICE.txt'),'Feather glyphs: copyright Cole Bemis, MIT license. Source: https://github.com/feathericons/feather. In-house glyphs: Glaze original code at src/render/inhouse.ts. Full Feather license is distributed in the shared export folder FEATHER-LICENSE.txt; retain it with redistributed exports.\n');
  const needed=Math.max(1,6-new Set(theme.widgets.map(w=>w.originalSha256||w.sha256)).size),kinds=['clock','date','focus','battery'].slice(0,Math.min(4,needed)),options=[];
  for(const kind of kinds){
   const file='runtime-'+kind+'-face-20261101.png',dest=join(dir,'widgets',file);
   const uri=await page.evaluate(({kind,bg,ink})=>{
    const c=document.querySelector('canvas'),x=c.getContext('2d');x.clearRect(0,0,1024,1024);x.fillStyle=bg;x.fillRect(0,0,1024,1024);x.strokeStyle=ink;x.lineWidth=3;x.globalAlpha=.35;
    if(kind==='clock'||kind==='focus'){
     x.beginPath();x.arc(512,512,442,0,Math.PI*2);x.stroke();
     if(kind==='clock'){for(let i=0;i<12;i++){let a=i*Math.PI/6;x.beginPath();x.moveTo(512+410*Math.sin(a),512-410*Math.cos(a));x.lineTo(512+430*Math.sin(a),512-430*Math.cos(a));x.stroke()}}
     else{x.lineWidth=9;x.globalAlpha=.75;x.beginPath();x.arc(512,512,442,-Math.PI/2,-Math.PI/2+.36);x.stroke()}
    }else if(kind==='date'){
     x.beginPath();x.roundRect(92,92,840,840,46);x.stroke();x.beginPath();x.moveTo(92,222);x.lineTo(932,222);x.stroke();for(const at of [300,724]){x.lineWidth=12;x.beginPath();x.moveTo(at,70);x.lineTo(at,135);x.stroke()}
    }else{x.beginPath();x.roundRect(140,260,718,504,38);x.stroke();x.fillStyle=ink;x.fillRect(858,420,30,184)}
    x.globalAlpha=1;return c.toDataURL('image/png').split(',')[1]
   },{kind,bg:theme.background,ink:theme.foreground});
   const bytes=Buffer.from(uri,'base64');if(existsSync(dest)&&sha(readFileSync(dest))!==sha(bytes))throw Error('Refusing to replace face '+dest);if(!existsSync(dest))writeFileSync(dest,bytes);
   options.push({id:'live-'+kind,kind,image:file,sizes:['small','medium','large'],fit:'fit',background:'theme',label:kind==='clock'?'Live clock':kind==='date'?'Today':kind==='focus'?'Focus session':'Battery level',numberFree:true,liveFrame:frames[kind],sha256:sha(bytes),bytes:bytes.length});
  }
  const validation=parseWidgetOptions(options,options.map(o=>({path:o.image,role:'widget-art',width:1024,height:1024})));if(validation.errors.length)throw Error(validation.errors.join(';'));
  for(const o of validation.options)if(!liveArtPlan(theme.id.slice(4),o))throw Error('Face does not resolve to live plan');
  const manifest={theme:theme.id,date:'2026-11-01',scope:'Clean UI backgrounds, no painted time, date, countdown or battery value. Native liveFrame support required; not photo-widget art.',nativeCodeStatus:'candidate_branch_requires_mac_check_and_device_test',widgets:options};
  writeFileSync(join(dir,'widgets','runtime-options-20261101.json'),JSON.stringify(manifest,null,2)+'\n');
  report.push({theme:theme.id,icons:entries.length,appMappings:CATALOGUE.length,numberFreeFaces:options.length,filesMissingToSix:Math.max(0,6-theme.widgets.length-options.length),iconBytes:entries.reduce((s,x)=>s+x.bytes,0)});
  console.log(theme.id,entries.length,'icons',options.length,'clean faces');
 }
 const summary={themes:report.length,iconPngs:report.reduce((s,r)=>s+r.icons,0),numberFreeFaces:report.reduce((s,r)=>s+r.numberFreeFaces,0),remainingDecorativeFiles:report.reduce((s,r)=>s+r.filesMissingToSix,0)};
 writeFileSync(join(root,'release-simulation','production-export-report.json'),JSON.stringify({date:'2026-11-01',summary,themes:report,nativeDeviceValidated:false,publication:false},null,2)+'\n');console.log(JSON.stringify(summary));
}finally{await browser.close()}
