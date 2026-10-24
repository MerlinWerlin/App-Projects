// Small phone services behind one module: haptics (respecting the setting), sharing with real error messages,
// storage, the phone language, and opening Settings / mail. Never throws to the UI.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Localization from 'expo-localization';
import * as Sharing from 'expo-sharing';
import { Linking, Share } from 'react-native';

let hapticsOn = true;
export const setHapticsEnabled = (on: boolean) => {
  hapticsOn = on;
};

export const haptic = {
  tap: () => hapticsOn && Haptics.selectionAsync().catch(() => {}),
  press: () => hapticsOn && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => hapticsOn && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => hapticsOn && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

export type ShareResult = { ok: true } | { ok: false; reason: 'unavailable' | 'error'; detail?: string };

export async function shareFile(uri: string, title: string): Promise<ShareResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'unavailable' };
    await Sharing.shareAsync(uri, { mimeType: 'audio/wav', UTI: 'com.microsoft.waveform-audio', dialogTitle: title });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'error', detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function shareText(message: string): Promise<ShareResult> {
  try {
    await Share.share({ message });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'error', detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

export async function loadList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const j = raw ? JSON.parse(raw) : [];
    return Array.isArray(j) ? (j as T[]) : [];
  } catch {
    return [];
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stays in memory this session
  }
}

export const storage = {
  get: (k: string) => AsyncStorage.getItem(k),
  set: (k: string, v: string) => AsyncStorage.setItem(k, v),
};

export function phoneLanguages(): string[] {
  try {
    return Localization.getLocales().map((l) => l.languageTag);
  } catch {
    return ['en'];
  }
}

export const openSettings = () => Linking.openSettings().catch(() => {});
export const openMail = (subject: string, body: string) =>
  Linking.openURL(`mailto:jaredbradley272@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`).catch(() => {});
