// Owner 2026-11-15 "Your artwork": the app side of the Custom 1-5 widgets. Calls the widget
// bridge's customArtSlots / setCustomArt / clearCustomArt (GlazeWidgetBridgeModule.swift,
// CustomArtSlots.swift). Pictures are resized and kept in the App Group on this device only; nothing
// is uploaded. Every change reloads every widget timeline (done natively). Returns null when the
// bridge isn't there (Expo Go, Android, an older build), so the section stays hidden.
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { isCustomArtSlot, normaliseCustomArtList, type CustomArtList } from '../core/customArtSlots';

type CustomArtBridge = {
  customArtSlots?(): Promise<string[]>;
  setCustomArt?(slot: number, uri: string): Promise<boolean>;
  clearCustomArt?(slot: number): Promise<boolean>;
};

function bridge(): CustomArtBridge | null {
  if (Platform.OS !== 'ios') return null;
  try {
    const mod = requireOptionalNativeModule<CustomArtBridge>('GlazeWidgetBridge');
    return mod && typeof mod.customArtSlots === 'function' && typeof mod.setCustomArt === 'function' && typeof mod.clearCustomArt === 'function'
      ? mod
      : null;
  } catch {
    return null;
  }
}

export const customArt = {
  /** The five slots, or null without the native bridge. */
  async list(): Promise<CustomArtList | null> {
    const mod = bridge();
    if (!mod?.customArtSlots) return null;
    try {
      return normaliseCustomArtList(await mod.customArtSlots());
    } catch {
      return null;
    }
  },
  /** Resizes the picture at `uri` (file://) into `slot` (1-5), replacing any earlier one. */
  async set(slot: number, uri: string): Promise<boolean> {
    const mod = bridge();
    if (!mod?.setCustomArt || !isCustomArtSlot(slot) || !uri) return false;
    try {
      return (await mod.setCustomArt(slot, uri)) === true;
    } catch {
      return false;
    }
  },
  async clear(slot: number): Promise<boolean> {
    const mod = bridge();
    if (!mod?.clearCustomArt || !isCustomArtSlot(slot)) return false;
    try {
      return (await mod.clearCustomArt(slot)) === true;
    } catch {
      return false;
    }
  },
};
