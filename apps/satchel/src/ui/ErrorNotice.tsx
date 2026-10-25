// A STATES_COPY error block (title, body, one action) for problems that leave the screen usable: a save that
// didn't reach storage (the form stays open with what was typed), or saved trips that couldn't be read.
// Announced to screen readers as an alert. Colours from theme tokens.
import { Text, View } from 'react-native';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space } from '../theme/tokens.ts';
import { Button } from './kit.tsx';

export function ErrorNotice({ title, body, action, actionHint, onAction }: { title: string; body: string; action?: string; actionHint?: string; onAction?: () => void }) {
  const { theme } = useApp();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{ gap: space.s, borderWidth: 1, borderColor: theme.danger, borderRadius: radius.m, padding: space.m, backgroundColor: theme.card }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.danger }}>{title}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 15, color: theme.ink }}>{body}</Text>
      {action && onAction ? <Button label={action} hint={actionHint} kind="quiet" onPress={onAction} /> : null}
    </View>
  );
}
