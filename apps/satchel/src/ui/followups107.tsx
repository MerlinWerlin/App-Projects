// T151 run-107 follow-ups, UI pieces: the Your day postcards row on a free afternoon, the "Remind me to check out"
// Calendar button for a stay, and the numbers trainer's optional casual second line. Logic in
// src/core/followups107.ts; postcards and kids data on this phone only.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { formatTime, zoneCity } from '../core/format.ts';
import { CHECKOUT_REMIND_MIN, checkoutRemindAt, checkoutReminderIcs, checkoutWindow, postcardsBrief, type CasualReading } from '../core/followups107.ts';
import type { Item, LocalDate, Trip } from '../core/model.ts';
import { shareCalendarFile } from '../native/calendarFile.ts';
import { useApp } from '../state/app.tsx';
import { usePostcards } from '../state/postcards.ts';
import { space, TOUCH, typeScale } from '../theme/tokens.ts';
import { Button, PressableScale } from './kit.tsx';

/** Your day: "A free afternoon: 2 postcards to write" (nothing without a free afternoon or anyone left to write to). */
export function PostcardsBriefRow({ trip, today, zone, now }: { trip: Trip; today: LocalDate; zone: string; now: number }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [book] = usePostcards(trip.id);
  const b = postcardsBrief(trip, book, today, zone, now);
  if (!b) return null;
  const line = b.open === 1 ? t('f107.postcards.briefOne') : t('f107.postcards.brief', { n: b.open });
  const sub = t('f107.postcards.briefSub', { sent: b.total - b.open, total: b.total });
  return (
    <>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${line}. ${sub}`}
        accessibilityHint={t('f107.postcards.briefHint', { trip: trip.name })}
        onPress={() => router.push({ pathname: '/postcards/[tripId]', params: { tripId: trip.id } })}
        style={{ minHeight: TOUCH, paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="mail-outline" size={18} color={theme.heroAccent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk }]}>
            {line}
          </Text>
          <Text numberOfLines={1} style={[typeScale.small, { color: theme.heroMuted }]}>
            {sub}
          </Text>
        </View>
      </PressableScale>
    </>
  );
}

/** A stay's "Remind me to check out": a Calendar event alerting an hour before check-out (hotel's clock). */
export function CheckoutRemindButton({ item, now }: { item: Item; now: number }) {
  const { t } = useApp();
  const w = checkoutWindow(item);
  if (!w?.closes || !checkoutRemindAt(item, now)) return null;
  const remind = async () => {
    const closes = w.closes;
    if (!closes) return;
    const name = item.place?.name?.trim() || item.title.trim() || t('f106.checkout.stay');
    const time = formatTime(closes.local);
    const words = {
      summary: t('f107.checkout.summary', { name, time }),
      description: t('f107.checkout.description', { name, time, city: zoneCity(w.tz), note: t(w.usual ? 'checkin.remind.noteUsual' : 'checkin.remind.noteOwn') }),
    };
    const r = checkoutReminderIcs(item, words, Date.now());
    if (!r) return;
    const res = await shareCalendarFile(`checkout-${item.id.replace(/[^A-Za-z0-9_-]+/g, '')}.ics`, r.text, t('f107.checkout.shareTitle'));
    if (res !== 'shared') Alert.alert(t('checkin.remind.failedTitle'), t('checkin.remind.failedBody'));
  };
  return <Button label={t('f107.checkout.remind')} hint={t('f107.checkout.remindHint', { n: CHECKOUT_REMIND_MIN })} kind="secondary" icon="calendar-outline" onPress={remind} />;
}

/** The numbers trainer's optional second line: how the amount is often said, with its rule and the check caption. */
export function CasualLine({ casual }: { casual: CasualReading | null }) {
  const { t, theme } = useApp();
  if (!casual) return null;
  return (
    <View style={{ gap: 2, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.s }}>
      <Text selectable accessibilityLanguage={casual.lang} maxFontSizeMultiplier={1.6} style={[typeScale.bodyStrong, { color: theme.ink }]}>
        {t('f107.numbers.casual', { text: casual.text })}
      </Text>
      {casual.roman ? <Text style={[typeScale.small, { color: theme.muted, fontStyle: 'italic' }]}>{t('f107.numbers.casualRoman', { roman: casual.roman })}</Text> : null}
      <Text style={[typeScale.small, { color: theme.muted }]}>{t(`f107.numbers.rule.${casual.rule}`)}</Text>
      {casual.needsCheck ? <Text style={[typeScale.small, { fontSize: 12, color: theme.muted }]}>{t('numbers.notChecked')}</Text> : null}
    </View>
  );
}
