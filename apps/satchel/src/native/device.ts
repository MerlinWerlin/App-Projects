// Small phone services behind one module: haptics (respecting the setting), storage, the phone language,
// opening Settings. Every call is guarded so Expo Go never crashes and the UI never sees a throw.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Localization from 'expo-localization';
import { Linking } from 'react-native';

let hapticsOn = true;
export const setHapticsEnabled = (on: boolean) => {
  hapticsOn = on;
};

export const haptic = {
  tap: () => {
    if (hapticsOn) Haptics.selectionAsync().catch(() => {});
  },
  press: () => {
    if (hapticsOn) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success: () => {
    if (hapticsOn) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};

export async function loadJson<T extends object>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stays in memory this session
  }
}

export function phoneLanguages(): string[] {
  try {
    return Localization.getLocales().map((l) => l.languageTag);
  } catch {
    return ['en'];
  }
}

export const openSettings = () => {
  Linking.openSettings().catch(() => {});
};
