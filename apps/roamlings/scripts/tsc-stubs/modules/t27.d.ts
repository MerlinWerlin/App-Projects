// Stubs added by T27 for the modules it imports (see ../README.md). Hand-written from the published API of
// expo-clipboard SDK 57 (build/Clipboard.d.ts). Only the members Satchel uses. Unverified offline.
declare module 'expo-clipboard' {
  export type SetStringOptions = { inputFormat?: 'plainText' | 'html' };
  export function setStringAsync(text: string, options?: SetStringOptions): Promise<boolean>;
  export function getStringAsync(): Promise<string>;
  export function hasStringAsync(): Promise<boolean>;
}
