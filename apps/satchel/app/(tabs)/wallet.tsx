// Wallet tab: every ticket across all trips in real time order, upcoming first (soonest at the top), then past.
// Each row opens the full-brightness ticket view. Tickets are free forever. The document vault entry sits below.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay, formatTime, zoneCity } from '../../src/core/format.ts';
import { splitWallet, walletEntries, type WalletEntry } from '../../src/core/tickets.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { fonts, radius, space } from '../../src/theme/tokens.ts';
import { KindIcon, kindKey } from '../../src/ui/kinds.tsx';
import { Button, Card, EmptyState, Label, PressableScale, Title } from '../../src/ui/kit.tsx';
import { WalletVaultSlot } from '../../src/ui/slots/WalletVaultSlot.tsx';

type Row = { type: 'header'; key: string; label: string } | { type: 'entry'; key: string; entry: WalletEntry; past: boolean };

export default function WalletScreen() {
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => Date.now());
  // Re-split upcoming / past each time the tab comes into view.
  useFocusEffect(useCallback(() => setNow(Date.now()), []));

  const rows = useMemo<Row[]>(() => {
    const { upcoming, past } = splitWallet(walletEntries(trips), now);
    const out: Row[] = [];
    if (upcoming.length) out.push({ type: 'header', key: 'h-upcoming', label: t('wallet.upcoming') });
    for (const e of upcoming) out.push({ type: 'entry', key: e.key, entry: e, past: false });
    if (past.length) out.push({ type: 'header', key: 'h-past', label: t('wallet.past') });
    for (const e of past) out.push({ type: 'entry', key: e.key, entry: e, past: true });
    return out;
  }, [trips, now, t]);

  const renderRow = useCallback(
    ({ item: row }: { item: Row }) => {
      if (row.type === 'header') {
        return (
          <View accessibilityRole="header" style={{ marginTop: space.s }}>
            <Label>{row.label}</Label>
          </View>
        );
      }
      const { item, tripName, ticket } = row.entry;
      const whenText = `${formatDay(item.start.local.slice(0, 10), lang)} · ${formatTime(item.start.local)} ${zoneCity(item.start.tz)}`;
      const label = t('wallet.open', { kind: t(kindKey(item.kind)), title: item.title, when: whenText, trip: tripName });
      return (
        <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('wallet.openHint')} onPress={() => router.push(`/ticket/${item.id}`)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, opacity: row.past ? 0.7 : 1 }}>
            <View style={{ width: 44, height: 44, borderRadius: radius.l, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <KindIcon kind={item.kind} color={theme.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={2} style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>
                {item.title}
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted, fontVariant: ['tabular-nums'] }}>{whenText}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>
                {[tripName, item.ref ? t('wallet.refShort', { ref: item.ref }) : ''].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {ticket.qrCropUri ? (
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Ionicons name="qr-code-outline" size={22} color={theme.accent} />
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: theme.accent }}>{t('wallet.qrBadge')}</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={20} color={theme.muted} />
            )}
          </Card>
        </PressableScale>
      );
    },
    [t, theme, lang, router],
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: insets.top + space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.m }}
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={renderRow}
      ListHeaderComponent={<Title>{t('wallet.title')}</Title>}
      ListEmptyComponent={
        <EmptyState
          title={t('wallet.empty')}
          body={t('wallet.emptyBody')}
          action={<Button label={t('empty.wallet.action')} hint={t('empty.wallet.actionHint')} onPress={() => router.navigate('/')} />}
        />
      }
      ListFooterComponent={
        <View style={{ marginTop: space.l }}>
          <WalletVaultSlot />
        </View>
      }
    />
  );
}
