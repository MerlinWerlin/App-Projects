/** Voltage drop: mV/A·m (AS/NZS 3008 method, user-entered value) or a physics estimate from conductor size. */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { fmt, parseNum } from '../../src/core/num.ts';
import { longUnit, toMetres } from '../../src/core/units.ts';
import { NOMINAL_V, SIZES_MM2, vdropMv, vdropPhysics, type Metal, type Phase } from '../../src/core/vdrop.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { RADIUS, SPACE } from '../../src/theme/theme.ts';
import { FieldRow, Locked, NumField, Picks, Result, Screen, Toggle, Txt } from '../../src/ui/kit.tsx';
import { useSave } from '../../src/ui/useSave.ts';
import { CAPTURE, DEMO } from '../../src/capture.ts';

type Method = 'mv' | 'physics';

export default function Drop() {
  const app = useApp();
  const { prefs, theme } = app;
  const save = useSave();
  const [method, setMethod] = useState<Method>(CAPTURE ? 'physics' : 'mv');
  const [phase, setPhase] = useState<Phase>('single');
  const [metal, setMetal] = useState<Metal>('cu');
  const [f, setF] = useState<Record<string, string>>(CAPTURE ? DEMO.drop : { temp: '75', pf: '1' });
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const opt = (k: string) => (f[k]?.trim() ? parseNum(f[k]) : null);
  const lu = longUnit(prefs.units);

  const r = useMemo(() => {
    const common = {
      current: parseNum(f.current),
      length: toMetres(parseNum(f.length), prefs.units),
      phase,
      voltage: opt('volts') ?? NOMINAL_V[phase],
      limitPct: opt('limit') ?? prefs.vdLimit,
    };
    return method === 'mv'
      ? vdropMv({ ...common, mvPerAm: parseNum(f.mv) })
      : vdropPhysics({ ...common, metal, area: parseNum(f.area), tempC: opt('temp') ?? 75, pf: opt('pf') ?? 1, reactance: opt('x') ?? 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, phase, metal, f, prefs.units, prefs.vdLimit]);

  const maxLen = r.ok ? (prefs.units === 'metric' ? r.value.maxLength : r.value.maxLength / 0.3048) : 0;
  const answers = r.ok ? [
    { label: 'Voltage drop', value: `${fmt(r.value.vd, 2)} V  ·  ${fmt(r.value.pct, 2)} %` },
    { label: 'At the load', value: `${fmt(r.value.vEnd, 1)} V` },
    { label: `Max run at ${fmt(r.value.limitPct, 1)} %`, value: `${fmt(maxLen, 0)} ${lu}` },
    ...(method === 'physics' ? [{ label: 'Equivalent', value: `${fmt(r.value.mvPerAm, 2)} mV/A·m` }] : []),
    ...(method === 'physics' && r.value.minSize !== undefined ? [{ label: 'Smallest size (V-drop only)', value: r.value.minSize == null ? 'None listed' : `${r.value.minSize} mm²` }] : []),
  ] : [];

  return (
    <Screen title="Voltage drop" sub="Over a cable run">
      {!app.can('vdrop') ? <Locked what="Voltage drop" /> : (
        <>
          <Toggle label="Method" value={method} onChange={setMethod} options={[{ id: 'mv', label: 'mV/A·m' }, { id: 'physics', label: 'From size' }]} />
          <Toggle label="Supply" value={phase} onChange={setPhase} options={[{ id: 'single', label: 'Single-phase' }, { id: 'three', label: 'Three-phase' }]} />
          <FieldRow>
            <NumField label="Load current" value={f.current ?? ''} onChange={set('current')} unit="A" />
            <NumField label="Route length" value={f.length ?? ''} onChange={set('length')} unit={lu} hint="One way, along the cable." />
          </FieldRow>
          {method === 'mv' ? (
            <>
              <NumField label={`Cable mV/A·m (${phase === 'single' ? 'single' : 'three'}-phase)`} value={f.mv ?? ''} onChange={set('mv')} unit="mV/A·m"
                hint="From AS/NZS 3008 or the cable maker, for this size, installation and conductor temperature." />
            </>
          ) : (
            <>
              <Toggle label="Conductor" value={metal} onChange={setMetal} options={[{ id: 'cu', label: 'Copper' }, { id: 'al', label: 'Aluminium' }]} />
              <NumField label="Conductor size" value={f.area ?? ''} onChange={set('area')} unit="mm²" />
              <Picks values={SIZES_MM2.slice(1, 12)} current={f.area ?? ''} onPick={set('area')} />
              <FieldRow>
                <NumField label="Conductor temp" value={f.temp ?? ''} onChange={set('temp')} unit="°C" hint="75 °C is typical for V-90 at full load." />
                <NumField label="Power factor" value={f.pf ?? ''} onChange={set('pf')} />
              </FieldRow>
              <NumField label="Reactance" value={f.x ?? ''} onChange={set('x')} unit="mΩ/m" optional hint="From the cable data. Matters from 16 mm² up." />
            </>
          )}
          <FieldRow>
            <NumField label="Nominal voltage" value={f.volts ?? ''} onChange={set('volts')} placeholder={String(NOMINAL_V[phase])} unit="V" optional />
            <NumField label="Drop allowed" value={f.limit ?? ''} onChange={set('limit')} placeholder={fmt(prefs.vdLimit)} unit="%" optional />
          </FieldRow>
          <Result
            error={r.ok ? null : r.error}
            answers={answers}
            status={r.ok ? (r.value.pass ? 'pass' : 'fail') : undefined}
            statusText={r.ok ? (r.value.pass ? `Inside ${fmt(r.value.limitPct, 1)} %` : `Over ${fmt(r.value.limitPct, 1)} %`) : undefined}
            steps={r.ok ? r.steps : []}
            warnings={r.ok ? r.warnings : []}
            onSave={r.ok ? () => save({ kind: 'vdrop', title: `Voltage drop (${phase === 'single' ? '1φ' : '3φ'})`, lines: [`${f.current} A over ${f.length} ${lu}`, ...answers.map(a => `${a.label}: ${a.value}`)], steps: r.steps }) : undefined}
          >
            {r.ok ? <Bar pct={r.value.pct} limit={r.value.limitPct} pass={r.value.pass} track={theme.card2} line={theme.line} ok={theme.pass} bad={theme.fail} ink={theme.ink2} /> : null}
          </Result>
          <Txt v="footnote" tone="ink2">AS/NZS 3000 limits the drop from the point of supply to any point to 5 % unless otherwise allowed. Mains and submains use part of it, so set the drop allowed for this circuit. Change the default in Settings.</Txt>
        </>
      )}
    </Screen>
  );
}

function Bar({ pct, limit, pass, track, line, ok, bad, ink }: { pct: number; limit: number; pass: boolean; track: string; line: string; ok: string; bad: string; ink: string }) {
  const scale = Math.max(limit * 1.5, pct * 1.05);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 4 }}>
      <View style={{ height: 14, borderRadius: RADIUS.pill, backgroundColor: track, overflow: 'hidden', borderWidth: 1, borderColor: line }}>
        <View style={{ width: `${Math.min(100, (pct / scale) * 100)}%`, height: '100%', backgroundColor: pass ? ok : bad }} />
        <View style={{ position: 'absolute', left: `${(limit / scale) * 100}%`, top: -2, bottom: -2, width: 3, backgroundColor: ink }} />
      </View>
      <Txt v="footnote" tone="ink2">Limit marker at {fmt(limit, 1)} %</Txt>
    </View>
  );
}
