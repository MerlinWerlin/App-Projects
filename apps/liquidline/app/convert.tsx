// Converter: one number in, every common unit out. Free in every state.
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { fmt, parseNum } from '../src/core/units.ts';
import { RADIUS, SPACE, usePalette } from '../src/theme/tokens.ts';
import { Card, Label, NumberField, Screen, Small } from '../src/ui/kit.tsx';

type Unit = { id: string; label: string; toBase: (v: number) => number; fromBase: (b: number) => number; dp: number };
type Cat = { id: string; title: string; units: Unit[]; note?: string };
const lin = (id: string, label: string, k: number, dp: number, off = 0): Unit => ({ id, label, toBase: (v) => v * k + off, fromBase: (b) => (b - off) / k, dp });

export const CATS: Cat[] = [
  { id: 'p', title: 'Pressure', units: [lin('kPa', 'kPa', 1, 1), lin('bar', 'bar', 100, 3), lin('psi', 'psi', 6.894757293168361, 2), lin('MPa', 'MPa', 1000, 4), lin('inHg', 'inHg', 3.386389, 2), lin('kgcm2', 'kgf/cm²', 98.0665, 3)], note: 'Converts the number only: gauge stays gauge, absolute stays absolute.' },
  { id: 't', title: 'Temperature', units: [lin('C', '°C', 1, 1), { id: 'F', label: '°F', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (b) => (b * 9) / 5 + 32, dp: 1 }, lin('K', 'K', 1, 2, -273.15)] },
  { id: 'dt', title: 'Temp difference', units: [lin('K', 'K (°C difference)', 1, 2), lin('F', '°F difference', 5 / 9, 2)], note: 'Superheat, subcooling, glide, ΔT: no 32° offset.' },
  { id: 'vac', title: 'Vacuum', units: [lin('micron', 'micron', 0.133322368, 0), lin('Pa', 'Pa', 1, 1), lin('mbar', 'mbar', 100, 3), lin('Torr', 'Torr', 133.322368, 3), lin('inHgv', 'inHg abs', 3386.389, 3)] },
  { id: 'cap', title: 'Capacity', units: [lin('kW', 'kW', 1000, 2), lin('W', 'W', 1, 0), lin('BTU', 'BTU/h', 0.29307107017, 0), lin('TR', 'ton (refrig.)', 3516.8528, 2), lin('kcal', 'kcal/h', 1.163, 0)] },
  { id: 'air', title: 'Airflow', units: [lin('Ls', 'L/s', 1, 1), lin('m3h', 'm³/h', 1 / 3.6, 0), lin('cfm', 'CFM', 0.4719474, 0), lin('m3s', 'm³/s', 1000, 3)] },
  { id: 'len', title: 'Length', units: [lin('m', 'm', 1, 2), lin('ft', 'ft', 0.3048, 2), lin('in', 'in', 0.0254, 2), lin('mm', 'mm', 0.001, 1)] },
  { id: 'mass', title: 'Charge', units: [lin('g', 'g', 1, 0), lin('kg', 'kg', 1000, 3), lin('oz', 'oz', 28.349523125, 2), lin('lb', 'lb', 453.59237, 3)] },
  { id: 'rate', title: 'Charge rate', units: [lin('gm', 'g/m', 1, 1), lin('ozft', 'oz/ft', 28.349523125 / 0.3048, 3)] },
  { id: 'tq', title: 'Torque', units: [lin('Nm', 'N·m', 1, 1), lin('ftlb', 'ft·lb', 1.3558179483, 1), lin('inlb', 'in·lb', 0.112984829, 0)] },
];

export default function ConvertScreen() {
  const p = usePalette();
  const [cat, setCat] = useState(CATS[0]);
  const [from, setFrom] = useState(CATS[0].units[0]);
  const [v, setV] = useState('100');
  const n = parseNum(v);
  const base = Number.isFinite(n) ? from.toBase(n) : NaN;
  return (
    <Screen tab={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.sm }}>
        {CATS.map((c) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected: c.id === cat.id }} onPress={() => { setCat(c); setFrom(c.units[0]); }} style={{ minHeight: 48, paddingHorizontal: SPACE.lg, borderRadius: 999, justifyContent: 'center', backgroundColor: c.id === cat.id ? p.accent : p.surface2 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.id === cat.id ? p.onAccent : p.text }}>{c.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Card>
        <NumberField label={`${cat.title} in ${from.label}`} value={v} onChange={setV} unit={from.label} step={1} />
        <Label>From unit</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
          {cat.units.map((u) => (
            <Pressable key={u.id} accessibilityRole="button" accessibilityState={{ selected: u.id === from.id }} onPress={() => setFrom(u)} style={{ minHeight: 48, paddingHorizontal: SPACE.md, borderRadius: RADIUS.md, justifyContent: 'center', borderWidth: 2, borderColor: u.id === from.id ? p.text : p.line }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: p.text }}>{u.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card>
        {cat.units.filter((u) => u.id !== from.id).map((u, i) => (
          <View key={u.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: SPACE.sm, borderTopWidth: i ? 1 : 0, borderTopColor: p.line }}>
            <Text style={{ fontSize: 17, color: p.text2 }}>{u.label}</Text>
            <Text selectable style={{ fontSize: 28, fontWeight: '800', color: p.text }}>{fmt(u.fromBase(base), u.dp)}</Text>
          </View>
        ))}
        {cat.note ? <Small>{cat.note}</Small> : null}
      </Card>
    </Screen>
  );
}
