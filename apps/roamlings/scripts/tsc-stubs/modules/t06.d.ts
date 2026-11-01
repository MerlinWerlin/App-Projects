// Stubs added by T06 for modules it imports (see ../README.md). SDK 57 public API, members Satchel uses.
declare module 'expo-local-authentication' {
  export enum AuthenticationType {
    FINGERPRINT = 1,
    FACIAL_RECOGNITION = 2,
    IRIS = 3,
  }
  export enum SecurityLevel {
    NONE = 0,
    SECRET = 1,
    BIOMETRIC_WEAK = 2,
    BIOMETRIC_STRONG = 3,
  }
  export type LocalAuthenticationError =
    | 'not_enrolled'
    | 'user_cancel'
    | 'app_cancel'
    | 'not_available'
    | 'lockout'
    | 'no_space'
    | 'timeout'
    | 'unable_to_process'
    | 'unknown'
    | 'system_cancel'
    | 'user_fallback'
    | 'invalid_context'
    | 'passcode_not_set'
    | 'authentication_failed';
  export type LocalAuthenticationResult = { success: true } | { success: false; error: LocalAuthenticationError; warning?: string };
  export type BiometricsSecurityLevel = 'weak' | 'strong';
  export type LocalAuthenticationOptions = {
    promptMessage?: string;
    promptSubtitle?: string;
    promptDescription?: string;
    cancelLabel?: string;
    disableDeviceFallback?: boolean;
    requireConfirmation?: boolean;
    biometricsSecurityLevel?: BiometricsSecurityLevel;
    fallbackLabel?: string;
  };
  export function hasHardwareAsync(): Promise<boolean>;
  export function supportedAuthenticationTypesAsync(): Promise<AuthenticationType[]>;
  export function isEnrolledAsync(): Promise<boolean>;
  export function getEnrolledLevelAsync(): Promise<SecurityLevel>;
  export function authenticateAsync(options?: LocalAuthenticationOptions): Promise<LocalAuthenticationResult>;
  export function cancelAuthenticate(): Promise<void>;
}

// Options inlined (no named type) so a second `declare module 'expo-sharing'` from another feature merges cleanly.
declare module 'expo-sharing' {
  export function isAvailableAsync(): Promise<boolean>;
  export function shareAsync(url: string, options?: { mimeType?: string; UTI?: string; dialogTitle?: string }): Promise<void>;
}
