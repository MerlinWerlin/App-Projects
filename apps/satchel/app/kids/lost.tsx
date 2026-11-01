// T149 "If I am lost" card for one child, full screen, to show a local or screenshot onto the child's lock screen:
// high contrast (ink on card in both themes), the local language of the country the trip puts you in on that date in
// big type with English under each line, the child's first name, the parent's phone (tap to call) and the stay booked
// for that night. Lines not yet read by a fluent speaker carry the caption "checked by a fluent speaker: not yet".
// Day before / Next day step the date (stay and language follow it) with a short timed fade; Reduce Motion: none.
// The screen stays awake while open. Params: ?tripId= ?childId= ?date=.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import helpData from '../../src/content/helpcards.json';
import kidsData from '../../src/content/kids.json';
import phraseData from '../../src/content/phrases.json';
import { EMERGENCY_KEY, EMPTY_CARD, normaliseCard } from '../../src/core/emergency.ts';
import { formatDay } from '../../src/core/format.ts';
import type { HelpTable } from '../../src/core/helpcards.ts';
import { lostCardText, lostKidCard, type CardLine, type KidsTable, type LostRow } from '../../src/core/kids.ts';
import type { EmergencyCard } from '../../src/core/model.ts';
import type { PhraseTable } from '../../src/core/phrases.ts';
import { addDays } from '../../src/core/tz.ts';
import { useScreenAwake } from '../../src/native/keepAwake.ts';
import { shareText as shareSheet } from '../../src/native/share.ts';
import { useApp } from '../../src/state/app.tsx';
import { useKids } from '../../src/state/kids.ts';
import { usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { duration, fadeIn, fadeOut } from '../../src/theme/motion.ts';
import { fonts, radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { callAndExplain } from '../../src/ui/EmergencyCardView.tsx';
import { Body, Button, PressableScale, Warning } from '../../src/ui/kit.tsx';
import { LANG_KEY } from '../../src/ui/phrases.ts';

const HELP = helpData as HelpTable;
const TABLE = kidsData as KidsTable;
const PHRASES = phraseData as unknown as PhraseTable;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export default function LostKidScreen() {
  const params = useLocalSearchParams<{ tripId?: string; childId?: string; date?: string }>();
  const { t, theme, reduceMotion, lang: uiLang } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trips } = useTrips();
  const tripId = first(params.tripId);
  const trip = trips.find((x) => x.id === tripId) ?? null;
  const [data, loaded] = useKids(tripId);
  const [storedCard] = usePersisted<EmergencyCard>(EMERGENCY_KEY, EMPTY_CARD);
  const child = data.children.find((c) => c.id === first(params.childId)) ?? null;
  const startDate = isDay(first(params.date)) ? first(params.date) : (trip?.startDate ?? '');
  const [date, setDate] = useState(startDate);
  const [shareError, setShareError] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  useScreenAwake('satchel-kids-lost');
  useEffect(() => {
    fadeIn(fade, reduceMotion, duration.base).start();
  }, [fade, reduceMotion]);

  const card = useMemo(
    () => (trip && child && date ? lostKidCard({ trip, date, child, data, card: normaliseCard(storedCard), phrases: PHRASES, help: HELP, table: TABLE }) : null),
    [trip, child, date, data, storedCard],
  );
  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/kids/[tripId]', params: { tripId } }));

  const step = (n: number) => {
    fadeOut(fade, reduceMotion).start(() => {
      setDate((d) => addDays(d, n));
      fadeIn(fade, reduceMotion, duration.base).start();
    });
  };

  const share = async () => {
    if (!card || !child) return;
    setShareError(false);
    if ((await shareSheet(lostCardText(card), t('kids.lost.shareTitle', { name: child.name }))) === 'failed') setShareError(true);
  };

  const big = (l: CardLine, size: number) => (
    <View accessible accessibilityLabel={l.local === l.en ? l.en : `${l.local}. ${l.en}`} style={{ gap: space.xs }}>
      <Text selectable accessibilityLanguage={l.lang ?? 'en'} maxFontSizeMultiplier={1.6} style={{ fontSize: size, lineHeight: Math.round(size * 1.3), fontWeight: '700', color: theme.ink }}>
        {l.local}
      </Text>
      {l.local !== l.en ? <Text style={[typeScale.title, { color: theme.ink }]}>{l.en}</Text> : null}
    </View>
  );

  const row = (r: LostRow, key: string) => (
    <View key={key} style={{ gap: space.xs, paddingTop: space.m, borderTopWidth: 2, borderTopColor: theme.ink }}>
      <Text accessibilityLanguage={r.label.lang ?? 'en'} style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: theme.ink }}>
        {r.label.local === r.label.en ? r.label.en : `${r.label.local} · ${r.label.en}`}
      </Text>
      <Text selectable maxFontSizeMultiplier={1.6} style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 36, color: theme.ink }}>
        {r.value}
      </Text>
      {r.dial ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('kids.lost.call', { number: r.dial })}
          accessibilityHint={t('kids.lost.callHint')}
          onPress={() => callAndExplain(r.dial!, t)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s, minHeight: TOUCH + space.s, borderRadius: radius.pill, backgroundColor: theme.accentStrong }}
        >
          <Ionicons name="call" size={22} color={theme.onAccent} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: theme.onAccent }}>{t('kids.lost.call', { number: r.dial })}</Text>
        </PressableScale>
      ) : null}
    </View>
  );

  if (!loaded) return <View style={{ flex: 1, backgroundColor: theme.card }} />;

  const small = [typeScale.small, { color: theme.muted }];
  return (
    <View style={{ flex: 1, backgroundColor: theme.card }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.xl, paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.xl }}>
        {!card || !child ? (
          <Body>{t('kids.lost.missing')}</Body>
        ) : (
          <Animated.View style={{ opacity: fade, gap: space.xl }}>
            <View style={{ gap: space.xs }}>
              <Text style={[typeScale.caption, { fontSize: 13, color: theme.muted }]}>
                {card.lang ? t('kids.lost.language', { lang: t(LANG_KEY[card.lang]) }) : t('kids.lost.english')}
              </Text>
              <Text style={[typeScale.caption, { fontSize: 13, color: theme.muted }]}>{t('kids.lost.date', { date: formatDay(date, uiLang) })}</Text>
              <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
                {t('kids.lost.showThis')}
              </Text>
            </View>
            {big(card.title, 34)}
            <View style={{ gap: space.l }}>{card.rows.map((r, n) => row(r, `${n}`))}</View>
            {!card.hasStay ? <Body muted>{t('kids.lost.noStay')}</Body> : null}
            {card.noPhone ? <Warning text={t('kids.lost.noPhone')} /> : null}
            <View style={{ paddingTop: space.m, paddingLeft: space.m, borderLeftWidth: 6, borderLeftColor: theme.accent }}>{big(card.ask, 30)}</View>
            {card.unchecked ? <Text style={small}>{t('kids.lost.unchecked')}</Text> : null}
            <Text style={small}>{t('kids.lost.screenshot')}</Text>
          </Animated.View>
        )}
      </ScrollView>
      <View style={{ gap: space.s, paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: insets.bottom + space.l, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.card }}>
        {shareError ? <Warning text={t('kids.lost.shareFailed')} /> : null}
        {card ? (
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <View style={{ flex: 1 }}>
              <Button kind="secondary" icon="chevron-back" label={t('kids.lost.prev')} hint={t('kids.lost.prevHint')} onPress={() => step(-1)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button kind="secondary" icon="chevron-forward" label={t('kids.lost.next')} hint={t('kids.lost.nextHint')} onPress={() => step(1)} />
            </View>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.s }}>
          {card ? (
            <View style={{ flex: 1 }}>
              <Button kind="quiet" icon="share-outline" label={t('kids.lost.share')} hint={t('kids.lost.shareHint')} onPress={share} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button label={t('kids.lost.close')} hint={t('kids.lost.closeHint')} onPress={close} />
          </View>
        </View>
      </View>
    </View>
  );
}
