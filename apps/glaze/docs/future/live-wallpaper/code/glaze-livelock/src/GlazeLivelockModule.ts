// Typed wrapper for the native GlazeLivelock module (iOS dev builds only).
// App code must NOT import this package: requireNativeModule throws where the module is
// missing (Expo Go, Android). App code goes through src/native/livelock.ts, which uses
// requireOptionalNativeModule('GlazeLivelock') and falls back cleanly.
import { NativeModule, requireNativeModule } from 'expo';

export type GlazeLivelockStateName = 'idle' | 'preparing' | 'playing' | 'paused' | 'stopped' | 'error';

export type GlazeLivelockState = {
  state: GlazeLivelockStateName;
  /** Index of the loop on the Lock Screen within the playlist. */
  index: number;
  count: number;
  /** Loops exported so far / in total while preparing. */
  prepared: number;
  total: number;
  projectId?: string;
  /** e.g. 'user', 'low-power', 'interrupted', 'media-reset', or an error description. */
  reason?: string;
};

export type GlazeLivelockSupport = {
  supported: boolean;
  reason: 'ios-version' | 'not-built' | null;
};

export type GlazeLivelockEvents = {
  onState: (state: GlazeLivelockState) => void;
};

declare class GlazeLivelockNativeModule extends NativeModule<GlazeLivelockEvents> {
  isSupported(): Promise<GlazeLivelockSupport>;
  /** JSON of LivelockPayload (src/core/livelockPayload.ts). */
  start(json: string): Promise<void>;
  stop(): Promise<void>;
  next(): Promise<void>;
  getState(): Promise<GlazeLivelockState>;
}

export default requireNativeModule<GlazeLivelockNativeModule>('GlazeLivelock');
