import React, { useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../src/state/AppState';
import { sortJobs } from '../../src/state/data';
import { Body, Button, Card, Screen, TextBox, useTap } from '../../src/ui/kit';
import { font, radius, space, usePalette } from '../../src/ui/theme';
import { ART } from '../../src/ui/art';
import { SwipeRow } from '../../src/ui/SwipeRow';
import { useCountry } from '../../src/country/useCountry';

export default function JobsTab() {
  const c = usePalette();
  const app = useApp();
  const tap = useTap();
  const [name, setName] = useState('');
  const jobs = sortJobs(app.jobs);
  const country = useCountry();
  const confirmDelete = (id: string, name: string) => Alert.alert(`Delete “${name}”?`, 'The job and everything saved in it will be deleted from this phone. This can’t be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete job', style: 'destructive', onPress: () => app.deleteJob(id) }]);
  const create = () => {
    if (!name.trim()) return;
    const j = app.createJob(name);
    tap('success');
    setName('');
    router.push({ pathname: '/job/[id]', params: { id: j.id } });
  };
  return (
    <Screen>
      <Card>
        <TextBox label="New job" value={name} onChangeText={setName} placeholder="e.g. 14 Smith St, ensuite" />
        <Button label="Create job" icon="add" disabled={!name.trim()} onPress={create} />
      </Card>
      {jobs.length ? jobs.map(j => {
        const n = app.records.filter(r => r.jobId === j.id).length;
        return (
          <SwipeRow key={j.id} label="Delete" onDelete={() => confirmDelete(j.id, j.name)}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${j.name}, ${n} saved`} accessibilityHint="Swipe left to delete" onPress={() => router.push({ pathname: '/job/[id]', params: { id: j.id } })}
            onLongPress={() => confirmDelete(j.id, j.name)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.m, backgroundColor: c.surface, borderRadius: radius.l, padding: space.l, minHeight: 76, borderWidth: c.scheme === 'light' ? 1 : 0, borderColor: c.line, opacity: pressed ? 0.85 : 1 })}>
            <Ionicons name="folder" size={30} color={c.copper} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.display, fontSize: 24, color: c.ink }} numberOfLines={2}>{j.name}</Text>
              <Text style={{ fontSize: 14, color: c.ink3 }}>{n === 1 ? '1 calculation' : `${n} calculations`} · {new Date(j.updatedAt).toLocaleDateString(country.locale, { day: 'numeric', month: 'short' })}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.ink3} />
          </Pressable>
          </SwipeRow>
        );
      }) : (
        <View style={{ alignItems: 'center', gap: space.m, paddingVertical: space.l }}>
          <Image source={ART.jobs} style={{ width: 220, height: 165 }} resizeMode="contain" accessible={false} />
          <Text style={{ fontFamily: font.display, fontSize: 26, color: c.ink }}>NO JOBS YET</Text>
          <Body muted style={{ textAlign: 'center' }}>Make a job for each site, then tap Save to job on any result. Your offsets, cut lists and falls stay together, on this phone only.</Body>
        </View>
      )}
    </Screen>
  );
}
