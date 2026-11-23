/** Short working-at-heights reminder for the chosen country, with the regulator. */
import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, View } from 'react-native';
import { isPublicSource } from '../src/data/src';
import { useApp } from '../src/state/AppState';
import { RADIUS, SPACE } from '../src/theme/theme';
import { Btn, Card, Screen, Txt } from '../src/ui/kit';

const CHECKS = [
  'Plan the job: access, edge protection, and how you’d get someone down.',
  'Treat skylights, old sheets and fibre cement as fragile until proven otherwise.',
  'Stay off wet, frosty or dusty roofs, and stop work in strong wind.',
  'Use a harness on a rated anchor when edge protection can’t be fitted.',
  'Secure ladders and keep three points of contact.',
  'Keep the area below clear, and tie down sheets in wind.',
];

export default function Safety() {
  const { country, theme } = useApp();
  return (
    <Screen>
      <View style={[st.band, { backgroundColor: theme.accent }]}>
        <Ionicons name="warning" size={36} color={theme.onAccent} />
        <Txt v="title" style={{ color: theme.onAccent }} accessibilityRole="header">Working at heights</Txt>
      </View>
      <Card style={{ gap: SPACE.xs }}>
        <Txt v="label" tone="ink3">{country.name}</Txt>
        <Txt v="headline">{country.safety.regulator}</Txt>
        <Txt v="body" tone="ink2">{country.safety.text}</Txt>
        {isPublicSource(country.safety.src.url) ? <Btn label="Read the regulator’s guidance" kind="outline" icon="open-outline" onPress={() => void Linking.openURL(country.safety.src.url)} /> : null}
      </Card>
      <Card style={{ gap: SPACE.sm }}>
        {CHECKS.map(c => (
          <View key={c} style={st.check}>
            <Ionicons name="checkmark-circle-outline" size={24} color={theme.ink} />
            <Txt v="body" style={{ flex: 1 }}>{c}</Txt>
          </View>
        ))}
      </Card>
      <Txt v="footnote" tone="ink3">A reminder, not training. Follow your site’s safe work method and local law.</Txt>
    </Screen>
  );
}

const st = StyleSheet.create({
  band: { borderRadius: RADIUS.l, padding: SPACE.lg, gap: SPACE.sm },
  check: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-start' },
});
