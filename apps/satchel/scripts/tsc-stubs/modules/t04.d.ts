// Stubs added by T04 for modules it imports (see ../README.md). SDK 57 public API, members Satchel uses.
declare module 'expo-brightness' {
  export enum BrightnessMode {
    UNKNOWN = 0,
    AUTOMATIC = 1,
    MANUAL = 2,
  }
  export function isAvailableAsync(): Promise<boolean>;
  /** Current app (iOS: screen) brightness, 0..1. */
  export function getBrightnessAsync(): Promise<number>;
  /** Sets app (iOS: screen) brightness, 0..1. */
  export function setBrightnessAsync(brightnessValue: number): Promise<void>;
  export function getSystemBrightnessAsync(): Promise<number>;
  export function setSystemBrightnessAsync(brightnessValue: number): Promise<void>;
  /** Android: stop overriding the window brightness and follow the system again. */
  export function restoreSystemBrightnessAsync(): Promise<void>;
  export function isUsingSystemBrightnessAsync(): Promise<boolean>;
  export function useSystemBrightnessAsync(): Promise<void>;
  export function getSystemBrightnessModeAsync(): Promise<BrightnessMode>;
  export function setSystemBrightnessModeAsync(brightnessMode: BrightnessMode): Promise<void>;
}

declare module 'expo-sharing' {
  export type SharingOptions = { mimeType?: string; UTI?: string; dialogTitle?: string; anchor?: { x: number; y: number; width: number; height: number } };
  export function isAvailableAsync(): Promise<boolean>;
  export function shareAsync(url: string, options?: SharingOptions): Promise<void>;
}
