// T65: "Your travels" hero card on the Trips tab. A gradient card with three big numbers (countries, days away,
// km flown) and a small tile strip; the whole card opens app/travels.tsx. Hidden when there are no trips at all.
// Colours from theme tokens only; it fades in (timed) like the rest of the tab.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useApp } from '../state/app.tsx';
import { radius, shadowOf, space, typeScale } from '../theme/tokens.ts';
import { FadeInView, GradientFill, toneColours } from './hero.tsx';
import { PressableScale } from './kit.tsx';
import { formatInt, useTravelStats } from './useTravelStats.ts';
import { tileTone } from './WorldTiles.tsx';

export function TravelsCard() {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const { stats, hasTrips } = useTravelStats();
  if (!hasTrips) return null;
  const any = stats.tripsTaken > 0;
  const vars = { countries: stats.countries.length, days: stats.daysAway, km: formatInt(stats.flights.km, lang) };
  const figures: { n: string; label: string }[] = [
    { n: String(stats.countries.length), label: t('travels.stat.countries') },
    { n: String(stats.daysAway), label: t('travels.stat.daysAway') },
    { n: vars.km, label: t('travels.stat.km') },
  ];
  return (
    <FadeInView delay={80}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={any ? t('travels.card.a11y', vars) : t('travels.card.a11yEmpty')}
        accessibilityHint={t('travels.card.hint')}
        onPress={() => router.push('/travels')}
        style={[{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: theme.hero.map[0] }, shadowOf(theme, 'low')]}
      >
        <GradientFill tone="map" />
        <View style={{ padding: space.l, gap: space.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Ionicons name="globe-outline" size={20} color={theme.heroInk} />
            <Text style={[typeScale.title, { color: theme.heroInk, flex: 1 }]}>{t('travels.card.title')}</Text>
            <Text style={[typeScale.bodyStrong, { color: theme.heroMuted }]}>{t('travels.card.open')}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.heroMuted} />
          </View>
          {any ? (
            <View style={{ flexDirection: 'row', gap: space.m }}>
              {figures.map((f) => (
                <View key={f.label} style={{ flex: 1 }}>
                  <Text style={[typeScale.displayM, { color: theme.heroInk, fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
                    {f.n}
                  </Text>
                  <Text style={[typeScale.caption, { color: theme.heroMuted }]} numberOfLines={1}>
                    {f.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[typeScale.body, { color: theme.heroMuted }]}>{t('travels.card.bodyEmpty')}</Text>
          )}
          {stats.countries.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {stats.countries.slice(0, 14).map((iso2) => {
                const { fg, bg } = toneColours(theme, tileTone(iso2));
                return (
                  <View
                    key={iso2}
                    style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: bg, borderWidth: 1.5, borderColor: fg }}
                  />
                );
              })}
            </View>
          ) : null}
        </View>
      </PressableScale>
    </FadeInView>
  );
}
