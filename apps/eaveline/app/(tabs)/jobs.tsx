/** Saved jobs, on this phone only. */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { flag } from '../../src/data';
import { useApp } from '../../src/state/AppState';
import { RADIUS, SPACE } from '../../src/theme/theme';
import { Btn, Card, Field, Screen, Txt } from '../../src/ui/kit';

const EMPTY = require('../../assets/illustrations/empty-jobs.png');

export default function Jobs() {
  const app = useApp();
  const { theme } = app;
  const router = useRouter();
  const [name, setName] = useState('');
  const create = () => {
    if (!app.unlocked) { router.push('/unlock'); return; }
    const j = app.newJob(name);
    setName('');
    router.push(`/job/${j.id}`);
  };
  return (
    <Screen>
      <Card style={{ gap: SPACE.sm, paddingVertical: SPACE.md }}>
        <Field testID="job-name" label="New job" value={name} onChangeText={setName} keyboard="default" placeholder="Address or customer" />
        <Btn testID="job-create" label="Create job" icon="add" onPress={create} />
        <Txt v="footnote" tone="ink3">Jobs are saved on this phone only. Results you save from any calculator go to the job you’re working on.</Txt>
      </Card>
      {app.jobs.length === 0 ? (
        <View style={st.empty}>
          <Image source={EMPTY} style={st.emptyArt} resizeMode="contain" accessible={false} />
          <Txt v="title2" style={{ textAlign: 'center' }}>No jobs yet</Txt>
          <Txt v="body" tone="ink2" style={{ textAlign: 'center' }}>Create one above, or tap Save on any result and Eaveline starts a job for you.</Txt>
        </View>
      ) : app.jobs.map(j => {
        const active = j.id === app.activeJobId;
        return (
          <Pressable key={j.id} testID={`job-${j.id}`} accessibilityRole="button" onPress={() => router.push(`/job/${j.id}`)}
            style={({ pressed }) => [st.job, { backgroundColor: theme.sheet, borderColor: active ? theme.ink : theme.line, borderWidth: active ? 2 : StyleSheet.hairlineWidth, opacity: pressed ? 0.85 : 1 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="title2" numberOfLines={2}>{j.name}</Txt>
              <Txt v="footnote" tone="ink3">{flag(j.country)} {j.entries.length} result{j.entries.length === 1 ? '' : 's'} · {new Date(j.updatedAt).toLocaleDateString()}</Txt>
              {active ? <Txt v="label" tone="ink">Working on this</Txt> : null}
            </View>
            <Ionicons name="chevron-forward" size={22} color={theme.ink3} />
          </Pressable>
        );
      })}
    </Screen>
  );
}

const st = StyleSheet.create({
  empty: { alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.lg, paddingHorizontal: SPACE.md },
  emptyArt: { width: 220, height: 160 },
  job: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.m, padding: SPACE.md, minHeight: 72 },
});
