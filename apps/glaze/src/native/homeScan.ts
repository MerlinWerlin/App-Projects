// Home Screen scan adapter (T171). The native module `GlazeHomeScan` (modules/glaze-home-scan,
// Vision text recognition) only exists in the iOS native build (GLAZE_NATIVE=1). Everywhere else,
// including Expo Go, Android, web and the plain `production` build, this adapter reports
// "unavailable" and never throws; the screen then offers manual picking instead.
// Text recognition runs on the phone: the screenshots are never uploaded.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { OcrObservation } from '../core/homeScan';

export type HomeScanReason = 'expo-go' | 'android' | 'not-built' | null;
export type HomeScanAvailability = { available: boolean; reason: HomeScanReason };

export type RecognizeResult = { ok: true; lines: OcrObservation[] } | { ok: false; reason: 'unavailable' | 'failed' };

export interface HomeScanAdapter {
  isAvailable(): Promise<HomeScanAvailability>;
  recognizeText(fileUri: string): Promise<RecognizeResult>;
}

/** Shape the T171 Swift module exposes (modules/glaze-home-scan/index.ts). */
type NativeHomeScan = { recognizeText(fileUri: string): Promise<unknown> };

function isExpoGo(): boolean {
  try {
    return (
      String(Constants.executionEnvironment) === 'storeClient' ||
      String((Constants as { appOwnership?: unknown }).appOwnership) === 'expo'
    );
  } catch {
    return false;
  }
}

let cached: NativeHomeScan | null | undefined;

function loadNative(): NativeHomeScan | null {
  if (cached !== undefined) return cached;
  let found: NativeHomeScan | null = null;
  try {
    const mod =
      typeof requireOptionalNativeModule === 'function'
        ? requireOptionalNativeModule<NativeHomeScan>('GlazeHomeScan')
        : null;
    found = mod && typeof mod.recognizeText === 'function' ? mod : null;
  } catch {
    found = null;
  }
  cached = found;
  return found;
}

async function isAvailable(): Promise<HomeScanAvailability> {
  try {
    if (Platform.OS !== 'ios') return { available: false, reason: 'android' };
    if (isExpoGo()) return { available: false, reason: 'expo-go' };
    if (!loadNative()) return { available: false, reason: 'not-built' };
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: 'not-built' };
  }
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Keeps only well-formed lines from the native result (defensive: the bridge is untyped). */
function toObservations(raw: unknown): OcrObservation[] {
  if (!Array.isArray(raw)) return [];
  const out: OcrObservation[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.text !== 'string' || !o.text.trim()) continue;
    out.push({ text: o.text, confidence: num(o.confidence), x: num(o.x), y: num(o.y), w: num(o.w), h: num(o.h) });
  }
  return out;
}

export const homeScan: HomeScanAdapter = {
  isAvailable,
  async recognizeText(fileUri) {
    try {
      const status = await isAvailable();
      const mod = status.available ? loadNative() : null;
      if (!mod) return { ok: false, reason: 'unavailable' };
      if (typeof fileUri !== 'string' || !fileUri) return { ok: false, reason: 'failed' };
      const raw = await mod.recognizeText(fileUri);
      return { ok: true, lines: toObservations(raw) };
    } catch {
      return { ok: false, reason: 'failed' };
    }
  },
};
