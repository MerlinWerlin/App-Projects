// Document detail: type, name, expiry as text, saved copies (images inline, PDFs in the system viewer), Edit and
// Delete. Behind the same vault lock as /vault, and covered in the app switcher (T57).
// T155: the ticket pieces for documents too: an image copy can be cropped to its QR / barcode (app/doc-crop/[id].tsx,
// the crop shows big above the copy) and a PDF opens full screen inside Satchel on builds with the viewer
// (src/native/pdfView.tsx: local file only, JavaScript off, links refused), else the system preview / share sheet.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, Image, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deviceZone, todayIn } from '../../src/core/format.ts';
import type { Attachment } from '../../src/core/model.ts';
import { expiryOf, isImage, isPdf, removeDoc, requiresUnlock, tripWarnings } from '../../src/core/vault.ts';
import { copyView } from '../../src/core/vaultcopy.ts';
import { openFile } from '../../src/native/docPick.ts';
import { PdfView, pdfViewerAvailable } from '../../src/native/pdfView.tsx';
import { fileExists, removeFile } from '../../src/native/files.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePrivacyGuard } from '../../src/state/privacyGuard.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { useVaultDocs, useVaultLock } from '../../src/state/vaultLock.ts';
import { fonts, radius, space, TOUCH } from '../../src/theme/tokens.ts';
import { CroppedImage } from '../../src/ui/CroppedImage.tsx';
import { Body, Button, Card, EmptyState, Label, PressableScale, Screen, Warning } from '../../src/ui/kit.tsx';
import { DOC_ICON, docKindKey, ExpiryBadge, expiryText, tripWarningText, UnprotectedBanner, VaultLockGate } from '../../src/ui/slots/WalletVaultSlot.tsx';

export default function DocScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const lock = useVaultLock();
  usePrivacyGuard();
  const [docs, setDocs, loaded] = useVaultDocs();
  const { trips } = useTrips();
  const doc = docs.find((d) => d.id === id);
  const [missing, setMissing] = useState<string[]>([]);
  const [openFailed, setOpenFailed] = useState(false);
  // T155: the PDF copy shown full screen (its attachment id), a viewer that failed, crops that can't be drawn.
  const [pdfOpen, setPdfOpen] = useState<string | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const [cropBroken, setCropBroken] = useState<string[]>([]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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
    return <Screen>{loaded ? <EmptyState art="magnifier" title={t('route.doc')} body={t('doc.notFound')} /> : null}</Screen>;
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

  const side = Math.min(width - space.l * 4, 420);
  const copy = (a: Attachment) => {
    if (missing.includes(a.id)) return <Warning key={a.id} text={t('doc.missingFile', { name: a.name })} />;
    const view = copyView(a, !pdfFailed && pdfViewerAvailable());
    if (isImage(a)) {
      const showCrop = !!view.crop && !cropBroken.includes(a.id);
      return (
        <View key={a.id} style={{ gap: space.s }}>
          {showCrop ? (
            <View style={{ alignSelf: 'center', backgroundColor: theme.card, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, padding: space.s }}>
              <CroppedImage
                uri={a.uri}
                crop={view.crop!}
                boxW={side - space.s * 2}
                boxH={Math.round(side * 1.1)}
                label={t('f109.doc.codeLabel', { label: doc.label, name: a.name })}
                onError={() => setCropBroken((b) => (b.includes(a.id) ? b : [...b, a.id]))}
              />
            </View>
          ) : null}
          <Image
            source={{ uri: a.uri }}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('doc.imageA11y', { label: doc.label, name: a.name })}
            style={{ width: '100%', height: 260, borderRadius: radius.s, backgroundColor: theme.paper }}
          />
          <Button
            label={t(view.cropAction === 'adjust' ? 'f109.doc.cropAdjust' : 'f109.doc.cropAdd')}
            hint={t(view.cropAction === 'adjust' ? 'f109.doc.cropAdjustHint' : 'f109.doc.cropAddHint', { name: a.name })}
            kind="quiet"
            icon="crop"
            onPress={() => router.push({ pathname: '/doc-crop/[id]', params: { id: doc.id, att: a.id } })}
          />
        </View>
      );
    }
    if (view.inlinePdf) {
      return (
        <View key={a.id} style={{ gap: space.xs }}>
          <Button label={t('f109.doc.viewPdf', { name: a.name })} hint={t('f109.doc.viewPdfHint')} kind="secondary" icon="document-text-outline" onPress={() => setPdfOpen(a.id)} />
          <Button label={t('f109.doc.sharePdf')} hint={t('f109.doc.sharePdfHint', { name: a.name })} kind="quiet" onPress={() => open(a)} />
        </View>
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
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink, flex: 1 }} numberOfLines={2}>
          {a.name}
        </Text>
        <Ionicons name="open-outline" size={20} color={theme.muted} />
      </PressableScale>
    );
  };

  const shownPdf = pdfOpen && !pdfFailed ? doc.attachments.find((a) => a.id === pdfOpen && isPdf(a) && !missing.includes(a.id)) : undefined;
  if (shownPdf) {
    // Full screen PDF (the ticket view's viewer): the system's own pinch-zoom and page scrolling; Back returns here.
    return (
      <View style={{ flex: 1, backgroundColor: theme.paper }}>
        <View style={{ flex: 1 }}>
          <PdfView
            uri={shownPdf.uri}
            label={t('f109.doc.pdfLabel', { label: doc.label, name: shownPdf.name })}
            background={theme.paper}
            onFail={() => {
              setPdfFailed(true);
              setPdfOpen(null);
              AccessibilityInfo.announceForAccessibility(t('f109.doc.pdfFailed'));
            }}
          />
        </View>
        {openFailed ? (
          <View style={{ paddingHorizontal: space.l, paddingTop: space.s }}>
            <Warning text={t('doc.openFailed')} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.s, paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: insets.bottom + space.m, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.paper }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('f109.doc.pdfBack')}
            accessibilityHint={t('f109.doc.pdfBackHint')}
            onPress={() => setPdfOpen(null)}
            style={{ flex: 1, minHeight: TOUCH + 12, borderRadius: radius.m, backgroundColor: theme.accentStrong, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.s }}
          >
            <Ionicons name="chevron-back" size={22} color={theme.onAccent} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.onAccent }}>{t('f109.doc.pdfBack')}</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('f109.doc.sharePdf')}
            accessibilityHint={t('f109.doc.sharePdfHint', { name: shownPdf.name })}
            onPress={() => open(shownPdf)}
            style={{ width: TOUCH + 12, minHeight: TOUCH + 12, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-outline" size={22} color={theme.ink} />
          </PressableScale>
        </View>
      </View>
    );
  }

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
        {pdfFailed ? <Warning text={t('f109.doc.pdfFailed')} /> : null}
        {openFailed ? <Warning text={t('doc.openFailed')} /> : null}
      </Card>
      <Button label={t('doc.edit')} hint={t('spec41.doc.editHint')} onPress={() => router.push({ pathname: '/doc-edit', params: { id: doc.id } })} />
      <Button label={t('doc.delete')} hint={t('doc.deleteHint')} kind="quiet" onPress={confirmDelete} />
    </Screen>
  );
}
