// Owner 2026-11-14 ("Yes, add them"): a short how-to screen recording (bundled, so it works offline),
// played muted, looping and inline with expo-video (already in the app, no new dependency).
// - The poster frame shows until the video is ready to play.
// - Reduce Motion (the Glaze setting or iOS): no autoplay; the poster with a play button instead.
// - Pauses when its screen loses focus or the app goes to the background; resumes when it returns.
// Clips: src/ui/howToClips.ts.
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useT } from '../i18n';
import { chromeRadiusV2, circleRadius, sizeV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import type { HowToClipSource } from './howToClips';
import { useReduceMotion } from './useReduceMotion';

type Props = {
  clip: HowToClipSource;
  /** What the clip shows, for VoiceOver. */
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function HowToClip({ clip, label, style }: Props) {
  const { c } = useColorsV2();
  const { t } = useT();
  const reduce = useReduceMotion();
  const [ready, setReady] = useState(false);
  // Reduce Motion: nothing plays until the play button is tapped.
  const [wantsPlay, setWantsPlay] = useState(!reduce);
  const visible = useRef(true);
  const player = useVideoPlayer(clip.video, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (reduce) setWantsPlay(false);
  }, [reduce]);

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') setReady(true);
    });
    return () => sub.remove();
  }, [player]);

  const sync = useCallback(() => {
    try {
      if (wantsPlay && visible.current && AppState.currentState === 'active') player.play();
      else player.pause();
    } catch {
      // A released player (screen closing) has nothing to pause.
    }
  }, [player, wantsPlay]);

  useEffect(() => {
    sync();
  }, [sync]);

  // Off-screen: pause when the screen loses focus, play again when it comes back.
  useFocusEffect(
    useCallback(() => {
      visible.current = true;
      sync();
      return () => {
        visible.current = false;
        sync();
      };
    }, [sync]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', () => {
      try {
        sync();
      } catch {
        // T264: an app-state change never throws into React Native.
      }
    });
    return () => sub.remove();
  }, [sync]);

  const showPoster = !ready || !wantsPlay;
  return (
    <View
      style={[styles.frame, { backgroundColor: c.surfaceRaised }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      {showPoster ? (
        <ExpoImage source={clip.poster} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityIgnoresInvertColors />
      ) : null}
      {!wantsPlay ? (
        <Pressable
          onPress={() => setWantsPlay(true)}
          accessibilityRole="button"
          accessibilityLabel={t('theme.howTo.play')}
          style={({ pressed }) => [styles.play, { backgroundColor: c.tint, opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="play" size={sizeV2.rowIcon} color={c.onTint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 590 / 1278, maxHeight: 420, alignSelf: 'center', overflow: 'hidden', borderRadius: chromeRadiusV2.card, alignItems: 'center', justifyContent: 'center' },
  play: { width: sizeV2.touch + 16, height: sizeV2.touch + 16, borderRadius: circleRadius(sizeV2.touch + 16), alignItems: 'center', justifyContent: 'center' },
});
