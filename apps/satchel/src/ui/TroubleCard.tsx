// T78: the "When things go wrong" entry on the Emergency tab, right after Nearest help and in the same look. Opens
// app/trouble/index.tsx (offline step-by-step guides). Says how many guides are part-way through.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import table from '../content/troubles.json';
import { cleanProgress, guidesInProgress, TROUBLE_PROGRESS_KEY, type TroubleTable } from '../core/troubles.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { elevated, fonts, radius, space, TOUCH } from '../theme/tokens.ts';
import { IconBadge } from './hero.tsx';
import { PressableScale } from './kit.tsx';

const TABLE = table as TroubleTable;
const NO_PROGRESS: unknown = {};

export function TroubleCard() {
  const { t, theme } = useApp();
  const router = useRouter();
  const [raw] = usePersisted<unknown>(TROUBLE_PROGRESS_KEY, NO_PROGRESS);
  const started = useMemo(() => guidesInProgress(TABLE, cleanProgress(raw, TABLE)), [raw]);
  const body = started === 0 ? t('trouble.entryBody') : started === 1 ? t('trouble.entryProgressOne') : t('trouble.entryProgress', { n: started });
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('trouble.entry')}
      accessibilityHint={`${body} ${t('trouble.entryHint')}`}
      onPress={() => router.push('/trouble')}
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
      <IconBadge name="help-buoy-outline" tone="warn" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{t('trouble.entry')}</Text>
        <Text numberOfLines={3} style={{ fontFamily: fonts.body, fontSize: 15, color: started ? theme.ink : theme.muted }}>
          {body}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.muted} />
    </PressableScale>
  );
}
