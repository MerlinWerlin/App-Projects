// Connection status for the offline banner (FLOWS §13, ACCESSIBILITY "Map tab"). Pure TS: the raw state comes in
// from src/native/network.ts (expo-network); nothing here touches the phone.
// - "offline" only when the phone says there is no connection at all (flight mode, no signal, no Wi-Fi).
// - Connected to Wi-Fi without internet is not called offline: we never claim flight mode we can't see.
// - Anything we can't read (Expo Go web, a failed call, missing fields) is "unknown", and unknown shows nothing.

export type NetStatus = 'online' | 'offline' | 'unknown';

/** The phone's network state as expo-network reports it; every field may be missing. */
export type RawNetworkState = { type?: unknown; isConnected?: unknown; isInternetReachable?: unknown };

/** Online / offline / unknown from a raw expo-network state. Never guesses. */
export function netStatus(raw: unknown): NetStatus {
  if (!raw || typeof raw !== 'object') return 'unknown';
  const s = raw as RawNetworkState;
  if (s.isConnected === false) return 'offline';
  if (s.type === 'NONE' || s.type === 'none') return 'offline';
  if (s.isConnected === true) return 'online';
  return 'unknown';
}

/** The banner shows only when we know the phone is offline. */
export const showOfflineBanner = (s: NetStatus): boolean => s === 'offline';
