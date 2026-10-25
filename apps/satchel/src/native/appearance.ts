// System appearance override (T33): Light or Dark in Settings also turns system alerts, the keyboard and other
// system UI light or dark (react-native Appearance.setColorScheme); System hands control back to the phone.
// Guarded so a host without it (or one that rejects the value) never crashes; the app's own colours come from
// tokens either way.
import { Appearance } from 'react-native';
import { nativeScheme } from '../core/settings.ts';

export function applySystemAppearance(pref: unknown): void {
  try {
    if (typeof Appearance?.setColorScheme === 'function') Appearance.setColorScheme(nativeScheme(pref));
  } catch {
    // older hosts: system UI keeps following the phone
  }
}
