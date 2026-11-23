// Set-out: centre the grid so the edge cuts are even and not slivers; shows the plan and where to strike lines.
import { View } from 'react-native';
import { calcSetout, MODE_NAME, type SetoutMode } from '../../src/core/setout.ts';
import { editableLength, formatLength } from '../../src/core/units.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { SPACE, useTheme } from '../../src/theme/theme.ts';
import { TileInputs, useUnits } from '../../src/ui/fields.tsx';
import { Card, Field, Notes, Num, Problems, Row, Section, Segmented, Stat, Steps, Txt } from '../../src/ui/kit.tsx';
import { SetoutDiagram } from '../../src/ui/SetoutDiagram.tsx';
import { ToolScreen, useToolInputs } from '../../src/ui/ToolScreen.tsx';

type ModeChoice = 'best' | SetoutMode;
const MODES: Array<{ id: ModeChoice; label: string }> = [{ id: 'best', label: 'Best' }, { id: 'joint', label: 'Joint on centre' }, { id: 'tile', label: 'Tile on centre' }, { id: 'wall', label: 'From wall' }];

export default function SetoutTool() {
  const app = useApp();
  const t = useTheme();
  const u = useUnits();
  const [s, set, job] = useToolInputs({
    length: '', width: '', tileId: '', tileL: '', tileW: '', tileT: '', perBox: '', boxArea: '',
    joint: editableLength(app.country.jointMm.floor, u.system, 'joint'), gap: '0', modeX: 'best', modeY: 'best',
  });
  const mode = (v: unknown) => (v === 'best' ? null : (v as SetoutMode));
  const r = calcSetout({
    lengthMm: u.parse(s.length as string, 'room') ?? NaN, widthMm: u.parse(s.width as string, 'room') ?? NaN,
    tileLengthMm: u.parse(s.tileL as string, 'tile') ?? NaN, tileWidthMm: u.parse(s.tileW as string, 'tile') ?? NaN,
    jointMm: u.parse(s.joint as string, 'joint', true) ?? NaN, gapMm: u.parse(s.gap as string, 'joint', true) ?? NaN,
    modeX: mode(s.modeX), modeY: mode(s.modeY), system: u.system,
  });
  const L = (mm: number) => formatLength(mm, u.system, 'tile');
  const cut = (a: number, b: number) => (a || b ? (a === b || !b ? L(a || b) : `${L(a)} / ${L(b)}`) : 'none');
  const summary = r.ok ? [`Cuts ${cut(r.value.x.cutStart, r.value.x.cutEnd)} × ${cut(r.value.y.cutStart, r.value.y.cutEnd)}`, `${r.value.tilesNeeded} tiles on the grid`] : null;
  const firstLine = (p: { pieces: Array<[number, number]>; cutStart: number }) => (p.pieces.length > 1 ? p.pieces[0][1] + (u.parse(s.joint as string, 'joint', true) ?? 0) / 2 : null);

  return (
    <ToolScreen tool="setout" inputs={s} job={job} summary={summary} steps={r.ok ? r.steps : []} intro={`Where to start so the cuts at the walls are even and as big as possible.`}
      result={r.ok ? (
        <Card>
          <Txt v="footnote" tone="ink2" style={{ fontWeight: '700' }}>EDGE CUTS</Txt>
          <Row gap={SPACE.lg}>
            <View><Txt v="footnote" tone="ink2">Along the length</Txt><Num value={cut(r.value.x.cutStart, r.value.x.cutEnd)} size={44} /></View>
            <View><Txt v="footnote" tone="ink2">Across the width</Txt><Num value={cut(r.value.y.cutStart, r.value.y.cutEnd)} size={44} /></View>
          </Row>
          <Txt v="subhead" tone="ink2" style={{ marginTop: 4 }}>{`${MODE_NAME[r.value.x.mode]} (length), ${MODE_NAME[r.value.y.mode].toLowerCase()} (width).`}</Txt>
          <View style={{ marginTop: SPACE.md, marginHorizontal: -SPACE.xs }}>
            <SetoutDiagram x={r.value.x} y={r.value.y} system={u.system} tileX={u.parse(s.tileL as string, 'tile') ?? 0} tileY={u.parse(s.tileW as string, 'tile') ?? 0} />
          </View>
          <View style={{ flexDirection: 'row', gap: SPACE.md, marginTop: 4 }}>
            <Legend color={t.tile} label="Full tile" /><Legend color={t.tileCut} label="Cut" /><Legend color={t.accent} label="Centre line" dashed />
          </View>
          <Row gap={SPACE.lg}>
            <Stat label="Full tiles" value={String(r.value.fullTiles)} />
            <Stat label="Cut pieces" value={String(r.value.cutTiles)} />
            <Stat label="Tiles on grid" value={String(r.value.tilesNeeded)} />
          </Row>
          {firstLine(r.value.x) != null && firstLine(r.value.y) != null ? (
            <Txt v="subhead" style={{ marginTop: SPACE.sm }}>{`First joint lines: ${L(firstLine(r.value.x)!)} from the start wall along the length, ${L(firstLine(r.value.y)!)} from the back wall across.`}</Txt>
          ) : null}
          <Notes notes={r.notes} />
          <Steps steps={r.steps} />
        </Card>
      ) : <Problems problems={r.problems} />}
    >
      <Section title="Area">
        <Row>
          <Field label="Length" value={s.length as string} onChangeText={v => set({ length: v })} unit={u.unit('room')} keyboard={u.keyboard} hint={u.roomHint} />
          <Field label="Width" value={s.width as string} onChangeText={v => set({ width: v })} unit={u.unit('room')} keyboard={u.keyboard} />
        </Row>
      </Section>
      <Section title="Tile">
        <TileInputs value={s as never} onChange={p => set(p)} showBox={false} />
      </Section>
      <Section title="Joints">
        <Row>
          <Field label="Joint width" value={s.joint as string} onChangeText={v => set({ joint: v })} unit={u.unit('joint')} keyboard={u.keyboard} />
          <Field label="Gap at walls" value={s.gap as string} onChangeText={v => set({ gap: v })} unit={u.unit('joint')} keyboard={u.keyboard} hint="Perimeter movement gap" />
        </Row>
      </Section>
      <Section title="Start the length from">
        <Segmented label="Length set-out" value={s.modeX as ModeChoice} onChange={v => set({ modeX: v })} options={MODES} />
      </Section>
      <Section title="Start the width from">
        <Segmented label="Width set-out" value={s.modeY as ModeChoice} onChange={v => set({ modeY: v })} options={MODES} />
      </Section>
    </ToolScreen>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 16, height: dashed ? 3 : 16, borderRadius: 3, backgroundColor: color, borderWidth: dashed ? 0 : 1, borderColor: t.line }} />
      <Txt v="footnote" tone="ink2">{label}</Txt>
    </View>
  );
}
