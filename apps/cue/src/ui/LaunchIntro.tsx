/**
 * Launch intro (~1.35 s, once per cold start): picks up from the splash colour, the word "Cue" rolls up
 * into the reading-line band like prompter text, then everything fades to the app. Tap anywhere to skip. Not shown at all with Reduce Motion (the caller decides).
 * Reanimated only; the two edge masks reuse expo-linear-gradient (same colour to transparent, as on the prompter).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { t } from '../i18n';
import { DARK, FONT, PROMPTER, STAGE } from '../theme/theme';

const BG = '#10131C'; // = splash backgroundColor in app.json, so the hand-off is seamless
const WINDOW_W = 260;
const WINDOW_H = 168;
const ROLL_FROM = 120;
const ROLL_MS = 620;
const FADE_AT = 960;
const FADE_MS = 300;
export const INTRO_TOTAL_MS = FADE_AT + FADE_MS; // 1260 ms, under the 1.5 s budget

const GHOST = 'rgba(241,238,230,0.10)';

export function LaunchIntro({ onDone }: { onDone: () => void }) {
  const roll = useSharedValue(ROLL_FROM);
  const ink = useSharedValue(0);
  const fade = useSharedValue(1);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = (delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onDone();
    }, delay);
  };

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    roll.value = withTiming(0, { duration: ROLL_MS, easing: ease });
    ink.value = withTiming(1, { duration: ROLL_MS * 0.8, easing: ease });
    fade.value = withDelay(FADE_AT, withTiming(0, { duration: FADE_MS, easing: Easing.in(Easing.quad) }));
    finish(INTRO_TOTAL_MS + 20);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    if (finished.current) return;
    fade.value = withTiming(0, { duration: 160 });
    finish(170);
  };

  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const columnStyle = useAnimatedStyle(() => ({ transform: [{ translateY: roll.value }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * ink.value }));
  const bandStyle = useAnimatedStyle(() => ({ opacity: ink.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.root, rootStyle]}>
      <Pressable
        style={st.press}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel={t('app.name')}
        accessibilityHint={t('intro.skipHint')}
      >
        <View style={st.window}>
          {/* Reading-line band and standby marker, as on the prompter. */}
          <Animated.View style={[st.band, bandStyle]}>
            <View style={st.marker} />
          </Animated.View>

          <Animated.View style={[st.column, columnStyle]}>
            <View style={[st.ghost, { width: '58%' }]} />
            <View style={[st.ghost, { width: '76%' }]} />
            <View style={st.wordClip}>
              <Animated.View style={wordStyle}>
                <Text style={st.word} allowFontScaling={false}>
                  Cue
                </Text>
              </Animated.View>
            </View>
            <View style={[st.ghost, { width: '70%' }]} />
            <View style={[st.ghost, { width: '48%' }]} />
          </Animated.View>

          {/* Soft top and bottom edges so lines appear and leave like a prompter glass. */}
          <LinearGradient colors={[BG, 'rgba(16,19,28,0)']} style={[st.edge, { top: 0 }]} pointerEvents="none" />
          <LinearGradient colors={['rgba(16,19,28,0)', BG]} style={[st.edge, { bottom: 0 }]} pointerEvents="none" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const WORD_SIZE = 68;
const st = StyleSheet.create({
  root: { backgroundColor: BG, zIndex: 100, elevation: 100 },
  press: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  window: { width: WINDOW_W, height: WINDOW_H, overflow: 'hidden', justifyContent: 'center' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (WINDOW_H - WORD_SIZE * 1.25) / 2,
    height: WORD_SIZE * 1.25,
    backgroundColor: PROMPTER.classic.band,
    justifyContent: 'center',
  },
  marker: {
    width: 0,
    height: 0,
    marginLeft: 6,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: STAGE.sign,
  },
  column: { alignItems: 'center', gap: 14 },
  ghost: { height: 9, borderRadius: 5, backgroundColor: GHOST },
  wordClip: { overflow: 'hidden', paddingHorizontal: 18, borderRadius: 12 },
  word: { fontFamily: FONT.scriptBold, fontSize: WORD_SIZE, lineHeight: WORD_SIZE * 1.15, color: DARK.ink, letterSpacing: 0.5, textAlign: 'center' },
  edge: { position: 'absolute', left: 0, right: 0, height: 34 },
});
