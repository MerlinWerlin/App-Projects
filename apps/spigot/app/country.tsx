import React from 'react';
import { Stack } from 'expo-router';
import { useApp } from '../src/state/AppState';
import { profileFor } from '../src/country/countries';
import { CountryPicker } from '../src/ui/CountryPicker';
import { Body, Screen } from '../src/ui/kit';

/** Settings › Country. Changing it also switches units to the country's default (they can be flipped back). */
export default function CountryScreen() {
  const { prefs, setPrefs } = useApp();
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Country' }} />
      <Body muted>Sets units, the code Spigot quotes, minimum grades and the pipe and fittings offered. Saved jobs keep their numbers.</Body>
      <CountryPicker value={prefs.country ?? 'OTHER'} onChange={country => {
        const p = profileFor(country);
        setPrefs({ country, unit: p.defaultUnit, stock: p.stockLengthMm });
      }} />
    </Screen>
  );
}
