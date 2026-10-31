// T97: opens Messages with recipients and a body filled in (an sms: link from src/core/safecheck.ts smsUrl). The
// person still presses Send; nothing is sent from here. Resolves false (never throws) when the device can't open it.
import { Linking, Platform } from 'react-native';
import type { SmsPlatform } from '../core/safecheck.ts';

export const smsPlatform = (): SmsPlatform => (Platform.OS === 'android' ? 'android' : 'ios');

export async function openSms(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
