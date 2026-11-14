// T113 In-flight view for one flight booking: the arc with the plane at the elapsed fraction, time left, landing
// time on the destination clock and "set your watch to", home and destination clocks now, the "when you land"
// checklist (only what the trip holds), a jet lag tip and the boarding pass shortcut. Before departure (24 h) it
// counts down with Airport day's leave-by; after landing it stays for 6 h. Offline from the booking, no status lookups.
// T116: ticks every 10 s while focused (the plane glides with the same timed tween), paused when not focused.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../src/state/app.tsx';
import { space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView, SectionCard } from '../../src/ui/hero.tsx';
import { FULL_TICK_MS, InflightHero, jetlagLine, TimePanel, useCheckRows, useInflightForItem } from '../../src/ui/InflightCard.tsx';
import { Body, Button, EmptyState, PressableScale, Screen } from '../../src/ui/kit.tsx';

export default function InflightScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { t, theme } = useApp();
  const router = useRouter();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const v = useInflightForItem(itemId ?? '', focused ? FULL_TICK_MS : 0);
  const rows = useCheckRows(v);

  if (!v) {
    return (
      <Screen>
        <EmptyState art="clock" title={t('inflight.route')} body={t('inflight.notFound')} />
      </Screen>
    );
  }
  const tip = jetlagLine(t, v);
  const clocksLabel = t('inflight.clocksA11y', { home: v.home.city, homeTime: v.home.time, dest: v.destination.city, destTime: v.destination.time });

  return (
    <Screen>
      <FadeInView>
        <InflightHero v={v} arcHeight={160}>
          <TimePanel v={v} />
        </InflightHero>
      </FadeInView>

      {v.ticket ? (
        <Button
          label={t('inflight.ticket')}
          hint={t('inflight.ticketHint')}
          icon="ticket-outline"
          onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: v.ticket?.itemId ?? v.itemId } })}
        />
      ) : null}

      <FadeInView delay={60}>
        <SectionCard title={t('inflight.clocksTitle')} icon="time-outline" tone="sea">
          <View accessible accessibilityLabel={clocksLabel} style={{ flexDirection: 'row', gap: space.l }}>
            {[
              { label: t('inflight.clockHome', { city: v.home.city }), time: v.home.time },
              { label: t('inflight.clockDest', { city: v.destination.city }), time: v.destination.time },
            ].map((c) => (
              <View key={c.label} style={{ flex: 1, gap: 2 }}>
                <Text style={[typeScale.small, { color: theme.muted }]}>{c.label}</Text>
                <Text style={[typeScale.displayM, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{c.time}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </FadeInView>

      <FadeInView delay={120}>
        <SectionCard title={t('inflight.landTitle')} icon="checkmark-done-outline" tone="ok">
          {rows.length ? (
            rows.map((r) => (
              <PressableScale
                key={r.key}
                accessibilityRole="button"
                accessibilityLabel={r.label}
                accessibilityHint={r.hint}
                onPress={r.go}
                style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.m, borderTopWidth: 1, borderTopColor: theme.line, paddingVertical: space.s }}
              >
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Ionicons name={r.icon} size={22} color={theme.ok} />
                </View>
                <Text style={[typeScale.body, { color: theme.ink, flex: 1 }]}>{r.label}</Text>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                </View>
              </PressableScale>
            ))
          ) : (
            <Body muted>{t('inflight.landEmpty')}</Body>
          )}
        </SectionCard>
      </FadeInView>

      {tip ? (
        <FadeInView delay={180}>
          <SectionCard
            title={t('inflight.jetlagTitle')}
            icon="moon-outline"
            tone="teal"
            action={{ label: t('inflight.jetlagOpen'), hint: t('inflight.jetlagOpenHint'), onPress: () => router.push({ pathname: '/jetlag', params: { tripId: v.tripId } }) }}
          >
            <Body>{tip}</Body>
            <Body muted>{t('inflight.jetlagNote')}</Body>
          </SectionCard>
        </FadeInView>
      ) : null}

      <Button label={t('inflight.trip')} hint={t('inflight.tripHint')} kind="quiet" icon="list-outline" onPress={() => router.push({ pathname: '/trip/[id]', params: { id: v.tripId } })} />
      <Body muted>{t('inflight.offline')}</Body>
    </Screen>
  );
}
