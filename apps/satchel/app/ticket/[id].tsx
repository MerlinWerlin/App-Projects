// Ticket view: full screen at full brightness (restored on every exit), the saved QR crop big, the ticket image
// fitted (tap for fill), booking ref / seat / times big, and a one-handed Close at the bottom.
// T28: a PDF ticket opens full screen inside Satchel (View PDF: pinch-zoom, page scrolling, offline) on builds that
// have the viewer (src/native/pdfView.tsx); otherwise, and always via Open in…, it goes to the system share sheet.
// T28: an image ticket can be cropped to its code in the app (app/crop/[id].tsx); the crop shows big at the top.
// T41: Copy booking reference (ACCESSIBILITY "Ticket view") where the clipboard module is present; the result is
// shown and announced.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay, formatTime, zoneCity } from '../../src/core/format.ts';
import type { Stamp } from '../../src/core/model.ts';
import { isTransport } from '../../src/core/model.ts';
import { cleanCrop } from '../../src/core/qrcrop.ts';
import { attachmentKind, ticketToShow } from '../../src/core/tickets.ts';
import type { Key } from '../../src/i18n/en.ts';
import { restoreBrightness, useFullBrightness } from '../../src/native/brightness.ts';
import { clipboardAvailable, copyText } from '../../src/native/clipboard.ts';
import { fileExists } from '../../src/native/files.ts';
import { appPath } from '../../src/native/files.ts';
import { PdfView, pdfViewerAvailable } from '../../src/native/pdfView.tsx';
import { openInSystem } from '../../src/native/pickers.ts';
import { useApp } from '../../src/state/app.tsx';
import { findItem, useTrips } from '../../src/state/trips.tsx';
import { fonts, radius, space, TOUCH } from '../../src/theme/tokens.ts';
import { AirportPanel } from '../../src/ui/AirportPanel.tsx';
import { CroppedImage } from '../../src/ui/CroppedImage.tsx';
import { kindKey } from '../../src/ui/kinds.tsx';
import { Body, Button, Card, EmptyState, Label, PressableScale, Warning } from '../../src/ui/kit.tsx';

export default function TicketScreen() {
  const { id, att } = useLocalSearchParams<{ id: string; att?: string }>();
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const brightOk = useFullBrightness();

  const found = findItem(trips, id);
  const item = found?.item;
  const shown = item ? ticketToShow(item, att) : null;
  const kind = shown ? attachmentKind(shown.mime, shown.name) : 'other';
  const fileUri = shown ? appPath(shown.uri) : null;
  const cropUri = shown?.qrCropUri ? appPath(shown.qrCropUri) : null;
  // T28: the in-app crop rectangle of an image ticket.
  const rect = shown && kind === 'image' ? cleanCrop(shown.qrCrop) : null;

  const [missing, setMissing] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const [cropBroken, setCropBroken] = useState(false);
  const [fill, setFill] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [rectBroken, setRectBroken] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfFailed, setPdfFailed] = useState(false);
  const openSystem = () => {
    if (!shown) return;
    setOpenFailed(false);
    openInSystem(shown.uri, shown.mime, shown.name).then((ok) => setOpenFailed(!ok));
  };
  const cropScreen = () => shown && item && router.push({ pathname: '/crop/[id]', params: { id: item.id, att: shown.id } });
  const [refCopy, setRefCopy] = useState<'copied' | 'failed' | null>(null);
  const copyRef = async (ref: string) => {
    const ok = await copyText(ref);
    setRefCopy(ok ? 'copied' : 'failed');
    AccessibilityInfo.announceForAccessibility(t(ok ? 'spec41.ticket.refCopied' : 'spec41.ticket.refCopyFailed'));
  };

  useEffect(() => {
    let alive = true;
    setMissing(false);
    setImageBroken(false);
    setCropBroken(false);
    setRectBroken(false);
    setPdfOpen(false);
    if (fileUri) fileExists(fileUri).then((ok) => alive && setMissing(!ok));
    return () => {
      alive = false;
    };
  }, [fileUri, cropUri]);

  const close = () => {
    restoreBrightness();
    if (router.canGoBack()) router.back();
    else router.replace('/wallet');
  };
  const manage = () => {
    restoreBrightness();
    // Back to the booking if it is underneath (from the detail screen), otherwise open it in place of the ticket.
    if (item) router.dismissTo(`/item/${item.id}`);
  };

  const side = Math.min(width - space.l * 2, 420);
  const big = (s: string, size = 30) => (
    <Text selectable style={{ fontFamily: fonts.display, fontSize: size, color: theme.ink, fontVariant: ['tabular-nums'], letterSpacing: 0.5 }}>
      {s}
    </Text>
  );
  const when = (label: Key, s: Stamp) => (
    <View style={{ gap: 2 }}>
      <Label>{t(label)}</Label>
      {big(formatTime(s.local), 34)}
      <Body muted>{t('ticket.timeAt', { day: formatDay(s.local.slice(0, 10), lang), time: formatTime(s.local), city: zoneCity(s.tz) })}</Body>
    </View>
  );

  const inlinePdf = kind === 'pdf' && !!fileUri && !pdfFailed && pdfViewerAvailable();
  const showPdf = pdfOpen && inlinePdf && !missing && !!item;

  let body;
  if (!item) {
    body = <EmptyState art="magnifier" title={t('route.ticket')} body={t('item.notFound')} />;
  } else {
    const [startLabel, endLabel]: [Key, Key] = isTransport(item.kind)
      ? ['item.departs', 'item.arrives']
      : item.kind === 'hotel' || item.kind === 'car'
        ? ['item.checkIn', 'item.checkOut']
        : ['item.starts', 'item.ends'];
    const route = item.from || item.to ? t('ticket.from', { from: item.from?.name ?? '', to: item.to?.name ?? '' }) : item.place?.name;
    const showRect = !!rect && !!fileUri && !missing && !rectBroken && !imageBroken;
    const showCrop = !!cropUri && !cropBroken && !showRect;
    const showImage = kind === 'image' && !!fileUri && !missing && !imageBroken && fileUri !== cropUri;

    body = (
      <>
        <View style={{ gap: space.xs }}>
          <Label>{[t(kindKey(item.kind)), item.carrier, item.number].filter(Boolean).join(' · ')}</Label>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 28, color: theme.ink }}>
            {item.title}
          </Text>
          {found ? <Body muted>{t('ticket.trip', { name: found.trip.name })}</Body> : null}
        </View>

        {!shown ? <EmptyState art="ticket" title={t('ticket.none')} body={t('ticket.noneBody')} action={<Button label={t('ticket.manage')} hint={t('ticket.manageHint')} kind="quiet" onPress={manage} />} /> : null}

        {showRect ? (
          <View style={{ alignSelf: 'center', backgroundColor: theme.card, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, padding: space.s }}>
            <CroppedImage
              uri={fileUri!}
              crop={rect!}
              boxW={side - space.s * 2}
              boxH={Math.round(side * 1.1)}
              label={t('ticket.qrLabel', { title: item.title })}
              onError={() => setRectBroken(true)}
            />
          </View>
        ) : null}

        {showCrop ? (
          <View style={{ alignSelf: 'center', backgroundColor: theme.card, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, padding: space.s }}>
            <Image
              source={{ uri: cropUri! }}
              accessible
              accessibilityRole="image"
              accessibilityLabel={t('ticket.qrLabel', { title: item.title })}
              resizeMode="contain"
              onError={() => setCropBroken(true)}
              style={{ width: side - space.s * 2, height: side - space.s * 2 }}
            />
          </View>
        ) : null}

        <Card style={{ gap: space.m }}>
          {item.ref ? (
            <View style={{ gap: 2 }}>
              <Label>{t('item.ref')}</Label>
              {big(item.ref, 36)}
              {clipboardAvailable() ? (
                <Button label={t('spec41.ticket.copyRef')} hint={t('spec41.ticket.copyRefHint')} kind="quiet" onPress={() => item.ref && copyRef(item.ref)} />
              ) : null}
              {refCopy ? (
                <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: refCopy === 'copied' ? theme.ok : theme.ink }}>
                  {t(refCopy === 'copied' ? 'spec41.ticket.refCopied' : 'spec41.ticket.refCopyFailed')}
                </Text>
              ) : null}
            </View>
          ) : null}
          {item.seat ? (
            <View style={{ gap: 2 }}>
              <Label>{t('item.seat')}</Label>
              {big(item.seat)}
            </View>
          ) : null}
          <AirportPanel item={item} />
          {when(startLabel, item.start)}
          {item.end ? when(endLabel, item.end) : null}
          {route ? <Body>{route}</Body> : null}
        </Card>

        {showImage ? (
          <PressableScale
            accessibilityRole="imagebutton"
            accessibilityLabel={t('ticket.imageLabel', { title: item.title })}
            accessibilityHint={t('ticket.imageHint')}
            onPress={() => setFill((f) => !f)}
            style={{ borderRadius: radius.m, overflow: 'hidden', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }}
          >
            <Image
              source={{ uri: fileUri! }}
              resizeMode={fill ? 'cover' : 'contain'}
              onError={() => setImageBroken(true)}
              style={{ width: '100%', height: Math.round(side * 1.35) }}
            />
          </PressableScale>
        ) : null}
        {kind === 'image' && fileUri && !missing && !imageBroken ? (
          <Button
            label={t(rect ? 'tpolish.cropAdjust' : 'tpolish.cropAction')}
            hint={t(rect ? 'tpolish.cropAdjustHint' : 'tpolish.cropActionHint')}
            kind="quiet"
            icon="crop"
            onPress={cropScreen}
          />
        ) : null}

        {shown && missing ? <EmptyState art="ticket" title={t('ticket.missing')} body={t('ticket.missingBody')} action={<Button label={t('ticket.manage')} hint={t('ticket.manageHint')} kind="quiet" onPress={manage} />} /> : null}
        {shown && !missing && (imageBroken || (cropBroken && !showImage && kind !== 'pdf')) ? (
          <EmptyState art="ticket" title={t('ticket.broken')} body={t('ticket.brokenBody')} action={<Button label={t('ticket.manage')} hint={t('ticket.manageHint')} kind="quiet" onPress={manage} />} />
        ) : null}

        {shown && kind === 'pdf' && !missing ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Ionicons name="document-outline" size={22} color={theme.accent} />
              <Text style={{ flex: 1, fontFamily: fonts.displayMedium, fontSize: 18, color: theme.ink }}>{t('ticket.pdfTitle')}</Text>
            </View>
            <Body muted>{shown.name}</Body>
            {!cropUri ? <Body>{t('ticket.pdfBody')}</Body> : null}
            {inlinePdf ? (
              <Button
                label={t('tpolish.pdf.view')}
                hint={t('tpolish.pdf.viewHint', { name: shown.name })}
                kind={cropUri ? 'secondary' : 'primary'}
                icon="document-text-outline"
                onPress={() => setPdfOpen(true)}
              />
            ) : null}
            <Button
              label={inlinePdf ? t('tpolish.pdf.share') : t('ticket.openPdf')}
              hint={inlinePdf ? t('tpolish.pdf.shareHint', { name: shown.name }) : t('ticket.openPdfHint', { name: shown.name })}
              kind={cropUri || inlinePdf ? 'quiet' : 'primary'}
              onPress={openSystem}
            />
            {pdfFailed ? <Warning text={t('tpolish.pdf.failed')} /> : null}
            {openFailed ? <Warning text={t('ticket.err.open')} /> : null}
          </Card>
        ) : null}

        {!brightOk ? <Body muted>{t('ticket.brightnessOff')}</Body> : null}
      </>
    );
  }

  if (showPdf && shown && fileUri) {
    // Full screen PDF: the system's own pinch-zoom and page scrolling; Back returns to the details.
    return (
      <View style={{ flex: 1, backgroundColor: theme.paper }}>
        <View style={{ flex: 1, paddingTop: insets.top }}>
          <PdfView
            uri={fileUri}
            label={t('tpolish.pdf.label', { name: shown.name })}
            background={theme.paper}
            onFail={() => {
              setPdfFailed(true);
              setPdfOpen(false);
              AccessibilityInfo.announceForAccessibility(t('tpolish.pdf.failed'));
            }}
          />
        </View>
        {openFailed ? (
          <View style={{ paddingHorizontal: space.l, paddingTop: space.s }}>
            <Warning text={t('ticket.err.open')} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.s, paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: insets.bottom + space.m, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.paper }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('tpolish.pdf.back')}
            accessibilityHint={t('tpolish.pdf.backHint')}
            onPress={() => setPdfOpen(false)}
            style={{ flex: 1, minHeight: TOUCH + 12, borderRadius: radius.m, backgroundColor: theme.accentStrong, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.s }}
          >
            <Ionicons name="chevron-back" size={22} color={theme.onAccent} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.onAccent }}>{t('tpolish.pdf.back')}</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('tpolish.pdf.share')}
            accessibilityHint={t('tpolish.pdf.shareHint', { name: shown.name })}
            onPress={openSystem}
            style={{ width: TOUCH + 12, minHeight: TOUCH + 12, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-outline" size={22} color={theme.ink} />
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.paper }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + space.l, paddingHorizontal: space.l, paddingBottom: space.xl, gap: space.l }}>
        {body}
      </ScrollView>
      <View style={{ paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: insets.bottom + space.m, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.paper }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('ticket.close')}
          accessibilityHint={t('ticket.closeHint')}
          onPress={close}
          style={{ minHeight: TOUCH + 12, borderRadius: radius.m, backgroundColor: theme.accentStrong, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.s }}
        >
          <Ionicons name="close" size={24} color={theme.onAccent} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: theme.onAccent }}>{t('ticket.close')}</Text>
        </PressableScale>
      </View>
    </View>
  );
}
