// Expo config. Base settings live in app.json; this file only adds the native pieces
// (config plugins, Info.plist keys, entitlements) for development/production builds.
//
// Native pieces are applied only when GLAZE_NATIVE=1 (set by the EAS build profiles and by
// `GLAZE_NATIVE=1 npx expo prebuild`). Expo Go trial runs never load native plugins, so a
// missing or mis-versioned native package can't stop the trial from starting.
//
// Each native feature owns one file in native-plugins/*.json:
//   { "plugins": [...], "infoPlist": {...}, "entitlements": {...}, "androidPermissions": [...] }
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type NativePiece = {
  plugins?: NonNullable<ExpoConfig['plugins']>;
  infoPlist?: Record<string, unknown>;
  entitlements?: Record<string, unknown>;
  androidPermissions?: string[];
};

function nativePieces(): NativePiece[] {
  const dir = join(__dirname, 'native-plugins');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f: string) => f.endsWith('.json'))
    .sort()
    .map((f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as NativePiece);
}

function mergeUnique(a: unknown, b: unknown): unknown {
  if (Array.isArray(a) && Array.isArray(b)) return Array.from(new Set([...a, ...b]));
  return b;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  if (process.env.GLAZE_NATIVE !== '1') return base;

  const plugins = [...(base.plugins ?? [])];
  const infoPlist: Record<string, unknown> = { ...(base.ios?.infoPlist ?? {}) };
  const entitlements: Record<string, unknown> = { ...(base.ios?.entitlements ?? {}) };
  const permissions = new Set<string>(base.android?.permissions ?? []);

  for (const piece of nativePieces()) {
    plugins.push(...(piece.plugins ?? []));
    for (const [k, v] of Object.entries(piece.infoPlist ?? {})) infoPlist[k] = mergeUnique(infoPlist[k], v);
    for (const [k, v] of Object.entries(piece.entitlements ?? {})) entitlements[k] = mergeUnique(entitlements[k], v);
    for (const p of piece.androidPermissions ?? []) permissions.add(p);
  }

  return {
    ...base,
    plugins,
    ios: { ...base.ios, infoPlist, entitlements },
    android: { ...base.android, permissions: Array.from(permissions) },
  };
};
