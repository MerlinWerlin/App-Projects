import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { KeyFace } from '../icons/KeyFace';
import { RemoteIcon } from '../icons/RemoteIcon';
import { Socket } from './RemoteKey';
import { VOICE_BUTTON } from './controls';
import { VoiceController, VOICE_NOTES, voiceMode, type VoiceState } from '../../core/voice';
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
  const { session, snap } = useSession();
  const [state, setState] = useState<VoiceState>('idle');
  // App Review 2.3.1: say what the key really does. No real TV has voice yet and the phone has no speech-to-text,
  // so on those TVs the key reads "Search on the TV" with a search icon and opens the keyboard (the controller's
  // 'keyboard' mode). It reads "Hold to talk" only where it can listen. `snap` re-renders this on a TV switch.
  const stt = useMemo(() => loadSpeechToText(), []);
  const canTalk = snap.activeId !== null && voiceMode(session.activeDriver(), stt !== null) !== 'keyboard';
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
        stt,
        onNote: (n) => cb.current.onNote(n),
        onOpenKeyboard: () => cb.current.onOpenKeyboard(),
        onState: setState,
      }),
    [session, stt],
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
    // A long cap in its socket like every key (DESIGN.md "The logo remote"); the mic is in the theme's accent, and
    // the whole cap lights in the accent while listening.
    <Socket radius={99} style={styles.socket}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr(canTalk ? 'ui.remote.holdToTalkLabel' : 'ui.remote.searchTvLabel')}
      accessibilityHint={tr(canTalk ? 'ui.remote.holdToTalkHint' : 'ui.remote.searchTvHint')}
      accessibilityState={{ busy: state === 'sending' }}
      onPressIn={() => {
        // Couch Plus gate (src/plus/gate.tsx): locked -> the paywall opens and nothing listens or sends.
        if (!session.allowed()) return;
        tap();
        lockRef.current(true);
        void controller.press();
      }}
      onPressOut={() => {
        lockRef.current(false);
        void controller.release();
      }}
      style={({ pressed }) => [styles.pill, { backgroundColor: on ? t.accent : t.key, shadowColor: t.keyEdge, opacity: pressed && !on ? 0.9 : 1 }]}
    >
      {on ? null : <KeyFace keyColor={t.key} edgeColor={t.keyEdge} radius={99} />}
      <View style={styles.mic} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {listening ? (
          <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: t.accentInk }, ringStyle]} />
        ) : null}
        <RemoteIcon name={canTalk ? VOICE_BUTTON.icon : 'search'} size={22} color={on ? t.accentInk : t.accent} />
      </View>
      <Text
        scaleRole="label"
        style={[styles.label, styles.caption, { color: on ? t.accentInk : t.ink }]}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {on && canTalk ? VOICE_NOTES.listening : tr(canTalk ? 'ui.remote.holdToTalk' : 'ui.remote.searchTv')}
      </Text>
    </Pressable>
    </Socket>
  );
}

const styles = StyleSheet.create({
  socket: { alignSelf: 'stretch' },
  pill: {
    width: '100%',
    minHeight: 52,
    borderRadius: 99,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.55,
    shadowRadius: 1.5,
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
