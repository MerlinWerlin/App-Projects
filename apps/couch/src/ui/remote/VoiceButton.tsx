import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { RemoteIcon } from '../icons/RemoteIcon';
import { VOICE_BUTTON } from './controls';
import { VoiceController, VOICE_NOTES, type VoiceState } from '../../core/voice';
import { loadSpeechToText } from '../../native/speech';
import { useSession } from '../../state/session';
import { fonts } from '../../theme/tokens';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { useT } from '../../i18n/react';
import { useActive } from '../motion/useActive';
import { idleMode } from '../motion/idle';
import { useScrollLock } from '../Screen';
import { tap } from './haptics';

/**
 * "Hold to talk" button (prototype v2 bindVoice / .voice). Logic lives in src/core/voice.ts:
 * native TV voice where the driver supports it (the demo TV does), phone speech-to-text typed into
 * the TV search when available (dev build only, src/native/speech.ts), otherwise the keyboard sheet.
 * - onNote(text): show a short status line on the remote (e.g. 'Sent to the TV: "find cooking shows"').
 * - onOpenKeyboard(): fallback when no speech-to-text is available (Expo Go): open the keyboard sheet.
 */
export interface VoiceButtonProps {
  onNote: (text: string) => void;
  onOpenKeyboard: () => void;
}

/** One full breath of the mic ring (in + out). */
const BREATH_MS = 1400;

export function VoiceButton({ onNote, onOpenKeyboard }: VoiceButtonProps) {
  const t = useRemoteTheme();
  const tr = useT();
  const { session } = useSession();
  const [state, setState] = useState<VoiceState>('idle');
  // Lock the page ScrollView while holding, so a small drag cannot steal the touch and send early
  // (QA run 3 risk 3; same pattern as the touchpad).
  const setScrollLock = useScrollLock();
  const lockRef = useRef(setScrollLock);
  lockRef.current = setScrollLock;

  // Latest callbacks without recreating the controller every render.
  const cb = useRef({ onNote, onOpenKeyboard });
  cb.current = { onNote, onOpenKeyboard };

  const controller = useMemo(
    () =>
      new VoiceController({
        getDriver: () => session.activeDriver(),
        stt: loadSpeechToText(),
        onNote: (n) => cb.current.onNote(n),
        onOpenKeyboard: () => cb.current.onOpenKeyboard(),
        onState: setState,
      }),
    [session],
  );

  // Leaving the screen mid-hold must not send anything.
  useEffect(
    () => () => {
      controller.cancel();
      lockRef.current(false);
    },
    [controller],
  );

  const on = state !== 'idle';

  // Breathing mic ring while listening (scale 1 -> 1.12, opacity 0.35 -> 0.7, native driver).
  // Stops on release, when the screen is not active (useActive) and on unmount; Reduce Motion: static ring.
  const listening = state === 'listening';
  const active = useActive();
  const reduce = useReducedMotion();
  const breath = useRef(new Animated.Value(0)).current;
  const ringMode = idleMode({ reduce, active, wanted: listening });
  useEffect(() => {
    if (ringMode !== 'loop') {
      breath.stopAnimation();
      breath.setValue(0);
      return;
    }
    const half = BREATH_MS / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: half, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: half, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      breath.setValue(0);
    };
  }, [ringMode, breath]);
  const ringStyle = reduce
    ? { opacity: 0.55 }
    : {
        opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }),
        transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
      };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr('ui.remote.holdToTalkLabel')}
      accessibilityHint={tr('ui.remote.holdToTalkHint')}
      accessibilityState={{ busy: state === 'sending' }}
      onPressIn={() => {
        tap();
        lockRef.current(true);
        void controller.press();
      }}
      onPressOut={() => {
        lockRef.current(false);
        void controller.release();
      }}
      style={[styles.pill, { backgroundColor: on ? t.accent : t.accentSoft }]}
    >
      <View style={styles.mic} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {listening ? (
          <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: t.accentInk }, ringStyle]} />
        ) : null}
        <RemoteIcon name={VOICE_BUTTON.icon} size={22} color={on ? t.accentInk : t.ink} />
      </View>
      <Text
        scaleRole="label"
        style={[styles.label, styles.caption, { color: on ? t.accentInk : t.ink }]}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {on ? VOICE_NOTES.listening : tr('ui.remote.holdToTalk')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: '100%',
    minHeight: 52,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    // Larger Text (T74): the label wraps and the pill grows with it.
    paddingVertical: 6,
  },
  label: {
    fontFamily: fonts.textBold,
    fontSize: 15,
  },
  caption: { flexShrink: 1, textAlign: 'center' },
  mic: { width: 30, height: 30, marginEnd: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ring: {
    position: 'absolute',
    top: 0,
    start: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
  },
});
