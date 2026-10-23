/**
 * The app's DiscoveryDeps: fetch always; the phone Wi-Fi IP provider (expo-network) when present, so
 * the subnet probe runs automatically on every scan; UDP (SSDP) and mDNS only in dev builds that
 * include react-native-udp / react-native-zeroconf. Every loader is guarded; never throws, so Expo Go
 * gets { fetch, phoneIp } (or just { fetch } where expo-network is missing).
 */
import type { DiscoveryDeps } from '../core/discoveryService';
import { fetchAdapter } from '../state/tvs';
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
  const mdns = safe(loadZeroconf);
  if (mdns) deps.mdns = mdns;
  const phoneIp = safe(loadPhoneIp);
  if (phoneIp) deps.phoneIp = phoneIp;
  return deps;
}

export { loadPhoneIp };
