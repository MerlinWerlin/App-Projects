import { Pressable, Text, View } from 'react-native';
import { stairCodesFor, stairLimitsById } from '../src/core/stairCodes.ts';
import { planStair } from '../src/core/stairs.ts';
import { useSettings } from '../src/state/settings.tsx';
import { fonts, radius, space, useTheme, sys } from '../src/theme/theme.ts';
import { StairDiagram } from '../src/ui/diagrams.tsx';
import { Blade, Card, Checks, ErrorCard, Field, H, P, Readouts, Segment, StepsCard, useReaders, Verify } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';
import { useFine } from '../src/ui/useFine.ts';

export default function Stairs() {
  const t = useTheme();
  const { fmt, country } = useSettings();
  const G = country.terms.Going;
  const g = country.terms.going;
  const fine = useFine();
  const r = useReaders();
  const { vals, set } = useToolInputs('stairs', (d) => ({ rise: d.len(2700, 108), run: '', going: '', risers: '', stringer: d.len(290, 11.25), code: '' }));
  const codes = stairCodesFor(country.code);
  const limits = stairLimitsById(country.code, vals.code);
  const risersIn = r.num(vals.risers);
  const res = planStair({ totalRise: r.len(vals.rise) ?? NaN, totalRun: r.len(vals.run), going: r.len(vals.going), risers: risersIn, stringerWidth: r.len(vals.stringer), limits }, fmt, G);
  const save = res.ok
    ? { title: `Stairs: ${res.value.risers} risers`, summary: `${res.value.risers} risers at ${fine(res.value.riser)}, ${res.value.treads} treads at ${fine(res.value.going)} ${g}, 2R+G ${fine(res.value.twoRG)}, total ${g} ${fmt.len(res.value.totalGoing)}, ${fmt.deg(res.value.angle)}`, inputs: vals }
    : null;
  return (
    <ToolShell tool="stairs" save={save}>
      <Field label="Total rise, finished floor to finished floor" value={vals.rise} onChange={set('rise')} />
      {codes.length > 1 ? <Segment label="Stair type" options={codes.map((c) => ({ value: c.id, label: c.name }))} value={limits.id} onChange={set('code')} /> : null}
      {res.ok ? <Blade label="Risers" value={`${res.value.risers} × ${fine(res.value.riser)}`} sub={`${res.value.treads} treads · ${g} ${fine(res.value.going)}${limits.sMin != null || limits.sMax != null ? ` · 2R+G ${fine(res.value.twoRG)}` : ` · ${fmt.deg(res.value.angle)}`}`} /> : <ErrorCard text={res.error} />}
      <Card>
        <H>Fit the flight</H>
        <P muted small>All optional. Leave them empty and Trammel picks a comfortable stair.</P>
        <Field label="Floor space for the flight" optional value={vals.run} onChange={set('run')} hint="Front of the bottom riser to the face of the top one" />
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <View style={{ flex: 1 }}>
            <Field label="Risers" optional kind="int" value={vals.risers} onChange={set('risers')} placeholder="Auto" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={G} optional value={vals.going} onChange={set('going')} placeholder="Auto" />
          </View>
        </View>
        <Field label="Stringer board width" optional value={vals.stringer} onChange={set('stringer')} />
      </Card>
      {!res.ok ? null : (
        <>
          <StairDiagram risers={res.value.risers} riser={res.value.riser} going={res.value.going} />
          <Checks checks={res.checks.filter((c) => !limits.notes.includes(c.text))} />
          <Readouts
            rows={[
              { label: `Total ${g}`, value: fmt.len(res.value.totalGoing) },
              { label: 'Pitch', value: fmt.deg(res.value.angle) },
              { label: 'Step along pitch line', value: fine(res.value.step) },
              { label: 'Pitch line, nosing to nosing', value: fmt.len(res.value.pitchLine) },
              { label: 'Stringer, at least', value: fmt.len(res.value.stringerEstimate) },
              ...(res.value.throat != null ? [{ label: 'Stringer left under notch', value: fine(res.value.throat) }] : []),
              ...(res.value.goingRange ? [{ label: `${G} that passes at this riser`, value: `${fmt.len(Math.ceil(res.value.goingRange.min))} to ${fmt.len(Math.floor(res.value.goingRange.max))}` }] : []),
            ]}
          />
          {res.value.options.length > 1 ? (
            <Card>
              <H>Riser counts that pass</H>
              <P muted small>{risersIn ? 'Tap one to use it, or clear Risers to let Trammel choose.' : 'Tap one to use it.'}</P>
              {res.value.options.map((o) => (
                <Pressable key={o.risers} onPress={() => set('risers')(String(o.risers))} accessibilityRole="button" accessibilityLabel={`${o.risers} risers of ${fine(o.riser)}`} style={({ pressed }) => ({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, borderRadius: radius.m, paddingHorizontal: space.m, backgroundColor: o.risers === res.value.risers ? t.blade : t.sunk, opacity: pressed ? 0.75 : 1 })}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 22, color: o.risers === res.value.risers ? t.bladeInk : t.ink }}>
                    {o.risers} × {fine(o.riser)}
                  </Text>
                  <Text style={{ ...sys.body, fontSize: 15, color: o.risers === res.value.risers ? t.bladeInk : t.muted }}>
                    {g} {fmt.len(Math.ceil(o.goingMin))} to {fmt.len(Math.floor(o.goingMax))}
                  </Text>
                </Pressable>
              ))}
            </Card>
          ) : null}
          <StepsCard steps={res.steps} />
          <Checks checks={res.checks.filter((c) => limits.notes.includes(c.text))} />
          <Verify text={limits.binding ? `Checked against ${limits.source}. Guidance only: check headroom, balustrades, landings and local amendments, and verify against the plans and the certifier.` : `${limits.source}. Check your local building code, the plans and the certifier.`} />
        </>
      )}
    </ToolShell>
  );
}
