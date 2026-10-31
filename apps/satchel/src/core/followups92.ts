// T92 (run 93) follow-ups, pure part: what the membership card editor says when a card photo couldn't be added,
// from the library or the camera. The device side is src/native/journal.ts (pickJournalPhotos / takeJournalPhoto),
// whose failures map to one plain message here and, when the Settings app can fix it, an Open Settings button.
import type { PermissionState } from './permissions.ts';

export type CardPhotoSource = 'library' | 'camera';
export type CardPhotoFailure = 'canceled' | 'denied' | 'unavailable' | 'unreadable' | 'storage';
/** `key` is a catalogue key (src/i18n/en/followups92.ts, followups91.ts or journal.ts). */
export type CardPhotoProblem = { key: string; settings: boolean };

/** null: nothing to say (the picker or camera was simply closed). */
export function cardPhotoProblem(source: CardPhotoSource, reason: CardPhotoFailure, permission?: PermissionState): CardPhotoProblem | null {
  switch (reason) {
    case 'canceled':
      return null;
    case 'denied':
      if (source === 'library') return { key: 'f91.photo.denied', settings: permission !== 'unavailable' };
      // Camera: iOS never asks twice, so a refusal is fixed in Settings; 'ask' (Android can ask again) says so and
      // the camera button itself asks again.
      return permission === 'ask' ? { key: 'f92.camera.ask', settings: false } : { key: 'f92.camera.denied', settings: true };
    case 'unavailable':
      // The library picker never reports this; the camera does when there is none (simulator, some tablets).
      return { key: source === 'camera' ? 'f92.camera.unavailable' : 'journal.edit.photos.unreadable', settings: false };
    case 'storage':
      return { key: 'journal.edit.photos.storage', settings: false };
    default:
      return { key: 'journal.edit.photos.unreadable', settings: false };
  }
}
