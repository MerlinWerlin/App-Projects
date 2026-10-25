// Ticket view: full screen at full brightness (restored on every exit), the saved QR crop big, the ticket image
// fitted (tap for fill), booking ref / seat / times big, and a one-handed Close at the bottom.
// PDFs can't render inline in Expo Go, so a PDF ticket shows its details plus Open PDF (system share sheet).
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
import { attachmentKind, ticketToShow } from '../../src/core/tickets.ts';
import type { Key } from '../../src/i18n/en.ts';
import { restoreBrightness, useFullBrightness } from '../../src/native/brightness.ts';
import { clipboardAvailable, copyText } from '../../src/native/clipboard.ts';
import { fileExists } from '../../src/native/files.ts';
import { appPath } from '../../src/native/files.ts';
import { openInSystem } from '../../src/native/pickers.ts';
import { useApp } from '../../src/state/app.tsx';
import { findItem, useTrips } from '../../src/state/trips.tsx';
import { fonts, radius, space, TOUCH } from '../../src/theme/tokens.ts';
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

  const [missing, setMissing] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const [cropBroken, setCropBroken] = useState(false);
  const [fill, setFill] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
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

  let body;
  if (!item) {
    body = <EmptyState title={t('route.ticket')} body={t('item.notFound')} />;
  } else {
    const [startLabel, endLabel]: [Key, Key] = isTransport(item.kind)
      ? ['item.departs', 'item.arrives']
      : item.kind === 'hotel' || item.kind === 'car'
        ? ['item.checkIn', 'item.checkOut']
        : ['item.starts', 'item.ends'];
    const route = item.from || item.to ? t('ticket.from', { from: item.from?.name ?? '', to: item.to?.name ?? '' }) : item.place?.name;
    const showCrop = !!cropUri && !cropBroken;
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

        {!shown ? <EmptyState title={t('ticket.none')} body={t('ticket.noneBody')} action={<Button label={t('ticket.manage')} hint={t('ticket.manageHint')} kind="quiet" onPress={manage} />} /> : null}

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

        {shown && missing ? <EmptyState title={t('ticket.missing')} body={t('ticket.missingBody')} action={<Button label={t('ticket.manage')} hint={t('ticket.manageHint')} kind="quiet" onPress={manage} />} /> : null}
        {shown && !missing && (imageBroken || (cropBroken && !showImage && kind !== 'pdf')) ? (
          <EmptyState title={t('ticket.broken')} body={t('ticket.brokenBody')} action={<Button label={t('ticket.manage')} hint={t('ticket.manageHint')} kind="quiet" onPress={manage} />} />
        ) : null}

        {shown && kind === 'pdf' && !missing ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Ionicons name="document-outline" size={22} color={theme.accent} />
              <Text style={{ flex: 1, fontFamily: fonts.displayMedium, fontSize: 18, color: theme.ink }}>{t('ticket.pdfTitle')}</Text>
            </View>
            <Body muted>{shown.name}</Body>
            {!cropUri ? <Body>{t('ticket.pdfBody')}</Body> : null}
            <Button
              label={t('ticket.openPdf')}
              hint={t('ticket.openPdfHint', { name: shown.name })}
              kind={cropUri ? 'quiet' : 'primary'}
              onPress={() => {
                setOpenFailed(false);
                openInSystem(shown.uri, shown.mime, shown.name).then((ok) => setOpenFailed(!ok));
              }}
            />
            {openFailed ? <Warning text={t('ticket.err.open')} /> : null}
          </Card>
        ) : null}

        {!brightOk ? <Body muted>{t('ticket.brightnessOff')}</Body> : null}
      </>
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
          style={{ minHeight: TOUCH + 12, borderRadius: radius.m, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.s }}
        >
          <Ionicons name="close" size={24} color={theme.onAccent} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: theme.onAccent }}>{t('ticket.close')}</Text>
        </PressableScale>
      </View>
    </View>
  );
}
