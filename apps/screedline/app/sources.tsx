import { ScrollView, View } from 'react-native';
import { SOURCES } from '../src/core/sources';
import { useApp } from '../src/state/AppState';
import { SPACE } from '../src/theme/theme';
import { Card, T } from '../src/ui/kit';

export default function SourcesScreen() {
  const { theme } = useApp();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.ground }} contentContainerStyle={{ padding: SPACE.l, gap: SPACE.m, paddingBottom: SPACE.xxl }}>
      <T>Every formula and default comes from a published source. Defaults you can change (waste, densities, laps) are marked as such in each tool.</T>
      {SOURCES.map(s => (
        <Card key={s.topic} style={{ gap: SPACE.s }}>
          <T kind="label">{s.topic}</T>
          <T kind="small" color={theme.ink}>{s.what}</T>
          <View style={{ gap: 2 }}>{s.refs.map(r => <T key={r} kind="small">• {r}</T>)}</View>
        </Card>
      ))}
      <T kind="small">Screedline gives estimates for ordering and setting out. It is not engineering advice. Your engineer’s drawings, the NCC and Australian Standards, and your supplier’s figures always win.</T>
    </ScrollView>
  );
}
