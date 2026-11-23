import { Icon as Ionicons } from './Icon.tsx';
import { Pressable, Text, View } from 'react-native';
import { COUNTRIES, type CountryCode } from '../core/countries.ts';
import { RADIUS, SPACE, TOUCH, usePalette } from '../theme/tokens.ts';

export function CountryList({ value, onPick, detected }: { value: CountryCode; onPick: (c: CountryCode) => void; detected?: CountryCode }) {
  const p = usePalette();
  return (
    <View accessibilityRole="radiogroup" style={{ backgroundColor: p.surface, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: p.line }}>
      {COUNTRIES.map((c, i) => {
        const on = c.code === value;
        const u = c.units;
        return (
          <Pressable
            key={c.code}
            testID={`country-${c.code}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${c.name}${detected === c.code ? ', your iPhone’s region' : ''}`}
            onPress={() => onPick(c.code)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: TOUCH + 8, paddingHorizontal: SPACE.lg, backgroundColor: on ? p.surface2 : pressed ? p.surface2 : 'transparent', borderTopWidth: i ? 1 : 0, borderTopColor: p.line })}
          >
            <View style={{ width: 48, height: 34, borderRadius: 8, backgroundColor: on ? p.accent : p.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: 0.5, color: on ? p.onAccent : p.text2 }}>{c.code === 'OTHER' ? '···' : c.code === 'GB' ? 'UK' : c.code}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: p.text }}>{c.name}</Text>
              <Text style={{ fontSize: 14, color: p.text2 }}>
                {c.guided ? `${u.pressure} · °${u.temp} · ${u.length === 'm' ? 'metres' : 'feet'}` : 'Metric, generic guidance'}
                {detected === c.code ? ' · your region' : ''}
              </Text>
            </View>
            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={26} color={on ? p.text : p.text3} />
          </Pressable>
        );
      })}
    </View>
  );
}
