// T121 full-screen help card to show a local or screenshot to a child's phone: high contrast (ink on card in both
// themes, strong ink rules between rows), the local language in big type with English under each line, and what the
// traveller typed shown as typed. The lost card shows the photo (kept on this phone), name, who to call (tap the
// number to call it), the hotel from the current stay booking and the meeting point; the needs card lists the ticked
// needs and the free text. Share sends the same card as plain text (no photo). The screen stays awake while open
// (as on the phrase card). Switching between the two cards uses a short timed fade. Params: ?id= ?kind= ?lang=.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import helpData from '../src/content/helpcards.json';
import {
  bigSize,
  cardsOf,
  hotelForCards,
  lostView,
  needsView,
  parseIdParam,
  parseKindParam,
  shareText,
  type BiLine,
  type CardKind,
  type CardRow,
  type HelpTable,
} from '../src/core/helpcards.ts';
import { parseLangParam } from '../src/core/phrases.ts';
import { helpPhotoPath } from '../src/native/helpcardPhoto.ts';
import { useScreenAwake } from '../src/native/keepAwake.ts';
import { shareText as shareSheet } from '../src/native/share.ts';
import { useApp } from '../src/state/app.tsx';
import { useHelpPeople } from '../src/state/helpcards.ts';
import { useTrips } from '../src/state/trips.tsx';
import { duration, fadeIn, fadeOut } from '../src/theme/motion.ts';
import { fonts, radius, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { callAndExplain } from '../src/ui/EmergencyCardView.tsx';
import { Body, Button, PressableScale, Warning } from '../src/ui/kit.tsx';
import { LANG_KEY, usePhraseLang } from '../src/ui/phrases.ts';

const HELP_TABLE = helpData as HelpTable;
const KIND_ICON = { lost: 'help-buoy-outline', needs: 'accessibility-outline' } as const;

export default function HelpCardScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: string; lang?: string }>();
  const { t, theme, reduceMotion } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trips } = useTrips();
  const [people, loaded] = useHelpPeople();
  const { lang } = usePhraseLang(parseLangParam(params.lang));
  const person = people.find((p) => p.id === parseIdParam(params.id)) ?? null;
  const [kind, setKind] = useState<CardKind>(() => parseKindParam(params.kind));
  const [shareError, setShareError] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  useScreenAwake('satchel-helpcard');
  useEffect(() => {
    fadeIn(fade, reduceMotion, duration.base).start();
  }, [fade, reduceMotion]);

  const hotel = hotelForCards(trips, Date.now());
  const kinds = person ? cardsOf(person) : [];
  const shown: CardKind = kinds.includes(kind) ? kind : 'lost';
  const otherKind: CardKind = shown === 'lost' ? 'needs' : 'lost';
  // Not memoised: cheap, and the stay "now" depends on the clock.
  const view = person ? (shown === 'lost' ? lostView(HELP_TABLE, lang, person, hotel) : needsView(HELP_TABLE, lang, person)) : null;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/helpcards'));
  const language = t(LANG_KEY[lang]);

  const switchTo = (k: CardKind) => {
    if (k === shown) return;
    fadeOut(fade, reduceMotion).start(() => {
      setKind(k);
      fadeIn(fade, reduceMotion, duration.base).start();
    });
  };

  const share = async () => {
    if (!view || !person) return;
    setShareError(false);
    if ((await shareSheet(shareText(view), t('helpcards.card.shareTitle', { name: person.name }))) === 'failed') setShareError(true);
  };

  const small = (s: string) => <Text style={[typeScale.caption, { fontSize: 13, color: theme.muted }]}>{s}</Text>;

  const big = (l: BiLine, size?: number) => {
    const s = size ?? bigSize(l.local);
    return (
      <View accessible accessibilityLabel={l.local === l.en ? l.en : `${l.local}. ${l.en}`} style={{ gap: space.xs }}>
        <Text selectable accessibilityLanguage={l.lang} maxFontSizeMultiplier={1.6} style={{ fontSize: s, lineHeight: Math.round(s * 1.3), fontWeight: '700', color: theme.ink }}>
          {l.local}
        </Text>
        {l.local !== l.en ? <Text style={[typeScale.title, { color: theme.ink }]}>{l.en}</Text> : null}
      </View>
    );
  };

  const row = (r: CardRow, key: string) => (
    <View key={key} style={{ gap: space.xs, paddingTop: space.m, borderTopWidth: 2, borderTopColor: theme.ink }}>
      <Text accessibilityLanguage={r.label.lang} style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: theme.ink }}>
        {r.label.local === r.label.en ? r.label.en : `${r.label.local} · ${r.label.en}`}
      </Text>
      <Text selectable maxFontSizeMultiplier={1.6} style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 36, color: theme.ink }}>
        {r.value}
      </Text>
      {r.dial ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('helpcards.card.call', { number: r.dial })}
          accessibilityHint={t('helpcards.card.callHint')}
          onPress={() => callAndExplain(r.dial!, t)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s, minHeight: TOUCH + space.s, borderRadius: radius.pill, backgroundColor: theme.accentStrong }}
        >
          <Ionicons name="call" size={22} color={theme.onAccent} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: theme.onAccent }}>{t('helpcards.card.callButton', { number: r.dial })}</Text>
        </PressableScale>
      ) : null}
    </View>
  );

  if (!loaded) return <View style={{ flex: 1, backgroundColor: theme.card }} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.card }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.xl, paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.xl }}>
        <View style={{ gap: space.xs }}>
          {small(`${language} · ${t('helpcards.card.english')}`)}
          <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
            {t('helpcards.card.showThis')}
          </Text>
        </View>
        {!person || !view ? (
          <Body>{t('helpcards.card.missing')}</Body>
        ) : (
          <Animated.View style={{ opacity: fade, gap: space.xl }}>
            {view.kind === 'lost' && view.photoUri ? (
              <Image
                accessible
                accessibilityLabel={t('helpcards.photoOf', { name: person.name })}
                source={{ uri: helpPhotoPath(view.photoUri) }}
                resizeMode="cover"
                style={{ width: 160, height: 160, borderRadius: radius.l, borderWidth: 2, borderColor: theme.ink, backgroundColor: theme.seaSoft, alignSelf: 'center' }}
              />
            ) : null}
            {big(view.title)}
            {view.kind === 'lost' ? (
              <View style={{ gap: space.l }}>
                {view.rows.map((r) => row(r, r.label.id))}
                <View style={{ gap: space.l, paddingTop: space.m, borderTopWidth: 2, borderTopColor: theme.ink }}>
                  {view.lines.map((l) => (
                    <View key={l.id}>{big(l, 26)}</View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ gap: space.l }}>
                {row({ label: view.name, value: view.name.value }, 'name')}
                {view.needs.map((n) => (
                  <View key={n.id} style={{ paddingLeft: space.m, borderLeftWidth: 6, borderLeftColor: theme.accent }}>
                    {big(n, 28)}
                  </View>
                ))}
                {view.other ? row(view.other, 'other') : null}
              </View>
            )}
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('helpcards.card.screenshot')}</Text>
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('helpcards.card.check')}</Text>
          </Animated.View>
        )}
      </ScrollView>
      <View style={{ gap: space.s, paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: insets.bottom + space.l, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: theme.card }}>
        {shareError ? <Warning text={t('helpcards.card.shareFailed')} /> : null}
        {person && kinds.length > 1 ? (
          <Button
            kind="secondary"
            icon={KIND_ICON[otherKind]}
            label={shown === 'lost' ? t('helpcards.card.toNeeds') : t('helpcards.card.toLost')}
            hint={t('helpcards.card.switchHint')}
            onPress={() => switchTo(otherKind)}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.s }}>
          {person ? (
            <View style={{ flex: 1 }}>
              <Button kind="quiet" icon="share-outline" label={t('helpcards.card.share')} hint={t('helpcards.card.shareHint')} onPress={share} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button label={t('helpcards.card.close')} hint={t('helpcards.card.closeHint')} onPress={close} />
          </View>
        </View>
      </View>
    </View>
  );
}
