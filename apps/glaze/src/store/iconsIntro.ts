// The icons walkthrough's "seen" flag (src/core/iconsIntro.ts). Best effort: a failed read counts as
// not seen (the gentle walkthrough again), a failed write is ignored.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ICONS_INTRO_SEEN_KEY } from '../core/iconsIntro';

export async function iconsIntroSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ICONS_INTRO_SEEN_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markIconsIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ICONS_INTRO_SEEN_KEY, '1');
  } catch {
    // Best effort.
  }
}
