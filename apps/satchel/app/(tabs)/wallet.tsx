// Wallet tab: every ticket across all trips in real time order, upcoming first (soonest at the top), then past.
// Each row opens the full-brightness ticket view. Tickets are free forever. The document vault entry sits below.
// T50: warm hero with the upcoming count, a quick-access row (Emergency card, Documents, Packing, Essentials),
// upcoming tickets grouped by trip, and ticket cards with a colour stripe per booking kind and an "Offline ready"
// badge (the ticket file is saved on the phone). T56: a "Show a local" entry under the quick row opens the offline
// phrase cards (app/phrases.tsx). T61: Convert and Split bill quick actions open app/convert.tsx.
// T105: a Tipping quick action opens app/tipping.tsx.
// T102: a Cash card (cash on hand for the trip in progress or next) opens app/cash/[tripId].tsx.
// T119: wallet hero scene (entrance on every tab focus), SectionHeader rhythm, elevated cards, and each trip's group
// header in that trip's own accent (src/theme/tripAccent.ts, from its cover scene).
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deviceZone, formatDay, formatTime, todayIn, zoneCity } from '../../src/core/format.ts';
import { cashTripFor } from '../../src/core/cash.ts';
import { tripCover } from '../../src/core/covers.ts';
import { focusTrip } from '../../src/core/glance.ts';
import { splitWallet, walletEntries, type WalletEntry } from '../../src/core/tickets.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { elevated, radius, rhythm, space, typeScale } from '../../src/theme/tokens.ts';
import { tripAccent, type TripAccent } from '../../src/theme/tripAccent.ts';
import { FocusEntrance, HeroHeader, IconBadge, QuickAction, SectionHeader, toneColours } from '../../src/ui/hero.tsx';
import { KIND_ICON, KIND_TONE, kindKey } from '../../src/ui/kinds.tsx';
import { Button, EmptyState, PressableScale } from '../../src/ui/kit.tsx';
import { CashCard } from '../../src/ui/CashCard.tsx';
import { WalletCards } from '../../src/ui/loyaltyCards.tsx';
import { WalletVaultSlot } from '../../src/ui/slots/WalletVaultSlot.tsx';

type Row =
  | { type: 'header'; key: string; label: string; past: boolean }
  | { type: 'trip'; key: string; label: string; tripId: string }
  | { type: 'entry'; key: string; entry: WalletEntry; past: boolean };

const TicketCard = memo(function TicketCard({ entry, past }: { entry: WalletEntry; past: boolean }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const { item, tripName, ticket } = entry;
  const tone = KIND_TONE[item.kind];
  const stripe = past ? theme.line : toneColours(theme, tone).fg;
  const whenText = `${formatDay(item.start.local.slice(0, 10), lang)} · ${formatTime(item.start.local)} ${zoneCity(item.start.tz)}`;
  const label = `${t('wallet.open', { kind: t(kindKey(item.kind)), title: item.title, when: whenText, trip: tripName })}, ${t('design.wallet.offlineA11y')}`;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('wallet.openHint')} onPress={() => router.push(`/ticket/${item.id}`)}>
      <View
        style={[
          {
            flexDirection: 'row',
            borderRadius: radius.l,
            overflow: 'hidden',
            opacity: past ? 0.72 : 1,
          },
          elevated(theme, 'low'),
        ]}
      >
        <View style={{ width: 6, backgroundColor: stripe }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l }}>
          <IconBadge name={KIND_ICON[item.kind]} tone={past ? 'ink' : tone} />
          <View style={{ flex: 1, gap: rhythm.hair }}>
            <Text numberOfLines={2} style={[typeScale.bodyStrong, { fontSize: 17, color: theme.ink }]}>
              {item.title}
            </Text>
            <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{whenText}</Text>
            <Text numberOfLines={1} style={[typeScale.small, { color: theme.muted }]}>
              {[tripName, item.ref ? t('wallet.refShort', { ref: item.ref }) : ''].filter(Boolean).join(' · ')}
            </Text>
            {!past ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs }}>
                <Ionicons name="cloud-offline" size={14} color={theme.ok} />
                <Text style={[typeScale.caption, { color: theme.ok }]}>{t('design.wallet.offline')}</Text>
              </View>
            ) : null}
          </View>
          {ticket.qrCropUri ? (
            <View style={{ alignItems: 'center', gap: rhythm.hair, backgroundColor: theme.accentSoft, borderRadius: radius.m, padding: space.s }}>
              <Ionicons name="qr-code" size={22} color={theme.accentInk} />
              <Text style={[typeScale.caption, { color: theme.accentInk }]}>{t('wallet.qrBadge')}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={theme.muted} />
          )}
        </View>
      </View>
    </PressableScale>
  );
});

export default function WalletScreen() {
  const { t, theme } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());
  // Re-split upcoming / past each time the tab comes into view.
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const focus = useMemo(() => focusTrip(trips, todayIn(deviceZone(), now)), [trips, now]);
  const cashTrip = useMemo(() => cashTripFor(trips, todayIn(deviceZone(), now)), [trips, now]);

  const { rows, upcomingCount } = useMemo(() => {
    const { upcoming, past } = splitWallet(walletEntries(trips), now);
    const out: Row[] = [];
    if (upcoming.length) out.push({ type: 'header', key: 'h-upcoming', label: t('wallet.upcoming'), past: false });
    // Grouped by trip, trips in order of their soonest ticket; tickets keep their time order inside a trip.
    const order: string[] = [];
    const byTrip = new Map<string, WalletEntry[]>();
    for (const e of upcoming) {
      if (!byTrip.has(e.tripId)) {
        byTrip.set(e.tripId, []);
        order.push(e.tripId);
      }
      byTrip.get(e.tripId)!.push(e);
    }
    for (const id of order) {
      const group = byTrip.get(id)!;
      if (order.length > 1) out.push({ type: 'trip', key: `t-${id}`, label: group[0].tripName, tripId: id });
      for (const e of group) out.push({ type: 'entry', key: e.key, entry: e, past: false });
    }
    if (past.length) out.push({ type: 'header', key: 'h-past', label: t('wallet.past'), past: true });
    for (const e of past) out.push({ type: 'entry', key: e.key, entry: e, past: true });
    return { rows: out, upcomingCount: upcoming.length };
  }, [trips, now, t]);

  // T119: each trip's own accent (from its cover) for its group header.
  const accents = useMemo(() => {
    const m = new Map<string, TripAccent>();
    for (const trip of trips) m.set(trip.id, tripAccent(tripCover(trip), theme));
    return m;
  }, [trips, theme]);

  const renderRow = useCallback(
    ({ item: row }: { item: Row }) => {
      if (row.type === 'header') {
        return (
          <View style={{ marginTop: rhythm.tight }}>
            <SectionHeader title={row.label} icon={row.past ? 'archive-outline' : 'time-outline'} tone={row.past ? 'ink' : 'accent'} />
          </View>
        );
      }
      if (row.type === 'trip') {
        const accent = accents.get(row.tripId);
        return (
          <View accessible accessibilityRole="header" accessibilityLabel={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <View style={{ width: 4, alignSelf: 'stretch', borderRadius: radius.pill, backgroundColor: accent?.strong ?? theme.line }} />
            <Ionicons name="briefcase-outline" size={16} color={accent?.ink ?? theme.muted} />
            <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: accent?.ink ?? theme.ink, flex: 1 }]}>
              {row.label}
            </Text>
          </View>
        );
      }
      return <TicketCard entry={row.entry} past={row.past} />;
    },
    [theme, accents],
  );

  const heroCount = upcomingCount === 0 ? t('design.wallet.heroCountNone') : upcomingCount === 1 ? t('design.wallet.heroCountOne') : t('design.wallet.heroCount', { n: upcomingCount });

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: insets.top + space.m, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: rhythm.stack }}
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={renderRow}
      initialNumToRender={8}
      windowSize={7}
      ListHeaderComponent={
        <View style={{ gap: rhythm.section, marginBottom: rhythm.tight }}>
          <HeroHeader scene="wallet" eyebrow={heroCount} title={t('wallet.title')} subtitle={t('design.wallet.subtitle')} />
          <FocusEntrance delay={60} style={{ gap: rhythm.tight }}>
            <SectionHeader title={t('design.wallet.quick')} icon="flash-outline" tone="accent" />
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <QuickAction icon="medkit" tone="danger" label={t('design.wallet.q.emergency')} hint={t('design.wallet.q.emergencyHint')} onPress={() => router.navigate('/emergency')} />
              <QuickAction icon="lock-closed" tone="sea" label={t('design.wallet.q.vault')} hint={t('design.wallet.q.vaultHint')} onPress={() => router.push('/vault')} />
              <QuickAction
                icon="bag-handle"
                tone="teal"
                label={t('design.wallet.q.packing')}
                hint={focus ? t('design.wallet.q.packingHint', { trip: focus.name }) : t('design.wallet.q.packingNone')}
                disabled={!focus}
                onPress={() => focus && router.push(`/packing/${focus.id}`)}
              />
              <QuickAction icon="battery-half" tone="warn" label={t('design.wallet.q.essentials')} hint={t('design.wallet.q.essentialsHint')} onPress={() => router.push('/essentials')} />
            </View>
            {/* T61: offline converter and bill split on the trip's own rates. */}
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <QuickAction icon="cash-outline" tone="accent" label={t('convert.q.convert')} hint={t('convert.q.convertHint')} onPress={() => router.push('/convert')} />
              <QuickAction icon="people-outline" tone="ok" label={t('convert.q.split')} hint={t('convert.q.splitHint')} onPress={() => router.push({ pathname: '/convert', params: { section: 'split' } })} />
              {/* T90: offline units and clothing sizes. */}
              <QuickAction icon="speedometer-outline" tone="sea" label={t('units.q.units')} hint={t('units.q.unitsHint')} onPress={() => router.push('/units')} />
              {/* T105: tipping guide and tip calculator. */}
              <QuickAction icon="happy-outline" tone="warn" label={t('tipping.q.tipping')} hint={t('tipping.q.tippingHint')} onPress={() => router.push('/tipping')} />
            </View>
          </FocusEntrance>
          <FocusEntrance delay={120} style={{ gap: rhythm.stack }}>
            <SectionHeader title={t('look2.wallet.sectionMore')} icon="wallet-outline" tone="teal" />
            {/* T102: cash on hand. */}
            <CashCard trip={cashTrip} showTrip />
            <Button kind="secondary" icon="chatbubbles-outline" label={t('phrases.walletEntry')} hint={t('phrases.walletEntryHint')} onPress={() => router.push('/phrases')} />
            {/* T87: membership cards, on this phone only. */}
            <WalletCards />
          </FocusEntrance>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          art="ticket"
          title={t('wallet.empty')}
          body={t('wallet.emptyBody')}
          action={<Button label={t('empty.wallet.action')} hint={t('empty.wallet.actionHint')} onPress={() => router.navigate('/')} />}
        />
      }
      ListFooterComponent={
        <View style={{ marginTop: rhythm.section, gap: rhythm.tight }}>
          <SectionHeader title={t('look2.wallet.sectionDocs')} icon="lock-closed-outline" tone="sea" />
          <WalletVaultSlot />
        </View>
      }
    />
  );
}
