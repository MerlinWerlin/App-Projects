// T14 Save to Satchel: expo-router's hook for every URL the system opens the app with (cold start and while running).
// A file shared to Satchel (iOS Open in / Copy to Satchel gives a file:// URL, Android a content:// one) is sent to
// the Open in screen (app/openin/index.tsx) with the URL as a parameter, so the router never tries to match it as a
// path and never shows an unmatched-route screen. Every other URL passes through unchanged. Never throws: on an
// older build without the document types no file URL arrives, and any surprise here falls back to the URL as given.
import { incomingRedirect } from '../src/core/openin.ts';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return incomingRedirect(path) ?? path;
  } catch {
    return path;
  }
}
