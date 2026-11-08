import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseCatalog} from '../src/core/packCatalog.ts';
import {remoteArtTheme} from '../src/core/remoteCatalog.ts';
import {widgetThemeFrom} from '../src/core/widgetTheme.ts';
import {HABIT_DEFS,HABIT_KINDS} from '../src/core/habits.ts';
const root=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('Required local candidate root');
const parsed=parseCatalog(JSON.parse(readFileSync(join(root,'catalog.json'),'utf8')));if(!parsed.ok)throw Error(parsed.error);
const cohort=JSON.parse(readFileSync('docs/themed-clock-profiles.json','utf8')).themes;
const themes=cohort.map(t=>{
 const pack=parsed.value.packs.find(p=>p.id===t.id.slice(4));if(!pack)throw Error('Missing '+t.id);
 const nativeTheme=widgetThemeFrom(remoteArtTheme(pack,null),new Date('2026-11-03T00:00:00Z'));
 const cases=HABIT_KINDS.flatMap(kind=>{const def=HABIT_DEFS[kind];return [
  {kind,state:'empty',value:0,step:def.step,goal:def.defaultGoal},
  {kind,state:'progress',value:kind==='mood'?3:(def.defaultGoal??0)/2,step:def.step,goal:def.defaultGoal},
  {kind,state:'upper-bound',value:def.max,step:def.step,goal:def.defaultGoal},
 ]});
 return {id:t.id,nativeTheme,cases};
});
if(themes.length!==105)throw Error('Expected fixed105-theme cohort');
writeFileSync('docs/native-habit-review-profiles.json',JSON.stringify({schema:'GLAZE_NATIVE_HABIT_VISUAL_PROFILES_V1',themes,scope:'Actual app widgetThemeFrom(remoteArtTheme) payload and HABIT_DEFS. Existing native habit layouts, injected values; no artwork changes or installed-widget interaction claim.'},null,2)+'\n');
console.log('Prepared',themes.length,'real native theme palettes and',themes.length*24,'habit layout cases.');
