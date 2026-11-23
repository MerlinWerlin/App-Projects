/** Fixing estimates for sheets (per support), tiles or shingles (per piece). */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { sheetFixings, perPieceFixings } from '../src/core/fixings';
import { roofGeometry } from '../src/core/geometry';
import { sheets } from '../src/core/sheets';
import { grouped } from '../src/core/units';
import { useApp } from '../src/state/AppState';
import { roofReady } from '../src/state/model';
import { Answer, ErrorLine, Figures, LengthField, Notice, NumField, Picker, Screen, Segmented, Steps } from '../src/ui/kit';
import { Gate, RoofCard, SaveToJob } from '../src/ui/parts';

export default function Fixings() {
  const app = useApp();
  const { ctx, roof, country } = app;
  const params = useLocalSearchParams<{ sheets?: string; profile?: string; run?: string; laps?: string; edges?: string }>();
  const [mode, setMode] = useState<'sheets' | 'pieces'>(country.sheets.length || !country.shingles.length ? 'sheets' : 'pieces');
  const [profileId, setProfileId] = useState<string>(params.profile ?? country.sheets[0]?.id ?? 'custom');
  const profile = country.sheets.find(p => p.id === profileId);
  const g = roofReady(roof) ? roofGeometry(roof, ctx) : null;
  // Sheets on this roof with this profile: count and average run (hip sheets are shorter than the rafter).
  const layout = (() => {
    if (!g?.ok || !profile) return null;
    const s = sheets({ planes: g.value.planes, pitchDeg: roof.pitchDeg, coverWidthMm: profile.coverMm, overhangMm: country.defaults.overhangMm, ridgeAllowanceMm: 0, maxSheetMm: profile.maxLengthMm ?? country.defaults.maxSheetMm, endLapMm: profile.endLapMm ?? 0 }, ctx);
    if (!s.ok) return null;
    const laps = g.value.planes.reduce((n, pl) => n + Math.max(0, Math.ceil(pl.eaveMm / profile.coverMm - 1e-9) - 1) * pl.count, 0);
    const edges = profile.edgeClip ? g.value.planes.reduce((n, pl) => n + pl.count, 0) : 0;
    return { sheets: s.value.sheets, avgMm: s.value.totalLinealMm / s.value.sheets, laps, edges };
  })();
  const fromSheets = !!params.sheets && params.profile === profileId;
  const autoSheets = fromSheets ? Number(params.sheets) || null : layout?.sheets ?? null;
  const sideLaps = fromSheets && params.laps ? Number(params.laps) : layout?.laps;
  const edgeClips = fromSheets && params.edges ? Number(params.edges) : layout?.edges ?? 0;
  const [count, setCount] = useState<number | null>(autoSheets);
  const [spacing, setSpacing] = useState<number | null>(country.defaults.purlinSpacingMm);
  const [end, setEnd] = useState<number | null>(profile?.fixEnd ?? null);
  const [mid, setMid] = useState<number | null>(profile?.fixMid ?? null);
  const [stitch, setStitch] = useState<number | null>(null);
  const [waste, setWaste] = useState<number | null>(5);
  const [box, setBox] = useState<number | null>(country.defaults.screwBox);
  const [pieces, setPieces] = useState<number | null>(null);
  const [per, setPer] = useState<number | null>(country.shingles[0]?.nailsPerShingle ?? 2);
  const pick = (id: string) => {
    setProfileId(id);
    const p = country.sheets.find(x => x.id === id);
    if (p) { setEnd(p.fixEnd); setMid(p.fixMid); }
  };
  const slope = (fromSheets && params.run ? Number(params.run) : null) ?? layout?.avgMm ?? (g?.ok ? g.value.rafterMm + country.defaults.overhangMm : null);
  const res = mode === 'sheets' && count && slope && spacing && end != null && mid != null
    ? sheetFixings({ sheets: count, slopeMm: slope, supportSpacingMm: spacing, endPerSheet: end, intermediatePerSheet: mid, sideLapSpacingMm: stitch, sideLaps, edgeClipsPerSupport: edgeClips, wastePct: waste ?? 0, boxSize: box ?? 100 }, ctx) : null;
  const res2 = mode === 'pieces' && pieces && per ? perPieceFixings(pieces, per, waste ?? 0, box ?? 100, 'pieces') : null;
  const what = profile?.id.includes('concealed') || profile?.id.includes('standing') ? 'clips' : 'screws';
  return (
    <Screen>
      <Segmented label="Fixing" value={mode} onChange={setMode} options={[{ value: 'sheets', label: 'Sheet roofing' }, { value: 'pieces', label: 'Per tile / shingle' }]} />
      {mode === 'sheets' ? (
        <>
          <RoofCard />
          <Picker label="Profile" value={profileId} onPick={pick} choices={country.sheets.map(p => ({ id: p.id, title: p.name, sub: p.fixEnd != null ? `${p.fixEnd} at ends, ${p.fixMid} between per sheet` : 'Pattern from the maker’s sheet' }))} />
          {profile && profile.fixEnd == null ? <Notice icon="information-circle-outline" text="The maker gives this fixing pattern as a drawing only: count the fasteners per sheet at end and middle supports and enter them below." /> : null}
          <NumField testID="fix-sheets" label="Sheets" value={count} onValue={setCount} max={100000} hint={autoSheets ? `From this roof: ${autoSheets}` : undefined} />
          <LengthField testID="fix-spacing" label={`${cap(ctx.terms.purlin)} / ${ctx.terms.batten} spacing`} mm={spacing} onMm={setSpacing} size="short" />
          <NumField testID="fix-end" label={`${cap(what)} per sheet at end supports`} value={end} onValue={setEnd} max={50} />
          <NumField testID="fix-mid" label={`${cap(what)} per sheet at middle supports`} value={mid} onValue={setMid} max={50} />
          <LengthField label="Side-lap stitching every (optional)" mm={stitch} onMm={setStitch} size="short" />
        </>
      ) : (
        <>
          <NumField testID="fix-pieces" label="Tiles or shingles" value={pieces} onValue={setPieces} max={1e6} hint="Use the count from Tiles or Shingles." />
          <NumField label="Fixings per piece" value={per} onValue={setPer} max={20} hint={country.code === 'GB' ? 'BS 5534: every tile mechanically fixed; perimeter tiles at least two.' : 'From the maker’s fixing schedule for your wind region.'} />
        </>
      )}
      <NumField label="Spare" value={waste} onValue={setWaste} suffix="%" max={50} />
      <NumField label="Box size" value={box} onValue={setBox} max={100000} />
      {res && !res.ok ? <ErrorLine text={res.error} /> : null}
      {res2 && !res2.ok ? <ErrorLine text={res2.error} /> : null}
      <Gate tool="fixings">
        {res?.ok ? (
          <>
            <Answer testID="fixings-answer" label={`${cap(what)} to order`} value={grouped(res.value.total)} lines={[`${res.value.boxes} box${res.value.boxes === 1 ? '' : 'es'} of ${box}`]} />
            <Figures rows={[['Support lines per run', String(res.value.supports)], ['Through the sheets', String(res.value.screws)], ...(res.value.stitching ? [['Side-lap stitching', String(res.value.stitching)] as [string, string]] : [])]} />
            {country.fixingsNote ? <Notice icon="hammer-outline" text={country.fixingsNote.text} /> : null}
            <Steps steps={res.steps} notes={res.notes} />
            <SaveToJob tool="fixings" title={`Fixings · ${profile?.name ?? 'sheets'}`} lines={[`${res.value.total} ${what} (${res.value.boxes} × ${box})`, `${res.value.supports} support lines per run`]} />
          </>
        ) : null}
        {res2?.ok ? (
          <>
            <Answer label="Fixings to order" value={grouped(res2.value.total)} lines={[`${res2.value.boxes} box${res2.value.boxes === 1 ? '' : 'es'} of ${box}`]} />
            {country.fixingsNote ? <Notice icon="hammer-outline" text={country.fixingsNote.text} /> : null}
            <Steps steps={res2.steps} />
            <SaveToJob tool="fixings" title="Fixings" lines={[`${res2.value.total} fixings (${res2.value.boxes} × ${box})`]} />
          </>
        ) : null}
      </Gate>
    </Screen>
  );
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
