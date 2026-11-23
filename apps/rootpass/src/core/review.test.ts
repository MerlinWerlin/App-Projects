// Regression tests for the verified review findings (23 Nov 2026).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bend } from './bend.ts';
import { cutList } from './cutlist.ts';
import { pcd } from './pcd.ts';
import { OUTSIDE_NOTE, saddle } from './saddle.ts';
import { MAX_SHEETS, pcdTemplate, saddleTemplate } from './templates.ts';
import { legFromThroat, weldFiller } from './weld.ts';
import { createPurchaseProvider, type IapApi, type StorePurchase } from '../plus/purchases.ts';
import { UNLOCK_PRODUCT_ID } from '../plus/entitlement.ts';

test('outside-of-wall saddle always carries the foul warning, on screen and on the PDF', () => {
  const r = saddle({ headerOD: 114.3, branchOD: 88.9, branchWall: 0, angleDeg: 90, offset: 0, contact: 'outside' });
  assert.ok(r.ok && r.warnings.includes(OUTSIDE_NOTE));
  assert.match(OUTSIDE_NOTE, /foul the header/);
  // The bore really does reach further toward the header than the outside line at the sides (35.92 vs 41.82 mm).
  const R = 57.15, ro = 44.45, ri = 44.45 - 5.5;
  assert.ok(Math.sqrt(R * R - ri * ri) > Math.sqrt(R * R - ro * ro));
  const t = saddleTemplate({ headerOD: 114.3, branchOD: 88.9, branchWall: 0, angleDeg: 90, offset: 0, contact: 'outside' }, 'metric', 'a4');
  assert.ok(t.ok);
  assert.ok(t.value.doc.pages[0].ops.some(o => o.includes('foul the header')));
  const inside = saddle({ headerOD: 114.3, branchOD: 88.9, branchWall: 5.5, angleDeg: 90, offset: 0, contact: 'inside' });
  assert.ok(inside.ok && !inside.warnings.includes(OUTSIDE_NOTE));
});

test('an interior flange needs a setback at each end', () => {
  const r = bend({ thickness: 2, radius: 2, angleDeg: 90, k: 0.4, flanges: [30, 5, 30] }); // OSSB 4: middle needs > 8
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.error.startsWith('Flange 2 needs more than 8.0 mm'));
  assert.equal(bend({ thickness: 2, radius: 2, angleDeg: 90, k: 0.4, flanges: [30, 9, 30] }).ok, true);
  const end = bend({ thickness: 2, radius: 2, angleDeg: 90, k: 0.4, flanges: [4, 50] });
  assert.ok(!end.ok && end.error.startsWith('Flange 1 needs more than 4.0 mm'));
});

test('bolt circle: negative hole refused; overlapping holes are not printed as a drilling template', () => {
  assert.equal(pcd({ pcd: 100, holes: 6, layout: 'onCentre', holeDia: -5 }).ok, false);
  const over = pcdTemplate({ pcd: 100, holes: 6, layout: 'onCentre', holeDia: 60 }, 'metric', 'a4'); // chord 50
  assert.ok(!over.ok && /overlap/.test(over.error));
  assert.equal(pcdTemplate({ pcd: 100, holes: 6, layout: 'onCentre', holeDia: 0 }, 'metric', 'a4').ok, true);
});

test('cut list fails fast on a huge quantity instead of building it', () => {
  const t0 = Date.now();
  const r = cutList({ stock: 6000, kerf: 3, trim: 0, parts: [{ length: 100, qty: 10_000_000 }] });
  assert.ok(!r.ok && r.error === 'Up to 500 pieces per cut list.');
  assert.ok(Date.now() - t0 < 50);
  const split = cutList({ stock: 6000, kerf: 3, trim: 0, parts: [{ length: 100, qty: 300 }, { length: 200, qty: 201 }] });
  assert.ok(!split.ok);
});

test('templates refuse absurd sheet counts before building anything', () => {
  const t0 = Date.now();
  const r = pcdTemplate({ pcd: 18_000, holes: 8, layout: 'straddle' }, 'metric', 'a4');
  assert.ok(!r.ok && /sheets/.test(r.error));
  assert.ok(Date.now() - t0 < 200);
  const big = saddleTemplate({ headerOD: 3000, branchOD: 3000, branchWall: 0, angleDeg: 10, offset: 0, contact: 'outside' }, 'metric', 'a4');
  assert.ok(!big.ok);
  assert.equal(MAX_SHEETS, 60);
});

test('fillet by throat: a 6 mm throat is an 8.49 mm leg and twice the metal of a 6 mm leg', () => {
  assert.ok(Math.abs(legFromThroat(6) - 8.485) < 1e-3);
  const byLeg = weldFiller({ joint: { kind: 'fillet', legA: 6, legB: 6 }, length: 1000, reinforcementPct: 0, process: 'gmaw' });
  const byThroat = weldFiller({ joint: { kind: 'fillet', legA: legFromThroat(6), legB: legFromThroat(6) }, length: 1000, reinforcementPct: 0, process: 'gmaw' });
  assert.ok(byLeg.ok && byThroat.ok);
  assert.ok(Math.abs(byThroat.value.area - 2 * byLeg.value.area) < 1e-9);
});

test('iOS: a purchase found by refresh (Ask to Buy, relaunch) is finished once', async () => {
  const finished: string[] = [];
  const owned: StorePurchase[] = [{ productId: UNLOCK_PRODUCT_ID, purchaseState: 'purchased', transactionId: 't1' }];
  const api: IapApi = {
    initConnection: async () => true,
    fetchProducts: async () => [],
    getAvailablePurchases: async () => owned,
    restorePurchases: async () => undefined,
    requestPurchase: async () => undefined,
    finishTransaction: async ({ purchase }) => { finished.push(String(purchase.transactionId)); },
    purchaseUpdatedListener: () => ({ remove() {} }),
    purchaseErrorListener: () => ({ remove() {} }),
  };
  const store = createPurchaseProvider(api, () => Date.now());
  const a = await store.refresh();
  assert.equal(a?.plus, true);
  await store.refresh();
  await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(finished, ['t1']);
});

test('catalogue gaps filled: AU sheet under 5 mm, Canadian RHS', async () => {
  const { stockFor } = await import('./stock.ts');
  const auPlate = stockFor('AU', 'plate')!;
  for (const t of [1.6, 2, 3, 4]) assert.ok(auPlate.sizes.some(s => Math.abs(s.dims[0] - t) < 1e-9), `AU ${t} mm`);
  const caBox = stockFor('CA', 'shs')!;
  assert.equal(caBox.partial, false);
  assert.ok(caBox.sizes.some(s => s.label === '3 × 2"'), 'CA 3x2 RHS');
});

test('big results are grouped for display, never in fields', async () => {
  const u = await import('./units.ts');
  assert.equal(u.fmtGrouped(14385600, 1), '14,385,600.0');
  assert.equal(u.fmtGrouped(9999.9, 1), '9999.9');
  assert.equal(u.fmtGrouped(-12345.67, 2), '-12,345.67');
  assert.equal(u.mass(14385600, 'metric'), '14,385,600.0 kg');
  assert.equal(u.fmt(14385600, 1), '14385600.0'); // fields keep plain numbers (parseNum reads "," as a decimal point)
});
