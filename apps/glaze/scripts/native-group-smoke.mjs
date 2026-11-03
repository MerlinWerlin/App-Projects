import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {HABIT_KINDS,createHabit} from '../src/core/habits.ts';
import {parseHabitsDoc,parseHabitLog,habitTodayValue} from '../src/core/habitLog.ts';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
if(process.argv[2]==='prepare'){
 const clock=read(process.argv[3]),now=new Date(clock.now),utcOffsetMinutes=clock.offsetMinutes;
 const patch={water:{value:350,step:250},sleep:{value:7.5,step:.5},steps:{value:3200,step:1000},mood:{value:4}};
 const habitsRaw=JSON.stringify({v:1,habits:HABIT_KINDS.map(k=>({...createHabit(k,now,{utcOffsetMinutes}),...patch[k]}))});
 writeFileSync(process.argv[4],JSON.stringify({habitsRaw},null,2)+'\n');
}else{
 const fixture=read(process.argv[3]),writer=read(process.argv[4]),intents=read(process.argv[5]),reader=read(process.argv[6]);
 assert.equal(writer.habitsRaw,fixture.habitsRaw);assert.equal(reader.habitsRaw,fixture.habitsRaw,'native intents must not rewrite app tracker bytes');
 assert.equal(writer.runID,intents.runID);assert.equal(writer.runID,reader.runID);
 for(const r of [writer,intents,reader])assert.equal(r.sharedFileMarker,writer.runID,'App Group file access shared as well as preferences');
 assert.equal(writer.groupContainer,intents.groupContainer);assert.equal(writer.groupContainer,reader.groupContainer);
 assert.equal(new Set([writer.bundleID,intents.bundleID,reader.bundleID]).size,3,'three independently installed app processes');
 assert.equal(intents.actualIntentMethodsCalled,4);
 const log=parseHabitLog(reader.logRaw);assert.ok(log);assert.equal(log.seq,4);assert.equal(log.events.length,4);
 assert.deepEqual(log.events.map(e=>[e.kind,e.op,e.amount]),[['water','add',250],['sleep','add',.5],['steps','add',-1000],['mood','set',5]]);
 const now=new Date(reader.now),doc=parseHabitsDoc(reader.habitsRaw);
 const expected=Object.fromEntries(HABIT_KINDS.map(k=>[k,habitTodayValue(doc.habits,doc.applied,log,k,now,reader.offsetMinutes)]));
 assert.deepEqual(reader.todayValues,expected,'fresh-process native readings match actual app parser and pending-tap rules');
 const result={sourceSHA:reader.sourceSHA,passed:true,appGroup:reader.appGroup,independentProcesses:3,actualIntentMethodsCalled:4,persistedEvents:4,appTrackerBytesUnchanged:true,appAndNativeValuesMatch:true,values:expected,physicalDeviceTest:false,productionAppUsed:false,installedWidgetInstance:false,scope:'Three independently installed, App Group-entitled simulator hosts use production HabitStore and actual StepHabitIntent/SetMoodIntent.perform methods. Real app TypeScript generates and checks the data. This does not qualify Expo bridge delivery, SpringBoard dispatch/taps, cross-process concurrent writes or a phone.'};
 writeFileSync(process.argv[7],JSON.stringify(result,null,2)+'\n');console.log('Shared App Group and four actual intent methods pass across three installed simulator processes.');
}
