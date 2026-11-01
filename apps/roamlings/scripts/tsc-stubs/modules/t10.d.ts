// Stubs added by T10 for modules it imports (see ../README.md). expo-network SDK 57 public API, members Satchel uses.
declare module 'expo-network' {
  export enum NetworkStateType {
    NONE = 'NONE',
    UNKNOWN = 'UNKNOWN',
    CELLULAR = 'CELLULAR',
    WIFI = 'WIFI',
    BLUETOOTH = 'BLUETOOTH',
    ETHERNET = 'ETHERNET',
    WIMAX = 'WIMAX',
    VPN = 'VPN',
    OTHER = 'OTHER',
  }
  export type NetworkState = {
    type?: NetworkStateType;
    isConnected?: boolean;
    isInternetReachable?: boolean;
  };
  export type EventSubscription = { remove: () => void };
  export function getNetworkStateAsync(): Promise<NetworkState>;
  export function addNetworkStateListener(listener: (event: NetworkState) => void): EventSubscription;
  export function useNetworkState(): NetworkState;
}
