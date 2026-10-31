// T78 one "When things go wrong" guide: a coloured header with the guide's badge and progress, the general guidance
// line, then numbered steps you tick off (saved per guide on this phone; Start over clears them). Each step offers
// what the traveller already saved (src/core/troubles.ts stepActions): the local emergency number for the Emergency
// tab's country, the insurer and contacts on the emergency card, My important numbers, a vault document, the hotel
// address card, a phrase card or Nearest help. Missing data shows a quiet link to where it is added. Works offline.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import emergencyTable from '../../src/content/emergency_numbers.json';
import table from '../../src/content/troubles.json';
import { currentHotel } from '../../src/core/battery.ts';
import { COUNTRY_KEY, displayRow, EMERGENCY_KEY, EMPTY_CARD, findCountry, guessCountry, normaliseCard, type EmergencyTable } from '../../src/core/emergency.ts';
import { deviceZone, todayIn } from '../../src/core/format.ts';
import type { EmergencyCard } from '../../src/core/model.ts';
import { PHRASE_IDS } from '../../src/core/phrases.ts';
import {
  cleanNumbers,
  cleanProgress,
  findGuide,
  guideSummaryKey,
  guideTitleKey,
  IMPORTANT_NUMBERS_KEY,
  isTicked,
  progressOf,
  resetGuide,
  stepActions,
  stepBodyKey,
  stepTitleKey,
  toggleStep,
  TROUBLE_PROGRESS_KEY,
  type ResolvedAction,
  type TroubleContext,
  type TroubleTable,
} from '../../src/core/troubles.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { useVaultDocs } from '../../src/state/vaultLock.ts';
import { fonts, radius, shadowOf, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { callAndExplain } from '../../src/ui/EmergencyCardView.tsx';
import { FadeInView, ProgressBar, toneColours, type IconName } from '../../src/ui/hero.tsx';
import { Body, Button, EmptyState, PressableScale } from '../../src/ui/kit.tsx';
import { docKindKey } from '../../src/ui/slots/WalletVaultSlot.tsx';

const TABLE = table as TroubleTable;
const NUMBERS = emergencyTable as EmergencyTable;
const NONE: unknown = {};
const NO_NUMBERS: unknown = [];
const NO_PICK: string | null = null;

export default function TroubleGuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, theme } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trips } = useTrips();
  const [rawProgress, setProgress] = usePersisted<unknown>(TROUBLE_PROGRESS_KEY, NONE);
  const [rawNumbers] = usePersisted<unknown>(IMPORTANT_NUMBERS_KEY, NO_NUMBERS);
  const [storedCard] = usePersisted<EmergencyCard>(EMERGENCY_KEY, EMPTY_CARD);
  const [picked] = usePersisted<string | null>(COUNTRY_KEY, NO_PICK);
  const [docs] = useVaultDocs();
  const guide = findGuide(TABLE, typeof id === 'string' ? id : null);
  const progress = useMemo(() => cleanProgress(rawProgress, TABLE), [rawProgress]);

  // The same country the Emergency tab shows: the one picked there, else the guess from the trip or the phone.
  const row = useMemo(() => {
    const tz = deviceZone();
    const guess = guessCountry(trips, Date.now(), todayIn(tz), tz);
    const r = findCountry(NUMBERS, picked) ?? findCountry(NUMBERS, guess?.iso2);
    return r ? displayRow(r) : null;
  }, [trips, picked]);
  const hotel = currentHotel(trips, Date.now());
  const ctx: TroubleContext = {
    row,
    card: normaliseCard(storedCard),
    numbers: cleanNumbers(rawNumbers),
    docs: docs.map((d) => ({ id: d.id, kind: d.kind, label: d.label })),
    hotel: hotel?.hasAddress ? { id: hotel.item.id, name: hotel.item.place?.name?.trim() || hotel.item.title } : null,
    phraseIds: PHRASE_IDS,
  };

  if (!guide) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.paper }} contentContainerStyle={{ padding: space.l }}>
        <EmptyState title={t('trouble.notFound')} body={t('trouble.guidance')} action={<Button label={t('trouble.back')} onPress={() => router.back()} />} />
      </ScrollView>
    );
  }

  const tone = toneColours(theme, guide.tone);
  const p = progressOf(guide, progress);
  const title = t(guideTitleKey(guide) as Key);

  const startOver = () =>
    Alert.alert(t('trouble.startOverTitle'), t('trouble.startOverBody'), [
      { text: t('trouble.cancel'), style: 'cancel' },
      { text: t('trouble.startOverConfirm'), style: 'destructive', onPress: () => setProgress((old: unknown) => resetGuide(cleanProgress(old, TABLE), guide.id)) },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: space.m, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
    >
      <FadeInView>
        <View style={[{ borderRadius: radius.xl, padding: space.l, gap: space.m, backgroundColor: tone.bg, borderWidth: theme.dark ? 1 : 0, borderColor: theme.line }, shadowOf(theme, 'low')]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.cardRaised, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: tone.fg }}
            >
              <Ionicons name={guide.icon as IconName} size={32} color={tone.fg} />
            </View>
            <Text accessibilityRole="header" style={[typeScale.displayM, { flex: 1, color: theme.ink }]}>
              {title}
            </Text>
          </View>
          <Text style={[typeScale.body, { color: theme.ink }]}>{t(guideSummaryKey(guide) as Key)}</Text>
          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: tone.fg, fontVariant: ['tabular-nums'] }}>{t('trouble.progressA11y', { done: p.done, total: p.total })}</Text>
            <ProgressBar progress={p.fraction} label={t('trouble.progressA11y', { done: p.done, total: p.total })} tone={guide.tone} track={theme.cardRaised} />
          </View>
        </View>
      </FadeInView>

      <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start', backgroundColor: theme.seaSoft, borderRadius: radius.m, padding: space.m }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
          <Ionicons name="information-circle" size={20} color={theme.sea} />
        </View>
        <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{t('trouble.guidance')}</Text>
      </View>

      {guide.steps.map((s, i) => {
        const done = isTicked(progress, guide.id, s.id);
        const stepTitle = t(stepTitleKey(guide, s) as Key);
        const stepBody = t(stepBodyKey(guide, s) as Key);
        const actions = stepActions(s, ctx);
        return (
          <FadeInView key={s.id} delay={Math.min(i, 6) * 40}>
            <View
              style={[
                { backgroundColor: theme.cardRaised, borderRadius: radius.l, padding: space.m, gap: space.m, borderWidth: 1, borderColor: done ? theme.ok : theme.dark ? theme.line : theme.cardRaised },
                shadowOf(theme, 'low'),
              ]}
            >
              <PressableScale
                accessibilityRole="checkbox"
                accessibilityLabel={t('trouble.stepA11y', { n: i + 1, title: stepTitle, body: stepBody })}
                accessibilityHint={t('trouble.stepHint')}
                accessibilityState={{ checked: done }}
                onPress={() => setProgress((old: unknown) => toggleStep(cleanProgress(old, TABLE), guide, s.id))}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.m, minHeight: TOUCH }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: done ? theme.ok : tone.bg,
                    borderWidth: done ? 0 : 1.5,
                    borderColor: tone.fg,
                  }}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={22} color={theme.onAccent} />
                  ) : (
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: tone.fg, fontVariant: ['tabular-nums'] }}>{i + 1}</Text>
                  )}
                </View>
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text style={[typeScale.bodyStrong, { fontSize: 17, color: done ? theme.muted : theme.ink, textDecorationLine: done ? 'line-through' : 'none' }]}>{stepTitle}</Text>
                  <Text style={[typeScale.body, { fontSize: 15, color: done ? theme.muted : theme.ink }]}>{stepBody}</Text>
                </View>
              </PressableScale>
              {actions.length ? (
                <View style={{ gap: space.s, paddingLeft: 36 + space.m }}>
                  {actions.map((a, j) => (
                    <StepActionButton key={`${a.type}:${j}`} action={a} country={row?.country ?? ''} />
                  ))}
                </View>
              ) : null}
            </View>
          </FadeInView>
        );
      })}

      {p.state === 'done' ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: space.s, alignItems: 'center', backgroundColor: theme.okSoft, borderRadius: radius.m, padding: space.m }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="checkmark-circle" size={22} color={theme.ok} />
          </View>
          <Text style={[typeScale.body, { flex: 1, color: theme.ink }]}>{t('trouble.allDone')}</Text>
        </View>
      ) : null}

      {p.done > 0 ? <Button kind="quiet" icon="refresh" label={t('trouble.startOver')} hint={t('trouble.startOverHint')} onPress={startOver} /> : null}
      <Body muted>{t('trouble.offline')}</Body>
    </ScrollView>
  );
}

function StepActionButton({ action: a, country }: { action: ResolvedAction; country: string }) {
  const { t } = useApp();
  const router = useRouter();
  switch (a.type) {
    case 'emergency':
      return (
        <View style={{ gap: space.xs }}>
          <Button
            icon="call"
            label={t(`trouble.act.emergency.${a.service}` as Key, { number: a.number })}
            hint={t('trouble.act.emergencyHint', { country })}
            onPress={() => callAndExplain(a.number, t)}
          />
          {a.fallback ? <Body muted>{t('trouble.act.emergencyFallback', { country, number: a.number })}</Body> : null}
        </View>
      );
    case 'insurer':
      return (
        <Button
          kind="secondary"
          icon="call-outline"
          label={a.name ? t('trouble.act.insurer', { name: a.name }) : t('trouble.act.insurerNoName')}
          hint={t('trouble.act.insurerHint')}
          onPress={() => callAndExplain(a.number, t)}
        />
      );
    case 'contact':
      return <Button kind="secondary" icon="call-outline" label={t('trouble.act.contact', { name: a.name })} hint={t('trouble.act.contactHint')} onPress={() => callAndExplain(a.number, t)} />;
    case 'number':
      return <Button kind="secondary" icon="call-outline" label={t('trouble.act.number', { label: a.label })} hint={t('trouble.act.numberHint')} onPress={() => callAndExplain(a.number, t)} />;
    case 'doc':
      return (
        <Button
          kind="secondary"
          icon="lock-closed-outline"
          label={t('trouble.act.doc', { kind: t(docKindKey(a.kind)).toLowerCase() })}
          hint={t('trouble.act.docHint')}
          onPress={() => router.push(`/doc/${a.id}`)}
        />
      );
    case 'hotel':
      return (
        <Button
          kind="secondary"
          icon="bed-outline"
          label={t('trouble.act.hotel')}
          hint={t('trouble.act.hotelHint', { name: a.name })}
          onPress={() => router.push({ pathname: '/address/[id]', params: { id: a.id } })}
        />
      );
    case 'phrase':
      return (
        <Button
          kind="secondary"
          icon="chatbubble-ellipses-outline"
          label={t(`trouble.act.phrase.${a.phrase}` as Key)}
          hint={t('trouble.act.phraseHint')}
          onPress={() => router.push({ pathname: '/phrase-card', params: { phrase: a.phrase } })}
        />
      );
    case 'help':
      return <Button kind="secondary" icon="medkit-outline" label={t('trouble.act.help')} hint={t('trouble.act.helpHint')} onPress={() => router.push('/help')} />;
    case 'setup':
      if (a.need === 'country') return <Button kind="quiet" icon="globe-outline" label={t('trouble.setup.country')} hint={t('trouble.setup.countryHint')} onPress={() => router.navigate('/emergency')} />;
      if (a.need === 'card') return <Button kind="quiet" icon="add" label={t('trouble.setup.card')} hint={t('trouble.setup.cardHint')} onPress={() => router.push('/emergency-edit')} />;
      if (a.need === 'vault') return <Button kind="quiet" icon="add" label={t('trouble.setup.vault')} hint={t('trouble.setup.vaultHint')} onPress={() => router.push('/vault')} />;
      return (
        <Button
          kind="quiet"
          icon="add"
          label={t('trouble.setup.numbers', { group: t(`trouble.groupOne.${a.group ?? 'other'}` as Key) })}
          hint={t('trouble.setup.numbersHint')}
          onPress={() => router.push({ pathname: '/trouble/numbers', params: { add: a.group ?? 'other' } })}
        />
      );
  }
}
