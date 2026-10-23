import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Speak a status or error line to VoiceOver (night 23 Oct, cross-app from Linework fb-1023 "tapping Unlock
 * Plus did nothing"). accessibilityLiveRegion and accessibilityRole="alert" are not spoken on iOS, so a
 * remote key, app launch or keyboard send that failed showed its red line but stayed silent for VoiceOver
 * users: the button seemed to do nothing. Android keeps its live regions (speaking there too would double up).
 * The same text is spoken at most once per DEDUPE_MS, so two mounted screens showing one error speak once.
 */
export const DEDUPE_MS = 1500;
let lastText = '';
let lastAt = 0;

/** Announce `text` on iOS. Never throws. */
export function announce(text: string | null | undefined, now: number = Date.now()): void {
  const msg = text?.trim();
  if (!msg || Platform.OS !== 'ios') return;
  if (msg === lastText && now - lastAt < DEDUPE_MS) return;
  lastText = msg;
  lastAt = now;
  try {
    AccessibilityInfo.announceForAccessibility(msg);
  } catch {
    // Screen reader API unavailable: the line is still on screen.
  }
}

/** Announce `text` each time it changes to a new non-empty value. */
export function useAnnounce(text: string | null | undefined): void {
  useEffect(() => {
    announce(text);
  }, [text]);
}
