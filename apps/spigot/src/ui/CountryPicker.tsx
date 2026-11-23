import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COUNTRY_LIST, profileFor } from '../country/countries';
import type { CountryCode } from '../state/data';
import { useTap } from './kit';
import { HIT, font, radius, space, usePalette } from './theme';

/** One big radio row per country, glove-sized; the subtitle says what the choice changes. */
export function CountryPicker({ value, onChange }: { value: CountryCode | null; onChange: (c: CountryCode) => void }) {
  const c = usePalette();
  const tap = useTap();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: space.s }}>
      {COUNTRY_LIST.map(code => {
        const p = profileFor(code);
        const on = code === value;
        return (
          <Pressable key={code} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${p.name}. ${p.defaultUnit === 'metric' ? 'Millimetres' : 'Feet and inches'}. ${p.codeName}`}
            onPress={() => { tap(); onChange(code); }}
            style={({ pressed }) => ({ minHeight: HIT + 12, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m, borderRadius: radius.m, borderWidth: 2, borderColor: on ? c.ink : c.line, backgroundColor: on ? c.surface : 'transparent', transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <View style={{ width: 44, height: 32, borderRadius: 8, backgroundColor: on ? c.vis : c.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.display, fontSize: 17, color: on ? c.onVis : c.ink2 }}>{code === 'OTHER' ? '—' : code === 'GB' ? 'UK' : code}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: c.ink }}>{p.name}</Text>
              <Text style={{ fontSize: 14, color: c.ink3, marginTop: 2 }}>{`${p.defaultUnit === 'metric' ? 'mm and m' : 'Feet and inches'} · ${p.codeName}`}</Text>
            </View>
            <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={on ? c.copper : c.line} />
          </Pressable>
        );
      })}
    </View>
  );
}
