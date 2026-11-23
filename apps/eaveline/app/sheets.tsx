/** Sheet count and cut list from the roof and the local profile catalogue. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { roofGeometry } from '../src/core/geometry';
import { coverText, describeCut, sheets } from '../src/core/sheets';
import { grouped } from '../src/core/units';
import { useApp } from '../src/state/AppState';
import { roofReady } from '../src/state/model';
import { Answer, Btn, ErrorLine, Figures, LengthField, Notice, Picker, Screen, Section, Steps } from '../src/ui/kit';
import { Gate, RoofCard, SaveToJob } from '../src/ui/parts';
import { VERIFIED_LABEL } from '../src/data/src';
import type { SheetProfile } from '../src/data/types';

/** Hip roofs on big buildings produce hundreds of lengths; show the longest first and say how many more. */
const CUT_ROWS = 40;

export default function Sheets() {
  const app = useApp();
  const { ctx, roof, country } = app;
  const router = useRouter();
  const [profileId, setProfileId] = useState<string>(country.sheets[0]?.id ?? 'custom');
  const profile = country.sheets.find(x => x.id === profileId) ?? null;
  const [cover, setCover] = useState<number | null>(profile?.coverMm ?? null);
  const [overhang, setOverhang] = useState<number | null>(country.defaults.overhangMm);
  const [maxLen, setMaxLen] = useState<number | null>(profile?.maxLengthMm ?? country.defaults.maxSheetMm);
  /** The profile's end lap for this pitch: pitch bands first, then the AU/NZ low-pitch rule, else the maker's figure. */
  const lapFor = (pr: SheetProfile | null, pitch: number): number | null => {
    if (!pr) return 200;
    if (pr.endLapByPitch?.length) {
      const band = [...pr.endLapByPitch].sort((a, b) => b.minPitchDeg - a.minPitchDeg).find(b => pitch >= b.minPitchDeg - 1e-9);
      return band?.lapMm ?? null;
    }
    if (!pr.endLapMm) return null;
    if (country.code === 'AU' && pitch > 0 && pitch < 15) return 200;
    if (country.code === 'NZ' && pitch > 0 && pitch < 10) return 200;
    return pr.endLapMm;
  };
  // The lap follows the profile and pitch until the person types their own.
  const [lapTyped, setLapTyped] = useState<number | null | undefined>(undefined);
  const lap = lapTyped !== undefined ? lapTyped : lapFor(profile, roof.pitchDeg);
  const pick = (id: string) => {
    setProfileId(id);
    const pr = country.sheets.find(x => x.id === id) ?? null;
    if (pr) setCover(pr.coverMm);
    setMaxLen(pr?.maxLengthMm ?? country.defaults.maxSheetMm);
    setLapTyped(undefined);
  };
  const ready = roofReady(roof);
  const g = ready ? roofGeometry(roof, ctx) : null;
  const lapsAllowed = !profile || !!profile.endLapMm || !!profile.endLapByPitch?.length;
  const raw = g?.ok && cover ? sheets({ planes: g.value.planes, pitchDeg: roof.pitchDeg, coverWidthMm: cover, overhangMm: overhang ?? 0, ridgeAllowanceMm: 0, maxSheetMm: maxLen ?? 0, endLapMm: lap ?? 0 }, ctx) : null;
  const needsSplit = !!(raw?.ok && raw.value.splitRuns > 0);
  // Profiles the maker says can't be end-lapped: show the full lengths to order, never a split cut list.
  const noLap = needsSplit && !lapsAllowed;
  const res = noLap && g?.ok && cover
    ? sheets({ planes: g.value.planes, pitchDeg: roof.pitchDeg, coverWidthMm: cover, overhangMm: overhang ?? 0, ridgeAllowanceMm: 0, maxSheetMm: 1e7, endLapMm: 0 }, ctx)
    : raw;
  const lapMissing = needsSplit && lapsAllowed && (lap == null || lap <= 0);
  const belowMin = profile?.minPitchDeg != null && ready && roof.pitchDeg < profile.minPitchDeg - 1e-9;
  const sideLaps = g?.ok && cover ? g.value.planes.reduce((n, pl) => n + Math.max(0, Math.ceil(pl.eaveMm / cover - 1e-9) - 1) * pl.count, 0) : 0;
  const planeCount = g?.ok ? g.value.planes.reduce((n, pl) => n + pl.count, 0) : 0;
  const title = `Sheets · ${profile?.name ?? `custom ${ctx.len(cover ?? 0)} cover`}`;
  const inputs = (
    <Section title="Cover, overhang and laps">
      <LengthField testID="sheet-cover" label="Effective cover width" mm={cover} onMm={x => { setCover(x); if (profile && x !== profile.coverMm) setProfileId('custom'); }} size="short" />
      <LengthField testID="sheet-overhang" label={`Overhang into the ${ctx.terms.gutter}`} mm={overhang} onMm={setOverhang} size="short" />
      <LengthField testID="sheet-max" label="Longest sheet you can get or handle" mm={maxLen} onMm={setMaxLen} />
      {lapsAllowed ? <LengthField testID="sheet-lap" label="End lap (if a run needs two sheets)" mm={lap} onMm={x => setLapTyped(x)} size="short" hint={lapTyped === undefined ? 'Set from the profile and this pitch.' : undefined} /> : null}
    </Section>
  );
  return (
    <Screen>
      <RoofCard />
      <Picker testID="sheet-profile" label="Profile" value={profileId} onPick={pick}
        choices={country.sheets.map(x => ({ id: x.id, title: x.name, sub: `${coverText(x.coverMm, ctx)} cover${x.minPitchDeg != null ? ` · min ${ctx.pitch(x.minPitchDeg)}` : ''}`, tag: VERIFIED_LABEL[x.src.verified] }))} />
      {profile?.note ? <Notice text={profile.note} icon="information-circle-outline" /> : null}
      {!country.guided ? <Notice text="No local catalogue for this country: enter the cover width from your supplier." /> : null}
      {belowMin ? <Notice tone="danger" icon="warning-outline" text={`This roof is ${ctx.pitch(roof.pitchDeg)}, below this profile’s minimum of ${ctx.pitch(profile!.minPitchDeg!)}. Pick another profile or check with the maker.`} /> : null}
      {res && !res.ok ? <ErrorLine text={res.error} /> : null}
      {lapMissing ? <ErrorLine text="Some runs are longer than your longest sheet: enter the end lap so they can be split." /> : null}
      <Gate tool="sheets">
        {res?.ok && !lapMissing ? (
          <>
            <Answer testID="sheets-answer" label={noLap ? 'Full-length sheets to order' : 'Sheets to order'} value={grouped(res.value.sheets)} lines={[`${ctx.run(res.value.totalLinealMm)} in total`, `About ${ctx.area(res.value.orderedAreaM2)} of sheet`]} />
            {noLap ? <Notice tone="danger" icon="warning-outline" text={`The maker says this profile can’t be end-lapped, so each run is one sheet. Longest run ${ctx.len(res.value.cutList[0]?.lengthMm ?? 0)}, longer than the ${ctx.len(maxLen ?? 0)} you entered: check the supplier can roll and deliver it.`} /> : null}
            <Section title="Cut list">
              <Figures rows={res.value.cutList.slice(0, CUT_ROWS).map(c => [`${c.qty} sheet${c.qty === 1 ? '' : 's'}`, ctx.len(c.lengthMm)])} />
              {res.value.cutList.length > CUT_ROWS ? <Notice icon="list-outline" text={`${res.value.cutList.length - CUT_ROWS} more lengths, shortest last. Share the job sheet for the full list.`} /> : null}
            </Section>
            {inputs}
            <Steps steps={res.steps} notes={res.notes} />
            <SaveToJob tool="sheets" title={title} lines={[`${res.value.sheets} sheets, ${ctx.run(res.value.totalLinealMm)} total`, ...res.value.cutList.map(c => describeCut(c, ctx))]} />
            <Btn label="Fixings for these sheets" kind="outline" icon="arrow-forward" onPress={() => router.push({ pathname: '/fixings', params: {
              sheets: String(res.value.sheets), profile: profileId, run: String(Math.round(res.value.totalLinealMm / Math.max(1, res.value.sheets))),
              laps: String(sideLaps), edges: profile?.edgeClip ? String(planeCount) : '0' } })} />
          </>
        ) : null}
      </Gate>
      {!(res?.ok && app.can('sheets')) ? inputs : null}
    </Screen>
  );
}
