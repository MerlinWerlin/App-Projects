/**
 * First launch: one question, "Where do you work?", with the phone's region already picked. The answer sets units,
 * paper, currency, spelling, standards and the stocked-size catalogue. Changeable later in Settings.
 */
import { Icon } from './Icon.tsx';
import { getLocales } from 'expo-localization';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COUNTRIES, countryFromRegion, type CountryCode } from '../core/country.ts';
import type { UnitSystem } from '../core/units.ts';
import { useApp } from '../state/AppState.tsx';
import { JointArt } from './Art.tsx';
import { Btn, Segmented, Txt } from './kit.tsx';
import { C, RADIUS, SPACE } from './theme.ts';

const ORDER: CountryCode[] = ['AU', 'NZ', 'GB', 'IE', 'US', 'CA', 'OTHER'];

export function deviceCountry(): CountryCode {
  try {
    return countryFromRegion(getLocales()[0]?.regionCode);
  } catch {
    return 'OTHER';
  }
}

export function CountryList({ value, onPick }: { value: CountryCode; onPick(c: CountryCode): void }) {
  return (
    <View style={st.list} accessibilityRole="radiogroup">
      {ORDER.map((c, k) => {
        const on = c === value;
        return (
          <Pressable
            key={c}
            onPress={() => onPick(c)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [st.row, k > 0 && st.rowLine, pressed && { backgroundColor: C.raised }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="headline" style={{ fontSize: 19, lineHeight: 24 }}>{COUNTRIES[c].name}</Txt>
              <Txt v="small" tone="ink3">{c === 'OTHER' ? 'Metric, common sizes' : `${COUNTRIES[c].units === 'imperial' ? 'Inches' : 'Millimetres'} · ${COUNTRIES[c].standards?.welding ?? ''}`}</Txt>
            </View>
            <View style={[st.radio, on && { borderColor: C.accent, backgroundColor: C.accent }]}>
              {on ? <Icon name="check" size={18} color={C.accentInk} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Welcome() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const initial = useMemo(deviceCountry, []);
  const [country, setCountry] = useState<CountryCode>(initial);
  const [units, setUnits] = useState<UnitSystem>(COUNTRIES[initial].units);
  const pick = (c: CountryCode) => {
    setCountry(c);
    setUnits(COUNTRIES[c].units);
  };
  const artW = Math.min(width, 420);
  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + SPACE.sm, paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.xl, gap: SPACE.lg }}>
        <View style={{ alignItems: 'center', marginHorizontal: -SPACE.gutter }}>
          <JointArt width={artW} height={artW * 0.5} />
        </View>
        <View style={{ gap: SPACE.sm }}>
          <Txt v="display" accessibilityRole="header">Where do you work?</Txt>
          <Txt v="body" tone="ink2">Rootpass sets sizes your local steel suppliers stock, units, standards and currency to suit. You can change it in Settings.</Txt>
        </View>
        <CountryList value={country} onPick={pick} />
        <Segmented
          label="Measure in"
          value={units}
          options={[{ value: 'metric', label: 'Millimetres' }, { value: 'imperial', label: 'Inches' }]}
          onChange={v => setUnits(v as UnitSystem)}
        />
      </ScrollView>
      <View style={[st.footer, { paddingBottom: insets.bottom + SPACE.md }]}>
        <Btn label="Continue" onPress={() => app.setPrefs({ country, units, paper: COUNTRIES[country].paper, welcomed: true })} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  list: { backgroundColor: C.surface, borderRadius: RADIUS.lg, overflow: 'hidden' },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, gap: SPACE.md },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: C.ink3, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.md, backgroundColor: C.ground, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
});
