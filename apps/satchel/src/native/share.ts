// Text share sheet (React Native's built-in Share API, part of every build, Expo Go included). T71 "Share plan"
// hands it the plain-text itinerary only: no files, no attachments. Resolves 'failed' (never throws) when the sheet
// could not open, so the screen can say so and offer Try again.
import { Share } from 'react-native';

export type ShareTextResult = 'shared' | 'dismissed' | 'failed';

export async function shareText(message: string, title: string): Promise<ShareTextResult> {
  if (!message.trim()) return 'failed';
  try {
    const r = await Share.share({ message, title }, { subject: title, dialogTitle: title });
    return r.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}
