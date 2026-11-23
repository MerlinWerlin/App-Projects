import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useApp } from '../../src/state/AppState';
import type { Values } from '../../src/tools/registry';
import { T } from '../../src/ui/kit';
import { ToolView } from '../../src/ui/ToolView';

export default function ToolScreen() {
  const { id, prefill, job } = useLocalSearchParams<{ id: string; prefill?: string; job?: string }>();
  const { theme, tools, country } = useApp();
  const tool = tools.find(t => t.id === String(id));
  const values = useMemo<Values | undefined>(() => {
    if (!prefill) return undefined;
    try { return JSON.parse(String(prefill)) as Values; } catch { return undefined; }
  }, [prefill]);
  if (!tool || !tool.run) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.ground, padding: 24 }}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <T>That tool isn’t in this version.</T>
      </View>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: tool.title }} />
      <ToolView key={`${country.code}:${tool.id}:${prefill ?? ''}`} tool={tool} prefill={values} jobContext={job ? String(job) : undefined} />
    </>
  );
}
