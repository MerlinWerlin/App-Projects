import { Icon as Ionicons } from '../../src/ui/Icon.tsx';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { jobTitle, newJob } from '../../src/core/jobs.ts';
import { useAccess } from '../../src/state/access.ts';
import { saveJob, useJobs, useSettings } from '../../src/state/store.ts';
import { RADIUS, SPACE, usePalette } from '../../src/theme/tokens.ts';
import { Body, Button, Card, Chip, Label, Screen, Small } from '../../src/ui/kit.tsx';
import { SettingsButton } from './index.tsx';

export function dateText(ms: number) {
  try {
    return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  } catch {
    return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  }
}

export default function JobsScreen() {
  const p = usePalette();
  const jobs = useJobs();
  const s = useSettings();
  const a = useAccess();
  const add = () => {
    if (!a.canCalc) return router.push('/paywall');
    const j = newJob(s.refrigerant);
    saveJob(j);
    router.push({ pathname: '/job/[id]', params: { id: j.id } });
  };
  return (
    <Screen title="Jobs" subtitle="Saved on this iPhone only" right={<SettingsButton />}>
      <Button testID="new-job" title="New job" icon="add" onPress={add} />
      {jobs.length === 0 ? (
        <Card>
          <Label>No jobs yet</Label>
          <Body dim>Start a job for a site visit, then tap “Save to a job” on any reading. Each job keeps the readings with their working, ready to share as a job sheet.</Body>
        </Card>
      ) : (
        <View style={{ gap: SPACE.sm }}>
          {jobs.map((j) => (
            <Pressable
              key={j.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/job/[id]', params: { id: j.id } })}
              style={({ pressed }) => ({ backgroundColor: p.surface, borderRadius: RADIUS.lg, padding: SPACE.lg, gap: 6, borderWidth: 1, borderColor: p.line, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: p.text }} numberOfLines={2}>{jobTitle(j)}</Text>
                <Ionicons name="chevron-forward" size={20} color={p.text3} />
              </View>
              <View style={{ flexDirection: 'row', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip text={j.refrigerant} />
                <Small>{`${j.readings.length} reading${j.readings.length === 1 ? '' : 's'} · ${dateText(j.updatedAt)}`}</Small>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
