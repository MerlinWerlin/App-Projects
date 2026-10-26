// The only module that talks to expo-audio. Records 16-bit mono WAV on iOS (so JS can reverse it), plays files,
// and switches the audio session between "recording" and "loud speaker playback". iOS routes sound to the quiet
// earpiece while recording is allowed, so every playback first turns recording off (Backspin lesson, owner test).
import {
  AudioModule,
  AudioQuality,
  createAudioPlayer,
  IOSOutputFormat,
  setAudioModeAsync,
  type AudioPlayer,
  type RecordingOptions,
} from 'expo-audio';
import { Platform } from 'react-native';
import { hasAndroidPcm } from './pcm.ts';

export const RECORDING: RecordingOptions = {
  extension: '.wav',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 705600,
  isMeteringEnabled: true,
  android: {
    // The native PCM adapter decodes this AAC recording before the hook resolves a take.
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    sampleRate: 44100,
  },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
};

export type MicPermission = 'granted' | 'ask' | 'denied';

export async function micPermission(): Promise<MicPermission> {
  try {
    const p = await AudioModule.getRecordingPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'denied';
  } catch {
    return 'ask';
  }
}

export async function requestMic(): Promise<MicPermission> {
  try {
    const p = await AudioModule.requestRecordingPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'denied';
  } catch {
    return 'denied';
  }
}

let mode: 'record' | 'play' | null = null;

export async function modeForRecording(): Promise<void> {
  if (mode === 'record') return;
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
  mode = 'record';
}

export async function modeForPlayback(): Promise<void> {
  if (mode === 'play') return;
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  mode = 'play';
}

/** Only enable Android play when the native decoder is actually linked. */
export const canReverseHere = Platform.OS === 'ios' || (Platform.OS === 'android' && hasAndroidPcm);

/**
 * One shared player for the whole app (only one sound plays at a time). `play` resolves when the sound ends,
 * is stopped, or fails; never throws.
 */
let player: AudioPlayer | null = null;
let finish: (() => void) | null = null;

function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 100 });
    player.addListener('playbackStatusUpdate', (s: { didJustFinish?: boolean }) => {
      if (s.didJustFinish) {
        const f = finish;
        finish = null;
        f?.();
      }
    });
  }
  return player;
}

export type PlayResult = { ok: true } | { ok: false; detail: string };

export async function play(uri: string, rate = 1): Promise<PlayResult> {
  try {
    await modeForPlayback();
    stop();
    const p = getPlayer();
    p.replace({ uri });
    try {
      p.shouldCorrectPitch = true;
      p.setPlaybackRate(rate, 'high');
    } catch {
      // older expo-audio: normal speed only
    }
    await p.seekTo(0);
    return await new Promise<PlayResult>((resolve) => {
      finish = () => resolve({ ok: true });
      p.play();
    });
  } catch (e) {
    finish = null;
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export function stop(): void {
  const f = finish;
  finish = null;
  try {
    player?.pause();
  } catch {
    // nothing playing
  }
  f?.();
}

export const isPlaying = () => !!player?.playing;
