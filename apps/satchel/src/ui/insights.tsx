// T111 Spending insights: budget pace, day-by-day bars, category ring with legend, biggest days and cash vs card,
// plus the receipt thumbnail and full-screen viewer used by the Spending screen. Numbers come from
// src/core/insights.ts (integer minor units). Charts are react-native-svg in token colours (tone foregrounds, which
// pass the contrast test against cards in both themes); each chart is one accessible element whose label is the
// same text summary shown under it. Motion is the shared timed fade (FadeInView); nothing springs.
import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo, useState } from 'react';
import { Image, Modal, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect } from 'react-native-svg';
import { formatDay } from '../core/format.ts';
import { biggestDays, budgetPace, cashCardSplit, categorySlices, dailySeries, insightCurrency, type PaceState } from '../core/insights.ts';
import type { ExpenseCategory, LocalDate, Trip } from '../core/model.ts';
import { formatMoney, type Spending } from '../core/spending.ts';
import type { Key } from '../i18n/en.ts';
import { appPath } from '../native/files.ts';
import { useApp } from '../state/app.tsx';
import { radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { FadeInView, IconBadge, SectionHeader, toneColours, type IconName, type Tone } from './hero.tsx';
import { Body, Card, PressableScale } from './kit.tsx';

export const CATEGORY_KEYS: Record<ExpenseCategory, Key> = {
  food: 'spending.cat.food',
  transport: 'spending.cat.transport',
  stay: 'spending.cat.stay',
  activities: 'spending.cat.activities',
  shopping: 'spending.cat.shopping',
  other: 'spending.cat.other',
};
export const CATEGORY_ICONS: Record<ExpenseCategory, IconName> = {
  food: 'restaurant-outline',
  transport: 'bus-outline',
  stay: 'bed-outline',
  activities: 'ticket-outline',
  shopping: 'bag-handle-outline',
  other: 'ellipsis-horizontal-circle-outline',
};
export const CATEGORY_TONES: Record<ExpenseCategory, Tone> = { food: 'accent', transport: 'sea', stay: 'teal', activities: 'ok', shopping: 'warn', other: 'ink' };

const PACE_TONE: Record<PaceState, Tone> = { 'on-track': 'ok', ahead: 'warn', over: 'danger' };
const PACE_ICON: Record<PaceState, IconName> = { 'on-track': 'checkmark-circle-outline', ahead: 'speedometer-outline', over: 'alert-circle-outline' };

/** The Insights section: everything in the base currency (home, or the one currency used). */
export function SpendingInsights({ trip, s, cashIds, today }: { trip: Trip; s: Spending; cashIds: ReadonlySet<string>; today: LocalDate }) {
  const { t, lang } = useApp();
  const base = insightCurrency(s);
  const data = useMemo(() => {
    if (!base) return null;
    const series = dailySeries(s, trip, base);
    return { series, top: biggestDays(series, 3), slices: categorySlices(s, base), pay: cashCardSplit(s, cashIds, base), pace: budgetPace(s, trip, today) };
  }, [s, trip, base, cashIds, today]);
  const money = (minor: number) => formatMoney(minor, base ?? 'USD', lang);
  if (!s.expenses.length) return null;
  const hasData = !!data && data.series.some((d) => d.amount > 0);
  return (
    <View style={{ gap: space.m }}>
      <SectionHeader title={t('insights.title')} icon="analytics-outline" tone="sea" />
      {!base ? <Card><Body muted>{t('insights.noBase')}</Body></Card> : null}
      {data?.pace ? <PaceCard pace={data.pace} money={money} /> : base && s.budget && s.budget.amount === undefined ? <Card><Body muted>{t('insights.pace.noBudget')}</Body></Card> : null}
      {base && !hasData ? <Card><Body muted>{t('insights.noData')}</Body></Card> : null}
      {data && hasData ? (
        <>
          <FadeInView>
            <DayBars series={data.series} top={data.top} money={money} />
          </FadeInView>
          <FadeInView delay={60}>
            <CategoryRing slices={data.slices} money={money} />
          </FadeInView>
          {data.pay ? (
            <FadeInView delay={120}>
              <PayCard pay={data.pay} money={money} />
            </FadeInView>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function CardTitle({ title, icon, tone }: { title: string; icon: IconName; tone: Tone }) {
  const { theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
      <IconBadge name={icon} tone={tone} />
      <Text accessibilityRole="header" style={[typeScale.title, { flex: 1, color: theme.ink }]}>
        {title}
      </Text>
    </View>
  );
}

function PaceCard({ pace, money }: { pace: NonNullable<ReturnType<typeof budgetPace>>; money: (m: number) => string }) {
  const { t, theme } = useApp();
  const tone = PACE_TONE[pace.state];
  const { fg, bg } = toneColours(theme, tone);
  const stateLabel = t(`insights.pace.${pace.state}` as Key);
  const body =
    pace.state === 'over'
      ? t('insights.pace.body.over', { spent: money(pace.spent), amount: money(pace.spent - pace.budget), budget: money(pace.budget) })
      : t(`insights.pace.body.${pace.state}` as Key, { spent: money(pace.spent), planned: money(pace.planned) });
  const perDay = pace.perDayLeft != null ? (pace.daysLeft === 1 ? t('insights.pace.perDayOne', { amount: money(pace.perDayLeft) }) : t('insights.pace.perDay', { amount: money(pace.perDayLeft), n: pace.daysLeft })) : null;
  return (
    <Card style={{ gap: space.m, backgroundColor: bg }}>
      <View accessible accessibilityLabel={t('insights.pace.a11y', { state: stateLabel, body: [body, perDay, pace.partial ? t('insights.pace.partial') : ''].filter(Boolean).join(' ') })} style={{ gap: space.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <Ionicons name={PACE_ICON[pace.state]} size={28} color={fg} />
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.caption, { color: fg }]}>{t('insights.pace.title')}</Text>
            <Text style={[typeScale.title, { color: theme.ink }]}>{stateLabel}</Text>
          </View>
        </View>
        <Text style={[typeScale.body, { color: theme.ink }]}>{body}</Text>
        {perDay ? <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{perDay}</Text> : null}
        {pace.partial ? <Text style={[typeScale.small, { color: theme.ink }]}>{t('insights.pace.partial')}</Text> : null}
      </View>
    </Card>
  );
}

const BAR_H = 120;

const DayBars = memo(function DayBars({ series, top, money }: { series: ReturnType<typeof dailySeries>; top: ReturnType<typeof biggestDays>; money: (m: number) => string }) {
  const { t, theme, lang } = useApp();
  const [w, setW] = useState(0);
  const max = Math.max(1, ...series.map((d) => d.amount));
  const totalAmount = series.reduce((n, d) => n + d.amount, 0);
  const spentDays = series.filter((d) => d.amount > 0).length;
  const missing = series.reduce((n, d) => n + d.missing, 0);
  const best = top[0];
  const summary = best
    ? t('insights.days.summary', { n: spentDays, days: series.length, total: money(totalAmount), day: formatDay(best.day, lang), amount: money(best.amount) })
    : t('insights.days.summaryNone');
  const gap = series.length > 20 ? 2 : 4;
  const barW = w > 0 ? Math.max(2, (w - gap * (series.length - 1)) / series.length) : 0;
  const bar = toneColours(theme, 'sea').fg;
  const peak = toneColours(theme, 'accent').fg;
  return (
    <Card style={{ gap: space.m }}>
      <CardTitle title={t('insights.days.title')} icon="bar-chart-outline" tone="sea" />
      <View accessible accessibilityRole="image" accessibilityLabel={t('insights.days.a11y', { summary })} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: BAR_H }}>
        {w > 0 ? (
          <Svg width={w} height={BAR_H}>
            <Rect x={0} y={BAR_H - 1} width={w} height={1} fill={theme.line} />
            {series.map((d, i) => {
              const h = d.amount > 0 ? Math.max(4, Math.round(((BAR_H - 6) * d.amount) / max)) : 2;
              return <Rect key={d.day} x={i * (barW + gap)} y={BAR_H - 1 - h} width={barW} height={h} rx={Math.min(4, barW / 2)} fill={d.amount <= 0 ? theme.line : best && d.day === best.day ? peak : bar} />;
            })}
          </Svg>
        ) : null}
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typeScale.small, { color: theme.muted }]}>{formatDay(series[0].day, lang)}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{formatDay(series[series.length - 1].day, lang)}</Text>
      </View>
      <Body muted>{summary}</Body>
      {missing ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('insights.days.missing', { n: missing })}</Text> : null}
      {top.length ? (
        <View style={{ gap: space.xs }}>
          <Text accessibilityRole="header" style={[typeScale.bodyStrong, { color: theme.ink }]}>
            {t('insights.biggest.title')}
          </Text>
          {top.map((d, i) => {
            const day = formatDay(d.day, lang);
            const count = d.count === 1 ? t('insights.biggest.countOne') : t('insights.biggest.countMany', { n: d.count });
            return (
              <View
                key={d.day}
                accessible
                accessibilityLabel={t('insights.biggest.a11y', { rank: i + 1, day, amount: money(d.amount), count })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TOUCH, borderTopWidth: i ? 1 : 0, borderTopColor: theme.line }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: i === 0 ? theme.accentSoft : theme.seaSoft }}>
                  <Text style={[typeScale.small, { fontFamily: typeScale.bodyStrong.fontFamily, color: i === 0 ? theme.accentInk : theme.sea }]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.body, { color: theme.ink }]}>{day}</Text>
                  <Text style={[typeScale.small, { color: theme.muted }]}>{count}</Text>
                </View>
                <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{money(d.amount)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
});

const RING = 148;
const STROKE = 20;

const CategoryRing = memo(function CategoryRing({ slices, money }: { slices: ReturnType<typeof categorySlices>; money: (m: number) => string }) {
  const { t, theme } = useApp();
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const sum = slices.reduce((n, x) => n + x.amount, 0);
  const items = slices.map((x) => t('insights.cat.item', { category: t(CATEGORY_KEYS[x.category]), percent: x.percent, amount: money(x.amount) }));
  let offset = 0;
  return (
    <Card style={{ gap: space.m }}>
      <CardTitle title={t('insights.cat.title')} icon="pie-chart-outline" tone="accent" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.l, flexWrap: 'wrap' }}>
        <View accessible accessibilityRole="image" accessibilityLabel={t('insights.cat.a11y', { summary: items.join('. ') })} style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
            <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={theme.line} strokeWidth={STROKE} fill="none" />
            {slices.map((x) => {
              const len = sum > 0 ? (c * x.amount) / sum : 0;
              const el = (
                <Circle
                  key={x.category}
                  cx={RING / 2}
                  cy={RING / 2}
                  r={r}
                  fill="none"
                  stroke={toneColours(theme, CATEGORY_TONES[x.category]).fg}
                  strokeWidth={STROKE}
                  strokeDasharray={[Math.max(0, len - (slices.length > 1 ? 2 : 0)), c]}
                  strokeDashoffset={-offset}
                  rotation={-90}
                  originX={RING / 2}
                  originY={RING / 2}
                />
              );
              offset += len;
              return el;
            })}
          </Svg>
          <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]} numberOfLines={1} adjustsFontSizeToFit>
            {money(sum)}
          </Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('insights.cat.centre')}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 140, gap: space.xs }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {slices.map((x) => (
            <View key={x.category} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 28 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: toneColours(theme, CATEGORY_TONES[x.category]).fg }} />
              <Text style={[typeScale.small, { flex: 1, color: theme.ink }]} numberOfLines={1}>
                {t(CATEGORY_KEYS[x.category])}
              </Text>
              <Text style={[typeScale.small, { fontFamily: typeScale.bodyStrong.fontFamily, color: theme.ink, fontVariant: ['tabular-nums'] }]}>{x.percent}%</Text>
            </View>
          ))}
        </View>
      </View>
      <Body muted>{items.join(' · ')}</Body>
    </Card>
  );
});

function PayCard({ pay, money }: { pay: NonNullable<ReturnType<typeof cashCardSplit>>; money: (m: number) => string }) {
  const { t, theme } = useApp();
  const cash = toneColours(theme, 'ok');
  const card = toneColours(theme, 'sea');
  const label = t('insights.pay.a11y', { cash: pay.cashPercent, cashAmount: money(pay.cash), card: pay.cardPercent, cardAmount: money(pay.card) });
  return (
    <Card style={{ gap: space.m }}>
      <CardTitle title={t('insights.pay.title')} icon="card-outline" tone="ok" />
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ flexDirection: 'row', height: 16, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: theme.line }}>
        {pay.cash > 0 ? <View style={{ flex: pay.cash, backgroundColor: cash.fg }} /> : null}
        {pay.card > 0 ? <View style={{ flex: pay.card, backgroundColor: card.fg }} /> : null}
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ gap: space.xs }}>
        {[
          { key: 'cash', name: t('insights.pay.cash'), percent: pay.cashPercent, amount: pay.cash, colour: cash.fg, icon: 'cash-outline' as IconName },
          { key: 'card', name: t('insights.pay.card'), percent: pay.cardPercent, amount: pay.card, colour: card.fg, icon: 'card-outline' as IconName },
        ].map((row) => (
          <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 28 }}>
            <Ionicons name={row.icon} size={18} color={row.colour} />
            <Text style={[typeScale.body, { flex: 1, color: theme.ink }]}>{row.name}</Text>
            <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{t('insights.pay.row', { percent: row.percent, amount: money(row.amount) })}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ---- receipts ----

/** A 48 pt receipt thumbnail that opens the full-screen viewer. */
export function ReceiptThumb({ uri, label, onPress }: { uri: string; label: string; onPress: () => void }) {
  const { t, theme } = useApp();
  return (
    <PressableScale accessibilityRole="imagebutton" accessibilityLabel={label} accessibilityHint={t('insights.receipt.thumbHint')} onPress={onPress} style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={{ uri: appPath(uri) }} resizeMode="cover" style={{ width: 40, height: 40, borderRadius: radius.s, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.seaSoft }} />
    </PressableScale>
  );
}

/** Full-screen receipt (fades in and out; no slide or bounce). */
export function ReceiptViewer({ uri, label, onClose }: { uri: string | null; label: string; onClose: () => void }) {
  const { t, theme } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={uri != null} animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: theme.paper, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, gap: space.m }}>
          <Text accessibilityRole="header" style={[typeScale.title, { flex: 1, color: theme.ink }]}>
            {t('insights.receipt.view')}
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('insights.receipt.close')}
            accessibilityHint={t('insights.receipt.closeHint')}
            onPress={onClose}
            style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: theme.seaSoft }}
          >
            <Ionicons name="close" size={24} color={theme.sea} />
          </PressableScale>
        </View>
        {uri ? <Image accessible accessibilityLabel={label} source={{ uri: appPath(uri) }} resizeMode="contain" style={{ flex: 1, margin: space.l }} /> : null}
      </View>
    </Modal>
  );
}
