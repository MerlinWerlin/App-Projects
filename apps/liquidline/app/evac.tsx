// Evacuation: a tick-off checklist, the vacuum target in the person's unit, and a decay (standing vacuum) test with
// a timer and a reading log. The screen stays awake while the decay timer runs.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { checklistFor, DECAY_LIMIT_MICRON, DECAY_MINUTES, judgeDecay, TARGET_MICRON, type DecayReading } from '../src/core/evac.ts';
import { isFlammable } from '../src/core/refrigerants.ts';
import { fmt, parseNum, VACUUM_LABEL, vacuumFromPa, vacuumToPa } from '../src/core/units.ts';
import { useSettings } from '../src/state/store.ts';
import { FONT, RADIUS, SPACE, TOUCH, usePalette } from '../src/theme/tokens.ts';
import { Gate } from '../src/ui/Gate.tsx';
import { Button, Card, Label, Notice, NumberField, Readout, Screen, Small } from '../src/ui/kit.tsx';
import { stashReading } from '../src/ui/saveStash.ts';

const MICRON_PA = 0.133322368;

export default function EvacScreen() {
  return (
    <Screen tab={false}>
      <Gate what="the evacuation checklist and decay test">
        <Evac />
      </Gate>
    </Screen>
  );
}

function Evac() {
  const p = usePalette();
  const s = useSettings();
  const vu = s.units.vacuum;
  const toU = (micron: number) => vacuumFromPa(micron * MICRON_PA, vu);
  const dec = vu === 'micron' ? 0 : vu === 'Pa' ? 1 : vu === 'mbar' ? 3 : 3;
  const items = checklistFor(isFlammable(s.refrigerant));
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reading, setReading] = useState('');
  const [log, setLog] = useState<DecayReading[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (startAt == null) return;
    void activateKeepAwakeAsync('evac').catch(() => {});
    timer.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      deactivateKeepAwake('evac');
    };
  }, [startAt]);

  const minutes = startAt == null ? 0 : (now - startAt) / 60000;
  const verdict = judgeDecay(log);
  const addReading = () => {
    const v = parseNum(reading);
    if (!Number.isFinite(v) || v < 0) return;
    const micron = vacuumToPa(v, vu) / MICRON_PA;
    if (startAt == null) {
      setStartAt(Date.now());
      setNow(Date.now());
      setLog([{ minute: 0, micron }]);
    } else {
      setLog((l) => [...l, { minute: Math.round(minutes * 10) / 10, micron }]);
    }
    setReading('');
  };
  const doneCount = items.filter((i) => done[i.id]).length;
  const mm = Math.floor(minutes);
  const ss = Math.floor((minutes - mm) * 60);

  return (
    <>
      <Card tone="low">
        <Readout label="Vacuum target" value={fmt(toU(TARGET_MICRON), dec)} unit={VACUUM_LABEL[vu]} tone="low" size="mid" caption={`Then hold ${DECAY_MINUTES} min; it should level off below ${fmt(toU(DECAY_LIMIT_MICRON), dec)} ${VACUUM_LABEL[vu]}. The unit’s manual wins.`} />
      </Card>
      <Card>
        <Label>{`Checklist ${doneCount}/${items.length}`}</Label>
        {items.map((it) => {
          const on = !!done[it.id];
          return (
            <Pressable key={it.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setDone((d) => ({ ...d, [it.id]: !on }))} style={{ flexDirection: 'row', gap: SPACE.md, alignItems: 'flex-start', minHeight: TOUCH, paddingVertical: 6 }}>
              <Ionicons name={on ? 'checkmark-circle' : 'radio-button-off'} size={30} color={on ? p.ok : p.text2} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '600', color: on ? p.text2 : p.text, textDecorationLine: on ? 'line-through' : 'none' }}>{it.text}</Text>
                {it.detail ? <Small>{it.detail}</Small> : null}
              </View>
            </Pressable>
          );
        })}
      </Card>
      <Card tone="low">
        <Label tone="low">Decay test</Label>
        <Small>{startAt == null ? 'Isolate the pump, then log the first reading: the timer starts.' : 'Log a reading every few minutes.'}</Small>
        {startAt != null ? (
          <Text accessibilityLabel={`${mm} minutes ${ss} seconds`} style={{ fontFamily: FONT.display, fontSize: 64, color: p.low }}>{`${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`}</Text>
        ) : null}
        <NumberField testID="evac-reading" tone="low" label="Gauge reading" value={reading} onChange={setReading} unit={VACUUM_LABEL[vu]} step={vu === 'micron' ? 10 : 1} allowNegative={false} />
        <Button testID="evac-log" tone="low" icon="add" title={startAt == null ? 'Log reading and start timer' : 'Log reading'} onPress={addReading} />
        {log.length ? (
          <View style={{ gap: 4, borderRadius: RADIUS.md }}>
            {log.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Small>{`${fmt(r.minute, 1)} min`}</Small>
                <Text style={{ fontSize: 15, fontWeight: '700', color: p.text }}>{`${fmt(toU(r.micron), dec)} ${VACUUM_LABEL[vu]}`}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {log.length ? <Notice kind={verdict.verdict === 'pass' ? 'ok' : verdict.verdict === 'need-more' ? 'info' : 'warn'} text={verdict.text} /> : null}
        {log.length ? (
          <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
            <View style={{ flex: 1 }}><Button kind="secondary" title="Reset" onPress={() => { setStartAt(null); setLog([]); }} /></View>
            <View style={{ flex: 1 }}>
              <Button
                kind="secondary"
                icon="add-circle-outline"
                title="Save to job"
                onPress={() => {
                  stashReading({
                    kind: 'evacuation',
                    title: 'Evacuation decay test',
                    result: verdict.verdict === 'pass' ? 'Passed' : verdict.verdict === 'leak' ? 'Leak suspected' : verdict.verdict === 'moisture' ? 'Moisture suspected' : 'Incomplete',
                    steps: [...log.map((r) => ({ label: `${fmt(r.minute, 1)} min`, value: `${fmt(toU(r.micron), dec)} ${VACUUM_LABEL[vu]}` })), { label: 'Checklist', value: `${doneCount}/${items.length} ticked` }],
                  });
                  router.push('/save');
                }}
              />
            </View>
          </View>
        ) : null}
      </Card>
    </>
  );
}
