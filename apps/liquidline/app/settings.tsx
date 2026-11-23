import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import { countryFromRegion, withCountry } from '../src/core/settings.ts';
import { fmt, parseNum, pressureDecimals, pressureFromKpa, PRESSURE_LABEL, type LengthUnit, type MassUnit, type PressureUnit, type TempUnit, type VacuumUnit } from '../src/core/units.ts';
import { usePrefs, useCountry } from '../src/state/prefs.ts';
import { deviceRegion, updateSettings, useSettings } from '../src/state/store.ts';
import { usePalette } from '../src/theme/tokens.ts';
import { CountryList } from '../src/ui/CountryList.tsx';
import { Body, Button, Card, Label, NumberField, Row, Screen, Segmented, Small } from '../src/ui/kit.tsx';
import { Paywall, SUPPORT_URL } from '../src/ui/Paywall.tsx';

export default function SettingsScreen() {
  const s = useSettings();
  const c = useCountry();
  const pr = usePrefs();
  const p = usePalette();
  const [pickCountry, setPickCountry] = useState(false);
  const ft = s.units.length === 'ft';
  const [alt, setAlt] = useState(String(Math.round(ft ? s.altitudeM / 0.3048 : s.altitudeM)));
  const setUnit = (k: keyof typeof s.units, v: string) => updateSettings({ units: { ...s.units, [k]: v } });
  return (
    <Screen tab={false}>
      <Card>
        <Label>Country</Label>
        <Row testID="settings-country" icon="globe-outline" title={c.name} detail={c.guided ? 'Units, refrigerants, rules and stocked sizes' : 'Generic metric guidance'} onPress={() => setPickCountry(!pickCountry)} last />
        {pickCountry ? (
          <>
            <CountryList value={s.country} detected={countryFromRegion(deviceRegion())} onPick={(code) => { updateSettings((cur) => withCountry(cur, code)); setPickCountry(false); }} />
            <Small>Changing country resets units to that country’s usual ones.</Small>
          </>
        ) : null}
      </Card>
      <Card>
        <Label>Units</Label>
        <Segmented<PressureUnit> label="Pressure unit" value={s.units.pressure} onChange={(v) => setUnit('pressure', v)} options={[{ value: 'kPa', label: 'kPa' }, { value: 'bar', label: 'bar' }, { value: 'psi', label: 'psi' }, { value: 'MPa', label: 'MPa' }]} />
        <Segmented<TempUnit> label="Temperature unit" value={s.units.temp} onChange={(v) => setUnit('temp', v)} options={[{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }]} />
        <Segmented<LengthUnit> label="Length unit" value={s.units.length} onChange={(v) => setUnit('length', v)} options={[{ value: 'm', label: 'metres' }, { value: 'ft', label: 'feet' }]} />
        <Segmented<MassUnit> label="Charge unit" value={s.units.mass} onChange={(v) => setUnit('mass', v)} options={[{ value: 'g', label: 'grams' }, { value: 'oz', label: 'ounces' }]} />
        <Segmented<VacuumUnit> label="Vacuum unit" value={s.units.vacuum} onChange={(v) => setUnit('vacuum', v)} options={[{ value: 'micron', label: 'micron' }, { value: 'Pa', label: 'Pa' }, { value: 'mbar', label: 'mbar' }, { value: 'Torr', label: 'Torr' }]} />
      </Card>
      <Card>
        <Label>Pressure readings</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
          <View style={{ flex: 1 }}>
            <Body>Gauge pressure</Body>
            <Small>{s.gauge ? 'Readings are gauge (what your manifold shows). Atmosphere is added for the tables.' : 'Readings are absolute.'}</Small>
          </View>
          <Switch accessibilityLabel="Gauge pressure" value={s.gauge} onValueChange={(gauge) => updateSettings({ gauge })} trackColor={{ true: p.low, false: p.line }} />
        </View>
        <NumberField
          label="Site altitude"
          value={alt}
          onChange={(v) => { setAlt(v); const n = parseNum(v); if (Number.isFinite(n)) updateSettings({ altitudeM: Math.max(-500, Math.min(6000, ft ? n * 0.3048 : n)) }); }}
          unit={ft ? 'ft' : 'm'}
          step={ft ? 500 : 100}
          hint={`Atmosphere used: ${fmt(pressureFromKpa(pr.atmKpa, pr.pressure), pressureDecimals(pr.pressure) + 1)} ${PRESSURE_LABEL[pr.pressure]} abs. Leave 0 near sea level.`}
        />
      </Card>
      <Paywall />
      <Card>
        <Label>About</Label>
        <Row icon="shield-checkmark-outline" title={`Rules and sources for ${c.name}`} onPress={() => router.push('/sources')} />
        <Row icon="help-buoy-outline" title="Support" onPress={() => void Linking.openURL(SUPPORT_URL).catch(() => {})} last />
        <Small>{`Liquidline ${Constants.expoConfig?.version ?? ''}. An aid for licensed technicians: the manufacturer’s data and local regulations take precedence. No account, no ads, no tracking; jobs stay on this iPhone.`}</Small>
      </Card>
      <Button kind="plain" title="Show the welcome screens again" onPress={() => { updateSettings({ onboarded: false }); router.replace('/onboarding'); }} />
    </Screen>
  );
}
