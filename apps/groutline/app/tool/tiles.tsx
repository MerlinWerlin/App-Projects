// Tiles & boxes: the free calculator. Areas minus cut-outs, tile + joint module, waste by layout, boxes to buy.
import { View } from 'react-native';
import { LAYOUT_ORDER, LAYOUTS, type LayoutId } from '../../src/core/layouts.ts';
import { fmt } from '../../src/core/steps.ts';
import { calcTiles, type Rect } from '../../src/core/tiles.ts';
import { editableLength } from '../../src/core/units.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { SPACE } from '../../src/theme/theme.ts';
import { AreaRows, decodeRows, encodeRows } from '../../src/ui/AreaRows.tsx';
import { cap, plural, TileInputs, useUnits } from '../../src/ui/fields.tsx';
import { Card, Field, Notes, Num, Problems, Row, Section, Segmented, Stat, Steps, Txt } from '../../src/ui/kit.tsx';
import { ToolScreen, useToolInputs } from '../../src/ui/ToolScreen.tsx';

export default function TilesTool() {
  const app = useApp();
  const u = useUnits();
  const c = app.country;
  const [s, set, job] = useToolInputs({
    surface: 'floor', rows: encodeRows([{ a: '', b: '', cut: false }]),
    tileId: '', tileL: '', tileW: '', tileT: '', perBox: '', boxArea: '',
    joint: editableLength(c.jointMm.floor, u.system, 'joint'), layout: 'straight', waste: '',
  });
  const surface = s.surface as 'floor' | 'wall';
  const rows = decodeRows(s.rows as string, [{ a: '', b: '', cut: false }]);
  const layout = (LAYOUTS[s.layout as LayoutId] ? s.layout : 'straight') as LayoutId;

  const rects: Rect[] = rows.map(r => ({ widthMm: u.parse(r.a, 'room') ?? NaN, heightMm: u.parse(r.b, 'room') ?? NaN, subtract: r.cut }));
  const waste = (s.waste as string).trim() === '' ? null : Number(s.waste);
  const perBox = (s.perBox as string).trim() ? Number(s.perBox) : null;
  const boxArea = (s.boxArea as string).trim() ? u.parseArea(s.boxArea as string) : null;
  const r = calcTiles({
    rects, tileLengthMm: u.parse(s.tileL as string, 'tile') ?? NaN, tileWidthMm: u.parse(s.tileW as string, 'tile') ?? NaN,
    jointMm: u.parse(s.joint as string, 'joint', true) ?? NaN, layout, wastePct: waste, perBox, boxM2: perBox ? null : boxArea, system: u.system, boxWord: c.terms.box,
  });
  const box = c.terms.box;
  const summary = r.ok ? [`${r.value.tiles} tiles`, ...(r.value.boxes != null ? [`${r.value.boxes} ${plural(box, r.value.boxes)}`] : []), u.showArea(r.value.netM2)] : null;

  return (
    <ToolScreen tool="tiles" inputs={s} job={job} summary={summary} steps={r.ok ? r.steps : []}
      result={r.ok ? (
        <Card>
          <Txt v="footnote" tone="ink2" style={{ fontWeight: '700' }}>TILES TO BUY</Txt>
          <Num value={String(r.value.tiles)} unit="tiles" size={72} />
          <Row gap={SPACE.lg}>
            {r.value.boxes != null ? <Stat label={cap(plural(box, 2))} value={String(r.value.boxes)} /> : null}
            <Stat label="Area to tile" value={u.showArea(r.value.netM2).split(' ')[0]} unit={u.areaUnit} />
            <Stat label="Order incl. waste" value={u.showArea(r.value.orderM2).split(' ')[0]} unit={u.areaUnit} />
          </Row>
          {r.value.boxes == null ? <Txt v="footnote" tone="ink3" style={{ marginTop: SPACE.xs }}>{`Add tiles or ${u.areaUnit} per ${box} to get ${plural(box, 2)}.`}</Txt> : null}
          <Notes notes={r.notes} />
          <Steps steps={r.steps} />
        </Card>
      ) : <Problems problems={r.problems} />}
    >
      <Segmented label="Surface" value={surface} onChange={v => set({ surface: v, joint: editableLength(v === 'wall' ? c.jointMm.wall : c.jointMm.floor, u.system, 'joint') })}
        options={[{ id: 'floor', label: 'Floor' }, { id: 'wall', label: 'Wall' }]} />
      <Section title={surface === 'wall' ? 'Walls' : 'Floor'}>
        <AreaRows rows={rows} onChange={next => set({ rows: encodeRows(next) })} surface={surface} />
      </Section>
      <Section title="Tile">
        <TileInputs value={s as never} onChange={p => set(p)} filter={surface} />
      </Section>
      <Section title="Joint and layout">
        <View style={{ gap: SPACE.sm }}>
          <Row>
            <Field label="Joint width" value={s.joint as string} onChangeText={v => set({ joint: v })} unit={u.unit('joint')} keyboard={u.keyboard} />
            <Field label="Waste" value={s.waste as string} onChangeText={v => set({ waste: v })} unit="%" placeholder={String(LAYOUTS[layout].wastePct)} hint={`Default ${fmt(LAYOUTS[layout].wastePct, 0)}% for ${LAYOUTS[layout].short.toLowerCase()}`} />
          </Row>
          <Segmented label="Layout" value={layout} onChange={v => set({ layout: v })} options={LAYOUT_ORDER.map(id => ({ id, label: LAYOUTS[id].short }))} />
        </View>
      </Section>
    </ToolScreen>
  );
}
