/**
 * The app's Transport for drivers (D4-1): the global-fetch adapter, plus a WebSocket factory only when
 * the lan-wss native module is compiled in (dev builds), plus an IR transmitter only when the
 * ir-blaster module is compiled in and the phone has an emitter. In Expo Go, web and tests `ws` and
 * `ir` are undefined, so driverFor() returns null for Samsung / IR ("coming soon") instead of crashing.
 *
 * No static import of any native module: they are loaded by guarded requires in lanWss.ts / ir.ts.
 */
import type { Transport } from '../core/driver';
import { fetchAdapter } from '../state/tvs';
import { loadIrTransmitter } from './ir';
import { loadLanFetch } from './lanFetch';
import { loadLanWssFactory } from './lanWss';

export { fetchAdapter };

export function appTransport(): Transport {
  const t: Transport = { fetch: fetchAdapter };
  let ws: Transport['ws'] | null = null;
  try {
    ws = loadLanWssFactory();
  } catch {
    ws = null;
  }
  if (ws) t.ws = ws;
  let ir: Transport['ir'] | null = null;
  try {
    ir = loadIrTransmitter();
  } catch {
    ir = null;
  }
  if (ir) t.ir = ir;
  let lf: Transport['lanFetch'] | null = null;
  try {
    lf = loadLanFetch();
  } catch {
    lf = null;
  }
  if (lf) t.lanFetch = lf;
  return t;
}
