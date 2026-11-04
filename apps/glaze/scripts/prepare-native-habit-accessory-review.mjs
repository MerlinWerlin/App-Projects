import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseCatalog} from '../src/core/packCatalog.ts';
import {remoteArtTheme} from '../src/core/remoteCatalog.ts';
import {buildCatalogueSpec,applyCatalogueEdits,serialiseWidgetCatalogue} from '../src/core/widgetKinds.ts';
import {generateWidgetSet,widgetTokensFrom} from '../src/core/widgetSets.ts';
const root=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('Candidate root required');
const catalog=parseCatalog(JSON.parse(readFileSync(join(root,'catalog.json'),'utf8')));if(!catalog.ok)throw Error(catalog.error);
const profiles=JSON.parse(readFileSync('docs/native-habit-review-profiles.json','utf8')).themes;
const ids=['001-alpine-starlight','005-rainlight','014-frostglass-passage','034-match-point','062-froggy-picnic','063-boba-bear-club'];
const titles=[['Drink up 💧','Rest & recover','Keep moving','How am I?'],['Drink rain ☔','Sleep soundly','A little walk','Feeling today'],['补水时间 💧','好好休息','继续前进','今天心情'],['Hydration reminder','Rest & recover','Walk a little more','How do I feel today?'],['اشرب الماء','وقت النوم','واصل المشي','كيف أشعر اليوم؟'],['Tea break 🧋','Good night','Bear steps','Feeling cosy']];
const cases=[];
for(const [i,id] of ids.entries()){
 const pack=catalog.value.packs.find(p=>p.id===id.slice(4));if(!pack)throw Error(id);
 const theme=remoteArtTheme(pack,null),tokens=widgetTokensFrom(theme),set=generateWidgetSet(theme);
 for(const [j,kind] of ['water','sleep','steps','mood'].entries()){
  const name=titles[i][j],nativeKind='habit'+kind[0].toUpperCase()+kind.slice(1);
  const {spec,issues}=applyCatalogueEdits(buildCatalogueSpec(tokens,nativeKind,'accessoryRectangular'),{text:{name}});
  if(issues.some(x=>x.code!=='contrastAdjusted'))throw Error(JSON.stringify(issues));
  const payload=JSON.parse(serialiseWidgetCatalogue(set,{themeId:tokens.themeId,name:tokens.name,tokens,specs:[spec]},{now:new Date('2026-11-04T00:00:00Z')}));
  const raw=payload.catalogue.specs[0],texts=payload.catalogue.texts[raw.id];if(texts.name!==name)throw Error('Saved name changed');
  cases.push({id:`custom_${id}_${kind}`,theme:id,nativeTheme:profiles.find(t=>t.id===id).nativeTheme,kind,raw,texts,expectedTitle:name,rtl:i===4});
 }
}
writeFileSync('docs/native-habit-accessory-review.json',JSON.stringify({schema:'GLAZE_NATIVE_HABIT_ACCESSORY_SAVED_V1',cases})+'\n');console.log('Prepared24 actual saved accessory designs, including Chinese and Arabic names.');
