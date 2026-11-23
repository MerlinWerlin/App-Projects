import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { offsetMultiplier, FITTING_ANGLES } from '../../src/calc/offset';
import { HAZEN_C, MAX_VELOCITY, MIN_GRADES, PIPES, pipeId } from '../../src/calc/reference';
import { area } from '../../src/calc/flow';
import { formatLength } from '../../src/calc/units';
import { useApp } from '../../src/state/AppState';
import { Body, Card, Note, Screen, useTap } from '../../src/ui/kit';
import { HIT, font, space, usePalette } from '../../src/ui/theme';
import { fmtNumber } from '../../src/ui/format';

function Section({ title, children, initiallyOpen }: { title: string; children: React.ReactNode; initiallyOpen?: boolean }) {
  const c = usePalette();
  const tap = useTap();
  const [open, setOpen] = useState(!!initiallyOpen);
  return (
    <Card style={{ padding: 0, gap: 0 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => { tap(); setOpen(o => !o); }} style={{ minHeight: HIT + 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, gap: space.m }}>
        <Text style={{ flex: 1, fontFamily: font.display, fontSize: 24, color: c.ink, textTransform: 'uppercase' }}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={c.ink3} />
      </Pressable>
      {open ? <View style={{ paddingHorizontal: space.l, paddingBottom: space.l, gap: space.s }}>{children}</View> : null}
    </Card>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  const c = usePalette();
  return (
    <View accessibilityRole="list">
      <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: c.ink }}>
        {head.map((h, i) => <Text key={i} style={{ flex: i === 0 ? 1.3 : 1, fontSize: 13, fontWeight: '800', color: c.ink2, textAlign: i === 0 ? 'left' : 'right' }}>{h}</Text>)}
      </View>
      {rows.map((r, j) => (
        <View key={j} accessible accessibilityLabel={r.map((x, i) => `${head[i]} ${x}`).join(', ')} style={{ flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.line }}>
          {r.map((x, i) => <Text key={i} style={{ flex: i === 0 ? 1.3 : 1, fontFamily: i === 0 ? font.display : undefined, fontSize: i === 0 ? 19 : 16, color: c.ink, textAlign: i === 0 ? 'left' : 'right', fontVariant: ['tabular-nums'] }}>{x}</Text>)}
        </View>
      ))}
    </View>
  );
}

export default function Reference() {
  const { prefs } = useApp();
  const u = prefs.unit;
  const lpm = (id: number) => fmtNumber(area(id) * 1000, 3);
  const pipeRows = (material: string) => PIPES.filter(p => p.material === material).map(p => [p.size, formatLength(p.od_mm, u, { decimals: 2 }), formatLength(pipeId(p), u, { decimals: 2 }), lpm(pipeId(p))]);
  return (
    <Screen>
      <Body muted>Quick cards for the van. Typical published values: always check the manufacturer’s data and the current standard.</Body>
      <Section title="Offset multipliers" initiallyOpen>
        <Table head={['Fitting', 'Travel ×', 'Run ×']} rows={FITTING_ANGLES.map(a => [`${a}°`, fmtNumber(offsetMultiplier(a), 3), fmtNumber(a === 90 ? 0 : 1 / Math.tan((a * Math.PI) / 180), 3)])} />
        <Body muted style={{ fontSize: 14 }}>Travel = offset × the multiplier (1 ÷ sin θ). Run = offset × 1 ÷ tan θ.</Body>
      </Section>
      <Section title="Minimum drain grades">
        <Table head={['Drain', 'Min grade', 'Ratio']} rows={MIN_GRADES.map(g => [`DN${g.dn}`, `${g.pct} %`, g.ratio])} />
        {MIN_GRADES.filter(g => g.note).map(g => <Body key={g.dn} muted style={{ fontSize: 14 }}>{`DN${g.dn}: ${g.note}.`}</Body>)}
        <Note tone="warn">From AS/NZS 3500.2:2003, Table 3.2. Check the current edition (2025) and your state’s rules: reduced grades are allowed in some cases.</Note>
      </Section>
      <Section title="Copper tube Type B">
        <Table head={['Size', 'OD', 'Bore', 'L/m']} rows={pipeRows('Copper B')} />
        <Body muted style={{ fontSize: 14 }}>AS 1432 (MM Kembla, Austral Wright). DN15 is 12.70 mm OD; DN18 is 15.88 mm.</Body>
      </Section>
      <Section title="Copper tube Type A">
        <Table head={['Size', 'OD', 'Bore', 'L/m']} rows={pipeRows('Copper A')} />
      </Section>
      <Section title="PVC DWV">
        <Table head={['Size', 'OD', 'Bore', 'L/m']} rows={pipeRows('PVC DWV')} />
        <Body muted style={{ fontSize: 14 }}>AS/NZS 1260, Iplex mean bore. DN100 SN6, DN150 SN4.</Body>
      </Section>
      <Section title="PE-X (SDR 9)">
        <Table head={['Size', 'OD', 'Bore', 'L/m']} rows={pipeRows('PE-X')} />
        <Body muted style={{ fontSize: 14 }}>Reece Auspex figures; bore is the middle of the published range. Other brands differ.</Body>
      </Section>
      <Section title="Steel, AS 1074 Medium">
        <Table head={['Size', 'OD', 'Bore', 'L/m']} rows={pipeRows('Steel')} />
      </Section>
      <Section title="Water velocity limits">
        <Table head={['Service', 'Max']} rows={MAX_VELOCITY.map(v => [v.service, `${v.max} m/s`])} />
        <Body muted style={{ fontSize: 14 }}>Cold water: NCC Volume Three, B1P2 (not over 3.0 m/s for more than 1 % of the peak hour). Heated water: MM Kembla copper guide.</Body>
      </Section>
      <Section title="Hazen–Williams C">
        <Table head={['Pipe', 'C']} rows={Object.entries(HAZEN_C).map(([k, v]) => [k, v])} />
        <Body muted style={{ fontSize: 14 }}>Typical design values. Old or scaled pipe is rougher (lower C), so expect more loss.</Body>
      </Section>
    </Screen>
  );
}
