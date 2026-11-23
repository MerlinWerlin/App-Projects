/** Tiles, slates and battens: even gauge, courses, counts, batten lengths and ridge/hip capping. */
import { useState } from 'react';
import { View } from 'react-native';
import { cappingTiles } from '../src/core/flashing';
import { roofGeometry } from '../src/core/geometry';
import { slateGauge, tiles } from '../src/core/tiles';
import { num } from '../src/core/units';
import { VERIFIED_LABEL } from '../src/data/src';
import { useApp } from '../src/state/AppState';
import { roofReady } from '../src/state/model';
import { SPACE } from '../src/theme/theme';
import { Answer, ErrorLine, Figures, LengthField, Notice, NumField, Picker, Screen, Section, Steps } from '../src/ui/kit';
import { Gate, RoofCard, SaveToJob } from '../src/ui/parts';

export default function Tiles() {
  const app = useApp();
  const { ctx, roof, country } = app;
  const w = country.terms;
  const [tileId, setTileId] = useState<string>(country.tiles[0]?.id ?? 'custom');
  const tile = country.tiles.find(x => x.id === tileId) ?? null;
  const [cover, setCover] = useState<number | null>(tile?.coverWidthMm ?? null);
  const [maxGauge, setMaxGauge] = useState<number | null>(tile?.maxGaugeMm ?? null);
  const [perM2, setPerM2] = useState<number | null>(tile?.tilesPerM2 ? Math.round(tile.tilesPerM2 * 100) / 100 : null);
  const [len, setLen] = useState<number | null>(tile?.lengthMm ?? null);
  const [headlap, setHeadlap] = useState<number | null>(tile?.headlapMm ?? null);
  const [eaves, setEaves] = useState<number | null>(country.defaults.eavesSetOutMm);
  const [top, setTop] = useState<number | null>(country.defaults.topSetOutMm);
  const [waste, setWaste] = useState<number | null>(5);
  const [stockId, setStockId] = useState<string>(String(country.defaults.battenStockMm));
  const [capPerM, setCapPerM] = useState<number | null>(country.caps.find(c => c.kind === 'ridgeTile')?.perMetre ?? null);
  const pick = (id: string) => {
    setTileId(id);
    const t = country.tiles.find(x => x.id === id);
    if (!t) return;
    setCover(t.coverWidthMm); setMaxGauge(t.maxGaugeMm); setPerM2(t.tilesPerM2 ? Math.round(t.tilesPerM2 * 100) / 100 : null);
    setLen(t.lengthMm ?? null); setHeadlap(t.headlapMm ?? null);
  };
  const isSlate = tile?.kind === 'slate';
  const sg = isSlate && len && headlap ? slateGauge(len, headlap, ctx) : null;
  const gaugeMax = sg?.ok ? Math.min(sg.value.gaugeMm, maxGauge ?? Infinity) : maxGauge;
  const stock = Number(stockId);
  const ready = roofReady(roof);
  const g = ready ? roofGeometry(roof, ctx) : null;
  const res = g?.ok && (perM2 || (cover && gaugeMax)) ? tiles({ planes: g.value.planes, roofAreaM2: g.value.roofAreaM2, eavesSetOutMm: eaves ?? 0, topSetOutMm: top ?? 0, maxGaugeMm: gaugeMax ?? null, tileCoverWidthMm: cover, tilesPerM2: perM2, wastePct: waste ?? 0, battenStockMm: stock }, ctx) : null;
  const capLen = g?.ok ? g.value.ridgeMm + g.value.hipEachMm * g.value.hipCount : 0;
  const caps = capLen > 0 && capPerM ? cappingTiles(capLen, { perMetre: capPerM }, ctx) : null;
  const belowMin = tile?.minPitchDeg != null && ready && roof.pitchDeg < tile.minPitchDeg - 1e-9;
  const stockChoices = [...new Set([...country.battenStockMm, country.defaults.battenStockMm])].sort((a, b) => a - b).map(mm => ({ id: String(mm), title: ctx.len(mm) }));
  return (
    <Screen>
      <RoofCard />
      <Picker testID="tile-product" label="Tile or slate" value={tileId} onPick={pick}
        choices={country.tiles.map(x => ({ id: x.id, title: x.name, sub: [x.tilesPerM2 ? `${num(x.tilesPerM2, 2)} per m²` : null, x.minPitchDeg != null ? `min ${ctx.pitch(x.minPitchDeg)}` : null].filter(Boolean).join(' · '), tag: VERIFIED_LABEL[x.src.verified] }))} />
      {tile?.note ? <Notice text={tile.note} icon="information-circle-outline" /> : null}
      {belowMin ? <Notice tone="danger" icon="warning-outline" text={`This roof is ${ctx.pitch(roof.pitchDeg)}, below this tile’s minimum of ${ctx.pitch(tile!.minPitchDeg!)}.`} /> : null}
      <LengthField testID="tile-cover" label="Tile cover width (side to side, as laid)" mm={cover} onMm={setCover} size="short" hint={cover ? undefined : 'Not on the data sheet: measure a laid tile or ask the maker.'} />
      {isSlate ? (
        <>
          <LengthField testID="slate-length" label="Slate / tile length" mm={len} onMm={setLen} size="short" />
          <LengthField testID="slate-headlap" label="Headlap" mm={headlap} onMm={setHeadlap} size="short" hint="Use the maker’s headlap for this pitch and exposure." />
        </>
      ) : (
        <LengthField testID="tile-gauge" label="Maximum batten gauge" mm={maxGauge} onMm={setMaxGauge} size="short" hint={maxGauge ? undefined : 'From the tile maker’s set-out (not published on most data sheets).'} />
      )}
      <NumField testID="tile-perm2" label="Tiles per m² (blank: from gauge × cover)" value={perM2} onValue={setPerM2} max={100} />
      <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
        <View style={{ flex: 1 }}><LengthField label="Eaves set-out" mm={eaves} onMm={setEaves} size="short" /></View>
        <View style={{ flex: 1 }}><LengthField label="Top set-out" mm={top} onMm={setTop} size="short" /></View>
      </View>
      <Notice icon="information-circle-outline" text={`Set-outs: slope distance from the eave line to the first ${w.batten}, and from the top ${w.batten} to the ridge. Starting values only; use the tile maker’s set-out.`} />
      <NumField label="Waste for cuts and breakage" value={waste} onValue={setWaste} suffix="%" max={50} />
      <Picker label={`${cap(w.batten)} stock length`} value={stockId} onPick={setStockId} choices={stockChoices} customLabel={null} />
      {res && !res.ok ? <ErrorLine text={res.error} /> : null}
      <Gate tool="tiles">
        {res?.ok ? (
          <>
            <Answer testID="tiles-answer" label="Tiles to order" value={`${res.value.tilesToOrder}`} lines={[res.value.gaugeMm != null ? `${cap(w.batten)} gauge ${ctx.len(res.value.gaugeMm)} · ${res.value.rows} rows a plane` : `${num(res.value.coveragePerM2, 2)} per m² + ${waste ?? 0}% waste`]} />
            <Figures rows={[
              ...(res.value.tilesByCourses != null ? [['By courses', String(res.value.tilesByCourses)] as [string, string]] : []),
              ['By area', String(res.value.tilesByArea)],
              ['Coverage', `${num(res.value.coveragePerM2, 2)} per m²`],
              ...(res.value.battenLinealMm != null ? [[`${cap(w.battens)}`, `${ctx.run(res.value.battenLinealMm)} · ${res.value.battenPieces} × ${ctx.len(stock)}`] as [string, string]] : []),
              ...(caps?.ok ? [[`${cap(w.ridge)} & hip caps`, `${caps.value.tiles} (${ctx.run(capLen)})`] as [string, string]] : []),
            ]} />
            {capLen > 0 && !country.caps.some(c => c.perMetre) ? (
              <NumField label={`${cap(w.ridge)} caps per metre (from the maker)`} value={capPerM} onValue={setCapPerM} max={10} />
            ) : null}
            <Steps steps={[...res.steps, ...(sg?.ok ? sg.steps : []), ...(caps?.ok ? caps.steps : [])]} notes={[...res.notes, ...(sg?.ok ? sg.notes : [])]} />
            <SaveToJob tool="tiles" title={`Tiles · ${tile?.name ?? 'custom'}`} lines={[
              `${res.value.tilesToOrder} tiles (${waste ?? 0}% waste)`,
              ...(res.value.gaugeMm != null ? [`${cap(w.batten)} gauge ${ctx.len(res.value.gaugeMm)}, ${res.value.rows} rows`, `${res.value.battenPieces} × ${ctx.len(stock)} ${w.battens}`] : []),
              ...(caps?.ok ? [`${caps.value.tiles} ridge/hip caps`] : []),
            ]} />
          </>
        ) : null}
      </Gate>
    </Screen>
  );
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
