/** Native capability probes. Every native module here is optional; absence means a JS fallback. */
import { hasUdp, loadUdpFactory } from './udp';
import { hasZeroconf, loadZeroconf } from './zeroconf';

export interface NativeCapabilities {
  udp: boolean;
  zeroconf: boolean;
}

export function nativeCapabilities(): NativeCapabilities {
  return { udp: hasUdp(), zeroconf: hasZeroconf() };
}

export { loadUdpFactory, loadZeroconf };
