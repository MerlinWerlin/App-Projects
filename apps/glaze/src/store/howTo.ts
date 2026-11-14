// The "seen once" memory for the how-to videos (src/core/howTo.ts). Best effort: a failed read counts
// as seen (never a surprise video in a loop), a failed write is ignored.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { howToSeenKey, type HowToCategory } from '../core/howTo';

export async function howToSeen(category: HowToCategory): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(howToSeenKey(category))) === '1';
  } catch {
    return true;
  }
}

export async function markHowToSeen(category: HowToCategory): Promise<void> {
  try {
    await AsyncStorage.setItem(howToSeenKey(category), '1');
  } catch {
    // Best effort.
  }
}
