/** Conduit bending: offset, 3-point saddle, 4-point saddle, kick, 90° stub-up. */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { OFFSET_ANGLES, kick, offset, saddle3, saddle4, stub90 } from '../../src/core/bending.ts';
import { fmt, parseNum } from '../../src/core/num.ts';
import { fmtShort, shortUnit } from '../../src/core/units.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { SPACE } from '../../src/theme/theme.ts';
import { BendDiagram, type BendKind } from '../../src/ui/BendDiagram.tsx';
import { Btn, Card, FieldRow, IconBtn, Locked, NumField, Picks, Result, Segmented, Screen, Txt, type Answer } from '../../src/ui/kit.tsx';
import { useSave } from '../../src/ui/useSave.ts';
import { CAPTURE, DEMO } from '../../src/capture.ts';

const MODES: { id: BendKind; label: string }[] = [
  { id: 'offset', label: 'Offset' },
  { id: 'saddle3', label: '3-pt saddle' },
  { id: 'saddle4', label: '4-pt saddle' },
  { id: 'kick', label: 'Kick' },
  { id: 'stub90', label: '90° stub' },
];
const TITLES: Record<BendKind, string> = { offset: 'Offset', saddle3: '3-point saddle', saddle4: '4-point saddle', kick: 'Kick', stub90: '90° stub-up' };

export default function Bend() {
  const app = useApp();
  const { prefs } = app;
  const router = useRouter();
  const save = useSave();
  const [mode, setMode] = useState<BendKind>('offset');
  const [f, setF] = useState<Record<string, string>>(CAPTURE ? DEMO.bend : { angle: '30', centre: '45', angle4: '45' });
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const u = prefs.units;
  const unit = shortUnit(u);
  const L = (n: number) => fmtShort(n, u);
  const n = (k: string) => parseNum(f[k]);
  const opt = (k: string) => (f[k]?.trim() ? parseNum(f[k]) : null);

  const out = useMemo(() => {
    if (mode === 'offset') {
      const r = offset({ rise: n('rise'), angle: n('angle'), toObstacle: opt('to') }, L);
      if (!r.ok) return { error: r.error };
      const a: Answer[] = [{ label: 'Distance between marks', value: L(r.value.distance) }, { label: 'Shrink', value: L(r.value.shrink) }, { label: 'Multiplier', value: fmt(r.value.multiplier, 3) }];
      if (r.value.firstMark != null) a.push({ label: 'Mark 1 from end', value: L(r.value.firstMark) }, { label: 'Mark 2 from end', value: L(r.value.secondMark!) });
      return { answers: a, steps: r.steps, warnings: r.warnings };
    }
    if (mode === 'saddle3') {
      const r = saddle3({ height: n('height'), centreAngle: n('centre'), toCentre: opt('to') }, L);
      if (!r.ok) return { error: r.error };
      const a: Answer[] = [{ label: 'Outer marks from centre', value: L(r.value.sideDistance) }, { label: 'Move centre mark', value: L(r.value.centreAdvance) }, { label: 'Bends', value: `${fmt(r.value.sideAngle, 1)}° · ${fmt(r.value.centreAngle, 1)}° · ${fmt(r.value.sideAngle, 1)}°` }, { label: 'Total shrink', value: L(r.value.shrink) }];
      if (r.value.centreMark != null) a.push({ label: 'Mark 1', value: L(r.value.firstMark!) }, { label: 'Mark 2 (centre)', value: L(r.value.centreMark) }, { label: 'Mark 3', value: L(r.value.thirdMark!) });
      return { answers: a, steps: r.steps, warnings: r.warnings };
    }
    if (mode === 'saddle4') {
      const r = saddle4({ height: n('height'), width: n('width'), toObstacle: n('to4'), angle: n('angle4') }, L);
      if (!r.ok) return { error: r.error };
      const m = r.value.marks;
      return { answers: [{ label: 'Between bends', value: L(r.value.distance) }, { label: 'Mark 1', value: L(m[0]) }, { label: 'Mark 2', value: L(m[1]) }, { label: 'Mark 3', value: L(m[2]) }, { label: 'Mark 4', value: L(m[3]) }, { label: 'Total shrink', value: L(r.value.shrinkTotal) }], steps: r.steps, warnings: r.warnings };
    }
    if (mode === 'kick') {
      const r = kick({ rise: n('kRise'), angle: opt('kAngle'), run: opt('kRun') }, L);
      if (!r.ok) return { error: r.error };
      return { answers: [{ label: 'Bend angle', value: `${fmt(r.value.angle, 1)}°` }, { label: 'Along the conduit', value: L(r.value.travel) }, { label: 'Horizontal run', value: L(r.value.run) }], steps: r.steps, warnings: r.warnings };
    }
    const r = stub90({ height: n('stub'), takeUp: n('take'), radius: opt('radius') }, L);
    if (!r.ok) return { error: r.error };
    const a: Answer[] = [{ label: 'Mark from end', value: L(r.value.mark) }];
    if (r.value.gain != null) a.push({ label: 'Developed length', value: L(r.value.developed!) }, { label: 'Gain', value: L(r.value.gain) });
    return { answers: a, steps: r.steps, warnings: r.warnings };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, f, u]);

  // Offsets are free for everyone; saddles, kicks and stubs need the Full Unlock or the trial.
  const locked = mode !== 'offset' && !app.can('bend');
  return (
    <Screen title="Bend" sub="Conduit bending marks" right={<IconBtn icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}>
      {!prefs.noticeSeen ? (
        <Card style={{ gap: SPACE.sm, borderColor: app.theme.accent, borderWidth: 2 }}>
          <Txt v="headline">Made for licensed electricians</Txt>
          <Txt v="subhead" tone="ink2">Wattle is a calculation aid. It doesn’t replace AS/NZS 3000, AS/NZS 3008, the manufacturer’s data or a qualified design, and it isn’t instructions for doing electrical work. Electrical work in Australia must be done by a licensed electrician.</Txt>
          <View style={{ flexDirection: 'row', gap: SPACE.sm, flexWrap: 'wrap' }}>
            <Btn title="Got it" onPress={() => app.setPrefs({ noticeSeen: true })} style={{ flexGrow: 1 }} />
            <Btn title="Sources" kind="secondary" onPress={() => router.push('/about')} style={{ flexGrow: 1 }} />
          </View>
        </Card>
      ) : null}
      <Segmented options={MODES} value={mode} onChange={setMode} label="Bend type" />
      {locked ? <Locked what={TITLES[mode]} /> : (
        <>
          <Card pad={false} style={{ paddingVertical: SPACE.xs }}>
            <BendDiagram kind={mode} label={`${TITLES[mode]} diagram with numbered bend marks`} />
          </Card>
          {mode === 'offset' ? (
            <>
              <FieldRow>
                <NumField label="Offset depth (rise)" value={f.rise ?? ''} onChange={set('rise')} unit={unit} />
                <NumField label="Bend angle" value={f.angle ?? ''} onChange={set('angle')} unit="°" />
              </FieldRow>
              <Picks values={OFFSET_ANGLES} current={f.angle ?? ''} onPick={set('angle')} suffix="°" />
              <NumField label="End of conduit to obstacle" value={f.to ?? ''} onChange={set('to')} unit={unit} optional hint="Add this to get both marks measured from the end." />
            </>
          ) : null}
          {mode === 'saddle3' ? (
            <>
              <FieldRow>
                <NumField label="Obstacle height" value={f.height ?? ''} onChange={set('height')} unit={unit} />
                <NumField label="Centre bend" value={f.centre ?? ''} onChange={set('centre')} unit="°" />
              </FieldRow>
              <Picks values={[45, 60]} current={f.centre ?? ''} onPick={set('centre')} suffix="°" />
              <NumField label="End of conduit to obstacle centre" value={f.to ?? ''} onChange={set('to')} unit={unit} optional />
            </>
          ) : null}
          {mode === 'saddle4' ? (
            <>
              <FieldRow>
                <NumField label="Obstacle height" value={f.height ?? ''} onChange={set('height')} unit={unit} />
                <NumField label="Obstacle width" value={f.width ?? ''} onChange={set('width')} unit={unit} />
              </FieldRow>
              <FieldRow>
                <NumField label="End to near edge" value={f.to4 ?? ''} onChange={set('to4')} unit={unit} />
                <NumField label="Bend angle" value={f.angle4 ?? ''} onChange={set('angle4')} unit="°" />
              </FieldRow>
              <Picks values={[22.5, 30, 45]} current={f.angle4 ?? ''} onPick={set('angle4')} suffix="°" />
            </>
          ) : null}
          {mode === 'kick' ? (
            <>
              <NumField label="Kick rise" value={f.kRise ?? ''} onChange={set('kRise')} unit={unit} />
              <FieldRow>
                <NumField label="Bend angle" value={f.kAngle ?? ''} onChange={set('kAngle')} unit="°" hint="Or leave blank and give the run." />
                <NumField label="Over a run of" value={f.kRun ?? ''} onChange={set('kRun')} unit={unit} optional />
              </FieldRow>
            </>
          ) : null}
          {mode === 'stub90' ? (
            <>
              <FieldRow>
                <NumField label="Stub height" value={f.stub ?? ''} onChange={set('stub')} unit={unit} hint="End of conduit to the back of the 90°." />
                <NumField label="Bender take-up" value={f.take ?? ''} onChange={set('take')} unit={unit} hint="Printed on your bender for this size." />
              </FieldRow>
              <NumField label="Centreline bend radius" value={f.radius ?? ''} onChange={set('radius')} unit={unit} optional hint="Shows developed length and gain." />
            </>
          ) : null}
          <Result {...out} onSave={'answers' in out ? () => save({ kind: mode, title: TITLES[mode], lines: out.answers!.map(a => `${a.label}: ${a.value}`), steps: out.steps ?? [] }) : undefined} />
        </>
      )}
    </Screen>
  );
}
