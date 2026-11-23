import { useState } from 'react';
import { Switch, View } from 'react-native';
import { parseNum } from '../src/core/num.ts';
import { useApp, type ThemePref, type Units } from '../src/state/AppState.tsx';
import { SPACE } from '../src/theme/theme.ts';
import { Card, NumField, Screen, SectionLabel, Toggle, Txt } from '../src/ui/kit.tsx';

export default function Settings() {
  const { prefs, setPrefs, theme } = useApp();
  const [lim, setLim] = useState(String(prefs.vdLimit));
  return (
    <Screen pushed title="Settings">
      <SectionLabel>Units</SectionLabel>
      <Toggle<Units> label="Units" value={prefs.units} onChange={units => setPrefs({ units })} options={[{ id: 'metric', label: 'Metric (mm, m)' }, { id: 'imperial', label: 'Imperial (in, ft)' }]} />
      <Txt v="footnote" tone="ink2">Bending in mm or inches (to 1/16"), runs in metres or feet. Cable sizes stay in mm².</Txt>
      <SectionLabel>Look</SectionLabel>
      <Toggle<ThemePref> label="Appearance" value={prefs.theme} onChange={t => setPrefs({ theme: t })} options={[{ id: 'system', label: 'Auto' }, { id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }, { id: 'sunlight', label: 'Sunlight' }]} />
      <Txt v="footnote" tone="ink2">Sunlight is pure black on white with heavy outlines, for reading outside.</Txt>
      <SectionLabel>Voltage drop</SectionLabel>
      <NumField label="Default drop allowed" value={lim} onChange={v => { setLim(v); const n = parseNum(v); if (n != null && n > 0 && n < 100) setPrefs({ vdLimit: n }); }} unit="%" hint="5 % is the AS/NZS 3000 limit from the point of supply. Use less for a final subcircuit if the mains use part of it." />
      <SectionLabel>Feel</SectionLabel>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 48 }}>
          <Txt v="headline" style={{ flex: 1 }}>Haptics</Txt>
          <Switch value={prefs.haptics} onValueChange={haptics => setPrefs({ haptics })} trackColor={{ true: theme.accent, false: theme.line }} accessibilityLabel="Haptics" />
        </View>
      </Card>
      <Txt v="footnote" tone="ink2">Wattle has no account, no ads and no tracking. Jobs and settings stay on this iPhone.</Txt>
    </Screen>
  );
}
