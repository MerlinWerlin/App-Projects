/**
 * The app's DiscoveryDeps: fetch always; the phone Wi-Fi IP provider (expo-network) when present, so
 * the subnet probe runs automatically on every scan; mDNS through the lan-wss Bonjour browser
 * (src/native/bonjour.ts, iOS native builds) or react-native-zeroconf; UDP (SSDP) only in dev builds
 * that include react-native-udp. Every loader is guarded; never throws, so Expo Go
 * gets { fetch, phoneIp } (or just { fetch } where expo-network is missing).
 */
import type { DiscoveryDeps } from '../core/discoveryService';
import { fetchAdapter } from '../state/tvs';
import { loadBonjour } from './bonjour';
import { loadTlsPortCheck } from './lanTls';
import { loadPhoneIp } from './network';
import { loadUdpFactory } from './udp';
import { loadZeroconf } from './zeroconf';

function safe<T>(load: () => T | null): T | null {
  try {
    return load();
  } catch {
    return null;
  }
}

export function appDiscoveryDeps(): DiscoveryDeps {
  const deps: DiscoveryDeps = { fetch: fetchAdapter, udp: null, mdns: null };
  const udp = safe(loadUdpFactory);
  if (udp) deps.udp = udp;
  // Bonjour via lan-wss (iOS NWBrowser, store builds) first; react-native-zeroconf if ever installed.
  const mdns = safe(loadBonjour) ?? safe(loadZeroconf);
  if (mdns) deps.mdns = mdns;
  const phoneIp = safe(loadPhoneIp);
  if (phoneIp) deps.phoneIp = phoneIp;
  const tlsCheck = safe(loadTlsPortCheck);
  if (tlsCheck) deps.tlsCheck = tlsCheck;
  return deps;
}

export { loadPhoneIp };
