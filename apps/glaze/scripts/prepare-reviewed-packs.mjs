#!/usr/bin/env node
// Local candidate preparation only: no hosting, pricing changes or store submission.
import { readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync } from 'node:fs';
import { resolve,join,basename } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { parseRemoteArtManifest, parseCatalog, CATALOG_FORMAT, REMOTE_ART_FORMAT } from '../src/core/packCatalog.ts';
import { validateWidgetOptions } from '../src/core/widgetOptions.ts';
import { liveArtPlan, withLiveArt } from '../src/core/liveArt.ts';
import { rgbaToThumbHash } from './packs/thumbhash.mjs';

const args=process.argv.slice(2),arg=n=>args[args.indexOf(n)+1];
if(!args.includes('--reviews')||!args.includes('--out'))throw Error('Required --reviews <review root> --out <new local candidate root>; optional --sharp-module <path>');
const root=resolve(arg('--reviews')),out=resolve(arg('--out')),req=createRequire(import.meta.url),sharp=req(args.includes('--sharp-module')?arg('--sharp-module'):'sharp');
const catalogue=JSON.parse(readFileSync(join(root,'release-simulation/catalogue.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex'),short=s=>s.replace(/^(extra-20261029-|audit-20261101-|production-20261101-)/,'').replace(/-preview$/,'').slice(0,40);
const packs=[],audit=[];mkdirSync(out,{recursive:true});
for(const t of catalogue.themes){
 const folder=join(root,t.id),id=t.id.slice(4),dest=join(out,'art',id,'v1');mkdirSync(dest,{recursive:true});
 const source=JSON.parse(readFileSync(join(folder,'source-and-prompts.json'),'utf8'));
 const assets=[],widgets=[],sources=[],ids=new Set(),hashes=new Set();
 async function image(src,role,label,options){
  const {data,info}=await sharp(src).rotate().resize(options).webp({quality:84,effort:4}).toBuffer({resolveWithObject:true});
  const digest=sha(data),file=label+'.'+digest.slice(0,8)+'.webp';writeFileSync(join(dest,file),data);
  const a={path:file,role,width:info.width,height:info.height,bytes:data.length,sha256:digest,mime:'image/webp'};assets.push(a);sources.push({asset:file,source:src,sourceSha256:sha(readFileSync(src))});return a;
 }
 const wallpaper=await image(join(folder,'wallpapers/wallpaper.png'),'wallpaper','wallpaper-2796',{height:2796,withoutEnlargement:true});
 const thumb=await image(join(folder,'wallpapers/wallpaper.png'),'thumb','thumb',{width:240,height:520,fit:'cover'});
 const raw=await sharp(join(folder,'wallpapers/wallpaper.png')).resize({width:48,height:96,fit:'cover'}).ensureAlpha().raw().toBuffer();
 const thumbhash=Buffer.from(rgbaToThumbHash(48,96,raw)).toString('base64');
 const runtime=JSON.parse(readFileSync(join(folder,'widgets/runtime-options-20261101.json'),'utf8')).widgets;
 const runtimeByFile=new Map(runtime.map(w=>[w.image,w]));
 for(const name of readdirSync(join(folder,'widgets')).filter(n=>n.endsWith('.png')).sort()){
  const original=join(folder,'widgets',name),override=t.widgets.find(w=>w.originalFile&&basename(w.originalFile)===name);
  const src=override?join(root,override.file):original,digest=sha(readFileSync(src));if(hashes.has(digest))continue;hashes.add(digest);
  const live=runtimeByFile.get(name);
  // Keep the old painted clock as a static concept beside its cleaned live replacement.
  const optionId=id==='alpine-starlight'&&name==='constellation-clock-preview.png'&&existsSync(join(folder,'widgets/themed-clock-20261102.json'))?'constellation-clock-concept':live?.id??short(name.slice(0,-4));if(ids.has(optionId))throw Error('Duplicate option '+id+'/'+optionId);ids.add(optionId);
  const a=await image(src,'widget-art','widget-'+optionId,{width:1024,height:1024,fit:'inside',withoutEnlargement:true});
  const base={id:optionId,kind:live?.kind??'art',image:a.path,sizes:['small','medium','large'],fit:'fit',background:'theme',label:live?.kind==='clock'?'Plain clock (fallback)':live?.label??optionId.replaceAll('-',' ').slice(0,40)};
  if(live){base.numberFree=true;base.liveFrame=live.liveFrame}
  widgets.push(base);
 }
 const clockProfile=join(folder,'widgets/themed-clock-20261102.json');
 if(existsSync(clockProfile)){
  const profile=JSON.parse(readFileSync(clockProfile,'utf8'));
  const asset=await image(profile.option.image,'widget-art','widget-themed-live-clock',{width:1024,height:1024,fit:'inside',withoutEnlargement:true});
  widgets.unshift({...profile.option,image:asset.path});
 }
 if(widgets.length<6)throw Error(id+' has fewer than six candidate designs');
 const palette={bg:t.background,tile:t.background,glyph:t.foreground,accent:t.foreground,text:t.foreground};
 const name=String(source.set??t.id).replace(/^\d{3}[- ]/,'').replaceAll('-',' ').slice(0,60);
 const manifest={format:REMOTE_ART_FORMAT,version:2,id,packVersion:1,name,plus:false,minAppVersion:'1.0.1',palette,
  meta:{name,mood:'Coordinated artwork and native value faces; local release-review candidate.',tags:['review-candidate'],credits:source.source?.photographer?`Glaze theme artwork; reference photograph by ${source.source.photographer}${source.source.page?' ('+source.source.page+')':''}.`:'Glaze generated theme artwork and original UI geometry.',licence:'openai-output-owned',generator:'openai-image',prompt:'Mixed original theme artwork and code-drawn UI faces. Exact artwork prompts retained in source review folder.',addedAt:'2026-11-01'},
  thumbhash,assets,totalBytes:assets.reduce((s,a)=>s+a.bytes,0),widgets,
  review:{publication:false,designApproved:false,pricing:'unassigned; plus=false is local-test metadata only',nativeCapability:'live-frame-clock-style-v2',nativePR:190,sourceReleaseNote:source.source?.release_note??null,rights:'Original source credits and any source-specific release notes still apply. No new rights clearance is asserted.'}};
 const parsed=parseRemoteArtManifest(manifest,id);if(!parsed.ok)throw Error(id+': '+parsed.error);
 const errors=validateWidgetOptions(widgets,assets);if(errors.length)throw Error(errors.join(';'));
 const options=withLiveArt(id,parsed.value.widgets),clocks=options.filter(w=>liveArtPlan(id,w)?.kind==='clock');if(!clocks.length)throw Error(id+' has no native clock plan');
 writeFileSync(join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 writeFileSync(join(dest,'source-map.json'),JSON.stringify({theme:t.id,sources,originalMetadata:join(folder,'source-and-prompts.json'),publication:false},null,2)+'\n');
 packs.push({id,name,packVersion:1,plus:false,bytes:manifest.totalBytes,manifest:`art/${id}/v1/manifest.json`,thumb:`art/${id}/v1/${thumb.path}`,thumbhash,palette,tags:['review-candidate'],mood:manifest.meta.mood,addedAt:'2026-11-01',category:''});
 audit.push({theme:t.id,id,options:widgets.length,liveOptions:options.filter(w=>w.liveArt).length,clockOptions:clocks.length,bytes:manifest.totalBytes,sourceReference:source.source??null,publication:false});console.log(id,widgets.length,'choices',manifest.totalBytes,'bytes');
}
const catalog={format:CATALOG_FORMAT,version:1,generatedAt:new Date().toISOString(),packs};const parsed=parseCatalog(catalog);if(!parsed.ok||parsed.value.packs.length!==catalogue.themes.length)throw Error('Candidate catalog did not round-trip');
writeFileSync(join(out,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
writeFileSync(join(out,'candidate-validation.json'),JSON.stringify({date:'2026-11-01',themes:audit.length,options:audit.reduce((s,r)=>s+r.options,0),liveOptions:audit.reduce((s,r)=>s+r.liveOptions,0),totalBytes:audit.reduce((s,r)=>s+r.bytes,0),minimumChoices:Math.min(...audit.map(r=>r.options)),nativePR:190,physicalDeviceValidated:false,published:false,pricingApproved:false,themesDetail:audit},null,2)+'\n');
writeFileSync(join(out,'README.md'),'Local Glaze remote-art v2 candidates prepared for APPS A2 release review. Every theme has at least six choices and a number-free native clock plan. These are additive WebP exports; no originals changed and nothing uploaded. Widgets require the native support in draft PR190. plus=false is local test metadata, not an approved retail tier. Original source/reference release notes remain applicable. candidate-validation.json records geometry, source and parser checks, not physical-device or rights approval.\n');
console.log('PREPARED',audit.length,'local candidate packs; no upload performed');
