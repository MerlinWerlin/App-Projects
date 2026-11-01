// T17 the gentle backup reminder on the Trips home: one line, only when an own trip starts within 7 days and no
// backup was made on this phone in the last 30 days (src/core/backup.ts backupReminderTrip). Dismissing it hides it
// for that trip for good; no other nags. Fades in (timed, Reduce Motion respected).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { backupReminderTrip } from '../core/backup.ts';
import { deviceZone, todayIn } from '../core/format.ts';
import type { Trip } from '../core/model.ts';
import { useApp } from '../state/app.tsx';
import { useBackupState } from '../state/backup.ts';
import { fonts, radius, space, TOUCH } from '../theme/tokens.ts';
import { FadeInView } from './hero.tsx';
import { PressableScale } from './kit.tsx';

export function BackupReminder({ trips }: { trips: Trip[] }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [state, update, loaded] = useBackupState();
  if (!loaded) return null;
  const trip = backupReminderTrip(trips, state, todayIn(deviceZone()), Date.now());
  if (!trip) return null;
  const dismiss = () => update((s) => ({ ...s, dismissed: [...s.dismissed.filter((x) => x !== trip.id), trip.id] }));
  return (
    <FadeInView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: theme.card, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, paddingLeft: space.m }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="cloud-upload-outline" size={20} color={theme.sea} />
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${t('backup.reminder', { trip: trip.name })} ${t('backup.reminderOpen')}`}
          accessibilityHint={t('backup.reminderOpenHint')}
          onPress={() => router.push('/backup')}
          style={{ flex: 1, minHeight: TOUCH, justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: theme.ink }}>
            {t('backup.reminder', { trip: trip.name })} <Text style={{ fontFamily: fonts.bodyBold, color: theme.sea }}>{t('backup.reminderOpen')}</Text>
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('backup.reminderDismiss')}
          accessibilityHint={t('backup.reminderDismissHint')}
          onPress={dismiss}
          style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={20} color={theme.muted} />
        </PressableScale>
      </View>
    </FadeInView>
  );
}
