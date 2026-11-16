// Destination themes in a hero banner: the country's motif toward the top right and the ambient particles, both
// behind the banner text. HeroHeader draws it for the Trips, Map and Wallet tones (src/theme/countryTheme.ts
// THEMED_TONES) while a country theme is on (src/state/countryTheme.tsx). Decorative: hidden from screen readers.
import { memo } from 'react';
import { View } from 'react-native';
import type { CountryPick } from '../core/countrytheme.ts';
import { useCountryPick } from '../state/countryTheme.tsx';
import { radius, space } from '../theme/tokens.ts';
import { AmbientLayer } from './AmbientLayer.tsx';
import { CountryMotif } from './countryArt.tsx';

export const CountryHeroArt = memo(function CountryHeroArt({
  pick,
  compact = false,
  scene = false,
  motif = true,
  topInset = 0,
}: {
  pick: CountryPick;
  compact?: boolean;
  /** A tab scene sits on the right: draw the motif softer behind it. */
  scene?: boolean;
  /** false keeps the banner's own illustration and adds only the particles. */
  motif?: boolean;
  topInset?: number;
}) {
  const width = compact ? 120 : 160;
  return (
    <>
      {motif ? (
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        // Behind a tab scene the motif is a softer backdrop; on its own it takes the illustration's place.
        style={{ position: 'absolute', right: -space.s, top: topInset + (compact ? 0 : space.xs), opacity: scene ? 0.6 : 0.95 }}
      >
        <CountryMotif motif={pick.spec.motif} paints={pick.spec.paints} width={width} height={width * 0.75} />
      </View>
      ) : null}
      <AmbientLayer kind={pick.particle} compact={compact} />
    </>
  );
});

/**
 * Trip detail: the trip's own country particles drifting across the sky of its cover (the top half only, clear of
 * the title). Put it after the cover inside a plain View; nothing when the trip isn't in a themed country.
 */
export function TripCoverAmbient() {
  const pick = useCountryPick();
  if (!pick) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', overflow: 'hidden', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}
    >
      <AmbientLayer kind={pick.particle} compact />
    </View>
  );
}
