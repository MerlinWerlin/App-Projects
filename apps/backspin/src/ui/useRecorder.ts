// Recording hook: permission, countdown, live level for the waveform, auto-stop at the time limit.
import { useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { micPermission, modeForRecording, RECORDING, requestMic, stop as stopPlayback, type MicPermission } from '../native/audio.ts';
import { haptic } from '../native/device.ts';
import { recordingToWav } from '../native/pcm.ts';

export type RecPhase = 'idle' | 'preparing' | 'countdown' | 'recording' | 'stopping';

export function useRecorder(maxSeconds: number, countdown: boolean) {
  const recorder = useAudioRecorder(RECORDING);
  const state = useAudioRecorderState(recorder, 80);
  const [phase, setPhaseState] = useState<RecPhase>('idle');
  // A ref as well, so a quick release (hold mode) sees the phase set a moment earlier.
  const phaseRef = useRef<RecPhase>('idle');
  const setPhase = (p: RecPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [count, setCount] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [perm, setPerm] = useState<MicPermission>('ask');
  const resolver = useRef<((uri: string | null, error?: string) => void) | null>(null);
  const cancelled = useRef(false);
  const stopAsap = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    micPermission().then(setPerm);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  // Live level (metering is dBFS, about -60..0) into a rolling 48-bar list.
  useEffect(() => {
    if (phase !== 'recording' || state.metering == null) return;
    const v = Math.max(0.05, Math.min(1, (state.metering + 55) / 50));
    setLevels((l) => [...l.slice(-47), v]);
  }, [state.metering, state.durationMillis, phase]);

  const finish = useCallback(async () => {
    if (phaseRef.current === 'preparing') {
      // Released (hold mode) before the mic was ready: stop as soon as it is.
      stopAsap.current = true;
      return;
    }
    if (phaseRef.current !== 'recording' && phaseRef.current !== 'countdown') return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (phaseRef.current === 'countdown') {
      cancelled.current = true;
      setPhase('idle');
      resolver.current?.(null);
      resolver.current = null;
      return;
    }
    setPhase('stopping');
    try {
      await recorder.stop();
      const recordedUri = recorder.uri;
      const uri = recordedUri ? await recordingToWav(recordedUri) : null;
      haptic.press();
      resolver.current?.(uri ?? null, uri ? undefined : 'no file');
    } catch (e) {
      resolver.current?.(null, e instanceof Error ? e.message : String(e));
    }
    resolver.current = null;
    setPhase('idle');
  }, [recorder]);

  /** Starts a take. Resolves with the file uri when it stops (button, limit, or error). */
  const start = useCallback(
    () =>
      new Promise<{ uri: string | null; error?: string; denied?: boolean }>(async (resolve) => {
        let p = perm;
        if (p !== 'granted') {
          p = await requestMic();
          setPerm(p);
          // The permission sheet took the finger off the button: start fresh next press.
          if (p === 'granted') return resolve({ uri: null, error: 'permission-granted' });
        }
        if (p !== 'granted') return resolve({ uri: null, denied: true });
        stopPlayback();
        cancelled.current = false;
        stopAsap.current = false;
        setLevels([]);
        setPhase('preparing');
        resolver.current = (uri, error) => resolve({ uri, error });
        try {
          await modeForRecording();
          await recorder.prepareToRecordAsync();
        } catch (e) {
          resolver.current = null;
          setPhase('idle');
          return resolve({ uri: null, error: e instanceof Error ? e.message : String(e) });
        }
        const go = () => {
          if (cancelled.current) return;
          if (stopAsap.current) {
            stopAsap.current = false;
            setPhase('idle');
            resolver.current = null;
            return resolve({ uri: null, error: 'short' });
          }
          recorder.record();
          haptic.press();
          setPhase('recording');
          timers.current.push(setTimeout(() => finishRef.current(), maxSeconds * 1000));
        };
        if (countdown) {
          setPhase('countdown');
          setCount(3);
          [1, 2].forEach((k) => timers.current.push(setTimeout(() => (haptic.tap(), setCount(3 - k)), k * 600)));
          timers.current.push(setTimeout(go, 1800));
        } else go();
      }),
    [perm, recorder, maxSeconds, countdown],
  );

  const finishRef = useRef(finish);
  finishRef.current = finish;

  return { start, finish, phase, count, levels, seconds: Math.floor((state.durationMillis ?? 0) / 1000), perm, setPerm };
}
