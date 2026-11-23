import { Pressable, View } from 'react-native';
import { COUNTRIES, GENERIC, type Country, type CountryCode } from '../countries/index.ts';
import { RADIUS, SPACE, TAP, useTheme } from '../theme/theme.ts';
import { Icon } from './Icon.tsx';
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
            style={({ pressed }) => ({ minHeight: TAP + 8, borderRadius: RADIUS.field, backgroundColor: t.sheet, borderWidth: 2, borderColor: on ? t.accent : 'transparent', paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ width: 32, alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {c.code === 'XX' ? <Icon name="globe" size={22} color={t.ink} /> : <Txt v="title2">{c.flag}</Txt>}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
                <Txt v="headline">{c.name}</Txt>
                {c.code === suggested ? <View style={{ backgroundColor: t.sunk, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}><Txt v="caption" tone="ink2">Your region</Txt></View> : null}
              </View>
              <Txt v="footnote" tone="ink2">{blurb(c)}</Txt>
            </View>
            {on ? <Icon name="checkCircle" size={22} color={t.accent} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
