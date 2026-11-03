import {readFileSync,writeFileSync} from 'node:fs';
import {contrastRatio,mix} from '../src/core/colour.ts';
const result=JSON.parse(readFileSync(process.argv[2],'utf8'));
if(result.palettes?.length!==105)throw Error('Expected105 native palette results');
const checks=[];
for(const p of result.palettes){
 const samples=Array.from({length:21},(_,i)=>mix(p.stops[0],p.stops.at(-1),i/20));
 const min=f=>Math.min(...samples.map(f));
 const r={theme:p.theme,ink:p.ink,accent:p.accent,backgroundStops:p.stops,
  primary:min(bg=>contrastRatio(p.ink,bg)),secondary:min(bg=>contrastRatio(mix(bg,p.ink,.85),bg)),
  button:min(bg=>contrastRatio(p.ink,mix(bg,p.ink,.12))),title:min(bg=>contrastRatio(p.accent,bg)),
  moodOutline:min(bg=>contrastRatio(mix(bg,p.ink,.6),bg)),selectedMood:min(bg=>contrastRatio(p.accent,mix(bg,p.accent,.15))),
  inkChanged:p.ink.toUpperCase()!==p.preferredInk.toUpperCase(),accentChanged:p.accent.toUpperCase()!==p.preferredAccent.toUpperCase()};
 if(Math.min(r.primary,r.secondary,r.button,r.title)<4.5-1e-8||Math.min(r.moodOutline,r.selectedMood)<3-1e-8)throw Error('Native colours fail independent app contrast calculation: '+JSON.stringify(r));
 checks.push(r);
}
const verification={schema:'GLAZE_NATIVE_HABIT_COLOUR_CHECK_V1',sourceSHA:result.sourceSHA,themes:105,samplesPerGradient:21,passed:true,inkChanged:checks.filter(r=>r.inkChanged).length,accentChanged:checks.filter(r=>r.accentChanged).length,checks,scope:'Independent app colour-library validation of native resolved text, button and mood colours over source gradients. This does not qualify rendered materials, tint modes or a device.'};
writeFileSync(process.argv[3],JSON.stringify(verification,null,2)+'\n');console.log('Native habit colours independently pass for105 palettes:',verification.inkChanged,'ink /',verification.accentChanged,'accent refinements.');
