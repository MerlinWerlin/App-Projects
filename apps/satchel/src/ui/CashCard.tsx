// T102: the "Cash" entry card on the Wallet tab and in a trip's Spending. Shows cash left per currency, its home
// value at the saved rate, and a "Getting low" or "Leftover cash" line; opens app/cash/[tripId].tsx.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { cashSummary, hasCash, leftoverSummary, lowCash } from '../core/cash.ts';
import { deviceZone, todayIn } from '../core/format.ts';
import type { Trip } from '../core/model.ts';
import { formatMoney } from '../core/spending.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, shadowOf, space, TOUCH } from '../theme/tokens.ts';
import { IconBadge } from './hero.tsx';
import { PressableScale } from './kit.tsx';

export function CashCard({ trip, showTrip }: { trip: Trip | null; showTrip?: boolean }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const view = useMemo(() => {
    if (!trip) return null;
    const today = todayIn(deviceZone());
    const s = cashSummary(trip);
    const rows = s.rows.filter((r) => r.amount !== 0);
    const amounts = rows.map((r) => formatMoney(r.amount, r.currency, lang)).join(' · ');
    const total = s.home && s.totalHome != null && rows.some((r) => r.currency !== s.home && r.home != null) ? t('cash.card.total', { amount: formatMoney(s.totalHome, s.home, lang) }) : null;
    const low = lowCash(trip, today);
    const left = leftoverSummary(trip, today);
    const note = left.show ? t('cash.card.leftover') : low.length ? t('cash.card.low', { codes: low.map((l) => l.currency).join(', ') }) : null;
    return { has: hasCash(trip), amounts, total, note, warn: !left.show && low.length > 0 };
  }, [trip, lang, t]);

  const title = t('cash.card.title');
  const body = !trip ? t('cash.card.noTrip') : !view?.has ? t('cash.card.empty') : view.amounts || t('cash.card.none');
  const sub = trip && showTrip ? t('cash.card.trip', { trip: trip.name }) : null;
  const label = [title, sub, body, view?.total, view?.note].filter(Boolean).join(', ');
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={trip ? t('cash.card.hint') : t('cash.card.noTripHint')}
      accessibilityState={{ disabled: !trip }}
      disabled={!trip}
      onPress={() => trip && router.push(`/cash/${trip.id}`)}
      style={{
        minHeight: TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
        borderRadius: radius.l,
        borderWidth: theme.dark ? 1 : 0,
        borderColor: theme.line,
        backgroundColor: theme.cardRaised,
        opacity: trip ? 1 : 0.6,
        ...shadowOf(theme, 'low'),
      }}
    >
      <IconBadge name="cash-outline" tone="ok" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{title}</Text>
        {sub ? (
          <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>
            {sub}
          </Text>
        ) : null}
        <Text numberOfLines={2} style={{ fontFamily: view?.amounts ? fonts.bodyBold : fonts.body, fontSize: 15, color: view?.amounts ? theme.ink : theme.muted, fontVariant: ['tabular-nums'] }}>
          {body}
        </Text>
        {view?.total ? <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted, fontVariant: ['tabular-nums'] }}>{view.total}</Text> : null}
        {view?.note ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: view.warn ? theme.warn : theme.teal }}>{view.note}</Text> : null}
      </View>
      {trip ? <Ionicons name="chevron-forward" size={20} color={theme.muted} /> : null}
    </PressableScale>
  );
}
