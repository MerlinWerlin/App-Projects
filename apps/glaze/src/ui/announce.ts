// Speak a status line to VoiceOver (night 23 Oct, cross-app from Couch's apps screen and Linework fb-1023
// "Unlock Plus did nothing"): accessibilityLiveRegion only works on Android, so on iOS a save / restore /
// purchase result that appears as text below a button was silent for VoiceOver users. Android keeps its live
// regions (announcing there too would speak twice).
import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/** Announce `text` once on iOS. Never throws. */
export function announce(text: string | null | undefined): void {
  const msg = text?.trim();
  if (!msg || Platform.OS !== 'ios') return;
  try {
    AccessibilityInfo.announceForAccessibility(msg);
  } catch {
    // Screen reader API unavailable: the text is still on screen.
  }
}

/**
 * Announce `text` whenever `trigger` changes to a new value (pass the status object itself, so the same
 * message set twice in a row is spoken again).
 */
export function useAnnounce(text: string | null | undefined, trigger: unknown = text): void {
  useEffect(() => {
    if (trigger == null) return;
    announce(text);
    // Speak per new status only (text follows trigger).
  }, [trigger]);
}
