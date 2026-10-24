/**
 * Speech-to-text seam for Voice Follow.
 *
 * Expo Go has no speech-recognition native module, so this returns null there and the app offers
 * Voice Pace (mic-level gating, src/core/pace.ts) instead. For the dev/TestFlight build:
 *   npx expo install expo-speech-recognition   (add its config plugin to app.json)
 * then replace the body of loadSpeech() with a guarded require of 'expo-speech-recognition' that:
 *   - requests permission, starts with { lang, interimResults: true, continuous: true, requiresOnDeviceRecognition: true }
 *   - forwards each 'result' event's transcript to onTranscript
 * The alignment logic (src/core/follow.ts) is already written and tested.
 * Do not add the require before the package is installed: Metro would fail to bundle.
 */
export interface SpeechSession {
  stop(): void;
}

export interface SpeechEngine {
  start(lang: string, onTranscript: (text: string) => void, onError: (msg: string) => void): Promise<SpeechSession>;
}

export function loadSpeech(): SpeechEngine | null {
  return null;
}
