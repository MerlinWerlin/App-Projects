/**
 * Phone speech-to-text adapter for the "Hold to talk" button (src/core/voice.ts SpeechToText).
 *
 * Today this always returns null: no speech package is installed, and adding one would need a
 * native module that Expo Go does not have (oversight directive D4-1: the app must keep booting
 * in Expo Go). With null, VoiceController uses native TV voice where the driver supports it
 * (the demo TV does) and otherwise opens the keyboard sheet.
 *
 * Dev-build plan (after T18 PC verification): add `expo-speech-recognition`, then load it here
 * through a guarded `require` inside try/catch (same pattern as src/native/lanWss.ts) and wrap it
 * as a SpeechToText. Request on-device recognition (requiresOnDeviceRecognition / EXTRA_PREFER_OFFLINE)
 * so no audio leaves the phone; only the final transcript is sent, and only to the TV on the LAN.
 * Recognition language (owner-1016 R3): SpeechToText.start(onPartial, lang) receives the active app
 * language's BCP-47 tag from VoiceController (src/core/voice.ts voiceLanguage(), e.g. 'fr-FR'); pass it
 * straight through as the recognizer's `lang` option. Expo Go keeps the keyboard fallback.
 * Do not add a require for that package before it is installed: Metro would fail to bundle.
 */
import type { SpeechToText } from '../core/voice';

export function loadSpeechToText(): SpeechToText | null {
  return null;
}

export function hasSpeechToText(): boolean {
  return loadSpeechToText() !== null;
}
