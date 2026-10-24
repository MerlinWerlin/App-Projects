/**
 * Voice Pace: listens to the mic level (expo-audio metering, works in Expo Go) and drives a 0..1
 * gate shared value that the prompter multiplies its speed by. The audio is never saved or uploaded:
 * the recorder writes to a throwaway cache file that is discarded on stop.
 */
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { VoiceGate } from '../core/pace';

export type GateStatus = 'off' | 'starting' | 'listening' | 'denied' | 'error';

export function useVoiceGate(enabled: boolean): { gate: SharedValue<number>; status: GateStatus; speaking: boolean } {
  const gate = useSharedValue(1);
  const recorder = useAudioRecorder({ ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 60);
  const model = useRef(new VoiceGate());
  const [status, setStatus] = useState<GateStatus>('off');
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!enabled) {
      gate.value = 1;
      setStatus('off');
      return;
    }
    let cancelled = false;
    gate.value = 0;
    model.current = new VoiceGate();
    setStatus('starting');
    (async () => {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          if (!cancelled) setStatus('denied');
          gate.value = 1;
          return;
        }
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        if (!cancelled) setStatus('listening');
      } catch {
        if (!cancelled) setStatus('error');
        gate.value = 1;
      }
    })();
    return () => {
      cancelled = true;
      try {
        void recorder.stop().catch(() => undefined);
      } catch {
        /* already stopped */
      }
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    };
  }, [enabled, recorder, gate]);

  useEffect(() => {
    if (!enabled || status !== 'listening') return;
    const db = typeof state.metering === 'number' ? state.metering : -160;
    const f = model.current.sample(db, Date.now());
    gate.value = f;
    const sp = model.current.speaking;
    setSpeaking((cur) => (cur === sp ? cur : sp));
  }, [state.metering, state.durationMillis, enabled, status, gate]);

  return { gate, status, speaking };
}
