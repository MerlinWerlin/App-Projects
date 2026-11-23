import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { bendOutline, lobster } from '../../src/core/lobster.ts';
import { mitreTemplate } from '../../src/core/templates.ts';
import { fmt, len, lenShort } from '../../src/core/units.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { Big, Btn, Card, Note, NumField, Row, Section, TableRows, Txt, VerifyNote, Working } from '../../src/ui/kit.tsx';
import { PipeChips } from '../../src/ui/parts.tsx';
import { C, SPACE } from '../../src/ui/theme.ts';
import { ToolScreen, usePdfExport, useTool } from '../../src/ui/useTool.tsx';

const DEFAULTS = { od: '114.3', bend: '90', pieces: '4', radius: '171.5', tangent: '0' };
const LENGTHS = ['od', 'radius', 'tangent'] as const;

export default function LobsterTool() {
  const app = useApp();
  const t = useTool('lobster', DEFAULTS, LENGTHS, {}, { od: '4.5', radius: '6.75' });
  const exportPdf = usePdfExport();
  const { width } = useWindowDimensions();
  const input = { od: t.mm('od'), bendDeg: t.num('bend'), pieces: t.num('pieces'), radius: t.mm('radius'), tangent: t.v.tangent.trim() === '' ? 0 : t.mm('tangent') };
  const r = useMemo(() => lobster(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const U = t.units;

  const drawing = useMemo(() => {
    if (!r.ok) return null;
    const polys = bendOutline(input.od, input.radius, input.bendDeg, input.pieces);
    const pts = polys.flat();
    const minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0]));
    const minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]));
    const W = width - SPACE.gutter * 2 - SPACE.lg * 2;
    const s = Math.min(W / (maxX - minX || 1), 220 / (maxY - minY || 1)) * 0.92;
    const H = (maxY - minY) * s + 12;
    const toS = (p: [number, number]) => `${(p[0] - minX) * s + (W - (maxX - minX) * s) / 2},${H - 6 - (p[1] - minY) * s}`;
    return { W, H, polys: polys.map(p => p.map(toS).join(' ')) };
  }, [r, width]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = r.ok ? (
    <Card>
      <Row>
        <Big label="Cut each face" value={`${fmt(r.value.cutDeg, 2)}°`} sub="off square (saw setting)" tone="accent" />
        <Big label="Welds" value={String(r.value.welds)} sub={`each turns ${fmt(r.value.weldDeg, 2)}°`} />
      </Row>
      {drawing ? (
        <View accessible accessibilityLabel={`Drawing of a ${input.pieces}-piece ${fmt(input.bendDeg, 0)} degree bend`}>
          <Svg width={drawing.W} height={drawing.H}>
            {drawing.polys.map((p, k) => (
              <Polygon key={k} points={p} fill={k === 0 || k === drawing.polys.length - 1 ? C.raised : k % 2 ? '#2C3846' : '#263240'} stroke={C.accent} strokeWidth={2} strokeLinejoin="round" />
            ))}
          </Svg>
        </View>
      ) : null}
      <TableRows
        head={['Piece', 'Qty', 'Long', 'Short']}
        rows={[
          ['End', r.value.end.qty, lenShort(r.value.end.long, U), lenShort(r.value.end.short, U)],
          ...(r.value.middle.qty > 0 ? [['Middle', r.value.middle.qty, lenShort(r.value.middle.long, U), lenShort(r.value.middle.short, U)]] : []),
        ]}
      />
      <Txt v="small" tone="ink3">Long = outside of the bend, short = inside, in {t.u}. End pieces have one square end. Centreline: end {lenShort(r.value.end.centre, U)}, middle {lenShort(r.value.middle.centre, U)}.</Txt>
      <Row>
        <Big label="Pipe needed" value={len(r.value.stockLength, U)} sub="sum of long sides, before kerf" />
      </Row>
      <Btn
        label="Print cut template"
        icon="print"
        onPress={() => exportPdf(() => {
          const doc = mitreTemplate(input, U, app.prefs.paper);
          return doc.ok ? { doc: doc.value.doc, fileName: `Mitre ${fmt(input.od, 1)} OD ${fmt(r.value.cutDeg, 1)}deg` } : null;
        })}
      />
      <Working steps={r.steps} />
    </Card>
  ) : null;

  return (
    <ToolScreen tool="lobster" onSave={t.save} jobName={t.jobName} preview={results}>
      <Section title="Pipe">
        <NumField label="Outside diameter" value={t.v.od} onChange={t.set('od')} unit={t.u} invalid={t.invalid('od')} />
        <PipeChips units={U} selectedMm={input.od} onPick={t.set('od')} />
      </Section>
      <Section title="Bend">
        <Row>
          <NumField label="Bend angle" value={t.v.bend} onChange={t.set('bend')} unit="°" step={15} min={1} invalid={t.invalid('bend')} />
          <NumField label="Pieces" value={t.v.pieces} onChange={t.set('pieces')} step={1} min={2} integer invalid={t.invalid('pieces')} />
        </Row>
        <NumField label="Centreline radius" value={t.v.radius} onChange={t.set('radius')} unit={t.u} hint="1.5 × OD is a long-radius bend." invalid={t.invalid('radius')} />
        <NumField label="Straight on each end (optional)" value={t.v.tangent} onChange={t.set('tangent')} unit={t.u} invalid={t.invalid('tangent')} />
      </Section>

      {!r.ok ? <Note kind="error">{r.error}</Note> : (
        <>
          {results}
          {r.warnings.map(w => <Note key={w} kind="warn">{w}</Note>)}
          <VerifyNote />
        </>
      )}
    </ToolScreen>
  );
}
