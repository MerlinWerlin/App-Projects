// Grout, adhesive and waterproofing quantities from the country's catalogue (or custom figures off the bag).
import { View } from 'react-native';
import { adhesiveRate } from '../../src/countries/index.ts';
import { calcAdhesive, calcGrout, calcMembrane, wetAreaSurfaces, type MembraneSurface } from '../../src/core/materials.ts';
import { BACK_BUTTER_KG_PER_M2, IMPERIAL_NOTCHES, NOTCHES, recommendNotch } from '../../src/core/notch.ts';
import { fmt, type Step } from '../../src/core/steps.ts';
import { editableLength, KG_PER_LB, L_PER_USGAL, M2_PER_SQFT } from '../../src/core/units.ts';
import { count } from '../../src/core/steps.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { SPACE } from '../../src/theme/theme.ts';
import { plural, TileInputs, useUnits } from '../../src/ui/fields.tsx';
import { Card, Field, Notes, Num, PickerRow, Problems, Row, Section, Segmented, Stat, Steps, ToggleRow, Txt } from '../../src/ui/kit.tsx';
import { ToolScreen, useToolInputs } from '../../src/ui/ToolScreen.tsx';

type Mode = 'grout' | 'adhesive' | 'membrane';

export default function MaterialsTool() {
  const app = useApp();
  const u = useUnits();
  const c = app.country;
  const imperial = u.system === 'imperial';
  const [s, set, job] = useToolInputs({
    mode: 'grout', area: '',
    tileId: '', tileL: '', tileW: '', tileT: '', perBox: '', boxArea: '',
    joint: editableLength(c.jointMm.floor, u.system, 'joint'),
    groutId: c.catalogue.grouts[0]?.id ?? '', groutBag: '', groutK: '1.6', groutExtra: '',
    adhId: c.catalogue.adhesives[0]?.id ?? '', adhBag: '', adhRate: '', notch: '', backButter: 'auto', adhExtra: '10',
    wpMode: 'room', roomL: '', roomW: '', showerL: '', showerW: '', showerWalls: '2', door: '', wallH: editableLength(c.membraneHeights.showerWallMm, u.system, 'room'), upturn: editableLength(c.membraneHeights.upturnMm, u.system, 'tile'), wholeFloor: true,
    wpId: c.catalogue.membranes[0]?.id ?? '', wpRate: '', wpCoats: '2', wpPack: '',
  });
  const mode = s.mode as Mode;
  const area = u.parseArea(s.area as string) ?? NaN;
  const tileL = u.parse(s.tileL as string, 'tile') ?? NaN, tileW = u.parse(s.tileW as string, 'tile') ?? NaN;
  const massUnit = imperial ? 'lb' : 'kg';
  const toKg = (v: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? (imperial ? n * KG_PER_LB : n) : NaN; };

  let result: { ok: true; big: string; bigUnit: string; stats: Array<[string, string, string?]>; steps: Step[]; notes: string[] } | { ok: false; problems: Array<{ message: string }> };
  let summary: string[] | null = null;

  if (mode === 'grout') {
    const g = c.catalogue.grouts.find(x => x.id === s.groutId) ?? null;
    const extraDefault = g?.includesWaste ? 0 : 10;
    const r = calcGrout({
      areaM2: area, tileLengthMm: tileL, tileWidthMm: tileW, tileThicknessMm: u.parse(s.tileT as string, 'tile') ?? NaN,
      jointMm: u.parse(s.joint as string, 'joint') ?? NaN, density: g ? g.density : Number(s.groutK), bagKg: g ? g.bagKg : toKg(s.groutBag as string),
      extraPct: (s.groutExtra as string).trim() ? Number(s.groutExtra) : extraDefault, system: u.system,
    });
    result = r.ok ? { ok: true, big: count(r.value.bags), bigUnit: plural('bag', r.value.bags), stats: [['Grout', fmt(imperial ? r.value.kgWithExtra / KG_PER_LB : r.value.kgWithExtra, 1), massUnit], ['Per ' + u.areaUnit, fmt(imperial ? (r.value.kgPerM2 / KG_PER_LB) * M2_PER_SQFT : r.value.kgPerM2, 3), massUnit]], steps: r.steps, notes: [...r.notes, ...(g?.verified === false ? ['This grout\'s own factor isn\'t published: the generic 1.6 kg/L is used. Check the bag\'s coverage chart.'] : []), ...(g?.kind === 'epoxy' ? ['Epoxy densities vary a lot by brand: check the kit\'s chart.'] : [])] } : r;
    if (r.ok) summary = [`${count(r.value.bags)} ${plural('bag', r.value.bags)} grout`, `${fmt(imperial ? r.value.kgWithExtra / KG_PER_LB : r.value.kgWithExtra, 1)} ${massUnit}`];
  } else if (mode === 'adhesive') {
    const a = c.catalogue.adhesives.find(x => x.id === s.adhId) ?? null;
    const list = imperial ? IMPERIAL_NOTCHES : NOTCHES;
    const rec = Number.isFinite(tileL) ? recommendNotch(Math.max(tileL, tileW || 0)) : null;
    const recNotch = rec ? list.reduce((best, n) => (Math.abs(n.mm - rec.mm) < Math.abs(best.mm - rec.mm) ? n : best), list[0]) : null;
    const notch = list.find(n => String(n.mm) === s.notch) ?? recNotch ?? list.find(n => n.mm >= 6) ?? list[0];
    const rate = adhesiveRate(a, notch);
    const customRate = (s.adhRate as string).trim() ? Number(s.adhRate) * (imperial ? KG_PER_LB / M2_PER_SQFT : 1) : null;
    const bb = s.backButter === 'auto' ? !!rec?.backButter : s.backButter === 'yes';
    const r = calcAdhesive({
      areaM2: area, kgPerM2: customRate ?? rate.kgPerM2, notchLabel: notch.label, backButterKgPerM2: bb ? BACK_BUTTER_KG_PER_M2 : 0,
      bagKg: a && !(s.adhBag as string).trim() ? a.bagKg : toKg(s.adhBag as string), extraPct: Number(s.adhExtra), system: u.system,
    });
    const notes = [
      customRate ? 'Using the coverage you typed.' : rate.fromMaker ? 'Using the maker\'s published coverage for this notch.' : `Generic rate (0.45 kg/m² per mm of notch): this product doesn't publish a figure for a ${notch.label} notch.`,
      ...(rec ? [`Suggested notch: ${recNotch?.label}${rec.backButter ? ' plus back-buttering' : ''} (${rec.why.toLowerCase()}). Lift a tile and check the contact.`] : []),
      c.contactRule,
    ];
    result = r.ok ? { ok: true, big: count(r.value.bags), bigUnit: plural('bag', r.value.bags), stats: [[c.terms.adhesive, fmt(imperial ? r.value.kgWithExtra / KG_PER_LB : r.value.kgWithExtra, 1), massUnit]], steps: r.steps, notes } : r;
    if (r.ok) summary = [`${count(r.value.bags)} ${plural('bag', r.value.bags)} ${c.terms.adhesive.toLowerCase()}`, `${notch.label} notch`];
    var notchUI = { list, notch, recNotch };
  } else {
    const m = c.catalogue.membranes.find(x => x.id === s.wpId) ?? null;
    let surfaces: MembraneSurface[] = [];
    let tape = 0;
    let problems: Array<{ message: string }> = [];
    if (s.wpMode === 'room') {
      const w = wetAreaSurfaces({
        roomLengthMm: u.parse(s.roomL as string, 'room') ?? NaN, roomWidthMm: u.parse(s.roomW as string, 'room') ?? NaN,
        showerLengthMm: u.parse(s.showerL as string, 'room') ?? NaN, showerWidthMm: u.parse(s.showerW as string, 'room') ?? NaN,
        showerWalls: Number(s.showerWalls) as 1 | 2 | 3, doorWidthMm: u.parse(s.door as string, 'room', true) ?? 0,
        showerWallHeightMm: u.parse(s.wallH as string, 'room') ?? NaN, upturnMm: u.parse(s.upturn as string, 'tile', true) ?? NaN, wholeFloor: !!s.wholeFloor,
      });
      surfaces = w.surfaces; tape = w.tapeMm; problems = w.problems;
    } else surfaces = [{ label: 'Area', areaM2: area }];
    const rateIn = (s.wpRate as string).trim();
    const litresPerM2PerCoat = rateIn ? (imperial ? L_PER_USGAL / (Number(rateIn) * M2_PER_SQFT) : Number(rateIn)) : m?.litresPerM2PerCoat ?? NaN;
    const packIn = (s.wpPack as string).trim();
    const r = problems.length ? { ok: false as const, problems } : calcMembrane({
      surfaces, litresPerM2PerCoat, coats: rateIn || !m ? Number(s.wpCoats) : m.coats, packLitres: packIn ? Number(packIn) * (imperial ? L_PER_USGAL : 1) : m?.packL ?? NaN,
      primerM2PerLitre: c.extras.primerM2PerLitre, primerPackLitres: null, tapeRunMm: tape, tapeRollMm: c.extras.tapeRollMm, system: u.system, packUnit: rateIn ? 'L' : m?.packUnit ?? 'L',
    });
    result = r.ok ? { ok: true, big: count(r.value.packs), bigUnit: plural('pack', r.value.packs), stats: [[c.terms.membrane, ...(m?.packUnit === 'kg' && !rateIn ? [fmt(imperial ? r.value.litres / KG_PER_LB : r.value.litres, 1), massUnit] as [string, string] : [fmt(imperial ? r.value.litres / L_PER_USGAL : r.value.litres, imperial ? 2 : 1), imperial ? 'gal' : 'L'] as [string, string])], ['Area', u.showArea(r.value.areaM2).split(' ')[0], u.areaUnit], ...(tape ? [['Tape / bond breaker', fmt(imperial ? tape / 304.8 : tape / 1000, 1), imperial ? 'ft' : 'm'] as [string, string, string]] : [])], steps: r.steps, notes: [c.membraneHeights.label, ...(m?.note ? [m.note] : []), 'Coverage is the maker\'s figure for the film thickness the system needs: don\'t thin it out to make a pack go further.'] } : r;
    if (r.ok) summary = [`${count(r.value.packs)} ${plural('pack', r.value.packs)} ${c.terms.membrane.toLowerCase()}`, u.showArea(r.value.areaM2)];
  }

  const grout = c.catalogue.grouts.find(x => x.id === s.groutId) ?? null;
  const adh = c.catalogue.adhesives.find(x => x.id === s.adhId) ?? null;
  const wp = c.catalogue.membranes.find(x => x.id === s.wpId) ?? null;
  const needsTile = mode !== 'membrane';
  const AreaField = <Field label={`Area to ${mode === 'membrane' ? c.terms.waterproofing.toLowerCase() : mode === 'grout' ? 'grout' : 'tile'}`} value={s.area as string} onChangeText={v => set({ area: v })} unit={u.areaUnit} hint="From the Tiles calculator, or measured" />;

  return (
    <ToolScreen tool="materials" title="Materials" inputs={s} job={job} summary={summary} steps={result.ok ? result.steps : []}
      result={result.ok ? (
        <Card>
          <Num value={result.big} unit={`${result.bigUnit} of ${mode === 'grout' ? 'grout' : mode === 'adhesive' ? c.terms.adhesive.toLowerCase() : c.terms.membrane.toLowerCase()}`} size={72} />
          <Row gap={SPACE.lg}>{result.stats.map(([l, v, un]) => <Stat key={l} label={l} value={v} unit={un} />)}</Row>
          <Notes notes={result.notes} />
          <Steps steps={result.steps} />
        </Card>
      ) : <Problems problems={result.problems} />}
    >
      <Segmented label="Material" value={mode} onChange={v => set({ mode: v })} options={[{ id: 'grout', label: 'Grout' }, { id: 'adhesive', label: c.terms.adhesive === 'Thinset' ? 'Thinset' : 'Adhesive' }, { id: 'membrane', label: c.terms.waterproofing }]} />
      {needsTile ? (
        <>
          <Section title="Area">{AreaField}</Section>
          <Section title="Tile">
            <TileInputs value={s as never} onChange={p => set(p)} showBox={false} showThickness={mode === 'grout'} />
          </Section>
        </>
      ) : null}
      {mode === 'grout' ? (
        <Section title="Grout">
          <View style={{ gap: SPACE.sm }}>
            <Field label="Joint width" value={s.joint as string} onChangeText={v => set({ joint: v })} unit={u.unit('joint')} keyboard={u.keyboard} hint="Joint depth = tile thickness" />
            <PickerRow label="Grout" value={grout?.label ?? 'Custom bag'} sub={grout ? `Factor ${fmt(grout.density, 2)} kg/L${grout.includesWaste ? ', wastage included' : ''}` : 'Type the bag size'}
              options={c.catalogue.grouts.map(x => ({ id: x.id, title: x.label, sub: `${x.kind === 'epoxy' ? 'Epoxy' : x.kind === 'sanded' ? 'Sanded' : x.kind === 'unsanded' ? 'Unsanded' : 'Cement'} · factor ${fmt(x.density, 2)} kg/L` }))}
              selected={grout?.id ?? null} onSelect={id => set({ groutId: id ?? '' })} />
            {!grout ? (
              <Row>
                <Field label="Bag size" value={s.groutBag as string} onChangeText={v => set({ groutBag: v })} unit={massUnit} />
                <Field label="Grout factor" value={s.groutK as string} onChangeText={v => set({ groutK: v })} unit="kg/L" hint="1.6 for most cement grouts" />
              </Row>
            ) : null}
            <Field label="Extra for mixing and clean-up" value={s.groutExtra as string} onChangeText={v => set({ groutExtra: v })} unit="%" placeholder={grout?.includesWaste ? '0' : '10'} />
          </View>
        </Section>
      ) : null}
      {mode === 'adhesive' && notchUI! ? (
        <Section title={c.terms.adhesive}>
          <View style={{ gap: SPACE.sm }}>
            <Txt v="footnote" tone="ink2" style={{ fontWeight: '600' }}>Trowel notch (square)</Txt>
            <Segmented label="Trowel notch" value={String(notchUI.notch.mm)} onChange={v => set({ notch: v })} options={notchUI.list.map(n => ({ id: String(n.mm), label: n.label + (notchUI.recNotch?.mm === n.mm ? ' ★' : '') }))} />
            <PickerRow label={c.terms.adhesive} value={adh?.label ?? 'Custom'} sub={adh ? (adh.coverage?.length ? 'Maker\'s coverage by notch' : 'Generic coverage') : 'Type the bag and coverage'}
              options={c.catalogue.adhesives.map(x => ({ id: x.id, title: x.label, sub: x.coverage?.length ? `Coverage for ${x.coverage.length} notch size${x.coverage.length > 1 ? 's' : ''}` : 'Generic coverage' }))}
              selected={adh?.id ?? null} onSelect={id => set({ adhId: id ?? '' })} />
            <Row>
              <Field label="Bag size" value={s.adhBag as string} onChangeText={v => set({ adhBag: v })} unit={massUnit} placeholder={adh ? fmt(imperial ? adh.bagKg / KG_PER_LB : adh.bagKg, 1) : ''} />
              <Field label="Coverage" value={s.adhRate as string} onChangeText={v => set({ adhRate: v })} unit={imperial ? 'lb/sq ft' : 'kg/m²'} hint="Optional, off the bag" />
            </Row>
            <Segmented label="Back-buttering" value={s.backButter as string} onChange={v => set({ backButter: v })} options={[{ id: 'auto', label: 'Back-butter: auto' }, { id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} />
            <Field label="Extra for the bucket and trowel" value={s.adhExtra as string} onChangeText={v => set({ adhExtra: v })} unit="%" />
          </View>
        </Section>
      ) : null}
      {mode === 'membrane' ? (
        <>
          <Section title="What to waterproof">
            <View style={{ gap: SPACE.sm }}>
              <Segmented label="Take-off" value={s.wpMode as string} onChange={v => set({ wpMode: v })} options={[{ id: 'room', label: 'Bathroom with shower' }, { id: 'area', label: 'Just an area' }]} />
              {s.wpMode === 'room' ? (
                <>
                  <Row>
                    <Field label="Room length" value={s.roomL as string} onChangeText={v => set({ roomL: v })} unit={u.unit('room')} keyboard={u.keyboard} />
                    <Field label="Room width" value={s.roomW as string} onChangeText={v => set({ roomW: v })} unit={u.unit('room')} keyboard={u.keyboard} />
                  </Row>
                  <Row>
                    <Field label="Shower length" value={s.showerL as string} onChangeText={v => set({ showerL: v })} unit={u.unit('room')} keyboard={u.keyboard} />
                    <Field label="Shower width" value={s.showerW as string} onChangeText={v => set({ showerW: v })} unit={u.unit('room')} keyboard={u.keyboard} />
                  </Row>
                  <Segmented label="Shower walls" value={s.showerWalls as string} onChange={v => set({ showerWalls: v })} options={[{ id: '1', label: '1 wall' }, { id: '2', label: 'Corner (2)' }, { id: '3', label: 'Alcove (3)' }]} />
                  <Row>
                    <Field label="Shower wall height" value={s.wallH as string} onChangeText={v => set({ wallH: v })} unit={u.unit('room')} keyboard={u.keyboard} />
                    <Field label="Upturn elsewhere" value={s.upturn as string} onChangeText={v => set({ upturn: v })} unit={u.unit('tile')} keyboard={u.keyboard} />
                  </Row>
                  <Field label="Door width" value={s.door as string} onChangeText={v => set({ door: v })} unit={u.unit('room')} keyboard={u.keyboard} />
                  <ToggleRow label="Whole floor" sub="Off = shower floor only" value={!!s.wholeFloor} onChange={v => set({ wholeFloor: v })} />
                </>
              ) : AreaField}
            </View>
          </Section>
          <Section title={c.terms.membrane}>
            <View style={{ gap: SPACE.sm }}>
              <PickerRow label={c.terms.membrane} value={wp?.label ?? 'Custom'} sub={wp ? `${wp.coats} coats${wp.note ? ` · ${wp.note}` : ''}` : 'Type the coverage off the pail'}
                options={c.catalogue.membranes.map(x => ({ id: x.id, title: x.label, sub: x.note ?? `${x.coats} coats` }))}
                selected={wp?.id ?? null} onSelect={id => set({ wpId: id ?? '' })} />
              {!wp ? (
                <Row>
                  <Field label="Coverage per coat" value={s.wpRate as string} onChangeText={v => set({ wpRate: v })} unit={imperial ? 'sq ft/gal' : 'L/m²'} />
                  <Field label="Coats" value={s.wpCoats as string} onChangeText={v => set({ wpCoats: v })} keyboard="number-pad" />
                  <Field label="Pack size" value={s.wpPack as string} onChangeText={v => set({ wpPack: v })} unit={imperial ? 'gal' : 'L'} />
                </Row>
              ) : null}
            </View>
          </Section>
        </>
      ) : null}
    </ToolScreen>
  );
}
