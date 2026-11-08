// T17 backup restore: expo-updates 58 reloadAsync (restart after a restore so every screen reads the new data).
declare module 'expo-updates' {
  export function reloadAsync(): Promise<void>;
}
