// T66 Time zones screen for one trip: Home vs here clocks, the good-time-to-call finder and the jet lag plan for
// each flight journey that moves the clock 3 h or more ("General guidance, not medical advice"). Free, offline.
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { fromUtc, localDate } from '../src/core/tz.ts';
import { useApp } from '../src/state/app.tsx';
import { useTrips } from '../src/state/trips.tsx';
import { space, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, SectionCard } from '../src/ui/hero.tsx';
import { CallFinder, ClockPair, Disclaimer, PlanSection, useJetLag } from '../src/ui/JetLagCard.tsx';
import { Body, EmptyState, Screen } from '../src/ui/kit.tsx';

export default function JetLagScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t, theme } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  const { view, now } = useJetLag(trip);

  if (!trip) {
    return (
      <Screen>
        <EmptyState title={t('jetlag.title')} body={t('trip.notFound')} />
      </Screen>
    );
  }
  if (!view) {
    return (
      <Screen>
        <EmptyState title={t('jetlag.title')} body={t('jetlag.plan.none')} icon="time-outline" />
      </Screen>
    );
  }
  const today = localDate(fromUtc(now, view.home));
  return (
    <Screen>
      <FadeInView>
        <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
          {trip.name}
        </Text>
      </FadeInView>
      {view.there ? (
        <FadeInView delay={40}>
          <SectionCard title={t('jetlag.title')} icon="time-outline" tone="teal">
            <ClockPair view={view} now={now} big />
          </SectionCard>
        </FadeInView>
      ) : null}
      {view.there ? (
        <FadeInView delay={80}>
          <CallFinder view={view} now={now} />
        </FadeInView>
      ) : null}
      <FadeInView delay={120}>
        <SectionCard title={t('jetlag.plan.title')} icon="moon-outline" tone="accent">
          {view.plans.length ? (
            <View style={{ gap: space.l }}>
              <Disclaimer />
              {view.plans.map((p) => (
                <PlanSection key={p.leg.which} plan={p} today={today} />
              ))}
            </View>
          ) : (
            <Body muted>{t('jetlag.plan.none')}</Body>
          )}
        </SectionCard>
      </FadeInView>
    </Screen>
  );
}
