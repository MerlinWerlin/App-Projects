import { View } from 'react-native';
import { commonRafter } from '../src/core/roof.ts';
import { useSettings } from '../src/state/settings.tsx';
import { space } from '../src/theme/theme.ts';
import { RafterDiagram } from '../src/ui/diagrams.tsx';
import { Blade, Card, Checks, ErrorCard, Field, H, Readouts, StepsCard, useReaders, Verify } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';
import { useFine } from '../src/ui/useFine.ts';

export default function Rafter() {
  const { fmt, country } = useSettings();
  const fine = useFine();
  const r = useReaders();
  const { vals, set } = useToolInputs('rafter', (d) => ({ span: d.len(6000, 288), pitch: '22.5', ridge: d.len(45, 1.5), overhang: d.len(450, 18), depth: d.len(190, 7.25), seat: d.len(90, 3.5) }));
  const res = commonRafter({ span: r.len(vals.span) ?? NaN, pitchDeg: r.num(vals.pitch) ?? NaN, ridgeThickness: r.len(vals.ridge), overhang: r.len(vals.overhang), rafterDepth: r.len(vals.depth), seat: r.len(vals.seat) }, fmt);
  const save = res.ok
    ? { title: `Rafter at ${fmt.deg(res.value.plumbAngle)}`, summary: `Heel to ridge ${fmt.len(res.value.rafterToRidge)}, eave ${fmt.len(res.value.eaveLength)}, total ${fmt.len(res.value.total)}, rise ${fmt.len(res.value.rise)}${res.value.birdsmouth ? `, birdsmouth height above plate ${fine(res.value.birdsmouth.hap)}` : ''}`, inputs: vals }
    : null;
  return (
    <ToolShell tool="rafter" save={save}>
      <Field label="Span, outside of wall plates" value={vals.span} onChange={set('span')} />
      <Field label="Pitch" kind="angle" value={vals.pitch} onChange={set('pitch')} />
      {res.ok ? <Blade label="Rafter length" value={fmt.len(res.value.total)} sub={`${fmt.len(res.value.rafterToRidge)} heel to ridge${res.value.eaveLength ? ` + ${fmt.len(res.value.eaveLength)} eave` : ''}`} /> : <ErrorCard text={res.error} />}
      <Card>
        <H>Ridge, eave and birdsmouth</H>
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <View style={{ flex: 1 }}>
            <Field label="Ridge thickness" optional value={vals.ridge} onChange={set('ridge')} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Eave overhang (level)" optional value={vals.overhang} onChange={set('overhang')} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <View style={{ flex: 1 }}>
            <Field label="Rafter depth" optional value={vals.depth} onChange={set('depth')} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Seat (plate width)" optional value={vals.seat} onChange={set('seat')} />
          </View>
        </View>
      </Card>
      {!res.ok ? null : (
        <>
          <RafterDiagram pitchDeg={res.value.plumbAngle} overhangRatio={res.value.eaveLength / Math.max(1, res.value.rafterToRidge)} />
          <Readouts
            rows={[
              { label: 'Run', value: fmt.len(res.value.run) },
              { label: 'Rise', value: fmt.len(res.value.rise) },
              { label: 'Plumb cut: set the square to', value: fmt.deg(res.value.plumbAngle), strong: true },
              { label: 'Seat cut', value: 'square to the plumb line' },
              { label: 'Plumb line to rafter edge', value: fmt.deg(res.value.seatAngle) },
            ]}
          />
          {res.value.birdsmouth ? (
            <>
              <H>Birdsmouth</H>
              <Readouts
                rows={[
                  { label: 'Plumb cut height', value: fine(res.value.birdsmouth.plumbHeight) },
                  { label: 'Notch depth, square to edge', value: fine(res.value.birdsmouth.depthSquare) },
                  { label: 'Height above plate', value: fine(res.value.birdsmouth.hap), strong: true },
                ]}
              />
            </>
          ) : null}
          <Checks checks={res.checks} />
          <StepsCard steps={res.steps} />
          <Verify text={`Guidance only: size, span and fix rafters to ${country.framingCode ?? 'your local framing code'} or the engineer's details, and check against the plans.`} />
        </>
      )}
    </ToolShell>
  );
}
