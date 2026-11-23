// PT: saturation temperature from a gauge pressure, or pressure from a temperature. Free in every state.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { glideAt, hasGlide, limits, satPressure, satTemp } from '../../src/core/pt.ts';
import { DELTA_LABEL, PRESSURE_LABEL, TEMP_LABEL, deltaFromK, fmt, parseNum, pressureDecimals, pressureFromKpa, pressureToKpa, tempFromC, tempToC } from '../../src/core/units.ts';
import { usePrefs } from '../../src/state/prefs.ts';
import { useSettings } from '../../src/state/store.ts';
import { usePalette } from '../../src/theme/tokens.ts';
import { Button, Card, NumberField, Readout, Screen, Segmented, Small, Working } from '../../src/ui/kit.tsx';
import { RefrigerantButton } from '../../src/ui/RefrigerantButton.tsx';
import { stashReading } from '../../src/ui/saveStash.ts';

export function SettingsButton() {
  const p = usePalette();
  return (
    <Pressable testID="settings-button" accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8} onPress={() => router.push('/settings')} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="settings-outline" size={28} color={p.text} />
    </Pressable>
  );
}

export default function PtTab() {
  const s = useSettings();
  const pr = usePrefs();
  return <PtScreen key={`${pr.pressure}-${pr.temp}-${s.gauge}`} />;
}

function PtScreen() {
  const s = useSettings();
  const pr = usePrefs();
  const id = s.refrigerant;
  const [mode, setMode] = useState<'p2t' | 't2p'>('p2t');
  const [pIn, setPIn] = useState(pr.pressure === 'psi' ? '118' : pr.pressure === 'bar' ? '8.1' : pr.pressure === 'MPa' ? '0.81' : '810');
  const [tIn, setTIn] = useState(pr.temp === 'F' ? '40' : '5');
  const glide = hasGlide(id);
  const pu = PRESSURE_LABEL[pr.pressure];
  const tu = TEMP_LABEL[pr.temp];
  const suffix = pr.gauge ? '' : ' abs';

  const res = useMemo(() => {
    const lim = limits(id);
    if (mode === 'p2t') {
      const v = parseNum(pIn);
      if (!Number.isFinite(v)) return null;
      const abs = pressureToKpa(v, pr.pressure) + (pr.gauge ? pr.atmKpa : 0);
      const dew = satTemp(id, abs, 'dew');
      const bub = satTemp(id, abs, 'bubble');
      if (dew == null || bub == null) {
        return { error: lim ? `Outside the table: ${fmt(tempFromC(lim.tMin, pr.temp), 0)} to ${fmt(tempFromC(lim.tMax, pr.temp), 0)} ${tu} for ${id}.` : 'No data.' };
      }
      const steps = [
        { label: 'Pressure read', value: `${pIn} ${pu}${pr.gauge ? ' gauge' : ' abs'}` },
        ...(pr.gauge ? [{ label: 'Absolute (+ atmosphere)', value: `${fmt(pressureFromKpa(abs, pr.pressure), pressureDecimals(pr.pressure) + 1)} ${pu} abs` }] : []),
        ...(glide
          ? [
              { label: 'Dew point (saturated vapour)', value: `${fmt(tempFromC(dew, pr.temp), 1)} ${tu}` },
              { label: 'Bubble point (saturated liquid)', value: `${fmt(tempFromC(bub, pr.temp), 1)} ${tu}` },
              { label: 'Glide (dew − bubble)', value: `${fmt(deltaFromK(glideAt(id, abs) ?? 0, pr.temp), 1)} ${DELTA_LABEL[pr.temp]}` },
            ]
          : [{ label: 'Saturation temperature', value: `${fmt(tempFromC(dew, pr.temp), 1)} ${tu}` }]),
      ];
      return { dew: fmt(tempFromC(dew, pr.temp), 1), bub: fmt(tempFromC(bub, pr.temp), 1), glideK: glideAt(id, abs) ?? 0, steps, vacuum: abs < pr.atmKpa };
    }
    const v = parseNum(tIn);
    if (!Number.isFinite(v)) return null;
    const c = tempToC(v, pr.temp);
    const dew = satPressure(id, c, 'dew');
    const bub = satPressure(id, c, 'bubble');
    if (dew == null || bub == null) {
      return { error: lim ? `Outside the table: ${fmt(tempFromC(lim.tMin, pr.temp), 0)} to ${fmt(tempFromC(lim.tMax, pr.temp), 0)} ${tu} for ${id}.` : 'No data.' };
    }
    const show = (kpa: number) => fmt(pressureFromKpa(kpa - (pr.gauge ? pr.atmKpa : 0), pr.pressure), pressureDecimals(pr.pressure));
    const steps = [
      { label: 'Temperature', value: `${tIn} ${tu}` },
      ...(glide
        ? [
            { label: 'Dew pressure', value: `${fmt(pressureFromKpa(dew, pr.pressure), pressureDecimals(pr.pressure) + 1)} ${pu} abs` },
            { label: 'Bubble pressure', value: `${fmt(pressureFromKpa(bub, pr.pressure), pressureDecimals(pr.pressure) + 1)} ${pu} abs` },
          ]
        : [{ label: 'Saturation pressure', value: `${fmt(pressureFromKpa(dew, pr.pressure), pressureDecimals(pr.pressure) + 1)} ${pu} abs` }]),
      ...(pr.gauge ? [{ label: 'Gauge (− atmosphere)', value: `${show(dew)}${glide ? ` / ${show(bub)}` : ''} ${pu}` }] : []),
    ];
    return { dew: show(dew), bub: show(bub), glideK: 0, steps, vacuum: dew < pr.atmKpa };
  }, [id, mode, pIn, tIn, pr.pressure, pr.temp, pr.gauge, pr.atmKpa, glide, pu, tu]);

  const outUnit = mode === 'p2t' ? tu : `${pu}${suffix}`;

  return (
    <Screen title="Pressure ⇄ Temp" subtitle={`Saturation for ${id}${pr.gauge ? ', gauge pressure' : ', absolute pressure'}`} right={<SettingsButton />}>
      <RefrigerantButton />
      <Segmented
        label="Direction"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'p2t', label: 'Pressure → Temp' },
          { value: 't2p', label: 'Temp → Pressure' },
        ]}
      />
      <Card>
        {mode === 'p2t' ? (
          <NumberField testID="pt-pressure" label={`Pressure (${pr.gauge ? 'gauge' : 'abs'})`} value={pIn} onChange={setPIn} unit={`${pu}${suffix}`} step={pr.pressure === 'kPa' ? 10 : pr.pressure === 'psi' ? 1 : 0.1} />
        ) : (
          <NumberField testID="pt-temp" label="Temperature" value={tIn} onChange={setTIn} unit={tu} step={1} />
        )}
      </Card>
      {res && 'error' in res ? (
        <Card><Small>{res.error}</Small></Card>
      ) : res ? (
        <Card>
          {glide ? (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Readout testID="pt-dew" label={mode === 'p2t' ? 'Dew · vapour' : 'Dew pressure'} value={res.dew} unit={outUnit} tone="low" size="mid" caption="Use for superheat" />
              </View>
              <View style={{ flex: 1 }}>
                <Readout testID="pt-bubble" label={mode === 'p2t' ? 'Bubble · liquid' : 'Bubble pressure'} value={res.bub} unit={outUnit} tone="high" size="mid" caption="Use for subcooling" />
              </View>
            </View>
          ) : (
            <Readout testID="pt-sat" label={mode === 'p2t' ? 'Saturation temperature' : 'Saturation pressure'} value={res.dew} unit={outUnit} />
          )}
          {res.vacuum ? <Small>Below atmospheric pressure (in vacuum).</Small> : null}
          <Working steps={res.steps} />
          <Button
            kind="secondary"
            icon="add-circle-outline"
            title="Save to a job"
            onPress={() => {
              stashReading({ kind: 'pt', title: `PT ${id}`, result: glide ? `dew ${res.dew} / bubble ${res.bub} ${outUnit}` : `${res.dew} ${outUnit}`, steps: res.steps });
              router.push('/save');
            }}
          />
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><Button kind="secondary" icon="grid-outline" title="PT chart" onPress={() => router.push('/chart')} /></View>
        <View style={{ flex: 1 }}><Button kind="secondary" icon="information-circle-outline" title="Facts" onPress={() => router.push('/info')} /></View>
      </View>
    </Screen>
  );
}
