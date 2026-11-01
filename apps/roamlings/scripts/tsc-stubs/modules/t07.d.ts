// Stubs added by T07 for modules it imports (see ../README.md). expo-battery SDK 57 public API, members Satchel uses.
declare module 'expo-battery' {
  export enum BatteryState {
    UNKNOWN = 0,
    UNPLUGGED = 1,
    CHARGING = 2,
    FULL = 3,
  }
  export type PowerState = {
    /** 0..1, or -1 when the level can't be read (iOS simulator). */
    batteryLevel: number;
    batteryState: BatteryState;
    /** iOS Low Power Mode / Android battery saver. */
    lowPowerMode: boolean;
  };
  export type BatteryLevelEvent = { batteryLevel: number };
  export type BatteryStateEvent = { batteryState: BatteryState };
  export type PowerModeEvent = { lowPowerMode: boolean };
  export type EventSubscription = { remove: () => void };
  export function isAvailableAsync(): Promise<boolean>;
  export function getBatteryLevelAsync(): Promise<number>;
  export function getBatteryStateAsync(): Promise<BatteryState>;
  export function isLowPowerModeEnabledAsync(): Promise<boolean>;
  export function getPowerStateAsync(): Promise<PowerState>;
  export function addBatteryLevelListener(listener: (event: BatteryLevelEvent) => void): EventSubscription;
  export function addBatteryStateListener(listener: (event: BatteryStateEvent) => void): EventSubscription;
  export function addLowPowerModeListener(listener: (event: PowerModeEvent) => void): EventSubscription;
}
