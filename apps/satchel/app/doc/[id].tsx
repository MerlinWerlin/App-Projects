// Document detail: type, name, expiry as text, saved copies (images inline, PDFs in the system viewer), Edit and
// Delete. Behind the same vault lock as /vault.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Text, View } from 'react-native';
import { deviceZone, todayIn } from '../../src/core/format.ts';
import type { Attachment } from '../../src/core/model.ts';
import { expiryOf, isImage, isPdf, removeDoc, requiresUnlock, tripWarnings } from '../../src/core/vault.ts';
import { openFile } from '../../src/native/docPick.ts';
import { fileExists, removeFile } from '../../src/native/files.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { useVaultDocs, useVaultLock } from '../../src/state/vaultLock.ts';
import { fonts, radius, space } from '../../src/theme/tokens.ts';
import { Body, Button, Card, EmptyState, Label, PressableScale, Screen, Warning } from '../../src/ui/kit.tsx';
import { DOC_ICON, docKindKey, ExpiryBadge, expiryText, tripWarningText, UnprotectedBanner, VaultLockGate } from '../../src/ui/slots/WalletVaultSlot.tsx';

export default function DocScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const lock = useVaultLock();
  const [docs, setDocs, loaded] = useVaultDocs();
  const { trips } = useTrips();
  const doc = docs.find((d) => d.id === id);
  const [missing, setMissing] = useState<string[]>([]);
  const [openFailed, setOpenFailed] = useState(false);

  const uris = doc?.attachments.map((a) => a.uri).join('|') ?? '';
  useEffect(() => {
    let alive = true;
    if (!doc) return;
    Promise.all(doc.attachments.map(async (a) => ((await fileExists(a.uri)) ? null : a.id))).then((r) => {
      if (alive) setMissing(r.filter((x): x is string => !!x));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uris]);

  if (requiresUnlock(lock)) return <VaultLockGate autoPrompt />;
  if (!doc) {
    return <Screen>{loaded ? <EmptyState title={t('route.doc')} body={t('doc.notFound')} /> : null}</Screen>;
  }

  const today = todayIn(deviceZone());
  const e = expiryOf(doc, today);
  const status = expiryText(t, e, doc.expires, lang);
  const statusColour = e.status === 'expired' ? theme.danger : e.status === 'soon' ? theme.warn : theme.ink;
  const warnings = tripWarnings(doc, trips, today);

  const open = async (a: Attachment) => {
    setOpenFailed(false);
    const ok = await openFile(a.uri, a.mime, a.name);
    if (!ok) setOpenFailed(true);
  };

  const confirmDelete = () =>
    Alert.alert(t('doc.deleteConfirm', { label: doc.label }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          const files = doc.attachments.flatMap((a) => (a.qrCropUri ? [a.uri, a.qrCropUri] : [a.uri]));
          setDocs((old) => removeDoc(old, doc.id));
          files.forEach((u) => removeFile(u));
          router.back();
        },
      },
    ]);

  const copy = (a: Attachment) => {
    if (missing.includes(a.id)) return <Warning key={a.id} text={t('doc.missingFile', { name: a.name })} />;
    if (isImage(a)) {
      return (
        <Image
          key={a.id}
          source={{ uri: a.uri }}
          resizeMode="contain"
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('doc.imageA11y', { label: doc.label, name: a.name })}
          style={{ width: '100%', height: 260, borderRadius: radius.s, backgroundColor: theme.paper }}
        />
      );
    }
    return (
      <PressableScale
        key={a.id}
        accessibilityRole="button"
        accessibilityLabel={t('doc.openPdf', { name: a.name })}
        accessibilityHint={isPdf(a) ? t('doc.openPdfHint') : undefined}
        onPress={() => open(a)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, borderWidth: 1, borderColor: theme.line, borderRadius: radius.s, paddingHorizontal: space.m }}
      >
        <Ionicons name="document-outline" size={22} color={theme.ink} />
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink, flex: 1 }} numberOfLines={1}>
          {a.name}
        </Text>
        <Ionicons name="open-outline" size={20} color={theme.muted} />
      </PressableScale>
    );
  };

  return (
    <Screen>
      <UnprotectedBanner />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Ionicons name={DOC_ICON[doc.kind]} size={24} color={theme.ink} />
          <Label>{t(docKindKey(doc.kind))}</Label>
        </View>
        <Text accessibilityRole="header" selectable style={{ fontFamily: fonts.display, fontSize: 26, color: theme.ink }}>
          {doc.label}
        </Text>
        <View style={{ gap: 2 }}>
          <Label>{t('doc.expiry')}</Label>
          <Text selectable style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: statusColour }}>
            {status}
          </Text>
        </View>
        <ExpiryBadge status={e.status} />
      </Card>
      {warnings.map((w) => (
        <Warning key={w.tripId} text={tripWarningText(t, w, doc.label, lang)} />
      ))}
      <Card>
        <Label>{t('doc.copiesTitle')}</Label>
        {doc.attachments.length ? doc.attachments.map(copy) : <Body muted>{t('doc.noCopies')}</Body>}
        {openFailed ? <Warning text={t('doc.openFailed')} /> : null}
      </Card>
      <Button label={t('doc.edit')} onPress={() => router.push({ pathname: '/doc-edit', params: { id: doc.id } })} />
      <Button label={t('doc.delete')} hint={t('doc.deleteHint')} kind="quiet" onPress={confirmDelete} />
    </Screen>
  );
}
