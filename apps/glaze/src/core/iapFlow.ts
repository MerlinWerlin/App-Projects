// T140 prep (oversight D143-1): the real Glaze Plus purchase flow, written against a small
// injected client shaped like expo-iap so it is pure TypeScript and unit-tested on a mock.
// Nothing here imports expo-iap; the native build adds the pinned package and passes its
// functions in (src/plus/iapStore.ts). Until then the mock store stays active.

export const PLUS_SKU = 'com.jared797.glaze.plus';

/** Re-check window after a failed or silent purchase (store can deliver late). */
export const RECHECK_DELAY_MS = 10_000;
/** How long to wait for the listener or the returned value before treating it as silent. */
export const PURCHASE_WAIT_MS = 60_000;

export type IapPurchase = {
  productId?: string;
  id?: string;
  transactionId?: string;
  [k: string]: unknown;
};

export type IapError = { code?: string; message?: string; [k: string]: unknown };

/** The subset of expo-iap Glaze uses. Both request key styles are sent (old ios/android, new apple/google). */
export interface IapClient {
  initConnection(): Promise<unknown>;
  requestPurchase(args: {
    request: {
      ios: { sku: string };
      android: { skus: string[] };
      apple: { sku: string };
      google: { skus: string[] };
    };
    type: 'in-app';
  }): Promise<unknown>;
  purchaseUpdatedListener(cb: (p: IapPurchase) => void): { remove(): void };
  purchaseErrorListener(cb: (e: IapError) => void): { remove(): void };
  getAvailablePurchases(): Promise<IapPurchase[] | null | undefined>;
  finishTransaction(args: { purchase: IapPurchase; isConsumable: false }): Promise<unknown>;
}

export type FlowResult =
  | { kind: 'purchased'; purchase: IapPurchase }
  | { kind: 'cancelled' }
  | { kind: 'failed'; code: string };

export type FlowDeps = {
  client: IapClient;
  sku?: string;
  sleep?: (ms: number) => Promise<void>;
  waitMs?: number;
  recheckMs?: number;
};

const CANCEL_CODES = new Set(['E_USER_CANCELLED', 'user-cancelled', 'USER_CANCELLED', 'UserCancelled']);

export function isCancelCode(code: string | undefined): boolean {
  return !!code && CANCEL_CODES.has(code);
}

export function productIdOf(p: IapPurchase | null | undefined): string | undefined {
  if (!p || typeof p !== 'object') return undefined;
  return typeof p.productId === 'string' ? p.productId : typeof p.id === 'string' ? p.id : undefined;
}

export function ownsSku(list: IapPurchase[] | null | undefined, sku: string): IapPurchase | null {
  if (!Array.isArray(list)) return null;
  return list.find((p) => productIdOf(p) === sku) ?? null;
}

/** Normalise whatever requestPurchase returned (object, array, null) to purchases. */
export function asPurchases(v: unknown): IapPurchase[] {
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === 'object') as IapPurchase[];
  if (v && typeof v === 'object') return [v as IapPurchase];
  return [];
}

export function errorCode(e: unknown): string {
  if (e && typeof e === 'object') {
    const c = (e as { code?: unknown }).code;
    if (typeof c === 'string' && c) return c;
  }
  return 'unknown';
}

/** Plain-words failure line (English source; UI uses plus.lock.failed). Never implies a charge. */
export function failureMessage(code: string): string {
  return `The purchase didn’t go through and nothing was charged. Store code: ${code}.`;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function finish(client: IapClient, purchase: IapPurchase): Promise<void> {
  try {
    await client.finishTransaction({ purchase, isConsumable: false });
  } catch {
    // An unfinished non-consumable is redelivered by the store; the entitlement still stands.
  }
}

/**
 * Buy Glaze Plus. Waits on BOTH the returned value and purchaseUpdatedListener (whichever
 * names the SKU first). On error or silence it re-checks getAvailablePurchases after ~10 s,
 * so a late or already-owned purchase still unlocks. Cancel stays quiet.
 */
export async function purchasePlus(deps: FlowDeps): Promise<FlowResult> {
  const { client } = deps;
  const sku = deps.sku ?? PLUS_SKU;
  const sleep = deps.sleep ?? realSleep;
  const waitMs = deps.waitMs ?? PURCHASE_WAIT_MS;
  const recheckMs = deps.recheckMs ?? RECHECK_DELAY_MS;

  try {
    await client.initConnection();
  } catch (e) {
    return { kind: 'failed', code: errorCode(e) };
  }

  let settle: (r: { purchase?: IapPurchase; error?: IapError }) => void = () => {};
  const outcome = new Promise<{ purchase?: IapPurchase; error?: IapError }>((r) => (settle = r));
  const okSub = client.purchaseUpdatedListener((p) => {
    if (productIdOf(p) === sku) settle({ purchase: p });
  });
  const errSub = client.purchaseErrorListener((e) => settle({ error: e }));

  let first: { purchase?: IapPurchase; error?: IapError; timeout?: true };
  try {
    const request = {
      ios: { sku },
      android: { skus: [sku] },
      apple: { sku },
      google: { skus: [sku] },
    };
    client
      .requestPurchase({ request, type: 'in-app' })
      .then((v) => {
        const hit = ownsSku(asPurchases(v), sku);
        if (hit) settle({ purchase: hit });
      })
      .catch((e: unknown) => settle({ error: { code: errorCode(e) } }));
    first = await Promise.race([outcome, sleep(waitMs).then(() => ({ timeout: true as const }))]);
  } finally {
    okSub.remove();
    errSub.remove();
  }

  if (first.purchase) {
    await finish(client, first.purchase);
    return { kind: 'purchased', purchase: first.purchase };
  }
  const code = first.error ? errorCode(first.error) : 'timeout';
  if (isCancelCode(code)) return { kind: 'cancelled' };

  await sleep(recheckMs);
  try {
    const owned = ownsSku(await client.getAvailablePurchases(), sku);
    if (owned) {
      await finish(client, owned);
      return { kind: 'purchased', purchase: owned };
    }
  } catch {
    // fall through to the failure with the original store code
  }
  return { kind: 'failed', code };
}

/** Restore: true when the store lists the SKU; finishes it so it is not redelivered. */
export async function restorePlus(deps: FlowDeps): Promise<boolean> {
  const sku = deps.sku ?? PLUS_SKU;
  await deps.client.initConnection();
  const owned = ownsSku(await deps.client.getAvailablePurchases(), sku);
  if (!owned) return false;
  await finish(deps.client, owned);
  return true;
}
