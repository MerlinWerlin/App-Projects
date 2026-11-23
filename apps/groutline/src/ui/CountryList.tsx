import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { COUNTRIES, GENERIC, type Country, type CountryCode } from '../countries/index.ts';
import { RADIUS, SPACE, TAP, useTheme } from '../theme/theme.ts';
import { Txt } from './kit.tsx';

const blurb = (c: Country) => c.guided
  ? `${c.system === 'metric' ? 'Metric (mm)' : 'Imperial (ft-in)'} · ${c.standards[0].name}`
  : 'Metric, generic guidance';

/** The country list, suggested country first. */
export function CountryList({ selected, suggested, onPick }: { selected: CountryCode | null; suggested: CountryCode; onPick(c: CountryCode): void }) {
  const t = useTheme();
  const list = [...COUNTRIES].sort((a, b) => (a.code === suggested ? -1 : b.code === suggested ? 1 : 0));
  return (
    <View style={{ gap: SPACE.xs }}>
      {[...list, GENERIC].map(c => {
        const on = c.code === selected;
        return (
          <Pressable key={c.code} accessibilityRole="radio" accessibilityState={{ selected: on }}
            accessibilityLabel={`${c.name}${c.code === suggested ? ', suggested from your phone\'s region' : ''}. ${blurb(c)}`}
            onPress={() => onPick(c.code)}
            style={({ pressed }) => ({ minHeight: TAP + 8, borderRadius: RADIUS.field, backgroundColor: on ? t.ink : t.sheet, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, opacity: pressed ? 0.85 : 1 })}>
            <Txt v="title2" accessibilityElementsHidden importantForAccessibility="no">{c.flag}</Txt>
            <View style={{ flex: 1 }}>
              <Txt v="headline" style={{ color: on ? t.ground : t.ink }}>{c.name}{c.code === suggested ? '  ·  Your region' : ''}</Txt>
              <Txt v="footnote" style={{ color: on ? t.ground : t.ink2 }}>{blurb(c)}</Txt>
            </View>
            {on ? <Ionicons name="checkmark-circle" size={26} color={t.accent} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
