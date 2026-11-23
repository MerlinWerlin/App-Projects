import { Icon } from '../../src/ui/Icon.tsx';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useJobs } from '../../src/state/jobs.tsx';
import { fonts, radius, space, TOUCH, useTheme, sys } from '../../src/theme/theme.ts';
import { EmptyJobsArt } from '../../src/ui/diagrams.tsx';
import { Button, Card, P, Screen } from '../../src/ui/kit.tsx';

export default function Jobs() {
  const t = useTheme();
  const { jobs, create } = useJobs();
  const [name, setName] = useState('');
  const add = () => {
    if (!name.trim()) return;
    const j = create(name);
    setName('');
    router.push(`/job/${j.id}`);
  };
  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="New job, e.g. Smith St deck"
          placeholderTextColor={t.muted}
          returnKeyType="done"
          onSubmitEditing={add}
          accessibilityLabel="New job name"
          style={{ flex: 1, minHeight: TOUCH, borderRadius: radius.m, borderWidth: 2, borderColor: t.line, backgroundColor: t.card, paddingHorizontal: space.m, ...sys.bodyMedium, fontSize: 18, color: t.ink }}
        />
        <Button label="Add" kind="blade" icon="plus" disabled={!name.trim()} onPress={add} />
      </View>
      {jobs.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.m }}>
          <EmptyJobsArt />
          <Text style={{ fontFamily: fonts.display, fontSize: 24, color: t.ink, textAlign: 'center' }}>No jobs yet</Text>
          <P muted>Make a job here, or tap Save to a job under any result. Jobs stay on this phone.</P>
        </Card>
      ) : (
        jobs.map((j) => (
          <Pressable key={j.id} onPress={() => router.push(`/job/${j.id}`)} accessibilityRole="button" accessibilityLabel={`${j.name}, ${j.calcs.length} saved`} style={({ pressed }) => ({ minHeight: 72, borderRadius: radius.l, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, padding: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m, opacity: pressed ? 0.75 : 1 })}>
            <Icon name="folder" size={26} color={t.ink} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: t.ink }} numberOfLines={2}>
                {j.name}
              </Text>
              <Text style={{ ...sys.body, fontSize: 15, color: t.muted }}>
                {j.calcs.length} saved · {new Date(j.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <Icon name="chevron" size={22} color={t.muted} />
          </Pressable>
        ))
      )}
    </Screen>
  );
}
