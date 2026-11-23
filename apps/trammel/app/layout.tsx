import { Text, View } from 'react-native';
import { layoutMembers } from '../src/core/layout.ts';
import { useSettings } from '../src/state/settings.tsx';
import { fonts, radius, space, useTheme } from '../src/theme/theme.ts';
import { LayoutDiagram } from '../src/ui/diagrams.tsx';
import { Blade, Card, Checks, ErrorCard, Field, H, P, Readouts, Segment, StepsCard, useReaders, Verify } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';

export default function Layout() {
  const t = useTheme();
  const { fmt, settings } = useSettings();
  const r = useReaders();
  const { vals, set } = useToolInputs('layout', (d) => ({ length: d.len(3600), spacing: d.len(450), thickness: d.len(45), mark: 'edge' }));
  const res = layoutMembers({ length: r.len(vals.length) ?? NaN, spacing: r.len(vals.spacing) ?? NaN, thickness: r.len(vals.thickness) ?? NaN }, fmt);
  const presets = settings.units === 'metric' ? ['300', '400', '450', '600', '900'] : ['12"', '16"', '19 3/16"', '24"'];
  const marks = res.ok ? (vals.mark === 'centre' ? res.value.centres : res.value.edges) : [];
  const save = res.ok ? { title: `Layout: ${res.value.count} members`, summary: `${res.value.count} members at ${fmt.len(r.len(vals.spacing) ?? 0)} centres over ${fmt.len(r.len(vals.length) ?? 0)}; ${vals.mark === 'centre' ? 'centre' : 'edge'} marks ${marks.map((m) => fmt.len(m)).join(', ')}`, inputs: vals } : null;
  return (
    <ToolShell tool="layout" save={save}>
      <Field label="Length (wall, floor or roof run)" value={vals.length} onChange={set('length')} />
      <Field label="Spacing (centres)" value={vals.spacing} onChange={set('spacing')} />
      <Segment options={presets.map((p) => ({ value: p, label: p }))} value={vals.spacing} onChange={set('spacing')} />
      <Field label="Member thickness" value={vals.thickness} onChange={set('thickness')} />
      {!res.ok ? (
        <ErrorCard text={res.error} />
      ) : (
        <>
          <Blade label="Members" value={String(res.value.count)} sub={`including both ends · ${res.value.count - 1} bays`} />
          <LayoutDiagram length={r.len(vals.length) ?? 1} centres={res.value.centres} thickness={r.len(vals.thickness) ?? 1} />
          <Card>
            <H>Marks from the start end</H>
            <Segment options={[{ value: 'edge', label: 'Leading edge' }, { value: 'centre', label: 'Centre' }]} value={vals.mark} onChange={set('mark')} />
            <P muted small>{vals.mark === 'edge' ? 'Hook the tape on the end, mark each number and put the member on the far side of the line.' : 'Centre of each member from the end.'}</P>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              {marks.map((m, i) => (
                <View key={i} style={{ backgroundColor: i === 0 || i === marks.length - 1 ? t.sunk : t.blade, borderRadius: radius.s, paddingVertical: space.xs, paddingHorizontal: space.m, minWidth: 72, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 22, color: i === 0 || i === marks.length - 1 ? t.ink : t.bladeInk }}>{fmt.len(m).replace(' mm', '')}</Text>
                </View>
              ))}
            </View>
          </Card>
          <Readouts rows={[{ label: 'Noggin / blocking, full bay', value: fmt.len(res.value.gaps[1] ?? res.value.gaps[0] ?? 0) }, { label: 'First bay', value: fmt.len(res.value.gaps[0] ?? 0) }, { label: 'Last bay', value: fmt.len(res.value.gaps[res.value.gaps.length - 1] ?? 0) }]} />
          <Checks checks={res.checks} />
          <StepsCard steps={res.steps} />
          <Verify text="Spacings for studs, joists, rafters and battens come from AS 1684, the sheet or cladding maker, or the engineer." />
        </>
      )}
    </ToolShell>
  );
}
