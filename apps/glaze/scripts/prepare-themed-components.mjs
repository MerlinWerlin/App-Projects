// Native date/focus/battery editions reuse verified number-free art. No raster artwork is edited.
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {parseWidgetOptions} from '../src/core/widgetOptions.ts';
import {liveArtPlan,liveArtSpec} from '../src/core/liveArt.ts';
const root=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('Usage: node prepare-themed-components.mjs <reviews>');
const sharp=createRequire(import.meta.url)(process.argv[3]??'sharp');
const clocks=JSON.parse(readFileSync('docs/themed-clock-profiles.json','utf8'));
const themes=[];
for(const clock of clocks.themes){
 // The special full-dial/stacked backgrounds have no separate quiet margin. Keep date/focus on
 // existing decorative art instead of putting values over a dial or the stacked time slot.
 let art=clock;
 if(clock.option.liveFrame.clockStyle!=='digital'){
   const cat=JSON.parse(readFileSync(join(root,'release-simulation/catalogue.json'),'utf8')).themes.find(t=>t.id===clock.id);
   const source=cat.widgets.find(w=>!w.practicalConcept);if(!source)throw Error('No decorative source');
   art={...clock,source:source.file,width:source.width,height:source.height};
   art.image='components-'+clock.id+'.jpg';
   await sharp(join(root,art.source)).resize({width:512,height:512,fit:'inside'}).jpeg({quality:85}).toFile(join('docs/themed-clock-fixtures',art.image));
 }
 const frame=clock.option.liveFrame.clockStyle==='digital'?clock.option.liveFrame:{rect:[.12,.025,.76,.14],ink:clock.ink};
 const components=[];
 for(const kind of ['date','focus','battery']){
   const liveFrame={rect:frame.rect,shape:'plate',valueStyle:'compact',ink:frame.ink};
   const option={id:'themed-live-'+kind,kind,image:'source-art',sizes:['small','medium','large'],fit:'fit',background:'blur',label:{date:'Art date · live',focus:'Art focus · live',battery:'Art battery · live'}[kind],numberFree:true,liveFrame};
   const parsed=parseWidgetOptions([option],[{path:option.image,role:'widget-art',width:art.width,height:art.height}]);if(parsed.errors.length)throw Error(parsed.errors.join(';'));
   const plan=liveArtPlan(clock.id.slice(4),parsed.options[0]);if(!plan)throw Error('No live plan');
   const composed={};for(const [size,w,h]of [['small',170,170],['medium',364,170],['large',364,382]])composed[size]=liveArtSpec(plan,{w:art.width,h:art.height},{w,h},'bleed',{bg:clock.bg,ink:frame.ink});
   components.push({kind,option,composed});
 }
 const theme={...art,components,scope:'Additive practical editions using original decorative art, not conversion of painted samples.',visualStatus:'native_composition_review_required'};delete theme.composed;delete theme.option;
 themes.push(theme);
 writeFileSync(join(root,clock.id,'widgets/themed-components-20261102.json'),JSON.stringify({...theme,components:components.map(c=>({...c,option:{...c.option,image:join(root,art.source)}}))},null,2)+'\n');
}
const data={date:'2026-11-02',themes,physicalDeviceTest:false,published:false};
writeFileSync('docs/themed-component-profiles.json',JSON.stringify(data,null,2)+'\n');
writeFileSync(join(root,'release-simulation/themed-component-profiles-20261102.json'),JSON.stringify(data,null,2)+'\n');
console.log('Prepared',themes.length*3,'art-preserving date/focus/battery editions; individual/native/device review pending.');
