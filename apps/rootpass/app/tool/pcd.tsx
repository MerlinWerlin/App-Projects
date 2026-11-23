import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { pcd } from '../../src/core/pcd.ts';
import { pcdTemplate } from '../../src/core/templates.ts';
import { fmt, len, lenShort } from '../../src/core/units.ts';
import { useApp } from '../../src/state/AppState.tsx';
import { Big, Btn, Card, Note, NumField, Row, Section, Segmented, TableRows, Txt, Working } from '../../src/ui/kit.tsx';
import { C, FONT, SPACE } from '../../src/ui/theme.ts';
import { ToolScreen, usePdfExport, useTool } from '../../src/ui/useTool.tsx';

const DEFAULTS = { pcd: '180', holes: '8', layout: 'straddle', rot: '0', hole: '18' };
const LENGTHS = ['pcd', 'hole'] as const;

export default function PcdTool() {
  const app = useApp();
  const t = useTool('pcd', DEFAULTS, LENGTHS, { layout: ['straddle', 'onCentre'] }, { pcd: '7.5', hole: '0.75' });
  const exportPdf = usePdfExport();
  const { width } = useWindowDimensions();
  const U = t.units;
  const input = { pcd: t.mm('pcd'), holes: t.num('holes'), layout: t.v.layout === 'onCentre' ? 'onCentre' as const : 'straddle' as const, extraRotationDeg: t.v.rot.trim() === '' ? 0 : t.num('rot'), holeDia: t.v.hole.trim() === '' ? 0 : t.mm('hole') };
  const r = useMemo(() => pcd(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const S = Math.min(width - SPACE.gutter * 2 - SPACE.lg * 2, 300);

  return (
    <ToolScreen tool="pcd" onSave={t.save} jobName={t.jobName}>
      <Section title="Bolt circle">
        <Row>
          <NumField label="PCD" value={t.v.pcd} onChange={t.set('pcd')} unit={t.u} invalid={t.invalid('pcd')} />
          <NumField label="Holes" value={t.v.holes} onChange={t.set('holes')} integer step={1} min={2} invalid={t.invalid('holes')} />
        </Row>
        <Segmented label="First hole" value={input.layout} onChange={t.set('layout')} options={[{ value: 'straddle', label: 'Straddle centreline' }, { value: 'onCentre', label: 'On 12 o\'clock' }]} />
        <Row>
          <NumField label="Hole size (optional)" value={t.v.hole} onChange={t.set('hole')} unit={t.u} invalid={t.invalid('hole')} />
          <NumField label="Turn by" value={t.v.rot} onChange={t.set('rot')} unit="°" allowNegative invalid={t.invalid('rot')} />
        </Row>
      </Section>
      {!r.ok ? <Note kind="error">{r.error}</Note> : (
        <Card>
          <Row>
            <Big label="Hole to hole" value={len(r.value.chord, U, 2)} sub="centres, neighbours: check with dividers" tone="accent" />
            <Big label="Pitch" value={`${fmt(r.value.pitchDeg, 2)}°`} />
          </Row>
          <View style={{ alignItems: 'center' }} accessible accessibilityLabel={`Drawing of ${input.holes} holes on the bolt circle`}>
            <Svg width={S} height={S}>
              <Line x1={S / 2} y1={6} x2={S / 2} y2={S - 6} stroke={C.line} strokeDasharray="5 4" />
              <Line x1={6} y1={S / 2} x2={S - 6} y2={S / 2} stroke={C.line} strokeDasharray="5 4" />
              <Circle cx={S / 2} cy={S / 2} r={S * 0.36} stroke={C.ink3} strokeDasharray="4 4" fill="none" />
              {r.value.holes.map(h => {
                const k = (S * 0.36) / (input.pcd / 2);
                const hr = input.holeDia ? Math.max(5, (input.holeDia / 2) * k) : 6;
                const x = S / 2 + h.x * k, y = S / 2 - h.y * k;
                const lx = S / 2 + h.x * k * 1.27, ly = S / 2 - h.y * k * 1.27;
                return (
                  <G key={h.n}>
                    <Circle cx={x} cy={y} r={hr} stroke={C.accent} strokeWidth={2.5} fill={C.accentDim} />
                    {(h.n - 1) % Math.max(1, Math.ceil(r.value.holes.length / 24)) === 0 ? <SvgText x={lx} y={ly + 5} fill={C.ink} fontSize={14} fontFamily={FONT.display} textAnchor="middle">{h.n}</SvgText> : null}
                  </G>
                );
              })}
            </Svg>
          </View>
          <TableRows head={['Hole', 'Angle', `X ${t.u}`, `Y ${t.u}`]} rows={r.value.holes.map(h => [h.n, `${fmt(h.angleDeg, 2)}°`, lenShort(h.x, U, 2), lenShort(h.y, U, 2)])} />
          <Txt v="small" tone="ink3">From the centre: X to the right, Y up. Angles clockwise from 12 o'clock.</Txt>
          <Btn
            label="Print drilling template"
            icon="print"
            onPress={() => exportPdf(() => {
              const doc = pcdTemplate(input, U, app.prefs.paper);
              return doc.ok ? { doc: doc.value.doc, fileName: `Bolt circle ${input.holes} on ${fmt(input.pcd, 1)}` } : null;
            })}
          />
          <Working steps={r.steps} />
        </Card>
      )}
      {r.ok ? r.warnings.map(w => <Note key={w} kind="warn">{w}</Note>) : null}
      <Note>Verify before drilling: check the hole-to-hole distance with dividers once the centres are punched.</Note>
    </ToolScreen>
  );
}
