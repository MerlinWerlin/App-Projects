import { router } from 'expo-router';
import { Alert, Image, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../src/state/AppState';
import { FONT, SPACE } from '../../src/theme/theme';
import { Button, Group, Row, ScreedLine, T } from '../../src/ui/kit';

const EMPTY = require('../../assets/art/empty-jobs.jpg');

function newJobFlow(app: ReturnType<typeof useApp>, then?: (id: string) => void) {
  if (!app.canAddJob) { router.push('/unlock'); return; }
  const create = (name?: string) => { const j = app.createJob(name ?? ''); if (j) (then ?? (id => router.push({ pathname: '/job/[id]', params: { id } })))(j.id); };
  if (Platform.OS === 'ios') Alert.prompt('New job', 'Name it after the client or address.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Create', onPress: (name?: string) => create(name) }], 'plain-text');
  else create('New job');
}

export default function JobsScreen() {
  const app = useApp();
  const { theme, jobs } = app;
  const insets = useSafeAreaInsets();
  const when = (ms: number) => new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.ground }} contentContainerStyle={{ paddingTop: insets.top + SPACE.m, paddingHorizontal: SPACE.l, paddingBottom: SPACE.xxl, gap: SPACE.l }}>
      <View style={{ gap: SPACE.s }} accessibilityRole="header">
        <ScreedLine theme={theme} width={56} />
        <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: FONT.numBold, fontSize: 44, lineHeight: 48, color: theme.ink }}>Jobs</Text>
        <T kind="small">Saved on this phone only. Share a job sheet with your supplier or the client.</T>
      </View>
      {jobs.length ? (
        <>
          <Group>
            {jobs.map((j, k) => (
              <Row key={j.id} testID={`job-${k}`} icon="clipboard-text-outline" title={j.name} subtitle={`${j.items.length} ${j.items.length === 1 ? 'calculation' : 'calculations'} · ${when(j.updatedAt)}`} onPress={() => router.push({ pathname: '/job/[id]', params: { id: j.id } })} />
            ))}
          </Group>
          <Button icon="plus" label="New job" onPress={() => newJobFlow(app)} />
          {!app.canAddJob ? <T kind="small" style={{ textAlign: 'center' }}>The free version keeps one job. Full Unlock keeps as many as you like.</T> : null}
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: SPACE.l, paddingTop: SPACE.l }}>
          <Image source={EMPTY} style={{ width: 240, height: 240, borderRadius: 24 }} accessibilityIgnoresInvertColors accessibilityLabel="Clipboard on a fresh slab" />
          <T kind="headline" style={{ textAlign: 'center' }}>No jobs yet</T>
          <T style={{ textAlign: 'center' }}>Make a job for each site, then tap Save to job under any answer. Everything stays on your phone.</T>
          <Button icon="plus" label="New job" onPress={() => newJobFlow(app)} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
    </ScrollView>
  );
}
