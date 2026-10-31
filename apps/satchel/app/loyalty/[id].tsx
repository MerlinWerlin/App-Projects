// T87 membership card view: the card big at full brightness (the ticket brightness helper, restored on every exit),
// the barcode drawn offline on a white panel, the number big with Copy, a gentle expiry note, Edit and Delete
// (asks first), and a one-handed Close at the bottom. Fades in (timed); no springs. T88: the optional card photo
// under the card (phone only); deleting the card deletes its photo copy too.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Alert, Image, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deviceZone, todayIn } from '../../src/core/format.ts';
import { cardExpiry, displayNumber, removeCard } from '../../src/core/loyalty.ts';
import { restoreBrightness, useFullBrightness } from '../../src/native/brightness.ts';
import { clipboardAvailable, copyText } from '../../src/native/clipboard.ts';
import { appPath, removeAppFiles } from '../../src/native/files.ts';
import { useApp } from '../../src/state/app.tsx';
import { saveCards, useLoyaltyCards } from '../../src/state/loyalty.ts';
import { fonts, radius, space, TOUCH } from '../../src/theme/tokens.ts';
import { BarcodeView, canDraw } from '../../src/ui/Barcode.tsx';
import { FadeInView } from '../../src/ui/hero.tsx';
import { Body, Button, Card, EmptyState, Label, PressableScale, Warning } from '../../src/ui/kit.tsx';
import { cardExpiryText, LoyaltyCardFace } from '../../src/ui/loyaltyCards.tsx';

export default function LoyaltyCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const brightOk = useFullBrightness();
  const [cards, loaded] = useLoyaltyCards();
  const card = cards.find((c) => c.id === id);
  const [copy, setCopy] = useState<'copied' | 'failed' | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const close = () => {
    restoreBrightness();
    if (router.canGoBack()) router.back();
    else router.replace('/wallet');
  };

  const copyNumber = async (n: string) => {
    const ok = await copyText(n);
    setCopy(ok ? 'copied' : 'failed');
    AccessibilityInfo.announceForAccessibility(t(ok ? 'loyalty.view.copied' : 'loyalty.view.copyFailed'));
  };

  const confirmDelete = () => {
    if (!card) return;
    Alert.alert(t('loyalty.deleteConfirm', { programme: card.programme }), t('loyalty.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!(await saveCards((old) => removeCard(old, card.id)))) {
            setSaveFailed(true);
            return;
          }
          if (card.photo) removeAppFiles([card.photo]).catch(() => {});
          close();
        },
      },
    ]);
  };

  const side = Math.min(width - space.l * 2, 440);
  let body;
  if (!card) {
    body = loaded ? <EmptyState icon="card-outline" title={t('loyalty.section.title')} body={t('loyalty.view.notFound')} /> : null;
  } else {
    const drawable = card.barcode !== 'none' && canDraw(card.barcode, card.number);
    const shown = displayNumber(card.number);
    const expiry = cardExpiry(card, todayIn(deviceZone()));
    const note = cardExpiryText(t, expiry, card.expires, lang);
    const noteColour = expiry.status === 'expired' ? theme.danger : expiry.status === 'soon' ? theme.warn : theme.muted;
    body = (
      <FadeInView style={{ gap: space.l }}>
        <View accessible accessibilityRole="header" accessibilityLabel={[card.programme, card.tier, shown].filter(Boolean).join(', ')}>
          <LoyaltyCardFace card={card} size="full" />
        </View>
        {card.photo ? (
          <Image
            source={{ uri: appPath(card.photo) }}
            accessible
            accessibilityLabel={t('f91.photo.a11y', { programme: card.programme })}
            resizeMode="contain"
            style={{ width: '100%', aspectRatio: 1.586, borderRadius: radius.m, backgroundColor: theme.line }}
          />
        ) : null}
        {drawable ? (
          <BarcodeView
            type={card.barcode}
            value={card.number}
            maxWidth={side - space.s * 2}
            label={t(card.barcode === 'qr' ? 'loyalty.view.qrLabel' : 'loyalty.view.barcodeLabel', { number: shown })}
          />
        ) : null}
        <Card style={{ gap: space.m }}>
          <View style={{ gap: 2 }}>
            <Label>{t('loyalty.view.number')}</Label>
            <Text selectable style={{ fontFamily: fonts.display, fontSize: 34, color: theme.ink, fontVariant: ['tabular-nums'], letterSpacing: 0.5 }}>
              {shown}
            </Text>
            {!drawable ? <Body muted>{t('loyalty.view.numberOnly')}</Body> : null}
            {clipboardAvailable() ? <Button kind="quiet" icon="copy-outline" label={t('loyalty.view.copy')} hint={t('loyalty.view.copyHint')} onPress={() => copyNumber(card.number)} /> : null}
            {copy ? (
              <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: copy === 'copied' ? theme.ok : theme.ink }}>
                {t(copy === 'copied' ? 'loyalty.view.copied' : 'loyalty.view.copyFailed')}
              </Text>
            ) : null}
          </View>
          {card.memberName ? (
            <View style={{ gap: 2 }}>
              <Label>{t('loyalty.view.memberName')}</Label>
              <Text selectable style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: theme.ink }}>
                {card.memberName}
              </Text>
            </View>
          ) : null}
          {card.tier ? (
            <View style={{ gap: 2 }}>
              <Label>{t('loyalty.view.tier')}</Label>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: theme.ink }}>{card.tier}</Text>
            </View>
          ) : null}
          {note ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Ionicons name="time-outline" size={18} color={noteColour} />
              <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: noteColour }}>{note}</Text>
            </View>
          ) : null}
        </Card>
        {!brightOk ? <Body muted>{t('ticket.brightnessOff')}</Body> : null}
        {saveFailed ? <Warning text={t('loyalty.err.save')} /> : null}
        <Button kind="secondary" icon="create-outline" label={t('loyalty.view.edit')} hint={t('loyalty.view.editHint')} onPress={() => router.push({ pathname: '/loyalty-edit', params: { id: card.id } })} />
        <Button kind="quiet" icon="trash-outline" label={t('loyalty.view.delete')} hint={t('loyalty.view.deleteHint')} onPress={confirmDelete} />
      </FadeInView>
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
          accessibilityLabel={t('loyalty.view.close')}
          accessibilityHint={t('loyalty.view.closeHint')}
          onPress={close}
          style={{ minHeight: TOUCH + 12, borderRadius: radius.m, backgroundColor: theme.accentStrong, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.s }}
        >
          <Ionicons name="close" size={24} color={theme.onAccent} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: theme.onAccent }}>{t('loyalty.view.close')}</Text>
        </PressableScale>
      </View>
    </View>
  );
}
