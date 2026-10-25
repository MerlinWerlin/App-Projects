// Hotel address card: full screen, high contrast, the local-language address in the largest text, "Show this to
// your driver", and a one-handed Close at the bottom. With no address saved, explains and offers Edit booking.
// Copy address puts one address on the clipboard (expo-clipboard behind src/native/clipboard.ts; press and hold
// still works where the clipboard module is missing).
// T41 (FLOWS §7.1, ACCESSIBILITY "Hotel address card"): an Edit hotel address action under a saved address, and a
// hint on Close.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clipboardAvailable, copyText } from '../../src/native/clipboard.ts';
import { useApp } from '../../src/state/app.tsx';
import { findItem, useTrips } from '../../src/state/trips.tsx';
import { fonts, space } from '../../src/theme/tokens.ts';
import { AddressCardView } from '../../src/ui/AddressCardView.tsx';
import { callAndExplain } from '../../src/ui/EmergencyCardView.tsx';
import { Body, Button, EmptyState } from '../../src/ui/kit.tsx';

export default function AddressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, theme } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const found = findItem(trips, id);
  const place = found?.item.place;
  const hasAddress = !!(place?.address?.trim() || place?.localAddress?.trim());
  const [copyState, setCopyState] = useState<'copied' | 'failed' | null>(null);
  const copy = async (text: string) => {
    const ok = await copyText(text);
    setCopyState(ok ? 'copied' : 'failed');
    AccessibilityInfo.announceForAccessibility(t(ok ? 'address.copied' : 'address.copyFailed'));
  };
  const canCopy = clipboardAvailable();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={{ flex: 1, backgroundColor: theme.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingHorizontal: space.l, paddingBottom: space.xl, gap: space.l }}>
        {!found ? (
          <EmptyState title={t('route.address')} body={t('address.notFound')} />
        ) : hasAddress && place ? (
          <>
            <AddressCardView
              variant="themed"
              name={place.name || found.item.title}
              address={place.address}
              localAddress={place.localAddress}
              phone={place.phone}
              onCall={(n) => callAndExplain(n, t)}
              onCopy={canCopy ? copy : undefined}
            />
            {copyState ? (
              <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: copyState === 'copied' ? theme.ok : theme.ink }}>
                {t(copyState === 'copied' ? 'address.copied' : 'address.copyFailed')}
              </Text>
            ) : null}
            {!canCopy ? <Body muted>{t('address.copyTip')}</Body> : null}
            <Button
              kind="quiet"
              label={t('spec41.address.edit')}
              hint={t('spec41.address.editHint')}
              onPress={() => router.push({ pathname: '/item-edit', params: { tripId: found.trip.id, id: found.item.id } })}
            />
          </>
        ) : (
          <EmptyState
            title={t('address.noAddressTitle')}
            body={t('address.noAddressBody')}
            action={
              <Button
                label={t('address.editBooking')}
                hint={t('address.editBookingHint')}
                onPress={() => router.replace({ pathname: '/item-edit', params: { tripId: found.trip.id, id: found.item.id } })}
              />
            }
          />
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: insets.bottom + space.l, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.paper }}>
        <Button label={t('address.close')} hint={t('spec41.common.closeHint')} onPress={close} />
      </View>
    </View>
  );
}
