// Owner 2026-11-14 / 2026-11-15: a how-to screen recording (bundled, so it works offline), played
// muted, looping and inline with expo-video (already in the app, no new dependency). Used LARGE in
// HowToSheet only (1.0.31: no small inline players any more).
// - The poster frame shows until the video is ready to play.
// - Reduce Motion (the Glaze setting or iOS): no autoplay; the poster with a play button instead.
// - Tap the video to pause or play it (a looping video needs a pause control, WCAG 2.2.2).
// - `replay` changes → back to the start and playing.
// - Pauses when its screen loses focus or the app goes to the background.
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
  /** What the clip shows, step by step, for VoiceOver (the video has no audio). */
  label: string;
  /** Bump to restart from the beginning and play. */
  replay?: number;
  style?: StyleProp<ViewStyle>;
};

const PLAY = 72;

export function HowToClip({ clip, label, replay = 0, style }: Props) {
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

  // "Watch again": from the start, playing.
  useEffect(() => {
    if (replay === 0) return;
    try {
      player.currentTime = 0;
    } catch {
      // Not loaded yet: it starts at 0 anyway.
    }
    setWantsPlay(true);
  }, [player, replay]);

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
    <Pressable
      onPress={() => setWantsPlay((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={wantsPlay ? t('theme.howTo.pauseHint') : t('theme.howTo.playHint')}
      style={[styles.frame, { backgroundColor: c.surfaceRaised, borderColor: c.separator }, style]}
    >
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      {showPoster ? (
        <ExpoImage source={clip.poster} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityIgnoresInvertColors />
      ) : null}
      {!wantsPlay ? (
        <View style={[styles.play, { backgroundColor: c.tint }]} pointerEvents="none">
          <Feather name="play" size={sizeV2.rowIcon} color={c.onTint} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 590 / 1278, overflow: 'hidden', borderRadius: chromeRadiusV2.card, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  play: { width: PLAY, height: PLAY, borderRadius: circleRadius(PLAY), alignItems: 'center', justifyContent: 'center' },
});
