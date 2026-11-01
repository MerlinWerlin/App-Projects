// Slot on the trip timeline header, owned by T54: the trip's spending at a glance (budget progress bar, or the
// total so far) linking to the spending screen. Spending with no exchange rate is never guessed: the card says which
// currencies are not counted yet.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import type { Trip } from '../../core/model.ts';
import { budgetStatus, formatMoney, readSpending, total } from '../../core/spending.ts';
import { useApp } from '../../state/app.tsx';
import { elevated, radius, space, typeScale } from '../../theme/tokens.ts';
import { IconBadge, ProgressBar, type Tone } from '../hero.tsx';
import { PressableScale } from '../kit.tsx';

export function TripSpendingSlot({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const s = useMemo(() => readSpending(trip), [trip]);
  const home = s.budget?.currency ?? null;
  const sum = useMemo(() => total(s.expenses, home, s.rates), [s, home]);
  const status = useMemo(() => budgetStatus(s), [s]);
  const money = (minor: number, code: string) => formatMoney(minor, code, lang);

  let headline: string;
  let detail: string | null = null;
  if (status && home) {
    headline = t('spending.slot.spentOf', { spent: money(status.spent, home), budget: money(status.budget, home) });
    detail = status.over ? t('spending.slot.over', { amount: money(-status.left, home) }) : t('spending.slot.left', { amount: money(status.left, home) });
  } else if (sum.count === 0) {
    headline = t('spending.slot.none');
    detail = t('spending.slot.noneBody');
  } else if (home && sum.home != null) {
    headline = t('spending.slot.spent', { amount: money(sum.home, home) });
  } else {
    headline = t('spending.slot.spent', { amount: sum.perCurrency.map((m) => money(m.amount, m.currency)).join(' + ') });
  }
  const missing = sum.missing.length ? t('spending.missingShort', { codes: sum.missing.join(', ') }) : null;
  const tone: Tone = status?.over ? 'danger' : status?.near ? 'warn' : 'ok';
  const summary = [headline, detail, missing].filter(Boolean).join('. ');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('spending.slot.a11y', { summary })}
      accessibilityHint={t('spending.slot.hint')}
      onPress={() => router.push(`/spending/${trip.id}`)}
      style={[
        elevated(theme, 'low'),
        { borderRadius: radius.l, padding: space.l, gap: space.s },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name="wallet-outline" tone={status ? tone : 'accent'} />
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.caption, { color: theme.muted }]}>{t('spending.title')}</Text>
          <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{headline}</Text>
        </View>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </View>
      </View>
      {status && home ? <ProgressBar progress={status.fraction} tone={tone} label={t('spending.progressA11y', { spent: money(status.spent, home), budget: money(status.budget, home) })} /> : null}
      {detail ? <Text style={[typeScale.small, { color: status?.over ? theme.danger : theme.muted }]}>{detail}</Text> : null}
      {missing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Ionicons name="alert-circle" size={16} color={theme.warn} />
          </View>
          <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{missing}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}
