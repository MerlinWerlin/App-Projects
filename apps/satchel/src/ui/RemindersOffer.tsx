// Itinerary tab: a small, one-time offer to turn on trip reminders (docs/REMINDERS.md). Shown only while reminders
// are off, a real (non-demo) trip has a plan coming up in the next two weeks, and it hasn't been dismissed. Turning
// on asks for permission there and then; "Not now" hides it for good (Settings still has the switch).
import { useMemo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { hasUpcomingReminders } from '../core/reminders.ts';
import { CAPTURE } from '../native/notifications.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { useReminderSetting } from '../state/reminders.ts';
import { useTrips } from '../state/trips.tsx';
import { fonts, space } from '../theme/tokens.ts';
import { IconBadge } from './hero.tsx';
import { Body, Button, Card } from './kit.tsx';

const DISMISSED_KEY = 'satchel.reminders.offerDismissed.v1';
const NOT_DISMISSED = false;

export function RemindersOffer({ now, style }: { now: number; style?: StyleProp<ViewStyle> }) {
  const { t, theme } = useApp();
  const { trips } = useTrips();
  const { on, setOn } = useReminderSetting();
  const [dismissed, setDismissed, loaded] = usePersisted<boolean>(DISMISSED_KEY, NOT_DISMISSED);
  // `now` ticks each minute; the plan only needs re-checking when trips change or the hour moves on.
  const hour = Math.floor(now / 3_600_000);
  const upcoming = useMemo(() => hasUpcomingReminders(trips, hour * 3_600_000), [trips, hour]);
  if (CAPTURE || on || !loaded || dismissed || !upcoming) return null;
  return (
    <Card style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.m }}>
        <IconBadge name="notifications-outline" tone="accent" size="s" />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>
            {t('reminders.offer.title')}
          </Text>
          <Body muted>{t('reminders.offer.body')}</Body>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        <Button label={t('reminders.offer.turnOn')} hint={t('reminders.offer.turnOnHint')} kind="secondary" onPress={() => void setOn(true)} />
        <Button label={t('reminders.offer.dismiss')} hint={t('reminders.offer.dismissHint')} kind="quiet" onPress={() => setDismissed(true)} />
      </View>
    </Card>
  );
}
