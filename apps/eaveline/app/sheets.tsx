/** Sheet count and cut list from the roof and the local profile catalogue. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { roofGeometry } from '../src/core/geometry';
import { coverText, describeCut, sheets } from '../src/core/sheets';
import { useApp } from '../src/state/AppState';
import { roofReady } from '../src/state/model';
import { Answer, Btn, ErrorLine, Figures, LengthField, Notice, Picker, Screen, Section, Steps } from '../src/ui/kit';
import { Gate, RoofCard, SaveToJob } from '../src/ui/parts';
import { VERIFIED_LABEL } from '../src/data/src';

export default function Sheets() {
  const app = useApp();
  const { ctx, roof, country } = app;
  const router = useRouter();
  const [profileId, setProfileId] = useState<string>(country.sheets[0]?.id ?? 'custom');
  const profile = country.sheets.find(x => x.id === profileId) ?? null;
  const [cover, setCover] = useState<number | null>(profile?.coverMm ?? null);
  const [overhang, setOverhang] = useState<number | null>(country.defaults.overhangMm);
  const [maxLen, setMaxLen] = useState<number | null>(country.defaults.maxSheetMm);
  const lapDefault = (pid: string | null) => {
    const pr = country.sheets.find(x => x.id === pid);
    if (!pr?.endLapMm) return pr ? null : 200;
    // AU/NZ: 200 mm below 15° (AU) or 10° (NZ); the profile's figure otherwise.
    if (country.code === 'AU' && roof.pitchDeg > 0 && roof.pitchDeg < 15) return 200;
    if (country.code === 'NZ' && roof.pitchDeg > 0 && roof.pitchDeg < 10) return 200;
    return pr.endLapMm;
  };
  const [lap, setLap] = useState<number | null>(lapDefault(profileId));
  const pick = (id: string) => {
    setProfileId(id);
    const pr = country.sheets.find(x => x.id === id);
    if (pr) setCover(pr.coverMm);
    setLap(lapDefault(id));
  };
  const ready = roofReady(roof);
  const g = ready ? roofGeometry(roof, ctx) : null;
  const res = g?.ok && cover ? sheets({ planes: g.value.planes, pitchDeg: roof.pitchDeg, coverWidthMm: cover, overhangMm: overhang ?? 0, ridgeAllowanceMm: 0, maxSheetMm: maxLen ?? 0, endLapMm: lap ?? 0 }, ctx) : null;
  const belowMin = profile?.minPitchDeg != null && ready && roof.pitchDeg < profile.minPitchDeg - 1e-9;
  const noLap = profile && profile.endLapMm == null && res?.ok && res.value.splitRuns > 0;
  const title = `Sheets · ${profile?.name ?? `custom ${ctx.len(cover ?? 0)} cover`}`;
  return (
    <Screen>
      <RoofCard />
      <Picker testID="sheet-profile" label="Profile" value={profileId} onPick={pick}
        choices={country.sheets.map(x => ({ id: x.id, title: x.name, sub: `${coverText(x.coverMm, ctx)} cover${x.minPitchDeg != null ? ` · min ${ctx.pitch(x.minPitchDeg)}` : ''}`, tag: VERIFIED_LABEL[x.src.verified] }))} />
      {profile?.note ? <Notice text={profile.note} icon="information-circle-outline" /> : null}
      {!country.guided ? <Notice text="No local catalogue for this country: enter the cover width from your supplier." /> : null}
      <LengthField testID="sheet-cover" label="Effective cover width" mm={cover} onMm={x => { setCover(x); if (profile && x !== profile.coverMm) setProfileId('custom'); }} size="short" />
      <LengthField testID="sheet-overhang" label={`Overhang into the ${ctx.terms.gutter}`} mm={overhang} onMm={setOverhang} size="short" />
      <LengthField testID="sheet-max" label="Longest sheet you can get or handle" mm={maxLen} onMm={setMaxLen} />
      <LengthField testID="sheet-lap" label="End lap (if a run needs two sheets)" mm={lap} onMm={setLap} size="short" />
      {belowMin ? <Notice tone="danger" icon="warning-outline" text={`This roof is ${ctx.pitch(roof.pitchDeg)}, below this profile’s minimum of ${ctx.pitch(profile!.minPitchDeg!)}. Pick another profile or check with the maker.`} /> : null}
      {res && !res.ok ? <ErrorLine text={res.error} /> : null}
      <Gate tool="sheets">
        {res?.ok ? (
          <>
            <Answer testID="sheets-answer" label="Sheets to order" value={`${res.value.sheets}`} lines={[`${ctx.run(res.value.totalLinealMm)} in total`, `About ${ctx.area(res.value.orderedAreaM2)} of sheet`]} />
            {noLap ? <Notice tone="danger" icon="warning-outline" text="The maker says this profile can’t be end-lapped. Order full-length sheets, or check for longer lengths." /> : null}
            <Section title="Cut list">
              <Figures rows={res.value.cutList.map(c => [`${c.qty} sheet${c.qty === 1 ? '' : 's'}`, ctx.len(c.lengthMm)])} />
            </Section>
            <Steps steps={res.steps} notes={res.notes} />
            <SaveToJob tool="sheets" title={title} lines={[`${res.value.sheets} sheets, ${ctx.run(res.value.totalLinealMm)} total`, ...res.value.cutList.slice(0, 12).map(c => describeCut(c, ctx))]} />
            <Btn label="Fixings for these sheets" kind="outline" icon="arrow-forward" onPress={() => router.push({ pathname: '/fixings', params: { sheets: String(res.value.sheets), profile: profileId } })} />
          </>
        ) : null}
      </Gate>
    </Screen>
  );
}
