// Emergency tab: the chosen (or guessed) country's numbers with big call buttons, "verify locally", the source
// state, insurance, contacts and private medical notes behind a tap. Free forever, works offline, no location.
// T44 (ACCESSIBILITY "Emergency card" reading order): a Hotel address shortcut after the medical notes opens the
// address card for the stay you're in now, else the next one (battery.currentHotel, as essentials uses). Hidden
// when that stay has no saved address, so it never leads to an empty card.
// T59: a Nearest help card (hospitals, pharmacies, police; app/help.tsx) right after the numbers card.
// T78: a When things go wrong card (offline step-by-step guides; app/trouble/) right after Nearest help.
// T97: an I'm safe / Share where I am card (app/safe.tsx) right after the numbers card, before Nearest help.
// T55: the country essentials card (plugs, power, driving side, calling code, Bring an adapter?) for the same country.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import table from '../../src/content/emergency_numbers.json';
import { currentHotel } from '../../src/core/battery.ts';
import { cardStatus, COUNTRY_KEY, displayRow, EMERGENCY_KEY, EMPTY_CARD, findCountry, guessCountry, normaliseCard, searchCountries, type EmergencyTable } from '../../src/core/emergency.ts';
import { deviceZone, todayIn, zoneCity } from '../../src/core/format.ts';
import type { EmergencyCard } from '../../src/core/model.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { fonts, radius, shadowOf, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { CountryEssentialsCard } from '../../src/ui/CountryEssentialsCard.tsx';
import { callAndExplain, EmergencyCardView } from '../../src/ui/EmergencyCardView.tsx';
import { FadeInView, HeroHeader, IconBadge } from '../../src/ui/hero.tsx';
import { Body, Button, EmptyState, PressableScale, Screen, TextField } from '../../src/ui/kit.tsx';
import { NearestHelpCard } from '../../src/ui/NearestHelpCard.tsx';
import { SafeCheckCard } from '../../src/ui/SafeCheckCard.tsx';
import { TroubleCard } from '../../src/ui/TroubleCard.tsx';

const TABLE = table as EmergencyTable;
const NO_PICK: string | null = null;
const MAX_LIST = 40;

export default function EmergencyScreen() {
  const { t, theme } = useApp();
  const router = useRouter();
  const { trips } = useTrips();
  const [stored, , loaded] = usePersisted<EmergencyCard>(EMERGENCY_KEY, EMPTY_CARD);
  const [picked, setPicked] = usePersisted<string | null>(COUNTRY_KEY, NO_PICK);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [medicalShown, setMedicalShown] = useState(false);

  const card = useMemo(() => normaliseCard(stored), [stored]);
  const guess = useMemo(() => {
    const tz = deviceZone();
    return guessCountry(trips, Date.now(), todayIn(tz), tz);
  }, [trips]);
  const pickedRow = findCountry(TABLE, picked);
  const row = pickedRow ?? findCountry(TABLE, guess?.iso2);
  const display = row ? displayRow(row) : null;
  const results = useMemo(() => searchCountries(TABLE, query), [query]);
  // Not memoised: a cheap scan, and the tab stays mounted, so each render uses the current time.
  const hotel = currentHotel(trips, Date.now());
  const hotelName = hotel ? hotel.item.place?.name?.trim() || hotel.item.title : '';

  const origin = pickedRow
    ? t('emergency.countryPicked')
    : guess
      ? guess.from === 'trip'
        ? t('emergency.countryGuessTrip', { city: zoneCity(guess.zone) })
        : t('emergency.countryGuessPhone', { city: zoneCity(guess.zone) })
      : null;

  const choose = (iso2: string | null) => {
    setPicked(iso2);
    setListOpen(false);
    setQuery('');
  };

  if (!loaded) {
    return (
      <Screen>
        <HeroHeader tone="emergency" illustration="cross" title={t('emergency.title')} subtitle={t('emergency.loading')} />
      </Screen>
    );
  }

  const showList = listOpen || !display;

  return (
    <Screen>
      <FadeInView>
        <HeroHeader tone="emergency" illustration="cross" title={t('emergency.title')}>
          {display ? (
            <View style={{ gap: space.xs }}>
              <Text accessibilityRole="header" style={[typeScale.title, { color: theme.heroInk, maxWidth: '82%' }]}>
                {t('emergency.numbersFor', { country: display.country })}
              </Text>
              {origin ? <Text style={[typeScale.small, { color: theme.heroMuted, maxWidth: '82%' }]}>{origin}</Text> : null}
            </View>
          ) : null}
        </HeroHeader>
      </FadeInView>

      {display ? (
        <Button
          kind="quiet"
          label={listOpen ? t('emergency.countryDone') : t('emergency.countryChange')}
          hint={listOpen ? undefined : t('emergency.countryChangeHint')}
          onPress={() => setListOpen(!listOpen)}
        />
      ) : (
        <EmptyState art="mapPin" title={t('emergency.countryNone')} body={t('emergency.countryNoneBody')} />
      )}

      {showList ? (
        <View style={{ gap: space.s }}>
          <TextField label={t('emergency.countrySearch')} value={query} onChange={setQuery} placeholder={t('emergency.countrySearchPlaceholder')} autoCapitalize="none" />
          {pickedRow && guess ? (
            <Button kind="quiet" label={t('emergency.countryUseTrip')} hint={t('emergency.countryUseTripHint')} onPress={() => choose(null)} />
          ) : null}
          {results.length === 0 ? <Body muted>{t('emergency.countryNoMatch', { q: query.trim() })}</Body> : null}
          {results.slice(0, MAX_LIST).map((r) => {
            const selected = r.iso2 === display?.iso2;
            return (
              <PressableScale
                key={r.iso2}
                accessibilityRole="radio"
                accessibilityLabel={t('emergency.countryPick', { country: r.country })}
                accessibilityHint={t('emergency.countryPickHint', { country: r.country })}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => choose(r.iso2)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: space.l,
                  borderRadius: radius.m,
                  borderWidth: 1,
                  borderColor: selected ? theme.accent : theme.line,
                  backgroundColor: selected ? theme.accentSoft : theme.cardRaised,
                }}
              >
                <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{r.country}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{r.iso2}</Text>
              </PressableScale>
            );
          })}
          {results.length > MAX_LIST ? <Body muted>{t('emergency.countryMore', { n: MAX_LIST, total: results.length })}</Body> : null}
        </View>
      ) : null}

      {cardStatus(card).empty ? (
        <EmptyState
          art="compass"
          title={t('emergency.cardEmptyTitle')}
          body={t('emergency.cardEmptyBody')}
          action={<Button label={t('emergency.editCard')} hint={t('emergency.editCardHint')} onPress={() => router.push('/emergency-edit')} />}
        />
      ) : null}

      <EmergencyCardView
        variant="themed"
        row={display}
        card={card}
        onCall={(n) => callAndExplain(n, t)}
        medicalShown={medicalShown}
        onToggleMedical={() => setMedicalShown(!medicalShown)}
      />

      <SafeCheckCard />

      <NearestHelpCard />

      <TroubleCard />

      {display ? <CountryEssentialsCard iso2={display.iso2} /> : null}

      {hotel?.hasAddress ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('emergency.hotelShortcut')}
          accessibilityHint={t('emergency.hotelShortcutHint', { name: hotelName })}
          onPress={() => router.push({ pathname: '/address/[id]', params: { id: hotel.item.id } })}
          style={{
            minHeight: TOUCH,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.m,
            paddingHorizontal: space.l,
            paddingVertical: space.s,
            borderRadius: radius.l,
            borderWidth: theme.dark ? 1 : 0,
            borderColor: theme.line,
            backgroundColor: theme.cardRaised,
            ...shadowOf(theme, 'low'),
          }}
        >
          <IconBadge name="bed-outline" tone="accent" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{t('emergency.hotelShortcut')}</Text>
            <Text numberOfLines={2} style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>
              {t(hotel.state === 'now' ? 'emergency.hotelShortcutNow' : 'emergency.hotelShortcutNext', { name: hotelName })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.muted} />
        </PressableScale>
      ) : null}

      <Button label={t('emergency.editCard')} hint={t('emergency.editCardHint')} onPress={() => router.push('/emergency-edit')} />
      <Body muted>{t('emergency.freeForever')}</Body>
    </Screen>
  );
}
