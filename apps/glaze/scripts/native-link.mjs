// Native linking follows the build profile (oversight D128-2, T120).
//
// Expo autolinking reads `expo.autolinking.nativeModulesDir` from package.json only (an app config
// cannot set it), so this script rewrites that one field before install:
//   GLAZE_NATIVE=1  -> "./modules"      (development, preview, production-native: link Glaze's modules)
//   anything else   -> "./modules-off"  (production / first TestFlight build, Expo Go: link none)
//
// EAS runs it automatically as the `eas-build-pre-install` npm hook, with the profile's env set.
// On a PC: `node scripts/native-link.mjs 1` before `npx expo prebuild`, `node scripts/native-link.mjs 0` after.
// The committed package.json keeps "./modules-off", the safe default.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const NATIVE_DIR = './modules';
export const OFF_DIR = './modules-off';

/** Which folder autolinking scans for a given GLAZE_NATIVE value. */
export function nativeModulesDirFor(flag) {
  return String(flag ?? '').trim() === '1' ? NATIVE_DIR : OFF_DIR;
}

/** Returns package.json text with nativeModulesDir set for the flag; everything else unchanged. */
export function linkPackageJson(text, flag) {
  const pkg = JSON.parse(text);
  pkg.expo = pkg.expo ?? {};
  pkg.expo.autolinking = pkg.expo.autolinking ?? {};
  pkg.expo.autolinking.nativeModulesDir = nativeModulesDirFor(flag);
  return JSON.stringify(pkg, null, 2) + '\n';
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const file = join(root, 'package.json');
  const flag = process.argv[2] ?? process.env.GLAZE_NATIVE;
  const before = readFileSync(file, 'utf8');
  const after = linkPackageJson(before, flag);
  if (after !== before) writeFileSync(file, after);
  console.log(`native-link: GLAZE_NATIVE=${flag ?? '(unset)'} -> nativeModulesDir ${nativeModulesDirFor(flag)}`);
}
