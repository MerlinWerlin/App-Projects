// Settings > Reminders (docs/REMINDERS.md): the "Trip reminders" switch, a one-line explanation, and, when the phone
// refuses notifications for Satchel, a notice with a button to the phone's Settings. Turning it on asks for
// permission then (src/state/reminders.ts useReminderSetting); nothing is asked at launch.
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { openSettings } from '../native/device.ts';
import { useApp } from '../state/app.tsx';
import { useReminderSetting } from '../state/reminders.ts';
import { fonts, radius, space } from '../theme/tokens.ts';
import { SectionHeader } from './hero.tsx';
import { Body, Button, Card, ToggleRow } from './kit.tsx';

export function RemindersSection() {
  const { t } = useApp();
  const { on, permission, setOn } = useReminderSetting();
  return (
    <View style={{ gap: space.s }}>
      <SectionHeader title={t('reminders.settings.title')} icon="notifications-outline" tone="accent" />
      <Card>
        <ToggleRow label={t('reminders.settings.toggle')} hint={t('reminders.settings.toggleHint')} value={on} onChange={(v) => void setOn(v)} />
        <Body muted>{t('reminders.settings.body')}</Body>
        {on ? <Body muted>{t('reminders.settings.sounds')}</Body> : null}
      </Card>
      {on && permission === 'denied' ? <RemindersBlocked /> : null}
    </View>
  );
}

/** Notifications are refused for Satchel: only the phone's Settings can change that. */
function RemindersBlocked() {
  const { t, theme } = useApp();
  const title = t('reminders.settings.deniedTitle');
  const body = t('reminders.settings.deniedBody');
  return (
    <Card>
      <View accessibilityLiveRegion="polite" style={{ gap: space.s }}>
        <View accessible accessibilityRole="alert" accessibilityLabel={`${title}. ${body}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.m }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: 36, height: 36, borderRadius: radius.s, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="notifications-off-outline" size={20} color={theme.accent} />
          </View>
          <View style={{ flex: 1, gap: space.xs }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{title}</Text>
            <Body>{body}</Body>
          </View>
        </View>
        <Button label={t('reminders.settings.openSettings')} hint={t('reminders.settings.openSettingsHint')} onPress={openSettings} />
      </View>
    </Card>
  );
}
