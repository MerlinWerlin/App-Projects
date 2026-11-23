import { Pressable, Text, View } from 'react-native';
import { stairCodesFor, stairLimitsById } from '../src/core/stairCodes.ts';
import { planStair } from '../src/core/stairs.ts';
import { formatLimit } from '../src/core/units.ts';
import { useSettings } from '../src/state/settings.tsx';
import { fonts, radius, space, useTheme, sys } from '../src/theme/theme.ts';
import { StairDiagram } from '../src/ui/diagrams.tsx';
import { Blade, Card, Checks, ErrorCard, Field, H, P, Readouts, Segment, StepsCard, useReaders, Verify, useBadField } from '../src/ui/kit.tsx';
import { ToolShell, useToolInputs } from '../src/ui/ToolShell.tsx';
import { useFine } from '../src/ui/useFine.ts';

export default function Stairs() {
  const t = useTheme();
  const { fmt, country, settings } = useSettings();
  const lim = (mm: number, dir: 'min' | 'max') => formatLimit(mm, settings.units, settings.denom, dir);
  const G = country.terms.Going;
  const g = country.terms.going;
  const fine = useFine();
  const r = useReaders();
  const { vals, set, countryNote } = useToolInputs('stairs', (d) => ({ rise: d.len(2700, 108), run: '', going: '', risers: '', stringer: d.len(290, 11.25), tread: '', code: '' }));
  const codes = stairCodesFor(country.code);
  const limits = stairLimitsById(country.code, vals.code);
  const risersIn = r.num(vals.risers);
  const res0 = planStair({ totalRise: r.len(vals.rise) ?? NaN, totalRun: r.len(vals.run), going: r.len(vals.going), risers: risersIn, stringerWidth: r.len(vals.stringer), treadThickness: r.len(vals.tread), limits }, fmt, G);
  const bad = useBadField(vals);
  const res: typeof res0 = bad ? { ok: false, error: bad } : res0;
  const save = res.ok
    ? { title: `Stairs: ${res.value.risers} risers`, summary: `${res.value.risers} risers at ${fine(res.value.riser)}, ${res.value.treads} treads at ${fine(res.value.going)} ${g}, 2R+G ${fine(res.value.twoRG)}, total ${g} ${fmt.len(res.value.totalGoing)}, ${fmt.deg(res.value.angle)}`, inputs: vals }
    : null;
  return (
    <ToolShell tool="stairs" save={save}>
      {countryNote ? <P muted small>{countryNote}</P> : null}
      <Field label="Total rise, finished floor to finished floor" value={vals.rise} onChange={set('rise')} />
      {codes.length > 1 ? <Segment label="Stair type" options={codes.map((c) => ({ value: c.id, label: c.name }))} value={limits.id} onChange={set('code')} /> : null}
      {res.ok ? <Blade label={res.value.needsLanding ? 'Needs a landing' : 'Risers'} value={`${res.value.risers} × ${fine(res.value.riser)}`} sub={`${res.value.treads} treads · ${g} ${fine(res.value.going)}${limits.sMin != null || limits.sMax != null ? ` · 2R+G ${fine(res.value.twoRG)}` : ` · ${fmt.deg(res.value.angle)}`}`} /> : <ErrorCard text={res.error} />}
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
        <View style={{ flexDirection: 'row', gap: space.m }}>
          <View style={{ flex: 1 }}>
            <Field label="Stringer width" optional value={vals.stringer} onChange={set('stringer')} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Tread thickness" optional value={vals.tread ?? ''} onChange={set('tread')} />
          </View>
        </View>
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
              ...(res.value.bottomRiserCut != null ? [{ label: 'Bottom riser cut (dropped)', value: fine(res.value.bottomRiserCut), strong: true }] : []),
              ...(res.value.goingRange ? [{ label: `${G} that passes at this riser`, value: `${lim(res.value.goingRange.min, 'min')} to ${lim(res.value.goingRange.max, 'max')}` }] : []),
            ]}
          />
          {res.value.options.length > 1 ? (
            <Card>
              <H>Riser counts that pass in one flight</H>
              <P muted small>{risersIn ? 'Tap one to use it, or clear Risers to let Trammel choose.' : 'Tap one to use it.'}</P>
              {res.value.options.map((o) => (
                <Pressable key={o.risers} onPress={() => set('risers')(String(o.risers))} accessibilityRole="button" accessibilityLabel={`${o.risers} risers of ${fine(o.riser)}`} style={({ pressed }) => ({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, borderRadius: radius.m, paddingHorizontal: space.m, backgroundColor: o.risers === res.value.risers ? t.blade : t.sunk, opacity: pressed ? 0.75 : 1 })}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 22, color: o.risers === res.value.risers ? t.bladeInk : t.ink }}>
                    {o.risers} × {fine(o.riser)}
                  </Text>
                  <Text style={{ ...sys.body, fontSize: 15, color: o.risers === res.value.risers ? t.bladeInk : t.muted }}>
                    {g} {lim(o.goingMin, 'min')} to {lim(o.goingMax, 'max')}
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
