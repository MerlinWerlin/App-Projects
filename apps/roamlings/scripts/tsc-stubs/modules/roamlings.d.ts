// Stubs for libraries Roamlings adds on top of the shared set.
declare module 'expo-sensors' {
  export interface PedometerResult { steps: number }
  export interface PermissionResponse { granted: boolean; canAskAgain: boolean; status: string }
  export interface Subscription { remove(): void }
  export const Pedometer: {
    isAvailableAsync(): Promise<boolean>;
    getPermissionsAsync(): Promise<PermissionResponse>;
    requestPermissionsAsync(): Promise<PermissionResponse>;
    getStepCountAsync(start: Date, end: Date): Promise<PedometerResult>;
    watchStepCount(callback: (result: PedometerResult) => void): Subscription;
  };
}

declare module 'expo' {
  export function requireOptionalNativeModule<T = unknown>(name: string): T | null;
}
