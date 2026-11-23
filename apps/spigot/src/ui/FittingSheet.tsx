import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FITTINGS, fittingById, type FittingSpec } from '../calc/reference';
import { takeoff, validFitting } from '../calc/cut';
import { formatLength } from '../calc/units';
import { useApp } from '../state/AppState';
import { Button, Field, FieldLabel, Note, TextBox, readField, useKeypad, useTap, type NumField } from './kit';
import { HIT, font, radius, space, usePalette } from './theme';

export interface ChosenFitting { key: string; name: string; centreToEnd: number; engagement: number; verified: boolean; note?: string }

/** Resolves a saved fitting key ("pvc-100-88bend" or "custom:<id>") to its dimensions. */
export function useResolveFitting() {
  const { fittings } = useApp();
  return (key: string | null): ChosenFitting | null => {
    if (!key) return null;
    if (key.startsWith('custom:')) {
      const f = fittings.find(x => x.id === key.slice(7));
      return f ? { key, name: f.name, centreToEnd: f.centreToEnd, engagement: f.engagement, verified: true, note: 'Your own fitting' } : null;
    }
    const f = fittingById(key);
    return f ? { key, name: `${f.size} ${f.name}`, centreToEnd: f.centreToEnd, engagement: f.engagement, verified: f.verified, note: f.note ?? f.source } : null;
  };
}

const GROUPS = [...new Set(FITTINGS.map(f => f.group))];

export function FittingSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (key: string) => void }) {
  const c = usePalette();
  const app = useApp();
  const insets = useSafeAreaInsets();
  const tap = useTap();
  const u = app.prefs.unit;
  const [group, setGroup] = useState<string>(GROUPS[0]!);
  const [size, setSize] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [c2e, setC2e] = useState('');
  const [eng, setEng] = useState('');
  const sizes = useMemo(() => [...new Set(FITTINGS.filter(f => f.group === group).map(f => f.size))], [group]);
  const list: FittingSpec[] = FITTINGS.filter(f => f.group === group && (size === null || f.size === size));
  const fields: NumField[] = [
    { label: 'Centre to end (face)', text: c2e, setText: setC2e, hint: 'Centre line of the fitting to its mouth' },
    { label: 'Socket depth / thread engagement', text: eng, setText: setEng, hint: 'How far the pipe goes in' },
  ];
  const kp = useKeypad(fields);
  const pc = readField(fields[0]!, u), pe = readField(fields[1]!, u);
  const dims = typeof pc === 'number' && typeof pe === 'number' ? { centreToEnd: pc, engagement: pe } : null;
  const dimErr = dims ? validFitting(dims) : null;

  const pick = (key: string) => { tap(); onPick(key); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.l }}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontSize: 17, color: c.copper, fontWeight: '600' }}>Cancel</Text></Pressable>
          <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '700', color: c.ink }}>Choose fitting</Text>
          <View style={{ width: 56 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: space.l, paddingTop: 0, paddingBottom: insets.bottom + 40, gap: space.l }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: space.s }}>
            <FieldLabel>Your fittings</FieldLabel>
            {app.fittings.map(f => (
              <Pressable key={f.id} accessibilityRole="button" onPress={() => pick(`custom:${f.id}`)}
                onLongPress={() => Alert.alert(f.name, 'Delete this custom fitting?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => app.deleteFitting(f.id) }])}
                style={({ pressed }) => ({ minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.m, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 })}>
                <Ionicons name="star" size={20} color={c.copper} />
                <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: c.ink }}>{f.name}</Text>
                <Text style={{ fontFamily: font.display, fontSize: 20, color: c.ink2 }}>{formatLength(takeoff(f), u)}</Text>
              </Pressable>
            ))}
            {adding ? (
              <View style={{ gap: space.m, padding: space.m, borderRadius: radius.m, backgroundColor: c.surface }}>
                <TextBox label="Name" value={name} onChangeText={setName} placeholder="e.g. DN100 88° bend, Brand X" />
                <Field field={fields[0]!} onOpen={() => kp.openAt(0)} />
                <Field field={fields[1]!} onOpen={() => kp.openAt(1)} error={dimErr} />
                {dims && !dimErr ? <Note>{`Take-off ${formatLength(takeoff(dims), u)}`}</Note> : null}
                <Button label="Save fitting" icon="checkmark" disabled={!dims || !!dimErr || !name.trim()} onPress={() => {
                  if (!dims) return;
                  const f = app.saveFitting({ name, ...dims });
                  setAdding(false); setName(''); setC2e(''); setEng('');
                  pick(`custom:${f.id}`);
                }} />
              </View>
            ) : (
              <Button kind="quiet" icon="add" label="Add your own fitting" onPress={() => setAdding(true)} />
            )}
          </View>

          <View style={{ gap: space.s }}>
            <FieldLabel>Fitting table</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              {GROUPS.map(g => (
                <Pressable key={g} accessibilityRole="radio" accessibilityState={{ selected: g === group }} onPress={() => { tap(); setGroup(g); setSize(null); }}
                  style={{ minHeight: 44, paddingHorizontal: space.m, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: g === group ? c.copper : c.surface2 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: g === group ? c.onCopper : c.ink }}>{g}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              {sizes.map(s => (
                <Pressable key={s} accessibilityRole="radio" accessibilityState={{ selected: s === size }} onPress={() => { tap(); setSize(s === size ? null : s); }}
                  style={{ minHeight: 44, paddingHorizontal: space.m, borderRadius: radius.m, justifyContent: 'center', backgroundColor: s === size ? c.ink : c.surface2 }}>
                  <Text style={{ fontFamily: font.display, fontSize: 18, color: s === size ? c.bg : c.ink }}>{s}</Text>
                </Pressable>
              ))}
            </View>
            {list.map(f => (
              <Pressable key={f.id} accessibilityRole="button" accessibilityLabel={`${f.size} ${f.name}, take-off ${formatLength(takeoff(f), u)}`} onPress={() => pick(f.id)}
                style={({ pressed }) => ({ minHeight: HIT + 4, flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.m, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: c.ink }}>{f.size} {f.name}</Text>
                  <Text style={{ fontSize: 13, color: c.ink3 }}>{`C–E ${formatLength(f.centreToEnd, u)} · socket ${formatLength(f.engagement, u)}${f.verified ? '' : ' · check'}`}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: c.ink3 }}>TAKE-OFF</Text>
                  <Text style={{ fontFamily: font.display, fontSize: 22, color: c.ink }}>{formatLength(takeoff(f), u)}</Text>
                </View>
              </Pressable>
            ))}
            <Note tone="warn">{group === 'PVC DWV' ? 'Iplex figures (AS/NZS 1260). Other brands differ by a few millimetres: check your fitting or the maker’s catalogue.' : group.startsWith('Copper') ? 'US-pattern fittings that fit AU tube of the same OD. Australian AS 3688 fittings can differ: measure yours or add it above.' : 'US NPT malleable fittings with approximate make-up. Australian BSPT fittings can differ: measure yours or add it above.'}</Note>
          </View>
        </ScrollView>
        {kp.element}
      </View>
    </Modal>
  );
}
