// Phone adapters for the emergency card: pick ONE contact with the system picker, and open the call screen.
// Never throws to the UI; returns a reason instead. Satchel never reads the whole address book: if the system
// picker is unavailable we return 'unavailable' and the UI falls back to typing. Picked details stay on the phone.
import * as Contacts from 'expo-contacts';
import { Linking } from 'react-native';
import { pickPhone, telUri } from '../core/emergency.ts';
import { permissionState, type PermissionState } from '../core/permissions.ts';

export type PickedContact = { name: string; phone: string | null };
export type PickResult =
  | { ok: true; contact: PickedContact }
  | { ok: false; reason: 'unavailable' | 'denied' | 'cancelled' | 'error'; canAskAgain?: boolean; permission?: PermissionState };

export async function pickContact(): Promise<PickResult> {
  try {
    if (typeof Contacts.presentContactPickerAsync !== 'function') return { ok: false, reason: 'unavailable', permission: 'unavailable' };
    if (typeof Contacts.isAvailableAsync === 'function') {
      const available = await Contacts.isAvailableAsync().catch(() => false);
      if (!available) return { ok: false, reason: 'unavailable', permission: 'unavailable' };
    }
    if (typeof Contacts.requestPermissionsAsync === 'function') {
      const perm = await Contacts.requestPermissionsAsync();
      const state = permissionState(perm);
      // 'limited' (iOS 18 shared-contacts access) still lets the system picker run.
      if (state !== 'granted' && state !== 'limited') return { ok: false, reason: 'denied', canAskAgain: perm.canAskAgain, permission: state };
    }
    const c = await Contacts.presentContactPickerAsync();
    if (!c) return { ok: false, reason: 'cancelled' };
    const name = (c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || '').trim();
    return { ok: true, contact: { name, phone: pickPhone(c.phoneNumbers) } };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export type CallResult = { ok: true } | { ok: false; reason: 'invalid' | 'unavailable' };

/**
 * Opens the phone's call screen for a sanitised number (digits and a leading + only). iOS asks the user to
 * confirm before dialling. Devices that can't call (iPad, simulator) reject, and we report 'unavailable'.
 */
export async function callNumber(raw: string | null | undefined): Promise<CallResult> {
  const uri = telUri(raw);
  if (!uri) return { ok: false, reason: 'invalid' };
  try {
    await Linking.openURL(uri);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
