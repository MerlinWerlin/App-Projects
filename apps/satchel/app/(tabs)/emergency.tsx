// Emergency tab: the chosen (or guessed) country's numbers with big call buttons, "verify locally", the source
// state, insurance, contacts and private medical notes behind a tap. Free forever, works offline, no location.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import table from '../../src/content/emergency_numbers.json';
import { cardStatus, COUNTRY_KEY, displayRow, EMERGENCY_KEY, EMPTY_CARD, findCountry, guessCountry, normaliseCard, searchCountries, type EmergencyTable } from '../../src/core/emergency.ts';
import { deviceZone, todayIn, zoneCity } from '../../src/core/format.ts';
import type { EmergencyCard } from '../../src/core/model.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { fonts, radius, space } from '../../src/theme/tokens.ts';
import { callAndExplain, EmergencyCardView } from '../../src/ui/EmergencyCardView.tsx';
import { Body, Button, EmptyState, PressableScale, Screen, TextField, Title } from '../../src/ui/kit.tsx';

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
        <Title>{t('emergency.title')}</Title>
        <Body muted>{t('emergency.loading')}</Body>
      </Screen>
    );
  }

  const showList = listOpen || !display;

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Title>{t('emergency.title')}</Title>
        {display ? (
          <>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 22, color: theme.ink }}>
              {t('emergency.numbersFor', { country: display.country })}
            </Text>
            {origin ? <Body muted>{origin}</Body> : null}
          </>
        ) : null}
      </View>

      {display ? (
        <Button
          kind="quiet"
          label={listOpen ? t('emergency.countryDone') : t('emergency.countryChange')}
          hint={listOpen ? undefined : t('emergency.countryChangeHint')}
          onPress={() => setListOpen(!listOpen)}
        />
      ) : (
        <EmptyState title={t('emergency.countryNone')} body={t('emergency.countryNoneBody')} />
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
                  borderRadius: radius.s,
                  borderWidth: 1,
                  borderColor: selected ? theme.accent : theme.line,
                  backgroundColor: selected ? theme.accentSoft : theme.card,
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

      <Button label={t('emergency.editCard')} hint={t('emergency.editCardHint')} onPress={() => router.push('/emergency-edit')} />
      <Body muted>{t('emergency.freeForever')}</Body>
    </Screen>
  );
}
