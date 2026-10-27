import { MemoryKv } from '../core/library';
import { DAY_MS, TRIAL_DAYS, TRIAL_KEY, parseStamp, readStoredTrial, saveStoredTrial, trialLabel, trialStartFromPurchase, trialState } from './trial';
const NOW = Date.UTC(2026, 9, 27, 0);
test('fresh install never starts or persists a trial', async () => {
  const kv = new MemoryKv(); const secure = new MemoryKv();
  expect(await readStoredTrial(kv, secure)).toBeNull();
  expect(trialState(null, NOW)).toEqual({active:false,started:false,daysLeft:0,endsAt:0});
  expect(kv.data.size).toBe(0); expect(secure.data.size).toBe(0);
});
test('old automatic preview is not a store trial', async () => {
  const kv = new MemoryKv(); await kv.setItem('cue.firstLaunch.v1', String(NOW));
  expect(await readStoredTrial(kv, null)).toBeNull();
});
test('seven days exactly, rounded days left and expired endpoint', () => {
  expect(TRIAL_DAYS).toBe(7);
  expect(trialState(NOW, NOW).daysLeft).toBe(7);
  expect(trialState(NOW, NOW + 6.5*DAY_MS)).toMatchObject({active:true,daysLeft:1});
  expect(trialState(NOW, NOW+7*DAY_MS)).toMatchObject({active:false,started:true,daysLeft:0});
  expect(trialState(NOW, NOW-3*DAY_MS).active).toBe(false);
});
test('restore uses original transaction date, supports seconds and ISO, never invents missing dates', () => {
  expect(trialStartFromPurchase({originalTransactionDateIOS:NOW-10*DAY_MS,transactionDate:NOW},NOW)).toBe(NOW-10*DAY_MS);
  expect(trialStartFromPurchase({transactionDate:NOW/1000},NOW)).toBe(NOW);
  expect(trialStartFromPurchase({purchaseDate:new Date(NOW).toISOString()},NOW)).toBe(NOW);
  expect(trialStartFromPurchase({},NOW)).toBeNull();
  expect(trialStartFromPurchase({transactionDate:NOW+9*DAY_MS},NOW)).toBeNull();
});
test('reinstall keeps the earliest stored transaction, a confirmed store reset clears both caches', async () => {
  const kv = new MemoryKv(); const secure = new MemoryKv();
  await saveStoredTrial(kv,secure,NOW-9*DAY_MS); kv.data.clear();
  expect(await readStoredTrial(kv,secure)).toBe(NOW-9*DAY_MS);
  expect(trialState(await readStoredTrial(kv,secure),NOW).active).toBe(false);
  await saveStoredTrial(kv,secure,null); expect(await readStoredTrial(kv,secure)).toBeNull();
});
test('corrupt or inaccessible cache grants no access', async () => {
  const kv = new MemoryKv(); await kv.setItem(TRIAL_KEY, 'broken');
  expect(await readStoredTrial(kv,{getItem:async()=>{throw Error('locked');},setItem:async()=>{throw Error('locked');}})).toBeNull();
  for(const raw of [null,'','NaN','-1','0']) expect(parseStamp(raw)).toBeNull();
});
test('trial labels show active time only', () => {
  expect(trialLabel(trialState(null,NOW))).toBeNull();
  expect(trialLabel(trialState(NOW,NOW))).toEqual({key:'plus.trial.left',n:7});
  expect(trialLabel(trialState(NOW,NOW+6.5*DAY_MS))).toEqual({key:'plus.trial.leftOne',n:1});
});
