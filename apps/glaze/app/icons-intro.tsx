// /icons-intro: the gentle first-time icons walkthrough (owner 2026-11-13: the icons part of "Use
// everything" "seems scary... looks scammy... so much information thrown at you at once").
// One idea per card, calm plain words, Back / Next and Skip; the last card's "Set up icons" opens the
// existing install screen (/install). Seen once (finished or skipped), "Use everything" no longer
// opens it: the theme page shows a one-line "Set up icons" with a "How it works" link that reopens
// this screen (`again=1`, which just closes at the end). The first card has a slot for a short demo
// video (src/ui/iconsIntroDemo.ts), empty until Jared adds a clip.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ICONS_INTRO_STEPS } from '../src/core/iconsIntro';
import { useT } from '../src/i18n';
import { markIconsIntroSeen } from '../src/store/iconsIntro';
import { chromeRadiusV2, fontScaleCap, spaceV2, textV2, type TypeRoleV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { haptic } from '../src/ui/haptics';
import { textStyleFor } from '../src/ui/i18nLayout';
import { ICONS_INTRO_DEMO } from '../src/ui/iconsIntroDemo';
import { PillButton } from '../src/ui/PillButton';

function DemoVideo({ source }: { source: number }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} />;
}

export default function IconsIntroScreen() {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ theme?: string; again?: string }>();
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const [index, setIndex] = useState(0);
  const step = ICONS_INTRO_STEPS[index];
  const last = index === ICONS_INTRO_STEPS.length - 1;

  const finish = async (toInstall: boolean) => {
    await markIconsIntroSeen();
    if (toInstall && params.again !== '1') {
      router.replace({ pathname: '/install', params: params.theme ? { theme: params.theme } : {} });
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.top}>
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.inkSecondary }]}>
          {t('theme.iconsIntro.stepOf', { n: index + 1, total: ICONS_INTRO_STEPS.length })}
        </Text>
        {last ? null : (
          <PillButton label={t('theme.iconsIntro.skip')} variant="plain" size="small" onPress={() => void finish(false)} />
        )}
      </View>
      <View style={[styles.card, { backgroundColor: c.surface }]}>
        {index === 0 && ICONS_INTRO_DEMO !== null ? <DemoVideo source={ICONS_INTRO_DEMO} /> : null}
        <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('title2')} style={[...label('title2'), { color: c.ink }]}>
          {t(`theme.iconsIntro.steps.${step}.title`)}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[...label('body'), { color: c.inkSecondary }]}>
          {t(`theme.iconsIntro.steps.${step}.body`)}
        </Text>
      </View>
      <View style={styles.actions}>
        {last ? (
          <PillButton label={t('theme.iconsIntro.start')} block onPress={() => { haptic('select'); void finish(true); }} />
        ) : (
          <PillButton label={t('theme.iconsIntro.next')} block onPress={() => { haptic('select'); setIndex((i) => i + 1); }} />
        )}
        {index > 0 ? (
          <PillButton label={t('theme.iconsIntro.back')} block variant="plain" onPress={() => setIndex((i) => Math.max(0, i - 1))} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spaceV2.lg, paddingTop: spaceV2.md, gap: spaceV2.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: spaceV2.xl },
  card: { flex: 1, justifyContent: 'center', gap: spaceV2.md, padding: spaceV2.xl, borderRadius: chromeRadiusV2.card },
  video: { width: '100%', aspectRatio: 9 / 16, maxHeight: '55%', borderRadius: chromeRadiusV2.control },
  actions: { gap: spaceV2.sm, paddingBottom: spaceV2.md },
});
