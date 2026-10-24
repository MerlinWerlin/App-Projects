// Live Lock Screen adapter (docs/PLAN.md §3, §6; docs/LIVELOCK.md). The native module
// `GlazeLivelock` (modules/glaze-livelock, T10) only exists in an iOS development build and
// only works on iOS 26+. Everywhere else, including Expo Go and Android, this adapter
// reports "unavailable" and never throws (start() only rejects for a real native failure
// in a native build, so the caller can say "could not start").
//
// App code must use this adapter, never the modules/ package (which would crash Expo Go).
import Constants from 'expo-constants';
import { Dimensions, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { deviceForScreen, type LoopProject } from '../core/loop';
import { buildLivelockPayload } from '../core/livelockPayload';
import type { LoopArtwork } from '../core/liveLockView';

export type LivelockReason = 'expo-go' | 'android' | 'ios-version' | 'not-built' | null;
export type LivelockAvailability = { available: boolean; reason: LivelockReason };

export type LivelockStateName = 'idle' | 'preparing' | 'playing' | 'paused' | 'stopped' | 'error';
export type LivelockState = {
  state: LivelockStateName;
  index: number;
  count: number;
  prepared: number;
  total: number;
  projectId?: string;
  reason?: string;
  /**
   * T135: what the Lock Screen gets while running: 3:4 animated artwork, square animated artwork,
   * or only the still ("static": this iOS/SDK doesn't list the 3x4 key). Undefined from older builds.
   */
  artwork?: LoopArtwork;
};

export const IDLE_STATE: LivelockState = { state: 'idle', index: 0, count: 0, prepared: 0, total: 0 };

/** Preparing, playing or paused: a Stop control should be shown. */
export function isLivelockRunning(s: LivelockState): boolean {
  return s.state === 'preparing' || s.state === 'playing' || s.state === 'paused';
}

export interface LivelockAdapter {
  isAvailable(): Promise<LivelockAvailability>;
  /**
   * Export these projects (playlist order) and start them on the Lock Screen. Resolves
   * false when unavailable (nothing happens); rejects only if the native module fails.
   */
  start(projects: LoopProject[]): Promise<boolean>;
  stop(): Promise<void>;
  next(): Promise<void>;
  getState(): Promise<LivelockState>;
  /** Subscribe to state changes; returns an unsubscribe function (a no-op when unavailable). */
  addStateListener(listener: (state: LivelockState) => void): () => void;
}

/** Shape the Swift module exposes (modules/glaze-livelock/ios/GlazeLivelockModule.swift). */
type NativeLivelock = {
  isSupported?(): Promise<{ supported: boolean; reason: string | null }>;
  start(json: string): Promise<void>;
  stop(): Promise<void>;
  next?(): Promise<void>;
  getState?(): Promise<unknown>;
  addListener?(event: 'onState', listener: (state: unknown) => void): { remove(): void } | undefined;
};

export const LIVELOCK_MIN_IOS = 26;

export function isExpoGo(): boolean {
  try {
    return (
      String(Constants.executionEnvironment) === 'storeClient' ||
      String((Constants as { appOwnership?: unknown }).appOwnership) === 'expo'
    );
  } catch {
    return false;
  }
}

function iosMajorVersion(): number {
  const n = parseInt(String(Platform.Version), 10);
  return Number.isFinite(n) ? n : 0;
}

let cached: NativeLivelock | null | undefined;

function loadNative(): NativeLivelock | null {
  if (cached !== undefined) return cached;
  let found: NativeLivelock | null = null;
  try {
    const mod =
      typeof requireOptionalNativeModule === 'function'
        ? requireOptionalNativeModule<NativeLivelock>('GlazeLivelock')
        : null;
    found = mod && typeof mod.start === 'function' && typeof mod.stop === 'function' ? mod : null;
  } catch {
    found = null;
  }
  cached = found;
  return found;
}

const STATE_NAMES: readonly LivelockStateName[] = ['idle', 'preparing', 'playing', 'paused', 'stopped', 'error'];

function toState(v: unknown): LivelockState {
  if (!v || typeof v !== 'object') return IDLE_STATE;
  const o = v as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  const state = STATE_NAMES.includes(o.state as LivelockStateName) ? (o.state as LivelockStateName) : 'idle';
  return {
    state,
    index: num(o.index),
    count: num(o.count),
    prepared: num(o.prepared),
    total: num(o.total),
    projectId: typeof o.projectId === 'string' ? o.projectId : undefined,
    reason: typeof o.reason === 'string' ? o.reason : undefined,
    artwork: o.artwork === 'animated-3x4' || o.artwork === 'animated-1x1' || o.artwork === 'static' ? o.artwork : undefined,
  };
}

async function isAvailable(): Promise<LivelockAvailability> {
  try {
    if (Platform.OS !== 'ios') return { available: false, reason: 'android' };
    if (isExpoGo()) return { available: false, reason: 'expo-go' };
    if (iosMajorVersion() < LIVELOCK_MIN_IOS) return { available: false, reason: 'ios-version' };
    const mod = loadNative();
    if (!mod) return { available: false, reason: 'not-built' };
    if (typeof mod.isSupported === 'function') {
      const s = await mod.isSupported();
      if (!s || s.supported !== true) {
        return { available: false, reason: s?.reason === 'ios-version' ? 'ios-version' : 'not-built' };
      }
    }
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: 'not-built' };
  }
}

async function availableNative(): Promise<NativeLivelock | null> {
  const status = await isAvailable();
  return status.available ? loadNative() : null;
}

export const livelock: LivelockAdapter = {
  isAvailable,
  async start(projects) {
    const mod = await availableNative();
    if (!mod) return false; // Unavailable: callers check isAvailable() and show the explainer sheet.
    // The device only sets the aspect of the user's crop; the export is the 3:4 artwork (T135).
    const screen = Dimensions.get('screen');
    const built = buildLivelockPayload(projects, deviceForScreen(screen.width, screen.height));
    if (!built.ok) throw new Error(`livelock: ${built.error}`);
    await mod.start(built.json);
    return true;
  },
  async stop() {
    try {
      const mod = await availableNative();
      if (mod) await mod.stop();
    } catch {
      // Stopping must never surface an error.
    }
  },
  async next() {
    try {
      const mod = await availableNative();
      if (mod && typeof mod.next === 'function') await mod.next();
    } catch {
      // Ignore: the Lock Screen keeps the current loop.
    }
  },
  async getState() {
    try {
      const mod = await availableNative();
      if (!mod || typeof mod.getState !== 'function') return IDLE_STATE;
      return toState(await mod.getState());
    } catch {
      return IDLE_STATE;
    }
  },
  addStateListener(listener) {
    try {
      if (Platform.OS !== 'ios' || isExpoGo()) return () => {};
      const mod = loadNative();
      if (!mod || typeof mod.addListener !== 'function') return () => {};
      const sub = mod.addListener('onState', (v) => listener(toState(v)));
      return () => {
        try {
          sub?.remove();
        } catch {
          // Already removed.
        }
      };
    } catch {
      return () => {};
    }
  },
};
