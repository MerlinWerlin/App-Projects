/**
 * Checks once on mount for an over-the-air update and downloads it quietly; it applies on the next
 * cold start. No-op in Expo Go, development and where expo-updates is missing. Never throws.
 */
import { useEffect } from 'react';
import { checkForQuietUpdate } from '../native/updates';

export function useQuietUpdate(): void {
  useEffect(() => {
    void checkForQuietUpdate().catch(() => undefined);
  }, []);
}
