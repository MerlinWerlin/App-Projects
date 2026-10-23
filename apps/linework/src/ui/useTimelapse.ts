// Timelapse recording hook for the trace screen (T09). Drives CameraView.recordAsync / stopRecording through the
// pure state machine in src/core/timelapse.ts and saves clips with src/native/mediaLibrary.ts.
//
// What ends up in the video: only the camera feed. recordAsync records the native camera session, and the tracing
// overlay, grid and controls are separate React Native views drawn on top of it, so they are never in the file.
// The camera is muted (CameraView `mute`), so no microphone permission is ever requested.
import { useCallback, useEffect, useReducer, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from '../native/fs';
import type { CameraView } from 'expo-camera';
import {
  MAX_RECORD_S,
  elapsedSeconds,
  initialTimelapseState,
  timelapseReducer,
  type TimelapseState,
} from '../core/timelapse';
import { openAppSettings, saveVideoToPhotos } from '../native/mediaLibrary';
import { select, tap } from '../native/haptics';
import { t } from '../i18n';

export type TimelapseControls = {
  cameraRef: RefObject<CameraView | null>;
  /** Pass to CameraView onCameraReady. */
  onCameraReady: () => void;
  /** Pass to CameraView mode: 'video' only while a recording is armed, so photo snapshots (paper check) work otherwise. */
  mode: 'picture' | 'video';
  state: TimelapseState;
  /** Whole seconds recorded so far (while recording). */
  elapsed: number;
  recording: boolean;
  /** Record when idle, stop when recording; ignored otherwise. */
  toggle: () => void;
  save: () => void;
  discard: () => void;
  openSettings: () => void;
};

export function useTimelapse(onMessage: (text: string) => void): TimelapseControls {
  const cameraRef = useRef<CameraView | null>(null);
  const [state, dispatch] = useReducer(timelapseReducer, undefined, initialTimelapseState);
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);
  stateRef.current = state;
  const msgRef = useRef(onMessage);
  msgRef.current = onMessage;
  const readyRef = useRef(false);
  const [armed, setArmed] = useState(false);
  const readyWaiter = useRef<(() => void) | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Leaving the screen (e.g. to Lightbox) unmounts the camera: stop first so the clip is finalised, not lost.
  useFocusEffect(
    useCallback(() => {
      return () => {
        readyRef.current = false;
        if (stateRef.current.phase === 'recording') {
          dispatch({ type: 'stop' });
          try {
            cameraRef.current?.stopRecording();
          } catch {
            // The camera may already be gone; recordAsync then settles on its own.
          }
        }
      };
    }, []),
  );

  const onCameraReady = useCallback(() => {
    readyRef.current = true;
    const w = readyWaiter.current;
    readyWaiter.current = null;
    w?.();
  }, []);

  // Switching CameraView to video mode reconfigures the session; wait for onCameraReady (or a short timeout,
  // since not every platform re-fires it on a mode change) before recordAsync.
  const switchToVideo = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          readyWaiter.current = null;
          resolve();
        }, 1200);
        readyWaiter.current = () => {
          clearTimeout(t);
          // Small settle delay after the session reports ready.
          setTimeout(resolve, 150);
        };
        setArmed(true);
      }),
    [],
  );

  // Elapsed-time ticker, only while recording.
  const ticking = state.phase === 'recording' || state.phase === 'stopping';
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [ticking]);

  // Recording errors come back to idle with a message.
  useEffect(() => {
    if (state.phase === 'idle' && state.error) msgRef.current(state.error);
  }, [state.phase, state.error]);

  const start = useCallback(async () => {
    if (busyRef.current || stateRef.current.phase !== 'idle') return;
    const cam = cameraRef.current;
    if (!cam || !readyRef.current) {
      msgRef.current(t('trace.timelapse.cameraStarting'));
      return;
    }
    busyRef.current = true;
    tap();
    const at = Date.now();
    dispatch({ type: 'start', at });
    setNow(at);
    try {
      await switchToVideo();
      if (!mounted.current) return;
      // Re-read after the await: the ref may have moved on, so don't let TS keep the 'idle' narrowing from above.
      if (!cameraRef.current || (stateRef.current.phase as TimelapseState['phase']) !== 'recording') {
        // Camera went away, or Stop was tapped before recording actually began.
        dispatch({ type: 'failed', message: t('trace.timelapse.didntStart') });
        return;
      }
      msgRef.current(t('trace.timelapse.recordingNotice'));
      // Resolves when stopRecording() is called or maxDuration is reached.
      const result = await cameraRef.current.recordAsync({ maxDuration: MAX_RECORD_S });
      if (!mounted.current) return;
      if (!result?.uri) {
        // The core reducer would fall back to English here; report it in the current language instead.
        dispatch({ type: 'failed', message: t('trace.timelapse.noVideo') });
        return;
      }
      dispatch({ type: 'finished', uri: result.uri, at: Date.now() });
      AccessibilityInfo.announceForAccessibility(t('trace.timelapse.stoppedAnnounce'));
    } catch {
      if (!mounted.current) return;
      dispatch({ type: 'failed', message: t('trace.timelapse.unexpected') });
    } finally {
      busyRef.current = false;
      if (mounted.current) setArmed(false);
    }
  }, [switchToVideo]);

  const stop = useCallback(() => {
    if (stateRef.current.phase !== 'recording') return;
    tap();
    dispatch({ type: 'stop' });
    try {
      cameraRef.current?.stopRecording();
    } catch {
      dispatch({ type: 'failed', message: t('trace.timelapse.stopFailed') });
    }
  }, []);

  const toggle = useCallback(() => {
    const phase = stateRef.current.phase;
    if (phase === 'idle') start().catch(() => {});
    else if (phase === 'recording') stop();
  }, [start, stop]);

  const save = useCallback(async () => {
    const s = stateRef.current;
    if (!s.uri || (s.phase !== 'review' && s.phase !== 'denied' && s.phase !== 'error')) return;
    tap();
    dispatch({ type: 'save' });
    const result = await saveVideoToPhotos(s.uri);
    if (!mounted.current) return;
    if (result.kind === 'saved') {
      dispatch({ type: 'saved' });
      AccessibilityInfo.announceForAccessibility(t('trace.timelapse.saved'));
    } else if (result.kind === 'denied') {
      dispatch({ type: 'denied', canAskAgain: result.canAskAgain });
      AccessibilityInfo.announceForAccessibility(t('trace.timelapse.deniedAnnounce'));
    } else {
      const message = result.detail
        ? t('trace.timelapse.saveFailedDetail', { detail: result.detail })
        : t('trace.timelapse.saveFailed');
      dispatch({ type: 'saveFailed', message });
      AccessibilityInfo.announceForAccessibility(message);
    }

  }, []);

  const discard = useCallback(() => {
    select();
    // The clip only lives in the app cache; remove it now rather than waiting for the system to clear it.
    const uri = stateRef.current.uri;
    if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    dispatch({ type: 'discard' });
  }, []);

  const openSettings = useCallback(() => {
    tap();
    openAppSettings();
  }, []);

  return {
    cameraRef,
    onCameraReady,
    mode: armed ? 'video' : 'picture',
    state,
    elapsed: elapsedSeconds(state.startedAt, now),
    recording: state.phase === 'recording' || state.phase === 'stopping',
    toggle,
    save: () => {
      save().catch(() => {});
    },
    discard,
    openSettings,
  };
}
