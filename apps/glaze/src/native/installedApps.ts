// T229: asks iOS whether the popular apps in src/core/installedProbe.ts are installed, using
// Linking.canOpenURL on the schemes declared in Info.plist LSApplicationQueriesSchemes
// (native-plugins/queryschemes.json, native builds only).
//
// Falls back cleanly: in Expo Go, Android or a build without the declaration iOS answers false (or
// throws) for undeclared schemes, so every answer is false and nothing is selected. Never throws.
// Nothing leaves the phone: the answers stay in memory and only tick those apps in Icon Studio.
import { Linking, Platform } from 'react-native';
import { probeUrlFor } from '../core/installedProbe';

const TIMEOUT_MS = 2500;

function withTimeout(p: Promise<boolean>, ms: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v === true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
}

/** scheme -> installed, for each bare scheme. All false off iOS or on any error. */
export async function probeSchemes(schemes: readonly string[], timeoutMs: number = TIMEOUT_MS): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const s of schemes) out[s] = false;
  if (Platform.OS !== 'ios') return out;
  try {
    const answers = await Promise.all(
      schemes.map((s) => {
        let p: Promise<boolean>;
        try {
          p = Linking.canOpenURL(probeUrlFor(s));
        } catch {
          p = Promise.resolve(false);
        }
        return withTimeout(p, timeoutMs);
      }),
    );
    schemes.forEach((s, i) => {
      out[s] = answers[i] === true;
    });
  } catch {
    // Keep every answer false.
  }
  return out;
}
