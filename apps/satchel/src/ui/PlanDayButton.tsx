// T98: the "Plan my day" pill on each day of the trip screen; opens app/dayplan/[tripId].tsx for that day.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { formatDay } from '../core/format.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space } from '../theme/tokens.ts';
import { PressableScale } from './kit.tsx';

export function PlanDayButton({ tripId, day }: { tripId: string; day: string }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('dayplan.openA11y', { day: formatDay(day, lang) })}
      accessibilityHint={t('dayplan.openHint')}
      onPress={() => router.push({ pathname: '/dayplan/[tripId]', params: { tripId, day } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.m, borderRadius: radius.pill, backgroundColor: theme.seaSoft }}
    >
      <Ionicons name="walk-outline" size={18} color={theme.sea} />
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.sea }}>{t('dayplan.open')}</Text>
    </PressableScale>
  );
}
