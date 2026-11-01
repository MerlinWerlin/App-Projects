// Booking detail: times as printed with each place's zone, duration, day shift, references, addresses, notes.
// T41: says which other items on the trip it overlaps (EDGE_CASES "Overlapping items"; nothing is moved).
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { overlapPartners, overlapTitles } from '../../src/core/clashes.ts';
import { formatDay, formatDuration, formatTime, zoneCity } from '../../src/core/format.ts';
import type { Stamp } from '../../src/core/model.ts';
import { isTransport } from '../../src/core/model.ts';
import { dayShift, minutesBetween } from '../../src/core/tz.ts';
import { zonesReadable } from '../../src/core/timeline.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { findItem, useTrips } from '../../src/state/trips.tsx';
import { fonts, space } from '../../src/theme/tokens.ts';
import { AddToCalendar } from '../../src/ui/AddToCalendar.tsx';
import { AirportPanel } from '../../src/ui/AirportPanel.tsx';
import { KindIcon, carrierKey, kindKey, numberKey } from '../../src/ui/kinds.tsx';
import { Body, Button, Card, EmptyState, Label, Screen, Warning } from '../../src/ui/kit.tsx';
import { ItemAddressSlot } from '../../src/ui/slots/ItemAddressSlot.tsx';
import { ItemLoyaltySlot } from '../../src/ui/slots/ItemLoyaltySlot.tsx';
import { ItemTicketSlot } from '../../src/ui/slots/ItemTicketSlot.tsx';
import { ItemStaySlot } from '../../src/ui/stay.tsx';
import { ItemRentalSlot } from '../../src/ui/driving.tsx';
import { LegInfoLines } from '../../src/ui/layovers.tsx';
import { ItemSettingSlot } from '../../src/ui/rainplan.tsx';
import { ItemCheckinSlot } from '../../src/ui/checkin.tsx';
import { ItemAccessSlot } from '../../src/ui/stepfree.tsx';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, theme, lang } = useApp();
  const { trips, deleteItem } = useTrips();
  const router = useRouter();
  const found = findItem(trips, id);
  if (!found) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('item.title')} body={t('item.notFound')} />
      </Screen>
    );
  }
  const { trip, item } = found;
  const [startLabel, endLabel]: [Key, Key] = isTransport(item.kind)
    ? ['item.departs', 'item.arrives']
    : item.kind === 'hotel'
      ? ['item.checkIn', 'item.checkOut']
      : item.kind === 'car'
        ? ['spec.item.pickUp', 'spec.item.dropOff']
        : ['item.starts', 'item.ends'];

  const when = (s: Stamp, extra = '') => (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 28, color: theme.ink, fontVariant: ['tabular-nums'] }}>
        {formatTime(s.local)}
        {extra}
      </Text>
      <Body muted>
        {formatDay(s.local.slice(0, 10), lang)} · {t('item.zone', { time: formatTime(s.local), city: zoneCity(s.tz) })}
      </Body>
    </View>
  );
  const shift = item.end ? dayShift(item.start, item.end) : 0;
  // T43: a saved zone this phone can't read gives no real duration; say so instead of throwing (Edit fixes it).
  const readable = zonesReadable(item);
  const clashTitles = overlapTitles(overlapPartners(trip.items), item.id);
  const row = (k: Key, v?: string) =>
    v ? (
      <View key={k} style={{ gap: 2 }}>
        <Label>{t(k)}</Label>
        <Text selectable style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: theme.ink }}>
          {v}
        </Text>
      </View>
    ) : null;

  const confirmDelete = () =>
    Alert.alert(t('item.deleteConfirm', { title: item.title }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          // Its attachment files are removed by the store once the deletion is saved.
          if (!(await deleteItem(trip.id, item.id))) {
            Alert.alert(t('error.item.save.title'), t('error.item.save.body'));
            return;
          }
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: t(kindKey(item.kind)) }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <KindIcon kind={item.kind} color={theme.accent} size={26} />
        <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.display, fontSize: 24, color: theme.ink }}>
          {item.title}
        </Text>
      </View>
      <Card>
        <Label>{t(startLabel)}</Label>
        {when(item.start)}
        {item.end ? (
          <>
            <Label>{t(endLabel)}</Label>
            {when(item.end, shift ? `  ${t('item.dayShift', { n: shift > 0 ? `+${shift}` : String(shift) })}` : '')}
            {item.kind !== 'hotel' && readable ? <Body muted>{t('item.duration', { d: formatDuration(minutesBetween(item.start, item.end)) })}</Body> : null}
          </>
        ) : null}
        {/* T131: terminal and gate typed on a journey. */}
        <LegInfoLines item={item} />
      </Card>
      <AirportPanel item={item} framed />
      {/* T143: check-in opens / closes, Mark checked in, Calendar reminder and per-booking times. */}
      <ItemCheckinSlot item={item} />
      {readable ? null : <Warning text={t('t43.item.zoneUnreadable')} />}
      {clashTitles ? <Warning text={t('spec41.item.overlaps', { titles: clashTitles })} /> : null}
      <ItemTicketSlot trip={trip} item={item} />
      <ItemLoyaltySlot item={item} />
      <ItemAddressSlot trip={trip} item={item} />
      <ItemStaySlot item={item} />
      {/* T122: rental car checklist on car bookings (phone only). */}
      <ItemRentalSlot item={item} />
      {/* T140: indoors / outdoors, for rainy-day plan B (activities only). */}
      <ItemSettingSlot item={item} />
      {/* T156: step-free room / assistance booked / lift and a note (shown when needs are set or notes exist). */}
      <ItemAccessSlot item={item} />
      <Card>
        {row('item.from', item.from?.name)}
        {row('item.to', item.to?.name)}
        {row('item.place', item.place?.name !== item.title ? item.place?.name : undefined)}
        {row('item.address', item.place?.address)}
        {row('item.localAddress', item.place?.localAddress)}
        {row('item.ref', item.ref)}
        {row(carrierKey(item.kind), item.carrier)}
        {row(numberKey(item.kind), item.number)}
        {row('item.seat', item.seat)}
        {row('item.notes', item.notes)}
      </Card>
      <AddToCalendar trip={trip} scope={{ kind: 'item', id: item.id }} />
      <Button label={t('item.edit')} hint={t('spec.item.editHint')} onPress={() => router.push({ pathname: '/item-edit', params: { tripId: trip.id, id: item.id } })} />
      <Button label={t('item.delete')} hint={t('spec.item.deleteHint')} kind="quiet" onPress={confirmDelete} />
    </Screen>
  );
}
