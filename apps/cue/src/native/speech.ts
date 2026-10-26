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
import { selectSpeechLocale } from '../core/speechLocale';
import { t } from '../i18n';

export interface SpeechSession {
  stop(): void;
}

export interface SpeechEngine {
  start(
    lang: string,
    onTranscript: (text: string) => void,
    onError: (msg: string) => void,
    hints?: string[],
    onListening?: () => void,
    signal?: AbortSignal,
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
  getSupportedLocales?(opts: Record<string, never>): Promise<{ locales: string[]; installedLocales: string[] }>;
  isRecognitionAvailable?(): boolean;
  start(opts: Record<string, unknown>): void;
  stop(): void;
  abort?(): void;
  addListener(event: 'result', cb: (e: ResultEvent) => void): Sub;
  addListener(event: 'error', cb: (e: ErrorEvent) => void): Sub;
  addListener(event: 'end', cb: () => void): Sub;
  addListener(event: 'start', cb: () => void): Sub;
}

declare const require: (id: string) => unknown;

let cached: SpeechModule | null | undefined;

function loadModule(): SpeechModule | null {
  if (cached !== undefined) return cached;
  try {
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
    async start(lang, onTranscript, onError, hints, onListening, signal) {
      const checkCancelled = () => {
        if (signal?.aborted) throw new Error('Speech start cancelled');
      };
      checkCancelled();
      const perm = await m.requestPermissionsAsync();
      checkCancelled();
      if (!perm.granted) throw new Error(t('voice.permissionOff'));
      let device = 'en-US';
      try { device = Intl.DateTimeFormat().resolvedOptions().locale; } catch { /* English fallback */ }
      let supported: string[] | undefined;
      try { supported = (await m.getSupportedLocales?.({}))?.locales; } catch { /* Older Android service */ }
      checkCancelled();
      const speechLocale = selectSpeechLocale(lang, device, supported);
      if (!speechLocale) throw new Error(t('voice.languageUnavailable'));
      const onDevice = (() => {
        try {
          return m.supportsOnDeviceRecognition ? m.supportsOnDeviceRecognition() : true;
        } catch {
          return true;
        }
      })();
      if (!onDevice) throw new Error(t('voice.onDeviceUnavailable'));

      let active = true;
      // Each recogniser session starts its transcript from empty; keep the previous sessions' words so the
      // follower still sees a phrase across a restart.
      let carried = '';
      let current = '';
      let restart: ReturnType<typeof setTimeout> | undefined;
      const subs: Sub[] = [];
      const stop = () => {
        if (!active) return;
        active = false;
        clearTimeout(restart);
        for (const sub of subs) sub.remove();
        signal?.removeEventListener('abort', stop);
        try { if (m.abort) m.abort(); else m.stop(); } catch { /* Already stopped */ }
      };
      const fail = (msg: string) => {
        if (!active) return;
        stop();
        onError(msg);
      };
      const opts = {
        lang: speechLocale,
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: true,
        addsPunctuation: false,
        contextualStrings: (hints ?? []).slice(0, 100),
        iosTaskHint: 'dictation',
      };
      subs.push(
        m.addListener('start', () => { if (active) onListening?.(); }),
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
          fail(e.error === 'language-not-supported' || e.error === 'language-unavailable'
            ? t('voice.languageUnavailable')
            : e.message || e.error || t('voice.stopped'));
        }),
        m.addListener('end', () => {
          if (!active) return;
          carried = `${carried} ${current}`.trim().split(/\s+/).slice(-12).join(' ');
          current = '';
          clearTimeout(restart);
          restart = setTimeout(() => {
            if (!active) return;
            try { m.start(opts); } catch (e) {
              fail(e instanceof Error ? e.message : t('voice.stopped'));
            }
          }, 250);
        }),
      );
      signal?.addEventListener('abort', stop);
      try { m.start(opts); } catch (e) { stop(); throw e; }
      return { stop };
    },
  };
}
