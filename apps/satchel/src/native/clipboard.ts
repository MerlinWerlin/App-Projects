// Clipboard adapter (expo-clipboard, included in Expo Go). The module is required lazily inside try/catch, so a
// build or Expo Go without the native clipboard module gets `false` back (the UI then says "press and hold to
// copy") instead of crashing. Only text the user asked to copy goes on the clipboard; nothing is read from it.

type ClipboardModule = typeof import('expo-clipboard');

let cached: ClipboardModule | null | undefined;
function load(): ClipboardModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-clipboard') as ClipboardModule;
    cached = mod && typeof mod.setStringAsync === 'function' ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** True when copying can work on this build. */
export const clipboardAvailable = () => load() !== null;

/** Puts `text` on the clipboard. Resolves false (never throws) when it could not. */
export async function copyText(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;
  const mod = load();
  if (!mod) return false;
  try {
    const ok = await mod.setStringAsync(value);
    return ok !== false;
  } catch {
    return false;
  }
}
