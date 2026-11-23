import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { CHECKLIST } from '../src/core/weather';
import { useApp } from '../src/state/AppState';
import { RADIUS, SPACE } from '../src/theme/theme';
import { Button, Icon, T } from '../src/ui/kit';
import { haptic } from '../src/native/store';

/** Ticks are kept per job when opened from a job, otherwise in one general list. */
export default function ChecklistScreen() {
  const { job: jobId } = useLocalSearchParams<{ job?: string }>();
  const app = useApp();
  const { theme, prefs } = app;
  const job = jobId ? app.jobs.find(j => j.id === String(jobId)) : undefined;
  const general = app.drafts.checklist ?? {};
  const ticked = (id: string) => (job ? !!job.checks[id] : general[id] === 1);
  const toggle = (id: string) => {
    haptic.tap(prefs.haptics);
    if (job) app.patchJob(job.id, { checks: { ...job.checks, [id]: !job.checks[id] } });
    else app.setDraft('checklist', { ...general, [id]: general[id] === 1 ? 0 : 1 });
  };
  const clear = () => {
    if (job) app.patchJob(job.id, { checks: {} });
    else app.setDraft('checklist', {});
  };
  const total = CHECKLIST.reduce((n, g) => n + g.items.length, 0);
  const done = CHECKLIST.reduce((n, g) => n + g.items.filter(i => ticked(`${g.id}.${i.id}`)).length, 0);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.ground }} contentContainerStyle={{ padding: SPACE.l, gap: SPACE.m, paddingBottom: SPACE.xxl }}>
      <Stack.Screen options={{ title: job ? `Checklist · ${job.name}` : 'Pour & curing checklist' }} />
      <T kind="small">{done} of {total} done{job ? ' for this job' : ''}. Based on CCAA guidance, AS 2870, AS 3600 and AS 1379.</T>
      {CHECKLIST.map(g => (
        <View key={g.id} style={{ gap: SPACE.s }}>
          <T kind="caps" style={{ marginTop: SPACE.m }}>{g.title}</T>
          {g.items.map(i => {
            const key = `${g.id}.${i.id}`;
            const on = ticked(key);
            return (
              <Pressable
                key={key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={i.text}
                onPress={() => toggle(key)}
                style={({ pressed }) => ({ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: SPACE.m, backgroundColor: theme.card, borderRadius: RADIUS.m, paddingHorizontal: SPACE.l, paddingVertical: SPACE.m, borderWidth: theme.name === 'sun' ? theme.borderWidth : 1, borderColor: on ? theme.amber : theme.line, opacity: pressed ? 0.85 : 1 })}
              >
                <View style={{ width: 36, height: 36, borderRadius: 8, borderWidth: 3, borderColor: on ? theme.amber : theme.fieldLine, backgroundColor: on ? theme.amber : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Icon name="check-bold" size={24} color={theme.onAmber} /> : null}
                </View>
                <T style={{ flex: 1 }}>{i.text}</T>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Button kind="secondary" icon="weather-windy" label="Check pour weather" onPress={() => router.push({ pathname: '/tool/[id]', params: { id: 'weather' } })} style={{ marginTop: SPACE.l }} />
      {done ? <Button kind="plain" label="Clear all ticks" onPress={clear} /> : null}
    </ScrollView>
  );
}
