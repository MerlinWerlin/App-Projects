// Clipboard adapter (expo-clipboard, included in Expo Go). The module is required lazily inside try/catch, so a
// build or Expo Go without the native clipboard module gets `false` back (the UI then says "press and hold to
// copy") instead of crashing. Only text the user asked to copy goes on the clipboard. It is read only when the
// user taps "Paste from clipboard" (T77 Paste a booking), and what is read stays on the phone.

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

/** The clipboard's text, read only when the user asks (T77). Resolves null (never throws) when it can't be read. */
export async function readText(): Promise<string | null> {
  const mod = load();
  if (!mod || typeof mod.getStringAsync !== 'function') return null;
  try {
    const text = await mod.getStringAsync();
    return typeof text === 'string' ? text : null;
  } catch {
    return null;
  }
}
