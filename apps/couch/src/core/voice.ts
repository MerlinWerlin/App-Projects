import { getLocale, t as tr } from '../i18n/core';
import { withCopy } from '../i18n/lazyCopy';
import { localeInfo } from '../i18n/locales';
import type { TvDriver, VoiceStream } from './driver';
import { describeError } from './session';
import { DriverError } from './types';

/**
 * Hold-to-talk voice (prototype v2 bindVoice, PLAN 6b). Pure strategy + a small state machine;
 * the React button only forwards press/release and shows the notes.
 *
 * - 'native':   the driver has the 'voice' capability and beginVoice(): audio goes to the TV protocol.
 * - 'stt':      the phone's speech-to-text gives a transcript; we open the TV search (SEARCH key,
 *               skipped when the driver does not map it) and type the transcript with sendText.
 * - 'keyboard': neither is available (Expo Go with a real TV): open the keyboard sheet instead.
 */
export type VoiceMode = 'native' | 'stt' | 'keyboard';

/** Phone speech-to-text (src/native/speech.ts). On-device; only the transcript goes to the TV. */
export interface SpeechToText {
  available(): boolean;
  /**
   * Starts listening. onPartial receives the running transcript. `lang` is the BCP-47 recognition
   * language: the app's selected language (owner-1016 R3), e.g. 'fr-FR'.
   */
  start(onPartial: (text: string) => void, lang?: string): Promise<void>;
  /** Stops listening and resolves the final transcript ('' when nothing was heard). */
  stop(): Promise<string>;
  cancel(): void;
}

/** Optional microphone feed for native voice (PCM 16-bit mono chunks). Not wired in Expo Go. */
export interface MicSource {
  start(onChunk: (chunk: Uint8Array) => void): Promise<void>;
  stop(): void;
}

export type VoiceState = 'idle' | 'listening' | 'sending';

/** Notes under the voice button, translated on read (t() getters). */
export const VOICE_NOTES: {
  readonly listening: string;
  readonly keyboard: string;
  readonly empty: string;
  readonly noTv: string;
  readonly sentNative: string;
  readonly sent: (text: string) => string;
} = withCopy(
  {
    listening: '',
    keyboard: '',
    empty: '',
    noTv: '',
    sentNative: '',
    sent: (text: string): string => tr('core.voice.sent', { text }),
  },
  {
    listening: 'core.voice.listening',
    keyboard: 'core.voice.keyboard',
    empty: 'core.voice.empty',
    noTv: 'core.voice.noTv',
    sentNative: 'core.voice.sentNative',
  },
);

export function voiceMode(driver: TvDriver | null | undefined, sttAvailable: boolean): VoiceMode {
  if (driver && driver.capabilities.has('voice') && typeof driver.beginVoice === 'function') return 'native';
  if (sttAvailable) return 'stt';
  return 'keyboard';
}

/**
 * STT fallback send: open the TV search where the driver maps SEARCH, then type the text.
 * A driver without a SEARCH mapping throws DriverError('unsupported'); we then just type.
 */
export async function sendTranscript(driver: TvDriver, text: string): Promise<void> {
  try {
    await driver.sendKey('SEARCH');
  } catch (e) {
    if (!(e instanceof DriverError && e.code === 'unsupported')) throw e;
  }
  await driver.sendText(text);
}

export interface VoiceControllerDeps {
  getDriver: () => TvDriver | null;
  stt?: SpeechToText | null;
  mic?: MicSource | null;
  onNote: (text: string) => void;
  onOpenKeyboard: () => void;
  onState?: (s: VoiceState) => void;
  /** BCP-47 recognition language; defaults to the active app language (voiceLanguage()). */
  language?: () => string;
}

/** Speech recognition language for the active app language, e.g. 'ja-JP' (owner-1016 R3). */
export function voiceLanguage(): string {
  return localeInfo(getLocale()).bcp47;
}

function streamTranscript(stream: VoiceStream): string | null {
  const t = (stream as { transcript?: unknown }).transcript;
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}

/** idle → listening (press) → sending (release) → idle. cancel() returns to idle without sending. */
export class VoiceController {
  private st: VoiceState = 'idle';
  private mode: VoiceMode | null = null;
  private driver: TvDriver | null = null;
  private stream: VoiceStream | null = null;
  /** Resolves when press() has finished starting (release may arrive first). */
  private starting: Promise<boolean> | null = null;
  private session = 0;

  constructor(private readonly deps: VoiceControllerDeps) {}

  get state(): VoiceState {
    return this.st;
  }

  /** Mode the next press would use (for labels / hints). */
  currentMode(): VoiceMode {
    return voiceMode(this.deps.getDriver(), this.sttAvailable());
  }

  private sttAvailable(): boolean {
    try {
      return !!this.deps.stt?.available();
    } catch {
      return false;
    }
  }

  private set(s: VoiceState): void {
    if (this.st === s) return;
    this.st = s;
    this.deps.onState?.(s);
  }

  private fail(e: unknown): void {
    this.cleanup();
    this.set('idle');
    this.deps.onNote(describeError(e));
  }

  private cleanup(): void {
    try {
      this.deps.mic?.stop();
    } catch {
      // ignore
    }
    this.stream = null;
    this.starting = null;
    this.mode = null;
    this.driver = null;
  }

  press(): Promise<void> {
    if (this.st !== 'idle') return Promise.resolve();
    const driver = this.deps.getDriver();
    if (!driver) {
      this.deps.onNote(VOICE_NOTES.noTv);
      return Promise.resolve();
    }
    const mode = voiceMode(driver, this.sttAvailable());
    if (mode === 'keyboard') {
      this.deps.onNote(VOICE_NOTES.keyboard);
      this.deps.onOpenKeyboard();
      return Promise.resolve();
    }
    const id = ++this.session;
    this.mode = mode;
    this.driver = driver;
    this.set('listening');
    this.deps.onNote(VOICE_NOTES.listening);
    this.starting = this.start(id, mode, driver);
    return this.starting.then(() => undefined);
  }

  private async start(id: number, mode: VoiceMode, driver: TvDriver): Promise<boolean> {
    try {
      if (mode === 'native') {
        const stream = await driver.beginVoice!();
        if (id !== this.session) {
          stream.cancel();
          return false;
        }
        this.stream = stream;
        if (this.deps.mic) {
          await this.deps.mic.start((chunk) => {
            if (id === this.session && this.stream === stream) stream.sendAudio(chunk);
          });
        }
      } else {
        let lang = 'en-US';
        try {
          lang = (this.deps.language ?? voiceLanguage)();
        } catch {
          // keep English
        }
        await this.deps.stt!.start(() => {}, lang);
      }
      return id === this.session;
    } catch (e) {
      if (id === this.session) {
        this.session++;
        this.fail(e);
      }
      return false;
    }
  }

  async release(): Promise<void> {
    if (this.st !== 'listening') return;
    const id = this.session;
    const mode = this.mode;
    const driver = this.driver;
    this.set('sending');
    const ok = await (this.starting ?? Promise.resolve(false));
    if (!ok || id !== this.session || !driver) return;
    try {
      if (mode === 'native') {
        const stream = this.stream!;
        try {
          this.deps.mic?.stop();
        } catch {
          // ignore
        }
        await stream.end();
        const t = streamTranscript(stream);
        if (id !== this.session) return;
        this.deps.onNote(t ? VOICE_NOTES.sent(t) : VOICE_NOTES.sentNative);
      } else {
        const text = (await this.deps.stt!.stop()).trim();
        if (id !== this.session) return;
        if (!text) {
          this.deps.onNote(VOICE_NOTES.empty);
        } else {
          await sendTranscript(driver, text);
          this.deps.onNote(VOICE_NOTES.sent(text));
        }
      }
      this.cleanup();
      this.set('idle');
    } catch (e) {
      if (id === this.session) {
        this.session++;
        this.fail(e);
      }
    }
  }

  /** Abort without sending (e.g. finger slid off, screen left). */
  cancel(): void {
    if (this.st === 'idle') return;
    this.session++;
    try {
      this.stream?.cancel();
    } catch {
      // ignore
    }
    if (this.mode === 'stt') {
      try {
        this.deps.stt?.cancel();
      } catch {
        // ignore
      }
    }
    this.cleanup();
    this.set('idle');
  }
}
