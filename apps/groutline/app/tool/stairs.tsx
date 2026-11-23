// Stairs & steps: tiles per tread and riser, nosing lengths, and the riser check after the tile build-up.
import { View } from 'react-native';
import { calcStairs } from '../../src/core/stairs.ts';
import { editableLength, formatLength } from '../../src/core/units.ts';
import { count } from '../../src/core/steps.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { SPACE } from '../../src/theme/theme.ts';
import { plural, TileInputs, useUnits } from '../../src/ui/fields.tsx';
import { Card, Field, Notes, Num, Problems, Row, Section, Stat, Steps, ToggleRow, Txt } from '../../src/ui/kit.tsx';
import { ToolScreen, useToolInputs } from '../../src/ui/ToolScreen.tsx';

export default function StairsTool() {
  const app = useApp();
  const u = useUnits();
  const c = app.country;
  const [s, set, job] = useToolInputs({
    steps: '', width: '', going: '', riser: '', tileRisers: true,
    tileId: '', tileL: '', tileW: '', tileT: '', perBox: '', boxArea: '',
    joint: editableLength(c.jointMm.floor, u.system, 'joint'), buildUp: u.system === 'metric' ? '15' : '5/8',
    footRaised: false, landingTiled: true, nosing: editableLength(c.trimStockMm[0], u.system, 'room'),
  });
  const r = calcStairs({
    steps: Number(s.steps), widthMm: u.parse(s.width as string, 'room') ?? NaN, goingMm: u.parse(s.going as string, 'tile') ?? NaN, riserMm: u.parse(s.riser as string, 'tile') ?? NaN,
    tileRisers: !!s.tileRisers, tileLengthMm: u.parse(s.tileL as string, 'tile') ?? NaN, tileWidthMm: u.parse(s.tileW as string, 'tile') ?? NaN,
    jointMm: u.parse(s.joint as string, 'joint', true) ?? NaN, buildUpMm: u.parse(s.buildUp as string, 'joint', true) ?? NaN,
    floorRaisedAtFoot: !!s.footRaised, landingTiled: !!s.landingTiled, nosingStockMm: u.parse(s.nosing as string, 'room') ?? NaN, limits: c.stairs, system: u.system,
  });
  const F = (mm: number) => formatLength(mm, u.system, 'tile');
  const summary = r.ok ? [`${count(r.value.tiles)} tiles`, `${count(r.value.nosingLengths)} nosing ${plural('length', r.value.nosingLengths)}`] : null;
  return (
    <ToolScreen tool="stairs" inputs={s} job={job} summary={summary} steps={r.ok ? r.steps : []}
      intro={c.stairs ? `Checks against ${c.stairs.source}.` : 'No stair rules are set for this country: tile counts only.'}
      result={r.ok ? (
        <Card>
          <Num value={count(r.value.tiles)} unit="tiles for the flight" size={72} />
          <Txt v="footnote" tone="ink3">Each piece counted from its own tile. Add your usual breakage allowance.</Txt>
          <Row gap={SPACE.lg}>
            <Stat label="Per tread" value={count(r.value.tilesPerTread)} />
            {s.tileRisers ? <Stat label="Per riser" value={count(r.value.tilesPerRiser)} /> : null}
            <Stat label="Nosing lengths" value={count(r.value.nosingLengths)} />
          </Row>
          <Row gap={SPACE.lg}>
            <Stat label="Bottom riser" value={F(r.value.bottomRiser)} />
            <Stat label="Top riser" value={F(r.value.topRiser)} />
          </Row>
          {r.value.issues.length ? <Notes notes={r.value.issues} tone="warn" /> : <Notes notes={[c.stairs ? 'Risers and going are inside the limits.' : 'Tile counts only.']} />}
          <Notes notes={r.notes} />
          <Steps steps={r.steps} />
        </Card>
      ) : <Problems problems={r.problems} />}
    >
      <Section title="The stair">
        <View style={{ gap: SPACE.sm }}>
          <Row>
            <Field label="Treads to tile" value={s.steps as string} onChangeText={v => set({ steps: v })} keyboard="number-pad" />
            <Field label="Stair width" value={s.width as string} onChangeText={v => set({ width: v })} unit={u.unit('room')} keyboard={u.keyboard} />
          </Row>
          <Row>
            <Field label="Going (tread depth)" value={s.going as string} onChangeText={v => set({ going: v })} unit={u.unit('tile')} keyboard={u.keyboard} />
            <Field label="Riser height" value={s.riser as string} onChangeText={v => set({ riser: v })} unit={u.unit('tile')} keyboard={u.keyboard} />
          </Row>
          <ToggleRow label="Tile the risers too" value={!!s.tileRisers} onChange={v => set({ tileRisers: v })} />
        </View>
      </Section>
      <Section title="Tile">
        <TileInputs value={s as never} onChange={p => set(p)} showBox={false} filter="floor" />
        <View style={{ height: SPACE.sm }} />
        <Row>
          <Field label="Joint width" value={s.joint as string} onChangeText={v => set({ joint: v })} unit={u.unit('joint')} keyboard={u.keyboard} />
          <Field label="Build-up (tile + bed)" value={s.buildUp as string} onChangeText={v => set({ buildUp: v })} unit={u.unit('joint')} keyboard={u.keyboard} />
        </Row>
      </Section>
      <Section title="Top and bottom">
        <View style={{ gap: SPACE.sm }}>
          <ToggleRow label="Landing tiled the same" sub="Keeps the top riser the same height" value={!!s.landingTiled} onChange={v => set({ landingTiled: v })} />
          <ToggleRow label="Floor at the foot raised the same" sub="Otherwise the bottom riser grows by the build-up" value={!!s.footRaised} onChange={v => set({ footRaised: v })} />
          <Field label="Nosing comes in" value={s.nosing as string} onChangeText={v => set({ nosing: v })} unit={u.unit('room')} keyboard={u.keyboard} />
        </View>
      </Section>
    </ToolScreen>
  );
}
