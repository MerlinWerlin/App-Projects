import { useRouter } from 'expo-router';
import { useApp } from '../../src/state/AppState.tsx';
import { trialDaysText } from '../../src/plus/trial.ts';
import { Card, Row, Screen, SectionLabel } from '../../src/ui/kit.tsx';

export default function Tools() {
  const router = useRouter();
  const { tier, trial, jobs } = useApp();
  const days = tier === 'full' ? null : trialDaysText(trial);
  const n = jobs.jobs.length;
  return (
    <Screen title="Tools" sub="Runs, conversions and saved jobs">
      <Card pad={false} style={{ paddingHorizontal: 16 }}>
        <Row icon="git-network-outline" title="Cable runs & drums" sub="Total cable, cut plan and offcuts" onPress={() => router.push('/runs')} />
        <Row icon="swap-horizontal-outline" title="Converter" sub="mm² ↔ AWG, m ↔ ft, kW ↔ hp, kVA ↔ A" onPress={() => router.push('/convert')} />
        <Row icon="folder-open-outline" title="Jobs" sub={n ? `${n} saved job${n === 1 ? '' : 's'} on this iPhone` : 'Save calculations by job'} onPress={() => router.push('/jobs')} last />
      </Card>
      <SectionLabel>Wattle</SectionLabel>
      <Card pad={false} style={{ paddingHorizontal: 16 }}>
        <Row icon="flash-outline" title={tier === 'full' ? 'Full Unlock: thank you' : 'Full Unlock'} sub={tier === 'full' ? 'Every calculator is unlocked on this Apple Account' : days ?? '7-day free trial, then one payment. No subscription.'} onPress={() => router.push('/unlock')} />
        <Row icon="settings-outline" title="Settings" sub="Units, Sunlight mode, voltage-drop limit" onPress={() => router.push('/settings')} />
        <Row icon="shield-checkmark-outline" title="Safety & sources" sub="Where every formula comes from" onPress={() => router.push('/about')} last />
      </Card>
    </Screen>
  );
}
