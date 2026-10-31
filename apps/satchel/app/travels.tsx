// T65 "Your travels" (owner: the app "feels bland"). Lifetime stats worked out on the phone from the saved trips:
// next-trip countdown, countries, cities, days away, trips this year, flights and great-circle km, the longest trip,
// and an abstract world tile grid of visited countries (original SVG, no map imagery or flags). Demo trips are left
// out unless "Include demo trips" is on. Free, offline, theme tokens only, timed fades only.
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { zoneCity } from '../src/core/travelstats.ts';
import { useApp } from '../src/state/app.tsx';
import { radius, space, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader, IconBadge, SectionCard, StatTile } from '../src/ui/hero.tsx';
import { Body, Button, Card, EmptyState, ToggleRow } from '../src/ui/kit.tsx';
import { displayCountryName, formatInt, useTravelStats } from '../src/ui/useTravelStats.ts';
import { RecapList } from '../src/ui/RecapList.tsx';
import { WorldTiles } from '../src/ui/WorldTiles.tsx';

export default function TravelsScreen() {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { stats, includeDemo, setIncludeDemo, hasDemo } = useTravelStats();
  const km = formatInt(stats.flights.km, lang);
  const next = stats.next;

  const demoToggle = hasDemo ? (
    <Card>
      <ToggleRow label={t('travels.demo.toggle')} hint={t('travels.demo.hint')} value={includeDemo} onChange={setIncludeDemo} />
      {!includeDemo && stats.demoLeftOut ? <Body muted>{t('travels.demo.leftOut')}</Body> : null}
    </Card>
  ) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}
    >
      <FadeInView>
        <HeroHeader tone="map" illustration="route" compact eyebrow={t('travels.eyebrow')} title={t('travels.title')} subtitle={t('travels.subtitle')} />
      </FadeInView>

      {next ? (
        <FadeInView delay={40}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            <IconBadge name="calendar" tone="accent" />
            <View style={{ flex: 1 }} accessible accessibilityLabel={`${t('travels.next.title')}. ${next.days === 1 ? t('travels.next.tomorrow', { trip: next.name }) : t('travels.next.days', { trip: next.name, n: next.days })}`}>
              <Text style={[typeScale.caption, { color: theme.muted }]}>{t('travels.next.title')}</Text>
              <Text style={[typeScale.title, { color: theme.ink }]}>
                {next.days === 1 ? t('travels.next.tomorrow', { trip: next.name }) : t('travels.next.days', { trip: next.name, n: next.days })}
              </Text>
              {next.zone ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('travels.next.place', { place: zoneCity(next.zone) })}</Text> : null}
            </View>
          </Card>
        </FadeInView>
      ) : null}

      {stats.tripsTaken === 0 ? (
        <FadeInView delay={80}>
          <EmptyState
            art="compass"
            title={t('travels.empty.title')}
            body={!includeDemo && stats.demoLeftOut > 0 && !next ? t('travels.empty.demoBody') : t('travels.empty.body')}
            action={<Button label={t('travels.empty.add')} hint={t('travels.empty.addHint')} kind="quiet" icon="add" onPress={() => router.push('/trip-edit')} />}
          />
        </FadeInView>
      ) : (
        <>
          <FadeInView delay={80} style={{ gap: space.s }}>
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <StatTile value={stats.countries.length} label={t('travels.stat.countries')} icon="flag-outline" tone="sea" />
              <StatTile value={stats.cities.length} label={t('travels.stat.cities')} icon="business-outline" tone="teal" />
              <StatTile value={stats.daysAway} label={t('travels.stat.daysAway')} icon="sunny-outline" tone="accent" />
            </View>
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <StatTile value={stats.tripsThisYear} label={t('travels.stat.thisYear')} icon="calendar-outline" tone="ok" />
              <StatTile value={stats.flights.legs} label={t('travels.stat.flights')} icon="airplane-outline" tone="warn" />
              <StatTile value={stats.flights.km} label={t('travels.stat.km')} icon="navigate-outline" tone="danger" />
            </View>
          </FadeInView>

          <FadeInView delay={120}>
            <SectionCard icon="globe-outline" tone="sea" title={t('travels.world.title')} subtitle={t('travels.world.subtitle')}>
              <WorldTiles tiles={stats.tiles} />
              {stats.home ? <Body muted>{t('travels.world.home', { country: displayCountryName(stats.home, lang) })}</Body> : null}
            </SectionCard>
          </FadeInView>

          {stats.longest ? (
            <FadeInView delay={160}>
              <View accessible accessibilityLabel={t('travels.longest.a11y', { trip: stats.longest.name, n: stats.longest.days })}>
                <SectionCard icon="trophy-outline" tone="accent" title={t('travels.longest.title')} subtitle={t('travels.longest.body', { trip: stats.longest.name, n: stats.longest.days })} />
              </View>
            </FadeInView>
          ) : null}

          <FadeInView delay={200}>
            <SectionCard icon="airplane-outline" tone="warn" title={t('travels.flights.title')}>
              <Body>{stats.flights.legs ? t('travels.flights.body', { legs: stats.flights.legs, km }) : t('travels.flights.none')}</Body>
              {stats.flights.unmeasured ? <Body muted>{t('travels.flights.unmeasured', { n: stats.flights.unmeasured })}</Body> : null}
            </SectionCard>
          </FadeInView>

          {stats.cities.length ? (
            <FadeInView delay={240}>
              <SectionCard icon="business-outline" tone="teal" title={t('travels.cities.title')} subtitle={t('travels.cities.note')}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                  {stats.cities.map((c) => (
                    <View key={c} style={{ paddingHorizontal: space.m, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: theme.tealSoft }}>
                      <Text style={[typeScale.small, { color: theme.ink }]}>{c}</Text>
                    </View>
                  ))}
                </View>
              </SectionCard>
            </FadeInView>
          ) : null}
          <FadeInView delay={280}>
            <RecapList includeDemo={includeDemo} />
          </FadeInView>
        </>
      )}

      {demoToggle}
    </ScrollView>
  );
}
