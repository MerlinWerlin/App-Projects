// Document vault: locked first (device authentication), then the documents with expiry badges and trip warnings.
// Relocks on Lock, when you leave the vault, and after more than 60 s in the background (src/core/vault.ts).
// Covered in the app switcher while mounted (T57, src/ui/PrivacyCover.tsx in the root layout).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { deviceZone, todayIn } from '../src/core/format.ts';
import type { TravelDoc } from '../src/core/model.ts';
import { allTripWarnings, expiryOf, requiresUnlock, sortDocs } from '../src/core/vault.ts';
import { useApp } from '../src/state/app.tsx';
import { usePrivacyGuard } from '../src/state/privacyGuard.ts';
import { useTrips } from '../src/state/trips.tsx';
import { dispatchLock, useVaultDocs, useVaultLock } from '../src/state/vaultLock.ts';
import { fonts, space } from '../src/theme/tokens.ts';
import { Body, Button, Card, EmptyState, Label, PressableScale, Title, Warning } from '../src/ui/kit.tsx';
import { DOC_ICON, docKindKey, ExpiryBadge, expiryText, tripWarningText, UnprotectedBanner, VaultLockGate } from '../src/ui/slots/WalletVaultSlot.tsx';

export default function VaultScreen() {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const lock = useVaultLock();
  usePrivacyGuard();
  const [docs] = useVaultDocs();
  const { trips } = useTrips();
  const today = todayIn(deviceZone());
  const list = useMemo(() => sortDocs(docs, today), [docs, today]);
  const warnings = useMemo(() => allTripWarnings(docs, trips, today), [docs, trips, today]);

  // Leaving the vault (back to the Wallet) locks it; the next visit asks again.
  useEffect(() => () => dispatchLock({ type: 'leave' }), []);

  const renderDoc = useCallback(
    ({ item: doc }: { item: TravelDoc }) => {
      const e = expiryOf(doc, today);
      const status = expiryText(t, e, doc.expires, lang);
      const kind = t(docKindKey(doc.kind));
      const colour = e.status === 'expired' ? theme.danger : e.status === 'soon' ? theme.warn : theme.muted;
      return (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('vault.rowA11y', { kind, label: doc.label, status })}
          accessibilityHint={t('vault.rowHint')}
          onPress={() => router.push(`/doc/${doc.id}`)}
        >
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            <Ionicons name={DOC_ICON[doc.kind]} size={26} color={theme.ink} />
            <View style={{ flex: 1, gap: 2 }}>
              <Label>{kind}</Label>
              <Text style={{ fontFamily: fonts.displayMedium, fontSize: 18, color: theme.ink }}>{doc.label}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colour }}>{status}</Text>
              {doc.attachments.length ? (
                <Body muted>{doc.attachments.length === 1 ? t('vault.copiesOne') : t('vault.copies', { n: doc.attachments.length })}</Body>
              ) : null}
            </View>
            <ExpiryBadge status={e.status} />
          </Card>
        </PressableScale>
      );
    },
    [t, theme, lang, today, router],
  );

  if (requiresUnlock(lock)) return <VaultLockGate autoPrompt />;

  const labelOf = (id: string) => docs.find((d) => d.id === id)?.label ?? '';

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ padding: space.l, paddingBottom: space.xxl, gap: space.m }}
      data={list}
      keyExtractor={(d) => d.id}
      renderItem={renderDoc}
      ListHeaderComponent={
        <View style={{ gap: space.m, marginBottom: space.s }}>
          <Title>{t('vault.title')}</Title>
          <Body muted>{t('vault.privacy')}</Body>
          <UnprotectedBanner />
          {warnings.map((w) => (
            <Warning key={`${w.docId}-${w.tripId}`} text={tripWarningText(t, w, labelOf(w.docId), lang)} />
          ))}
          <Button label={t('vault.lockNow')} hint={t('vault.lockNowHint')} kind="quiet" onPress={() => dispatchLock({ type: 'lock' })} />
        </View>
      }
      ListEmptyComponent={<EmptyState title={t('vault.empty')} body={t('vault.emptyBody')} />}
      ListFooterComponent={
        <View style={{ gap: space.m, marginTop: space.s }}>
          <Button label={t('vault.add')} hint={t('vault.addHint')} onPress={() => router.push('/doc-edit')} />
          <Body muted>{t('vault.footer')}</Body>
        </View>
      }
    />
  );
}
