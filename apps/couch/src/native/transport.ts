/**
 * The app's Transport for drivers (D4-1): the global-fetch adapter, plus a WebSocket factory only when
 * the lan-wss native module is compiled in (dev builds), plus an IR transmitter only when the
 * ir-blaster module is compiled in and the phone has an emitter. In Expo Go, web and tests `ws` and
 * `ir` are undefined, so driverFor() returns null for Samsung / IR ("coming soon") instead of crashing.
 * `androidTv` (the Google TV remote socket) exists only in iOS builds with lan-wss LanAtv; without it
 * Google TVs are cast-only (isSupported('androidtv') is false).
 *
 * No static import of any native module: they are loaded by guarded requires in lanWss.ts / ir.ts.
 */
import type { Transport } from '../core/driver';
import { fetchAdapter } from '../state/tvs';
import { loadAndroidTvTransport } from './androidTvTls';
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
  // Google TV remote (mutual TLS + Keychain identity, lan-wss LanAtv): only in builds that include it.
  let atv: Transport['androidTv'] | null = null;
  try {
    atv = loadAndroidTvTransport();
  } catch {
    atv = null;
  }
  if (atv) t.androidTv = atv;
  return t;
}
