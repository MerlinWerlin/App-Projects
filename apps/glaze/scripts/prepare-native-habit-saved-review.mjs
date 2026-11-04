import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseCatalog} from '../src/core/packCatalog.ts';
import {remoteArtTheme} from '../src/core/remoteCatalog.ts';
import {buildCatalogueSpec,applyCatalogueEdits,serialiseWidgetCatalogue} from '../src/core/widgetKinds.ts';
import {generateWidgetSet,widgetTokensFrom} from '../src/core/widgetSets.ts';
const root=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('Required local candidate root');
const catalog=parseCatalog(JSON.parse(readFileSync(join(root,'catalog.json'),'utf8')));if(!catalog.ok)throw Error(catalog.error);
const profiles=JSON.parse(readFileSync('docs/native-habit-review-profiles.json','utf8')).themes;
const ids=['001-alpine-starlight','005-rainlight','014-frostglass-passage','034-match-point','062-froggy-picnic','063-boba-bear-club'];
const titles={water:'Drink up 💧',sleep:'Rest & recover',steps:'Keep moving',mood:'How am I?'};
const fills=[['#0C1724','#172D3F'],['#120D25','#241B3B'],['#ECF1F5','#C7D6E1'],['#B2360B','#B2360B'],['#DEEFE1','#AAC6AD'],['#F7E9D8','#DAC1A5']];
const cases=[];
for(const [i,id] of ids.entries()){
 const pack=catalog.value.packs.find(p=>p.id===id.slice(4));if(!pack)throw Error(id);
 const theme=remoteArtTheme(pack,null),tokens=widgetTokensFrom(theme),set=generateWidgetSet(theme);
 for(const kind of ['water','sleep','steps','mood'])for(const size of ['small','medium']){
  const nativeKind='habit'+kind[0].toUpperCase()+kind.slice(1);
  const {spec,issues}=applyCatalogueEdits(buildCatalogueSpec(tokens,nativeKind,size),{text:{name:titles[kind]},colours:{background:fills[i]}});
  if(issues.some(x=>x.code!=='contrastAdjusted'))throw Error(JSON.stringify(issues));
  const payload=JSON.parse(serialiseWidgetCatalogue(set,{themeId:tokens.themeId,name:tokens.name,tokens,specs:[spec]},{now:new Date('2026-11-04T00:00:00Z')}));
  const raw=payload.catalogue.specs[0],texts=payload.catalogue.texts[raw.id];
  if(texts.name!==titles[kind])throw Error('Title not preserved by real editor serializer');
  cases.push({id:`saved_${id}_${kind}_${size}`,theme:id,nativeTheme:profiles.find(t=>t.id===id).nativeTheme,kind,size,raw,texts,expectedTitle:titles[kind]});
 }
}
if(cases.length!==48)throw Error('Expected48 saved-editor cases');
writeFileSync('docs/native-habit-saved-review.json',JSON.stringify({schema:'GLAZE_NATIVE_HABIT_SAVED_REVIEW_V1',cases})+'\n');
console.log('Prepared48 real editor saved habit designs with custom names and gradients.');
