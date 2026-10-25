/**
 * Speech-to-text for Voice Follow, via expo-speech-recognition (Apple's / Google's on-device recogniser).
 *
 * Loaded with a guarded require: inside Expo Go the native module is missing, the require throws and this
 * returns null, so Expo Go keeps working and offers Voice Pace instead. In TestFlight / store builds the
 * module is compiled in (config plugin in app.json) and Voice Follow works.
 *
 * Privacy: recognition is requested on-device only, so no audio leaves the phone. iOS stops a continuous
 * session after about a minute, so the session restarts itself until stop() is called.
 */
export interface SpeechSession {
  stop(): void;
}

export interface SpeechEngine {
  start(
    lang: string,
    onTranscript: (text: string) => void,
    onError: (msg: string) => void,
    hints?: string[],
  ): Promise<SpeechSession>;
}

interface Sub {
  remove(): void;
}
interface ResultEvent {
  results?: { transcript?: string }[];
  isFinal?: boolean;
}
interface ErrorEvent {
  error?: string;
  message?: string;
}
interface SpeechModule {
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  supportsOnDeviceRecognition?(): boolean;
  isRecognitionAvailable?(): boolean;
  start(opts: Record<string, unknown>): void;
  stop(): void;
  abort?(): void;
  addListener(event: 'result', cb: (e: ResultEvent) => void): Sub;
  addListener(event: 'error', cb: (e: ErrorEvent) => void): Sub;
  addListener(event: 'end', cb: () => void): Sub;
}

declare const require: (id: string) => unknown;

let cached: SpeechModule | null | undefined;

function loadModule(): SpeechModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition') as { ExpoSpeechRecognitionModule?: SpeechModule };
    const m = mod?.ExpoSpeechRecognitionModule;
    cached = m && typeof m.start === 'function' && typeof m.addListener === 'function' ? m : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Errors that just mean "nothing heard yet": keep listening instead of bothering the speaker. */
const QUIET_ERRORS = new Set(['no-speech', 'speech-timeout', 'aborted']);

export function loadSpeech(): SpeechEngine | null {
  const m = loadModule();
  if (!m) return null;
  try {
    if (m.isRecognitionAvailable && !m.isRecognitionAvailable()) return null;
  } catch {
    return null;
  }
  return {
    async start(lang, onTranscript, onError, hints) {
      const perm = await m.requestPermissionsAsync();
      if (!perm.granted) throw new Error('Microphone and speech recognition permission is off. You can turn it on in Settings.');
      const onDevice = (() => {
        try {
          return m.supportsOnDeviceRecognition ? m.supportsOnDeviceRecognition() : true;
        } catch {
          return true;
        }
      })();
      if (!onDevice) throw new Error('This phone can’t recognise speech on-device for this language. Voice Pace still works.');

      let active = true;
      // Each recogniser session starts its transcript from empty; keep the previous sessions' words so the
      // follower still sees a phrase across a restart.
      let carried = '';
      let current = '';
      const opts = {
        lang,
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: true,
        addsPunctuation: false,
        contextualStrings: (hints ?? []).slice(0, 100),
        iosTaskHint: 'dictation',
      };
      const subs: Sub[] = [
        m.addListener('result', (e) => {
          if (!active) return;
          const text = e.results?.[0]?.transcript ?? '';
          current = text;
          onTranscript(`${carried} ${current}`.trim());
          if (e.isFinal) {
            carried = `${carried} ${current}`.trim().split(/\s+/).slice(-12).join(' ');
            current = '';
          }
        }),
        m.addListener('error', (e) => {
          if (!active || QUIET_ERRORS.has(e.error ?? '')) return;
          onError(e.message || e.error || 'Speech recognition stopped');
        }),
        m.addListener('end', () => {
          if (!active) return;
          carried = `${carried} ${current}`.trim().split(/\s+/).slice(-12).join(' ');
          current = '';
          try {
            m.start(opts);
          } catch {
            /* will surface through 'error' */
          }
        }),
      ];
      m.start(opts);
      return {
        stop() {
          active = false;
          for (const s of subs) s.remove();
          try {
            m.stop();
          } catch {
            /* already stopped */
          }
        },
      };
    },
  };
}
