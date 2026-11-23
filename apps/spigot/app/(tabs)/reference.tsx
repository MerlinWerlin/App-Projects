import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { offsetMultiplier, FITTING_ANGLES } from '../../src/calc/offset';
import { HAZEN_C, pipeId } from '../../src/calc/reference';
import { useCountry } from '../../src/country/useCountry';
import { trim } from '../../src/calc/fall';
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
  const country = useCountry();
  const PIPES = country.pipes;
  const materials = [...new Set(PIPES.map(p => p.material))];
  const u = prefs.unit;
  const lpm = (id: number) => fmtNumber(area(id) * 1000, 3);
  const pipeRows = (material: string) => PIPES.filter(p => p.material === material).map(p => [p.size, formatLength(p.od_mm, u, { decimals: 2 }), formatLength(pipeId(p), u, { decimals: 2 }), lpm(pipeId(p))]);
  return (
    <Screen>
      <Body muted>{`Quick cards for ${country.code === 'OTHER' ? 'the van' : country.name}. Typical published values: always check the manufacturer’s data and ${country.codeName}.`}</Body>
      <Section title="Offset multipliers" initiallyOpen>
        <Table head={['Fitting', 'Travel ×', 'Run ×']} rows={FITTING_ANGLES.map(a => [`${a}°`, fmtNumber(offsetMultiplier(a), 3), fmtNumber(a === 90 ? 0 : 1 / Math.tan((a * Math.PI) / 180), 3)])} />
        <Body muted style={{ fontSize: 14 }}>Travel = offset × the multiplier (1 ÷ sin θ). Run = offset × 1 ÷ tan θ.</Body>
      </Section>
      <Section title={`Minimum drain ${country.terms.fallLower}s`}>
        {country.minGrades ? (
          <>
            <Table head={['Drain', 'Ratio', 'Percent']} rows={country.minGrades.rules.map(g => [g.size, `1:${trim(g.n)}`, `${fmtNumber(100 / g.n, 2)} %`])} />
            {country.minGrades.rules.filter(g => g.note).map(g => <Body key={g.size} muted style={{ fontSize: 14 }}>{`${g.size}: ${g.note}.`}</Body>)}
            <Note tone="warn">{country.minGrades.source}</Note>
          </>
        ) : <Note>Minimum grades depend on your local code and pipe size. Spigot couldn’t verify them for your country, so it doesn’t show any: check your code.</Note>}
      </Section>
      {materials.map(m => (
        <Section key={m} title={m}>
          <Table head={['Size', 'OD', 'Bore', 'L/m']} rows={pipeRows(m)} />
          <Body muted style={{ fontSize: 14 }}>{PIPES.find(p => p.material === m)?.note}</Body>
        </Section>
      ))}
      {!country.materialsVerified ? <Note>{country.materialsNote}</Note> : null}
      <Section title="Water velocity limits">
        {country.maxVelocity ? (
          <>
            <Table head={['Service', 'Max']} rows={country.maxVelocity.rules.map(v => [v.service, `${v.max} m/s`])} />
            <Body muted style={{ fontSize: 14 }}>{country.maxVelocity.source}</Body>
          </>
        ) : <Note>Spigot couldn’t verify a velocity limit for your country. Around 3 m/s is a common upper limit for water services; check your local code.</Note>}
      </Section>
      <Section title="Hazen–Williams C">
        <Table head={['Pipe', 'C']} rows={Object.entries(HAZEN_C).map(([k, v]) => [k, v])} />
        <Body muted style={{ fontSize: 14 }}>Typical design values. Old or scaled pipe is rougher (lower C), so expect more loss.</Body>
      </Section>
    </Screen>
  );
}
