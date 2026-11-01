// T78 When things go wrong (owner feedback 1031 "start expanding": deepen the Emergency tab). Offline step-by-step
// guides for the moments a trip goes sideways, opened from the Emergency tab. A hero with a lifebuoy badge, the
// "My important numbers" tile, then one coloured tile per guide with its progress (ticks saved on this phone,
// src/core/troubles.ts). Everything is bundled: it works in flight mode. General guidance, never legal advice.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import table from '../../src/content/troubles.json';
import { cleanNumbers, cleanProgress, guideSummaryKey, guideTitleKey, IMPORTANT_NUMBERS_KEY, progressOf, TROUBLE_PROGRESS_KEY, type GuideProgress, type TroubleGuide, type TroubleTable } from '../../src/core/troubles.ts';
import type { T } from '../../src/i18n/core.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePersisted } from '../../src/state/persisted.ts';
import { elevated, fonts, radius, shadowOf, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView, GradientFill, IconBadge, ProgressBar, toneColours, type IconName } from '../../src/ui/hero.tsx';
import { PressableScale } from '../../src/ui/kit.tsx';

const TABLE = table as TroubleTable;
const NONE: unknown = {};
const NO_NUMBERS: unknown = [];

function progressText(t: T, p: GuideProgress): string {
  if (p.state === 'new') return t('trouble.progress.new', { n: p.total });
  if (p.state === 'done') return t('trouble.progress.done', { total: p.total });
  return t('trouble.progress.started', { done: p.done, total: p.total });
}

export default function TroubleListScreen() {
  const { t, theme } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rawProgress] = usePersisted<unknown>(TROUBLE_PROGRESS_KEY, NONE);
  const [rawNumbers] = usePersisted<unknown>(IMPORTANT_NUMBERS_KEY, NO_NUMBERS);
  const progress = useMemo(() => cleanProgress(rawProgress, TABLE), [rawProgress]);
  const count = useMemo(() => cleanNumbers(rawNumbers).length, [rawNumbers]);
  const numbersBody = count === 0 ? t('trouble.numbersTileEmpty') : count === 1 ? t('trouble.numbersTileOne') : t('trouble.numbersTileMany', { n: count });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: space.m, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
    >
      <FadeInView>
        <View style={[{ borderRadius: radius.xl, overflow: 'hidden', backgroundColor: theme.hero.emergency[0] }, shadowOf(theme, 'mid')]}>
          <GradientFill tone="emergency" />
          <View style={{ padding: space.l, paddingVertical: space.xl, gap: space.s }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.m }}>
              <Text accessibilityRole="header" style={[typeScale.displayM, { flex: 1, color: theme.heroInk }]}>
                {t('trouble.hero.title')}
              </Text>
              {/* Illustration-like badge: a lifebuoy in nested washes with a warm ring. Decorative. */}
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: theme.heroAccent, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="help-buoy" size={34} color={theme.heroInk} />
                </View>
              </View>
            </View>
            <Text style={[typeScale.body, { color: theme.heroMuted }]}>{t('trouble.hero.subtitle')}</Text>
          </View>
        </View>
      </FadeInView>

      <FadeInView delay={60}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('trouble.numbersTile')}
          accessibilityHint={`${numbersBody} ${t('trouble.numbersTileHint')}`}
          onPress={() => router.push('/trouble/numbers')}
          style={{
            minHeight: TOUCH,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.m,
            paddingHorizontal: space.l,
            paddingVertical: space.m,
            borderRadius: radius.l,
            ...elevated(theme, 'low'),
          }}
        >
          <IconBadge name="call-outline" tone="teal" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{t('trouble.numbersTile')}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>{numbersBody}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.muted} />
        </PressableScale>
      </FadeInView>

      <Text accessibilityRole="header" style={[typeScale.caption, { color: theme.muted }]}>
        {t('trouble.pick')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.m }}>
        {TABLE.guides.map((g, i) => (
          <GuideTile key={g.id} guide={g} progress={progressOf(g, progress)} delay={Math.min(i, 6) * 40} onPress={() => router.push({ pathname: '/trouble/[id]', params: { id: g.id } })} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start' }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
          <Ionicons name="information-circle-outline" size={18} color={theme.muted} />
        </View>
        <Text style={[typeScale.small, { flex: 1, color: theme.muted }]}>{t('trouble.guidance')}</Text>
      </View>
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('trouble.offline')}</Text>
    </ScrollView>
  );
}

function GuideTile({ guide, progress, delay, onPress }: { guide: TroubleGuide; progress: GuideProgress; delay: number; onPress: () => void }) {
  const { t, theme } = useApp();
  const tone = toneColours(theme, guide.tone);
  const title = t(guideTitleKey(guide) as Key);
  const summary = t(guideSummaryKey(guide) as Key);
  const status = progressText(t, progress);
  return (
    <FadeInView delay={delay} style={{ flexGrow: 1, flexBasis: '45%', minWidth: 150 }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('trouble.tileA11y', { title, summary, progress: status })}
        accessibilityHint={t('trouble.tileHint')}
        onPress={onPress}
        style={{
          flex: 1,
          minHeight: 168,
          padding: space.m,
          gap: space.s,
          borderRadius: radius.l,
          backgroundColor: tone.bg,
          borderWidth: 1,
          borderColor: progress.state === 'started' ? tone.fg : theme.line,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.cardRaised, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={guide.icon as IconName} size={24} color={tone.fg} />
          </View>
          {progress.state === 'done' ? <Ionicons name="checkmark-circle" size={24} color={theme.ok} /> : null}
        </View>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{title}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: tone.fg, fontVariant: ['tabular-nums'] }}>{status}</Text>
        <ProgressBar progress={progress.fraction} label={t('trouble.progressA11y', { done: progress.done, total: progress.total })} tone={guide.tone} track={theme.cardRaised} />
      </PressableScale>
    </FadeInView>
  );
}
