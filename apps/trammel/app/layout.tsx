import { Text, View } from 'react-native';
import { layoutMembers } from '../src/core/layout.ts';
import { defaultFraming, materialsFor } from '../src/core/materials.ts';
import { lengthToInput } from '../src/core/units.ts';
import { useSettings } from '../src/state/settings.tsx';
import { fonts, radius, space, useTheme } from '../src/theme/theme.ts';
import { LayoutDiagram } from '../src/ui/diagrams.tsx';
import { Blade, Card, Checks, ErrorCard, Field, H, P, Readouts, Segment, StepsCard, useReaders, Verify, useBadField } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';

const MAX_MARKS = 120;

export default function Layout() {
  const t = useTheme();
  const { fmt, settings, country } = useSettings();
  const r = useReaders();
  const { vals, set } = useToolInputs('layout', (d) => ({ length: d.len(3600, 144), spacing: d.len(country.spacings[d.units === 'imperial' ? 1 : Math.min(2, country.spacings.length - 1)]), thickness: d.len(Math.round(defaultFraming(country.code).d * 10) / 10), mark: 'edge' }));
  const res0 = layoutMembers({ length: r.len(vals.length) ?? NaN, spacing: r.len(vals.spacing) ?? NaN, thickness: r.len(vals.thickness) ?? NaN }, fmt);
  const bad = useBadField(vals);
  const res: typeof res0 = bad ? { ok: false, error: bad } : res0;
  // One-tap centres for this country (src/core/country.ts), shown in the units in use.
  const thicknesses = [...new Set(materialsFor(country.code).framing.map((f) => Math.round(f.d * 10) / 10))].sort((a, b) => a - b).map((mm) => lengthToInput(mm, settings.units, settings.denom));
  const presets = country.spacings.map((mm) => lengthToInput(mm, settings.units, settings.denom));
  const marks = res.ok ? (vals.mark === 'centre' ? res.value.centres : res.value.edges) : [];
  const save = res.ok ? { title: `Layout: ${res.value.count} members`, summary: `${res.value.count} members at ${fmt.len(r.len(vals.spacing) ?? 0)} centres over ${fmt.len(r.len(vals.length) ?? 0)}; ${vals.mark === 'centre' ? 'centre' : 'edge'} marks ${marks.map((m) => fmt.len(m)).join(', ')}`, inputs: vals } : null;
  return (
    <ToolShell tool="layout" save={save}>
      <Field label="Length (wall, floor or roof run)" value={vals.length} onChange={set('length')} />
      <Field label="Spacing (centres)" value={vals.spacing} onChange={set('spacing')} />
      <Segment chips options={presets.map((p) => ({ value: p, label: p }))} value={vals.spacing} onChange={set('spacing')} />
      <Field label="Member thickness" value={vals.thickness} onChange={set('thickness')} />
      <Segment chips options={thicknesses.map((x) => ({ value: x, label: x }))} value={vals.thickness} onChange={set('thickness')} />
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
              {marks.slice(0, MAX_MARKS).map((m, i) => (
                <View key={i} style={{ backgroundColor: i === 0 || i === marks.length - 1 ? t.sunk : t.blade, borderRadius: radius.s, paddingVertical: space.xs, paddingHorizontal: space.m, minWidth: 72, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 22, color: i === 0 || i === marks.length - 1 ? t.ink : t.bladeInk }}>{fmt.len(m).replace(' mm', '')}</Text>
                </View>
              ))}
            </View>
            {marks.length > MAX_MARKS ? <P muted small>{`…and ${marks.length - MAX_MARKS} more marks, every ${fmt.len(r.len(vals.spacing) ?? 0)}, to ${fmt.len(marks[marks.length - 1])}.`}</P> : null}
          </Card>
          <Readouts rows={[{ label: `${country.terms.noggin.charAt(0).toUpperCase()}${country.terms.noggin.slice(1)}, full bay`, value: fmt.len(res.value.gaps[1] ?? res.value.gaps[0] ?? 0) }, { label: 'First bay', value: fmt.len(res.value.gaps[0] ?? 0) }, { label: 'Last bay', value: fmt.len(res.value.gaps[res.value.gaps.length - 1] ?? 0) }]} />
          <Checks checks={res.checks} />
          <StepsCard steps={res.steps} />
          <Verify text="Spacings for studs, joists, rafters and battens come from your local timber framing code or span tables, the sheet or cladding maker, or the engineer." />
        </>
      )}
    </ToolShell>
  );
}
