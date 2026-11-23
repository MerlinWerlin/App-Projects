import { Icon } from '../../src/ui/Icon.tsx';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Share, Text, TextInput, View } from 'react-native';
import { jobText } from '../../src/core/jobs.ts';
import { toolById } from '../../src/core/tools.ts';
import { useJobs } from '../../src/state/jobs.tsx';
import { fonts, radius, space, TOUCH, useTheme, sys } from '../../src/theme/theme.ts';
import { Button, Card, P, Screen } from '../../src/ui/kit.tsx';

export default function JobScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs, rename, remove, removeCalc } = useJobs();
  const job = jobs.find((j) => j.id === id);
  const [name, setName] = useState(job?.name ?? '');
  if (!job) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Job' }} />
        <Card>
          <P>This job has been deleted.</P>
          <Button label="Back to Jobs" onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }
  const confirmDelete = () =>
    Alert.alert(`Delete ${job.name}?`, `Its ${job.calcs.length} saved calculation${job.calcs.length === 1 ? '' : 's'} will be removed from this phone. This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete job',
        style: 'destructive',
        onPress: () => {
          remove(job.id);
          router.back();
        },
      },
    ]);
  return (
    <Screen>
      <Stack.Screen options={{ title: job.name }} />
      <View style={{ gap: space.xs }}>
        <Text style={{ ...sys.bodyBold, fontSize: 15, color: t.muted }}>Job name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => rename(job.id, name)}
          returnKeyType="done"
          accessibilityLabel="Job name"
          style={{ minHeight: TOUCH, borderRadius: radius.m, borderWidth: 2, borderColor: t.line, backgroundColor: t.card, paddingHorizontal: space.m, fontFamily: fonts.display, fontSize: 24, color: t.ink }}
        />
      </View>
      {job.calcs.length === 0 ? (
        <Card>
          <P muted>Nothing saved here yet. Open a tool, then tap Save to a job under the result.</P>
          <Button label="Open the tools" kind="blade" icon="tools" onPress={() => router.navigate('/')} />
        </Card>
      ) : (
        job.calcs.map((c) => (
          <View key={c.id} style={{ borderRadius: radius.l, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }}>
            <Pressable onPress={() => router.push({ pathname: `/${c.tool}` as never, params: { calc: c.id } })} accessibilityRole="button" accessibilityHint="Opens it with these numbers" style={({ pressed }) => ({ padding: space.l, gap: space.xs, opacity: pressed ? 0.75 : 1 })}>
              <Text style={{ ...sys.bodyBold, fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: t.muted }}>{toolById(c.tool)?.name}</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: t.ink }}>{c.title}</Text>
              <P>{c.summary}</P>
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert('Remove this calculation?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removeCalc(job.id, c.id) },
                ])
              }
              accessibilityRole="button"
              accessibilityLabel={`Remove ${c.title}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 48, paddingHorizontal: space.l, borderTopWidth: 1, borderTopColor: t.line }}
            >
              <Icon name="trash" size={18} color={t.bad} />
              <Text style={{ ...sys.bodyBold, fontSize: 15, color: t.bad }}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}
      {job.calcs.length ? <Button label="Share job sheet" icon="share" kind="secondary" onPress={() => Share.share({ message: jobText(job) }).catch(() => {})} /> : null}
      <Button label="Delete job" icon="trash" kind="danger" onPress={confirmDelete} />
    </Screen>
  );
}
