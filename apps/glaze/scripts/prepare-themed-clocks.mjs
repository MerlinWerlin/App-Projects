// Prepare live clock editions from existing number-free decorative artwork; never flatten it.
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {parseWidgetOptions} from '../src/core/widgetOptions.ts';
import {liveArtPlan,liveArtSpec} from '../src/core/liveArt.ts';
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
if(!args.includes('--reviews')||!args.includes('--sharp-module'))throw Error('Required --reviews <root> --sharp-module <module>');
const root=resolve(arg('--reviews')),req=createRequire(import.meta.url),sharp=req(arg('--sharp-module'));
const fixture=resolve('docs/themed-clock-fixtures');mkdirSync(fixture,{recursive:true});
const cat=JSON.parse(readFileSync(join(root,'release-simulation/catalogue.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const luminance=(r,g,b)=>[r,g,b].map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const rgb=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16));
const themes=[];
for(const t of cat.themes){
 let chosen=t.widgets.find(w=>!w.practicalConcept&&['photo','decorative-art'].includes(w.kind))??t.widgets.find(w=>!w.practicalConcept);
 if(!chosen){const file=readdirSync(join(root,t.id,'widgets')).find(n=>n.startsWith('production-20261101-')&&n.endsWith('.png'));if(file)chosen={file:t.id+'/widgets/'+file};}
 if(!chosen)throw Error('No verified decorative source '+t.id);
 let source=join(root,chosen.file),style='digital',rect=[.12,.10,.76,.18],ink=t.foreground,method='original decorative artwork with live digital time';
 const special=join(root,t.id,'widgets/native-clock-background-20261102.png');
 if(existsSync(special)){
   source=special;style=t.id.startsWith('001-')?'analog':'stacked';rect=style==='analog'?[.105,.075,.79,.79]:[.26,.18,.48,.53];ink=style==='analog'?'#EEECE3':'#DCC5FF';method='original painted clock background, AI-removed fixed values';
 }else{
   // Analyze pixels only; the source artwork is neither painted over nor altered.
   const {data,info}=await sharp(source).resize(96,96,{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
   // The contact-sheet review exposed head/finial clashes in the old17%-down band.
   // Reserve a quieter edge band instead of running the label through the central subject.
   const candidates=[.025,.81].map(y=>[.12,y,.76,.14]);let best;
   for(const box of candidates){
     const values=[];for(let y=Math.floor(box[1]*96);y<Math.floor((box[1]+box[3])*96);y++)for(let x=12;x<84;x++){const i=(y*96+x)*info.channels;values.push(luminance(data[i],data[i+1],data[i+2]));}
     const mean=values.reduce((a,b)=>a+b,0)/values.length,variance=values.reduce((a,b)=>a+(b-mean)**2,0)/values.length;
     const options=[t.foreground,'#F5F3EC','#17201D'].map(c=>{const l=luminance(...rgb(c));const ratios=values.map(v=>(Math.max(l,v)+.05)/(Math.min(l,v)+.05)).sort((a,b)=>a-b);return {ink:c,contrast:ratios[Math.floor(ratios.length*.1)]};}).sort((a,b)=>b.contrast-a.contrast);
     const lowerOnly=['028','031','045','049','051','059','074','081'].includes(t.id.slice(0,3));
     const score=variance+(options[0].contrast<4.5?.3:0)+(lowerOnly&&box[1]<.5?10:0);if(!best||score<best.score)best={rect:box,score,...options[0]};
   }
   rect=best.rect;ink=best.ink;
 }
 const bytes=readFileSync(source),meta=await sharp(bytes).metadata();
 const liveFrame={rect,shape:style==='analog'?'circle':'plate',clockStyle:style,ink};
 const option={id:'themed-live-clock',kind:'clock',image:'clock-background.jpg',sizes:['small','medium','large'],fit:'fit',background:'blur',label:style==='stacked'?'After Hours · live':'Art clock · live',numberFree:true,liveFrame};
 const parsed=parseWidgetOptions([option],[{path:option.image,role:'widget-art',width:meta.width,height:meta.height}]);if(parsed.errors.length)throw Error(parsed.errors.join(';'));
 const plan=liveArtPlan(t.id.slice(4),parsed.options[0]);if(!plan)throw Error('No live plan');
 const file=t.id+'.jpg';await sharp(bytes).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toFile(join(fixture,file));
 const composed={};for(const [size,w,h]of [['small',170,170],['medium',364,170],['large',364,382]])composed[size]=liveArtSpec(plan,{w:meta.width,h:meta.height},{w,h},'bleed',{bg:t.background,ink});
 const profile={id:t.id,bg:t.background,ink,image:file,source:source.slice(root.length+1).replaceAll('\\','/'),sourceSha256:sha(bytes),width:meta.width,height:meta.height,method,option,composed,visualStatus:'native_composition_review_required',installedWidgetTest:false};
 themes.push(profile);
 writeFileSync(join(root,t.id,'widgets/themed-clock-20261102.json'),JSON.stringify({...profile,option:{...option,image:source}},null,2)+'\n');
}
const result={date:'2026-11-02',scope:'Native art clock editions; original painted clocks remain unchanged unless separately cleaned. Automatic layout requires visual review.',themes};
writeFileSync('docs/themed-clock-profiles.json',JSON.stringify(result,null,2)+'\n');
writeFileSync(join(root,'release-simulation/themed-clock-profiles-20261102.json'),JSON.stringify(result,null,2)+'\n');
writeFileSync(join(fixture,'README.md'),'CI-only downscaled art fixtures for APPS A2 native clock composition review. Written by prepare-themed-clocks.mjs; original sources and hashes are in themed-clock-profiles.json. Not app bundle artwork, not installed-widget or rights approval.\n');
console.log('Prepared',themes.length,'art-preserving live clock profiles; visual review still required.');
