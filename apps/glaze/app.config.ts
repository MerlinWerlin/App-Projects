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
import { createRequire } from 'node:module';

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

/** Config-plugin package names a piece needs (string or [name, options] entries). */
function pluginPackages(piece: NativePiece): string[] {
  return (piece.plugins ?? []).map((p) => (Array.isArray(p) ? String((p as unknown[])[0]) : String(p)));
}

/**
 * A piece whose config plugin isn't installed is skipped with a warning instead of failing `expo config`
 * (owner TestFlight fix 24 Oct: a missing @bacons/apple-targets stopped the whole build). The widget piece
 * switches itself on once the package is in package.json and the lockfile.
 */
function installed(name: string): boolean {
  try {
    createRequire(join(__dirname, 'package.json')).resolve(`${name}/package.json`);
    return true;
  } catch {
    return false;
  }
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
    const missing = pluginPackages(piece).filter((name) => !installed(name));
    if (missing.length > 0) {
      // D145-2: loud, not quiet. On Expo's build servers the post-install hook has already stopped the
      // build if the widget tool is missing; here (PC / CI config reads) it is only reported.
      console.error(`[glaze] WARNING native piece skipped, not installed: ${missing.join(', ')} (widgets will be missing from this build)`);
      continue;
    }
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
