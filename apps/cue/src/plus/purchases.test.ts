import { createPurchaseProvider, type IapApi, type StorePurchase } from './purchases';
import { PLUS_PRODUCT_ID as PLUS } from './entitlement';
import { TRIAL_PRODUCT_ID as TRIAL, DAY_MS } from './trial';
const NOW=Date.UTC(2026,9,27);
function fake() {
  let updated: (p:StorePurchase)=>void = () => undefined;
  let error: (e:unknown)=>void = () => undefined;
  let list:StorePurchase[]=[];
  const removed=jest.fn();
  const api:IapApi={
    initConnection:jest.fn(async()=>true),
    fetchProducts:jest.fn(async()=>[{id:PLUS,displayPrice:'$2.99'},{id:TRIAL,displayPrice:'Free'}]),
    getAvailablePurchases:jest.fn(async()=>list), restorePurchases:jest.fn(async()=>undefined),
    requestPurchase:jest.fn(async()=>undefined), finishTransaction:jest.fn(async()=>undefined),
    purchaseUpdatedListener:fn=>{updated=fn;return{remove:removed};},
    purchaseErrorListener:fn=>{error=fn;return{remove:removed};},
  };
  return {api,removed,update:(p:StorePurchase)=>updated(p),error:(e:unknown)=>error(e),setOwned:(p:StorePurchase[])=>{list=p;}};
}
afterEach(()=>jest.useRealTimers());
test('missing store, connection failure and missing product never unlock', async()=>{
  expect(await createPurchaseProvider(null).buy()).toMatchObject({ok:false,reason:'unavailable'});
  expect(await createPurchaseProvider(null).refresh()).toBeNull();
  const f=fake(); f.api.initConnection=async()=>false;
  expect(await createPurchaseProvider(f.api).buy()).toMatchObject({ok:false});
  f.api.initConnection=async()=>true; f.api.fetchProducts=async()=>[];
  expect(await createPurchaseProvider(f.api).buy()).toMatchObject({ok:false});
});
test('real localized price and both supported request keys, duplicate event/return acknowledged once', async()=>{
  const f=fake(); f.api.requestPurchase=jest.fn(async(args)=>{expect(args.request.apple.sku).toBe(PLUS);expect(args.request.ios.sku).toBe(PLUS);expect(args.type).toBe('in-app');const p={productId:PLUS,purchaseState:'purchased'};f.update(p);return p;});
  const store=createPurchaseProvider(f.api,()=>NOW);expect(await store.price()).toBe('$2.99');
  expect(await store.buy()).toMatchObject({ok:true,access:{plus:true}});
  expect(f.api.finishTransaction).toHaveBeenCalledTimes(1);expect(f.api.finishTransaction).toHaveBeenCalledWith({purchase:{productId:PLUS,purchaseState:'purchased'},isConsumable:false});expect(f.removed).toHaveBeenCalledTimes(2);
});
test('event-only Apple sheet remains active and accepts a later transaction', async()=>{
  jest.useFakeTimers();const f=fake();const purchase=createPurchaseProvider(f.api).buy();
  await jest.advanceTimersByTimeAsync(12_000);expect(f.removed).not.toHaveBeenCalled();
  f.update({productId:PLUS});expect(await purchase).toMatchObject({ok:true});
});
test('listener failure cannot defeat a successful returned transaction',async()=>{
  const f=fake();f.api.requestPurchase=async()=>{f.error({code:'E_TEMP'});return{productId:PLUS};};
  expect(await createPurchaseProvider(f.api).buy()).toMatchObject({ok:true});
});
test('failed response reconciles late ownership before reporting failure',async()=>{
  jest.useFakeTimers();const f=fake();f.api.requestPurchase=async()=>{throw{code:'E_NETWORK'};};
  const result=createPurchaseProvider(f.api).buy();await jest.advanceTimersByTimeAsync(4000);f.setOwned([{productId:PLUS}]);await jest.advanceTimersByTimeAsync(1000);
  expect(await result).toMatchObject({ok:true});
});
test('purchase failure shows error code after reconciliation and removes listeners',async()=>{
  jest.useFakeTimers();const f=fake();f.api.requestPurchase=async()=>{throw{code:'E_NETWORK'};};
  const result=createPurchaseProvider(f.api).buy();await jest.advanceTimersByTimeAsync(11_000);
  expect(await result).toMatchObject({ok:false,reason:'failed',message:expect.stringContaining('[E_NETWORK]')});expect(f.removed).toHaveBeenCalledTimes(2);
});
test('cancel and pending approval never unlock',async()=>{
  for(const code of ['user-cancelled','deferred-payment']){const f=fake();f.api.requestPurchase=async()=>{f.error({code});};expect(await createPurchaseProvider(f.api).buy()).toMatchObject({ok:false,reason:code==='user-cancelled'?'cancelled':'pending'});expect(f.removed).toHaveBeenCalledTimes(2);}
});
test('trial never grants permanent Plus; restore does not restart its clock',async()=>{
  const f=fake();f.api.requestPurchase=async()=>({productId:TRIAL,transactionDate:NOW});
  expect(await createPurchaseProvider(f.api,()=>NOW).startTrial()).toEqual({ok:true,access:{plus:false,trialStart:NOW}});
  f.setOwned([{productId:TRIAL,originalTransactionDateIOS:NOW-10*DAY_MS,transactionDate:NOW}]);
  expect(await createPurchaseProvider(f.api,()=>NOW).restore()).toEqual({ok:true,access:{plus:false,trialStart:NOW-10*DAY_MS}});
});
test('an existing trial with no date cannot become a fresh trial',async()=>{
  const f=fake();f.setOwned([{productId:TRIAL}]);expect(await createPurchaseProvider(f.api,()=>NOW).startTrial()).toMatchObject({ok:false,message:expect.stringContaining('E_TRIAL_DATE')});expect(f.api.requestPurchase).not.toHaveBeenCalled();
});
test('restore finds both items; empty restore and unreadable store are distinct',async()=>{
  const f=fake();const store=createPurchaseProvider(f.api,()=>NOW);expect(await store.restore()).toMatchObject({ok:false,reason:'empty'});
  f.setOwned([{productId:PLUS},{productId:TRIAL,transactionDate:NOW}]);expect(await store.restore()).toEqual({ok:true,access:{plus:true,trialStart:NOW}});
  f.api.getAvailablePurchases=async()=>{throw Error('offline');};expect(await store.refresh()).toBeNull();expect(await store.restore()).toMatchObject({ok:false,reason:'failed'});
});
test('authoritative refresh clears revoked ownership and ignores pending or unrelated items',async()=>{
  const f=fake();f.setOwned([{productId:PLUS,purchaseState:'pending'},{productId:'unrelated'}]);expect(await createPurchaseProvider(f.api).refresh()).toEqual({plus:false,trialStart:null});
});
test('double taps cannot open two Apple sheets',async()=>{
  jest.useFakeTimers();const f=fake();const store=createPurchaseProvider(f.api);const first=store.buy();await jest.advanceTimersByTimeAsync(0);expect(await store.buy()).toMatchObject({ok:false});f.update({productId:PLUS});expect(await first).toMatchObject({ok:true});expect(f.api.requestPurchase).toHaveBeenCalledTimes(1);
});
test('a silent request times out with restore guidance and no leaked listeners',async()=>{
  jest.useFakeTimers();const f=fake();const result=createPurchaseProvider(f.api).buy();await jest.advanceTimersByTimeAsync(180_001);expect(await result).toMatchObject({ok:false,message:expect.stringContaining('E_PURCHASE_TIMEOUT')});expect(f.removed).toHaveBeenCalledTimes(2);
});
test('unresponsive store preparation is bounded and never grants access', async()=>{
  jest.useFakeTimers();const f=fake();f.api.initConnection=()=>new Promise(()=>{});
  const result=createPurchaseProvider(f.api).buy();await jest.advanceTimersByTimeAsync(20_001);expect(await result).toMatchObject({ok:false,reason:'unavailable'});
});
test('pending transaction returned by Apple waits for approval without granting Plus',async()=>{
  const f=fake();f.api.requestPurchase=async()=>({productId:PLUS,purchaseState:'pending'});expect(await createPurchaseProvider(f.api).buy()).toMatchObject({ok:false,reason:'pending'});expect(f.api.finishTransaction).not.toHaveBeenCalled();
});


test('Australian storefront never labels USD 1.99 metadata as the Australian purchase price', async () => {
  const f = fake();
  f.api.getStorefront = async () => 'AUS';
  f.api.fetchProducts = async () => [{id: PLUS, displayPrice: '$1.99', currency: 'USD'}];
  expect(await createPurchaseProvider(f.api).price()).toBe('A$2.99');
  f.api.fetchProducts = async () => [{id: PLUS, displayPrice: '$2.99', currency: 'AUD'}];
  expect(await createPurchaseProvider(f.api).price()).toBe('A$2.99');
});

test('foreign stores keep their own price and currency; missing products never get an invented price', async () => {
  const f = fake();
  f.api.getStorefront = async () => 'USA';
  f.api.fetchProducts = async () => [{id: PLUS, displayPrice: '$1.99', currency: 'USD'}];
  expect(await createPurchaseProvider(f.api).price()).toBe('USD $1.99');
  f.api.getStorefront = async () => 'AUS';
  f.api.fetchProducts = async () => [];
  expect(await createPurchaseProvider(f.api).price()).toBeNull();
});

test('every price read refreshes products; a failed country lookup does not assume Australia', async () => {
  const f = fake();
  f.api.getStorefront = async () => { throw Error('unavailable'); };
  f.api.fetchProducts = jest.fn(async () => [{id: PLUS, displayPrice: '$1.99', currency: 'USD'}]);
  const store = createPurchaseProvider(f.api);
  expect(await store.price()).toBe('USD $1.99');
  f.api.fetchProducts = jest.fn(async () => [{id: PLUS, displayPrice: '$2.99', currency: 'AUD'}]);
  expect(await store.price()).toBe('A$2.99');
});
