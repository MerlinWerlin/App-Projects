// T120 per-trip accent on the trip's own screens (packing, spending, journal, to-dos, gifts), like the trip screen's day
// cards (T119): the colour set comes from the trip's cover scene (src/theme/tripAccent.ts, contrast-checked in both
// themes). `strong` is for stripes (3:1 on the page and cards), `ink` for heading text (AA on the page and cards).
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { tripCover } from '../core/covers.ts';
import type { Trip } from '../core/model.ts';
import { useApp } from '../state/app.tsx';
import { radius, space, typeScale } from '../theme/tokens.ts';
import { tripAccent, type TripAccent } from '../theme/tripAccent.ts';

/** The trip's accent in the current theme. */
export function useTripAccent(trip: Trip): TripAccent {
  const { theme } = useApp();
  return useMemo(() => tripAccent(tripCover(trip), theme), [trip, theme]);
}

/** A short vertical stripe in the accent (decorative). */
export function AccentStripe({ accent, height = 20 }: { accent: TripAccent; height?: number }) {
  return <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: 4, height, borderRadius: radius.pill, backgroundColor: accent.strong }} />;
}

/**
 * A heading in the trip's accent: stripe + caption text in accent ink. `label` is what is read out (defaults to
 * the text); `right` sits at the end of the row (a count, for example).
 */
export function AccentHeading({ accent, text, label, right }: { accent: TripAccent; text: string; label?: string; right?: string }) {
  const { theme } = useApp();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={label ?? (right ? `${text}. ${right}` : text)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 28 }}>
      <AccentStripe accent={accent} />
      <Text style={[typeScale.caption, { flex: 1, fontSize: 13, color: accent.ink }]}>{text}</Text>
      {right ? <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{right}</Text> : null}
    </View>
  );
}

/** The trip's name as an accent heading at the top of one of its screens. */
export function TripAccentBand({ trip }: { trip: Trip }) {
  const { t } = useApp();
  const accent = useTripAccent(trip);
  return <AccentHeading accent={accent} text={trip.name} label={t('f99.accent.trip', { trip: trip.name })} />;
}
