import { Text, View } from 'react-native';
import { arcFromChord } from '../src/core/arc.ts';
import { useSettings } from '../src/state/settings.tsx';
import { fonts, space, useTheme } from '../src/theme/theme.ts';
import { ArcDiagram } from '../src/ui/diagrams.tsx';
import { Blade, Card, Checks, ErrorCard, Field, H, P, Stepper, StepsCard, useReaders } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';
import { useFine } from '../src/ui/useFine.ts';

export default function Arc() {
  const t = useTheme();
  const { fmt } = useSettings();
  const fine = useFine();
  const r = useReaders();
  const { vals, set } = useToolInputs('arc', (d) => ({ chord: d.len(1200), rise: d.len(200), div: '8' }));
  const div = Math.round(r.num(vals.div) ?? 8);
  const chord = r.len(vals.chord) ?? NaN;
  const rise = r.len(vals.rise) ?? NaN;
  const res = arcFromChord({ chord, rise, divisions: div }, fmt);
  const save = res.ok ? { title: `Arch ${fmt.len(chord)} x ${fmt.len(rise)}`, summary: `Radius ${fine(res.value.radius)}, arc ${fmt.len(res.value.arcLength)}; offsets ${res.value.offsets.map((o) => fine(o.y)).join(', ')}`, inputs: vals } : null;
  return (
    <ToolShell tool="arc" save={save}>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <View style={{ flex: 1 }}>
          <Field label="Span (chord)" value={vals.chord} onChange={set('chord')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Rise" value={vals.rise} onChange={set('rise')} />
        </View>
      </View>
      {!res.ok ? (
        <ErrorCard text={res.error} />
      ) : (
        <>
          <Blade label="Trammel radius" value={fine(res.value.radius)} sub={`arc length ${fmt.len(res.value.arcLength)} · ${fmt.deg(res.value.angle)}`} />
          <ArcDiagram chord={chord} rise={rise} radius={res.value.radius} />
          <Checks checks={res.checks} />
          <Card>
            <H>Offsets from the span line</H>
            <P muted small>Measure along the span from one end, then square up by the offset. Join the points with a batten.</P>
            <Stepper label="Divisions" value={div} min={2} max={40} onChange={(n) => set('div')(String(n))} />
            {res.value.offsets.map((o, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 40, alignItems: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
                <Text style={{ fontFamily: fonts.body, fontSize: 17, color: t.muted }}>at {fmt.len(o.fromEnd)}</Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 24, color: t.ink }}>{fine(o.y)}</Text>
              </View>
            ))}
          </Card>
          <StepsCard steps={res.steps} />
        </>
      )}
    </ToolShell>
  );
}
