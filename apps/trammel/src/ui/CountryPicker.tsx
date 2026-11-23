// Country list used on first launch (app/welcome.tsx) and in Settings (app/country.tsx): an inset grouped list with
// a checkmark on the chosen row, and one line under it saying what that country changes.
import { Pressable, Text, View } from 'react-native';
import { COUNTRIES, GUIDED, type CountryCode } from '../core/country.ts';
import { materialsFor } from '../core/materials.ts';
import { stairCodesFor } from '../core/stairCodes.ts';
import { fonts, radius, space, useTheme, sys } from '../theme/theme.ts';
import { Icon } from './Icon.tsx';

export function countrySummary(c: CountryCode): string {
  const p = COUNTRIES[c];
  const code = stairCodesFor(c)[0];
  const units = p.units === 'metric' ? 'Metric' : 'Imperial';
  const stairs = code.binding ? `Stairs checked against ${code.source.split(/,| \(/)[0]}` : 'No building code checked: comfort guidance only';
  const stock = materialsFor(c);
  return `${units} · ${stairs} · ${stock.verified ? stock.label : 'Generic timber sizes'}`;
}

export function CountryPicker({ value, onChange }: { value: CountryCode; onChange: (c: CountryCode) => void }) {
  const t = useTheme();
  const rows: CountryCode[] = [...GUIDED, 'OTHER'];
  return (
    <View style={{ gap: space.m }}>
      <View accessibilityRole="radiogroup" style={{ backgroundColor: t.card, borderRadius: radius.l, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }}>
        {rows.map((c, i) => {
          const on = c === value;
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={COUNTRIES[c].name}
              style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, gap: space.m, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, backgroundColor: pressed ? t.sunk : 'transparent' })}
            >
              <Text style={{ flex: 1, ...(on ? sys.bodyBold : sys.body), fontSize: 17, color: t.ink }}>{COUNTRIES[c].name}</Text>
              {on ? <Icon name="checkmark" size={20} color={t.ink} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Text accessibilityLiveRegion="polite" style={{ ...sys.body, fontSize: 15, lineHeight: 21, color: t.muted, paddingHorizontal: space.s }}>
        {countrySummary(value)}
      </Text>
    </View>
  );
}
