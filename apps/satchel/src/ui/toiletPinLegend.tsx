// T157: the legend under the Toilets tab's map view: one row per kind of toilet pin drawn (wheelchair accessible,
// ordinary), each a disc in the pin's theme colour with its glyph, as the pins look on the map (src/native/maps.tsx).
// Read as one line by screen readers; the discs are decorative. Theme tokens only.
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { TOILET_PIN_STYLES, type ToiletPinKind } from '../core/toiletpins.ts';
import type { Key } from '../i18n/en.ts';
import { useApp } from '../state/app.tsx';
import { space, typeScale } from '../theme/tokens.ts';

type IconName = ComponentProps<typeof Ionicons>['name'];
const KIND_KEY: Record<ToiletPinKind, Key> = { accessible: 'f110.toilets.legend.accessible', toilet: 'f110.toilets.legend.toilet' };

export function ToiletPinLegend({ kinds }: { kinds: readonly ToiletPinKind[] }) {
  const { t, theme } = useApp();
  if (!kinds.length) return null;
  const names = kinds.map((k) => t(KIND_KEY[k]));
  return (
    <View accessible accessibilityLabel={`${t('f110.toilets.legendLabel')}: ${names.join(', ')}. ${t('f110.toilets.legendNote')}`} style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.l, rowGap: space.xs }}>
        {kinds.map((k, i) => {
          const s = TOILET_PIN_STYLES[k];
          return (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme[s.tone], alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name={s.icon as IconName} size={13} color={theme.card} />
              </View>
              <Text style={[typeScale.small, { color: theme.ink }]}>{names[i]}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('f110.toilets.legendNote')}</Text>
    </View>
  );
}
