// T58 home country picker, shared by Settings and the country essentials card (src/ui/CountryEssentialsCard.tsx).
// One source of truth: the choice is stored once under HOME_COUNTRY_KEY (usePersisted), so a change in either place
// shows in the other at once. A button opens a searchable list of countries; picking one (or "Forget") saves it and
// closes the list. Tokens only, 48 pt targets (PressableScale), every control labelled, no animation of its own.
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import emergencyTable from '../content/emergency_numbers.json';
import essentialsTable from '../content/country_essentials.json';
import { searchCountries, type EmergencyTable } from '../core/emergency.ts';
import { findEssentials, type EssentialsRow, type EssentialsTable } from '../core/essentials.ts';
import { HOME_COUNTRY_KEY, homeCountry, homeCountryToStore } from '../core/settings.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { fonts, radius, space } from '../theme/tokens.ts';
import { Body, Button, PressableScale, TextField } from './kit.tsx';

const TABLE = essentialsTable as EssentialsTable;
const COUNTRIES = emergencyTable as EmergencyTable;
const NO_HOME: string | null = null;
const MAX_LIST = 30;

/** The saved home country (ISO code and essentials row, null when unset) and a setter (null forgets it). */
export function useHomeCountry(): { homeIso: string | null; homeRow: EssentialsRow | null; setHome: (code: string | null) => void } {
  const [stored, setStored] = usePersisted<string | null>(HOME_COUNTRY_KEY, NO_HOME);
  const home = homeCountry(TABLE, stored);
  return {
    homeIso: home?.iso2 ?? null,
    homeRow: home ? findEssentials(TABLE, home.iso2) : null,
    setHome: (code) => setStored(homeCountryToStore(TABLE, code)),
  };
}

/** The "Set / Change home country" button and, when open, the searchable country list. */
export function HomeCountryPicker() {
  const { t, theme } = useApp();
  const { homeIso, homeRow, setHome } = useHomeCountry();
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCountries(COUNTRIES, query), [query]);

  const choose = (code: string | null) => {
    setHome(code);
    setListOpen(false);
    setQuery('');
  };

  return (
    <View style={{ gap: space.s }}>
      <Button
        kind="quiet"
        label={listOpen ? t('essentials.homeDone') : homeRow ? t('essentials.homeChange') : t('essentials.homeSet')}
        hint={listOpen ? undefined : homeRow ? t('essentials.homeChangeHint') : t('essentials.homeSetHint')}
        onPress={() => setListOpen(!listOpen)}
      />
      {listOpen ? (
        <View style={{ gap: space.s }}>
          <TextField label={t('essentials.homeSearch')} value={query} onChange={setQuery} placeholder={t('essentials.homeSearchPlaceholder')} autoCapitalize="none" />
          {homeRow ? <Button kind="quiet" label={t('essentials.homeClear')} hint={t('essentials.homeClearHint')} onPress={() => choose(null)} /> : null}
          {results.length === 0 ? <Body muted>{t('essentials.homeNoMatch', { q: query.trim() })}</Body> : null}
          {results.slice(0, MAX_LIST).map((r) => {
            const selected = r.iso2 === homeIso;
            return (
              <PressableScale
                key={r.iso2}
                accessibilityRole="radio"
                accessibilityLabel={t('essentials.homePick', { country: r.country })}
                accessibilityHint={t('essentials.homePickHint', { country: r.country })}
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
                  backgroundColor: selected ? theme.accentSoft : theme.card,
                }}
              >
                <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{r.country}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{r.iso2}</Text>
              </PressableScale>
            );
          })}
          {results.length > MAX_LIST ? <Body muted>{t('essentials.homeMore', { n: MAX_LIST, total: results.length })}</Body> : null}
        </View>
      ) : null}
    </View>
  );
}
