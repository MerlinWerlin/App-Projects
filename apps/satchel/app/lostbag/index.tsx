// T127 Lost-bag kit: which bag? Reached from When things go wrong (Lost luggage) and the airport day ("My bag didn't
// arrive", with the trip and mode=report). Lists the bags of the trips under way, coming up and just ended (one trip
// when `tripId` is given), hold bags first for a report. Each row says how much of the bag is described. Records
// are phone-only (src/state/lostbag.ts). Tokens only, timed motion only, 48 pt rows, every control labelled.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { bagsOf, isCabin, visibleBags, type Bag } from '../../src/core/bags.ts';
import { deviceZone, formatRange, todayIn } from '../../src/core/format.ts';
import { descriptionProgress, isEmptyDescription, kitTrips } from '../../src/core/lostbag.ts';
import type { Trip } from '../../src/core/model.ts';
import { EMPTY_STORE, listFor, PACKING_KEY, type PackStore } from '../../src/core/packing.ts';
import { useApp } from '../../src/state/app.tsx';
import { useLostBag } from '../../src/state/lostbag.ts';
import { usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { cardPaint, radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { bagName } from '../../src/ui/bags.tsx';
import { FadeInView, HeroHeader, SectionCard } from '../../src/ui/hero.tsx';
import { EmptyState, PressableScale, Screen } from '../../src/ui/kit.tsx';

const BAG_ICON = { carry: 'briefcase', personal: 'bag-handle', checked: 'cube', own: 'bag' } as const;

function BagRow({ trip, bag, report }: { trip: Trip; bag: Bag; report: boolean }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [rec] = useLostBag(trip.id, bag.id);
  const name = bagName(t, bag);
  const where = t(isCabin(bag) ? 'lostbag.where.cabin' : 'lostbag.where.hold');
  const p = descriptionProgress(rec);
  const started = !!rec.reference || rec.log.length > 0;
  const summary = [isEmptyDescription(rec) ? t('lostbag.pick.summaryEmpty') : t('lostbag.pick.summary', { done: p.done, total: p.total }), started ? t('lostbag.pick.summaryReport') : '']
    .filter(Boolean)
    .join(' · ');
  const paint = cardPaint(theme, bag.colour);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('lostbag.pick.rowA11y', { name, where, trip: trip.name, summary })}
      accessibilityHint={t(report ? 'lostbag.pick.rowReportHint' : 'lostbag.pick.rowHint')}
      onPress={() => router.push({ pathname: '/lostbag/[tripId]', params: { tripId: trip.id, bag: bag.id, mode: report ? 'report' : 'describe' } })}
      style={{ minHeight: TOUCH + space.m, flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.l, backgroundColor: paint.fill }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: paint.wash, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={BAG_ICON[bag.kind]} size={20} color={paint.ink} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: paint.ink }]}>
          {name}
        </Text>
        <Text numberOfLines={2} style={[typeScale.small, { color: paint.muted }]}>
          {`${where} · ${summary}`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={paint.ink} />
    </PressableScale>
  );
}

export default function LostBagPicker() {
  const { tripId, mode } = useLocalSearchParams<{ tripId?: string; mode?: string }>();
  const report = mode === 'report';
  const { t, lang } = useApp();
  const { trips } = useTrips();
  const [store] = usePersisted<PackStore>(PACKING_KEY, EMPTY_STORE);
  const today = todayIn(deviceZone());
  const shown = tripId ? trips.filter((x) => x.id === tripId) : kitTrips(trips, today);
  const title = t(report ? 'lostbag.pick.reportTitle' : 'lostbag.pick.title');

  return (
    <Screen>
      <HeroHeader tone="emergency" compact illustration="route" eyebrow={t('lostbag.title')} title={title} subtitle={t('lostbag.phoneOnly')} />
      {shown.length === 0 ? (
        <EmptyState art="magnifier" title={t('lostbag.pick.emptyTitle')} body={t('lostbag.pick.emptyBody')} />
      ) : (
        <FadeInView style={{ gap: space.l }}>
          {shown.map((trip) => {
            const list = listFor(store, trip.id);
            const bags = (list ? visibleBags(list) : bagsOf(null)).slice();
            // For a report, hold bags come first (they're the ones that go missing).
            if (report) bags.sort((a, b) => Number(isCabin(a)) - Number(isCabin(b)));
            return (
              <SectionCard key={trip.id} title={trip.name} subtitle={formatRange(trip.startDate, trip.endDate, lang)} icon="briefcase-outline" tone="ok">
                <View style={{ gap: space.s }}>
                  {bags.map((bag) => (
                    <BagRow key={bag.id} trip={trip} bag={bag} report={report} />
                  ))}
                </View>
              </SectionCard>
            );
          })}
        </FadeInView>
      )}
    </Screen>
  );
}
