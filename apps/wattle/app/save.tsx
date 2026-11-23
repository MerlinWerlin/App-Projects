/** Sheet: pick a job (or make one) for the result the person just tapped Save on. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addCalc, createJob } from '../src/core/jobs.ts';
import { success } from '../src/native/haptics.ts';
import { useApp } from '../src/state/AppState.tsx';
import { clearPending, takePending } from '../src/state/pending.ts';
import { RADIUS, SPACE, TYPE } from '../src/theme/theme.ts';
import { Btn, Card, Row, Txt } from '../src/ui/kit.tsx';

export default function Save() {
  const app = useApp();
  const { theme } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [calc] = useState(takePending);
  const [name, setName] = useState('');
  const done = () => { clearPending(); success(app.prefs.haptics); router.back(); };
  const into = (jobId: string) => { if (calc) app.updateJobs(d => addCalc(d, jobId, calc)); done(); };
  const intoNew = () => {
    if (!calc) return;
    app.updateJobs(d => { const r = createJob(d, name); return addCalc(r.doc, r.job.id, calc); });
    done();
  };
  return (
    <ScrollView style={{ backgroundColor: theme.ground }} contentContainerStyle={{ padding: SPACE.md, gap: SPACE.md, paddingBottom: insets.bottom + SPACE.lg }} keyboardShouldPersistTaps="handled">
      {!calc ? <Txt v="callout" tone="ink2">Nothing to save. Go back and tap Save under a result.</Txt> : (
        <>
          <Card style={{ gap: 4 }}>
            <Txt v="headline">{calc.title}</Txt>
            {calc.lines.slice(0, 3).map((l, i) => <Txt key={i} v="subhead" tone="ink2">{l}</Txt>)}
          </Card>
          <Card style={{ gap: SPACE.sm }}>
            <Txt v="label" tone="ink2">New job</Txt>
            <TextInput value={name} onChangeText={setName} placeholder="Job name or address" placeholderTextColor={theme.ink2} maxLength={60} accessibilityLabel="New job name"
              style={[TYPE.body, { color: theme.ink, minHeight: 56, borderRadius: RADIUS.md, borderWidth: theme.rule, borderColor: theme.line, backgroundColor: theme.field, paddingHorizontal: SPACE.md }]} />
            <Btn title="Save to new job" icon="add" onPress={intoNew} />
          </Card>
          {app.jobs.jobs.length ? (
            <Card pad={false} style={{ paddingHorizontal: SPACE.md }}>
              {app.jobs.jobs.map((j, i) => <Row key={j.id} icon="folder-outline" title={j.name} sub={`${j.items.length} saved`} onPress={() => into(j.id)} last={i === app.jobs.jobs.length - 1} />)}
            </Card>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
