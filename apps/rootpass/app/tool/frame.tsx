import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Line, Polygon } from 'react-native-svg';
import { cornerMitre, polygonFrame, rectFrame, type PolygonSize } from '../../src/core/mitre.ts';
import { fmt, lenShort } from '../../src/core/units.ts';
import { Big, Card, Note, NumField, Row, Section, Segmented, TableRows, Txt, VERIFY, Working } from '../../src/ui/kit.tsx';
import { C, SPACE } from '../../src/ui/theme.ts';
import { ToolScreen, useTool } from '../../src/ui/useTool.tsx';

const DEFAULTS = { kind: 'rect', w: '1200', h: '600', member: '50', measured: 'outside', sides: '6', size: '400', sizeKind: 'outsideSide', corner: '90' };
const LENGTHS = ['w', 'h', 'member', 'size'] as const;

export default function FrameTool() {
  const t = useTool('frame', DEFAULTS, LENGTHS);
  const { width } = useWindowDimensions();
  const U = t.units;
  const kind = t.v.kind as 'rect' | 'polygon' | 'corner';
  const r = useMemo(() => {
    if (kind === 'rect') return rectFrame({ width: t.mm('w'), height: t.mm('h'), member: t.mm('member'), measured: t.v.measured === 'inside' ? 'inside' : 'outside' });
    if (kind === 'polygon') return polygonFrame({ sides: t.num('sides'), width: t.mm('member'), size: t.mm('size'), sizeKind: t.v.sizeKind as PolygonSize });
    return null;
  }, [JSON.stringify(t.v), U]); // eslint-disable-line react-hooks/exhaustive-deps
  const corner = kind === 'corner' ? cornerMitre(t.num('corner')) : null;

  const W = width - SPACE.gutter * 2 - SPACE.lg * 2;
  const polyDrawing = useMemo(() => {
    if (kind !== 'polygon' || !r?.ok) return null;
    const n = t.num('sides');
    const outR = r.value.pieces[0].longPoint / (2 * Math.sin(Math.PI / n));
    const inR = r.value.pieces[0].shortPoint / (2 * Math.sin(Math.PI / n));
    const s = (Math.min(W, 220) / 2 - 4) / outR;
    const c = Math.min(W, 220) / 2;
    const pts = (rad: number) => Array.from({ length: n }, (_, k) => {
      const a = Math.PI / 2 + Math.PI / n + (2 * Math.PI * k) / n;
      return [c + rad * s * Math.cos(a), c - rad * s * Math.sin(a)] as [number, number];
    });
    return { size: Math.min(W, 220), o: pts(outR), i: pts(inR) };
  }, [r, W]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ToolScreen tool="frame" onSave={t.save} jobName={t.jobName}>
      <Segmented value={kind} onChange={t.set('kind')} options={[{ value: 'rect', label: 'Rectangle' }, { value: 'polygon', label: 'Polygon' }, { value: 'corner', label: 'Any corner' }]} />
      {kind === 'rect' ? (
        <Section title="Frame">
          <Row>
            <NumField label="Width" value={t.v.w} onChange={t.set('w')} unit={t.u} invalid={t.invalid('w')} />
            <NumField label="Height" value={t.v.h} onChange={t.set('h')} unit={t.u} invalid={t.invalid('h')} />
          </Row>
          <Segmented label="Those sizes are" value={t.v.measured as 'outside' | 'inside'} onChange={t.set('measured')} options={[{ value: 'outside', label: 'Outside' }, { value: 'inside', label: 'Inside (opening)' }]} />
          <NumField label="Member face width" value={t.v.member} onChange={t.set('member')} unit={t.u} hint="The width you see in the frame face, e.g. 50 for 50 × 25 RHS laid flat." invalid={t.invalid('member')} />
        </Section>
      ) : kind === 'polygon' ? (
        <Section title="Polygon frame">
          <Row>
            <NumField label="Sides" value={t.v.sides} onChange={t.set('sides')} step={1} min={3} integer invalid={t.invalid('sides')} />
            <NumField label="Member face width" value={t.v.member} onChange={t.set('member')} unit={t.u} invalid={t.invalid('member')} />
          </Row>
          <Segmented
            label="Size given as"
            value={t.v.sizeKind as PolygonSize}
            onChange={t.set('sizeKind')}
            options={[{ value: 'outsideSide', label: 'Outside side' }, { value: 'outsideFlats', label: 'Across flats' }, { value: 'outsideCorners', label: 'Across corners' }]}
          />
          <NumField label="Size (outside)" value={t.v.size} onChange={t.set('size')} unit={t.u} invalid={t.invalid('size')} />
        </Section>
      ) : (
        <Section title="Two members meeting at a corner">
          <NumField label="Corner angle" value={t.v.corner} onChange={t.set('corner')} unit="°" step={5} min={1} hint="The angle between the two members, inside the corner." invalid={t.invalid('corner')} />
        </Section>
      )}

      {kind === 'corner' && corner ? (
        !corner.ok ? <Note kind="error">{corner.error}</Note> : (
          <Card>
            <Big label="Mitre each piece" value={`${fmt(corner.value.cutDeg, 2)}°`} sub="off square (saw setting)" tone="accent" />
            <Working steps={corner.steps} />
          </Card>
        )
      ) : r ? (
        !r.ok ? <Note kind="error">{r.error}</Note> : (
          <Card>
            <Row>
              <Big label="Mitre both ends" value={`${fmt(r.value.cutDeg, 2)}°`} sub="off square (saw setting)" tone="accent" />
              <Big label="Total stock" value={lenShort(r.value.totalLongPoint, U)} sub={`${t.u} of long points, before kerf`} />
            </Row>
            {polyDrawing ? (
              <View style={{ alignItems: 'center' }}>
                <Svg width={polyDrawing.size} height={polyDrawing.size}>
                  <Polygon points={polyDrawing.o.map(p => p.join(',')).join(' ')} fill={C.raised} stroke={C.ink3} strokeWidth={1.5} />
                  <Polygon points={polyDrawing.i.map(p => p.join(',')).join(' ')} fill={C.surface} stroke={C.ink3} strokeWidth={1.5} />
                  {polyDrawing.o.map((p, k) => <Line key={k} x1={p[0]} y1={p[1]} x2={polyDrawing.i[k][0]} y2={polyDrawing.i[k][1]} stroke={C.accent} strokeWidth={2.5} />)}
                </Svg>
              </View>
            ) : null}
            <TableRows head={['Piece', 'Qty', 'Long point', 'Short point']} rows={r.value.pieces.map(p => [p.label, p.qty, lenShort(p.longPoint, U), lenShort(p.shortPoint, U)])} />
            <Txt v="small" tone="ink3">Long point = outside edge, short point = inside edge, in {t.u}.</Txt>
            <Working steps={r.steps} />
          </Card>
        )
      ) : null}
      <Note>{VERIFY}</Note>
    </ToolScreen>
  );
}
